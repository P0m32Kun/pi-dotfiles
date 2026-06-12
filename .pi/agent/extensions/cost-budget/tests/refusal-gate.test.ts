import { describe, it, expect } from "vitest";
import { checkRefusalGate } from "../src/refusal-gate";

describe("checkRefusalGate", () => {
  // ─── 简单输入 → 无警告 ──────────────────────────────────────
  it("does not warn on simple greetings", () => {
    const result = checkRefusalGate("Hello");
    expect(result.warn).toBe(false);
    expect(result.complexityScore).toBeLessThan(1.5);
  });

  it("does not warn on short questions", () => {
    const result = checkRefusalGate("What is React?");
    expect(result.warn).toBe(false);
  });

  it("does not warn on empty input", () => {
    const result = checkRefusalGate("");
    expect(result.warn).toBe(false);
  });

  // ─── URL 检测 ───────────────────────────────────────────────
  it("warns on URL input (complexity += 0.5)", () => {
    const result = checkRefusalGate("Please analyze https://github.com/owner/repo");
    // URL alone is 0.5, below 1.5 threshold
    expect(result.reason).toContain("URL");
    expect(result.complexityScore).toBeGreaterThanOrEqual(0.5);
  });

  it("warns strongly when URL + complex keyword combined", () => {
    const result = checkRefusalGate("Please refactor https://github.com/owner/repo");
    expect(result.warn).toBe(true);
    expect(result.complexityScore).toBeGreaterThanOrEqual(1.5);
  });

  // ─── 代码块检测 ─────────────────────────────────────────────
  it("adds complexity for code blocks", () => {
    const result = checkRefusalGate("Here is my code:\n```js\nconsole.log('hi')\n```");
    expect(result.complexityScore).toBeGreaterThanOrEqual(0.3);
  });

  // ─── 复杂关键词检测 ─────────────────────────────────────────
  it("warns on refactor keyword (complexity += 1.0)", () => {
    const result = checkRefusalGate("Please help me refactor the entire codebase");
    expect(result.warn).toBe(true);
    expect(result.reason).toContain("refactor");
    expect(result.complexityScore).toBeGreaterThanOrEqual(1.0);
  });

  it("warns on 重构 keyword", () => {
    const result = checkRefusalGate("请帮我重构整个代码库");
    expect(result.warn).toBe(true);
    expect(result.reason).toContain("重构");
  });

  it("warns on migrate keyword", () => {
    const result = checkRefusalGate("Migrate this project to TypeScript");
    expect(result.warn).toBe(true);
    expect(result.reason).toContain("migrate");
  });

  it("warns on 迁移 keyword", () => {
    const result = checkRefusalGate("把项目迁移到 TypeScript");
    expect(result.warn).toBe(true);
    expect(result.reason).toContain("迁移");
  });

  it("warns on architecture keyword", () => {
    const result = checkRefusalGate("Design the architecture for a new system");
    expect(result.warn).toBe(true);
    expect(result.reason).toContain("architecture");
  });

  it("warns on 架构 keyword", () => {
    const result = checkRefusalGate("设计新系统的架构");
    expect(result.warn).toBe(true);
    expect(result.reason).toContain("架构");
  });

  it("warns on 全栈 keyword", () => {
    const result = checkRefusalGate("做一个全栈项目");
    expect(result.warn).toBe(true);
  });

  it("only counts one keyword (no double-counting)", () => {
    const result = checkRefusalGate("refactor and migrate the architecture");
    // 只匹配第一个关键词，score = 1.0，不会是 3.0
    expect(result.complexityScore).toBeLessThan(2.0);
  });

  // ─── 长度因素 ───────────────────────────────────────────────
  it("adds complexity for very long prompts (2000+ chars)", () => {
    const result = checkRefusalGate("x".repeat(3000));
    expect(result.complexityScore).toBeGreaterThanOrEqual(0.5);
  });

  it("adds more complexity for very long prompts (5000+ chars)", () => {
    const result = checkRefusalGate("x".repeat(6000));
    expect(result.complexityScore).toBeGreaterThanOrEqual(1.0);
  });

  // ─── 组合场景 ───────────────────────────────────────────────
  it("warns strongly on long prompt + keyword combination", () => {
    const prompt = "请重构".repeat(100) + "x".repeat(3000);
    const result = checkRefusalGate(prompt);
    expect(result.warn).toBe(true);
    expect(result.complexityScore).toBeGreaterThanOrEqual(1.5);
  });

  // ─── 建议消息 ───────────────────────────────────────────────
  it("suggests normal proceed for low complexity", () => {
    const result = checkRefusalGate("hello");
    expect(result.suggestion).toBe("Proceed as normal.");
  });

  it("suggests stronger model for high complexity", () => {
    const result = checkRefusalGate("x".repeat(6000) + " refactor the whole thing");
    expect(result.suggestion).toContain("stronger model");
  });

  it("suggests simpler approach for medium complexity", () => {
    const result = checkRefusalGate("refactor this module");
    expect(result.suggestion).toBeDefined();
  });

  // ─── 归一化边界 ─────────────────────────────────────────────
  it("caps complexity score at 3.0", () => {
    // 所有加分项触发：URL(0.5) + 代码块(0.3) + 关键词(1.0) + 长度>5000(1.0) = 2.8, 仍 < 3.0
    const prompt = "https://example.com\n```code```\n" + "refactor ".repeat(200) + "x".repeat(6000);
    const result = checkRefusalGate(prompt);
    expect(result.complexityScore).toBeLessThanOrEqual(3.0);
  });
});

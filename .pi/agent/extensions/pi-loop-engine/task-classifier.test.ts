import { describe, it, expect } from "vitest";
import { classifyTask, buildClassificationPrompt } from "./task-classifier.js";

describe("classifyTask", () => {
  // ── Test tasks → subagent-loop ──────────────────────────────

  it("classifies test coverage tasks as test/subagent-loop", () => {
    const r = classifyTask("补全覆盖率，完善 tagmapper 测试");
    expect(r.category).toBe("test");
    expect(r.strategy).toBe("subagent-loop");
    expect(r.confidence).toBeGreaterThan(0);
  });

  it("classifies E2E test tasks as test/subagent-loop", () => {
    const r = classifyTask("编写 E2E 测试，覆盖完整扫描流程");
    expect(r.category).toBe("test");
    expect(r.strategy).toBe("subagent-loop");
  });

  it("classifies TDD tasks as test/subagent-loop", () => {
    const r = classifyTask("用 TDD 实现新的解析器");
    expect(r.category).toBe("test");
    expect(r.strategy).toBe("subagent-loop");
  });

  // ── Fix tasks → loop ────────────────────────────────────────

  it("classifies bug fix as fix/loop", () => {
    const r = classifyTask("修复这个 bug：scope 检查在 CIDR 边界情况失败");
    expect(r.category).toBe("fix");
    expect(r.strategy).toBe("loop");
  });

  it("classifies error fix as fix/loop", () => {
    const r = classifyTask("fix the test failure in tagmapper");
    expect(r.category).toBe("fix");
    expect(r.strategy).toBe("loop");
  });

  // ── Feature tasks → subagent-loop ───────────────────────────

  it("classifies new feature as feature/subagent-loop", () => {
    const r = classifyTask("实现新的报告导出功能，支持 PDF 格式");
    expect(r.category).toBe("feature");
    expect(r.strategy).toBe("subagent-loop");
  });

  // ── Research tasks → direct ─────────────────────────────────

  it("classifies research as research/direct", () => {
    const r = classifyTask("分析一下 CyberStrikeAI 的架构");
    expect(r.category).toBe("research");
    expect(r.strategy).toBe("direct");
  });

  it("classifies comparison as research/direct", () => {
    const r = classifyTask("对比这两个项目的优劣");
    expect(r.category).toBe("research");
    expect(r.strategy).toBe("direct");
  });

  // ── Simple tasks → direct ───────────────────────────────────

  it("classifies simple rename as simple/direct", () => {
    const r = classifyTask("rename the file to new-name.ts");
    expect(r.category).toBe("simple");
    expect(r.strategy).toBe("direct");
  });

  it("classifies empty input as simple/direct", () => {
    const r = classifyTask("");
    expect(r.category).toBe("simple");
    expect(r.strategy).toBe("direct");
  });

  // ── Refactor tasks → loop ───────────────────────────────────

  it("classifies refactor as refactor/loop", () => {
    const r = classifyTask("重构 scan engine，提取公共接口");
    expect(r.category).toBe("refactor");
    expect(r.strategy).toBe("loop");
  });

  // ── Anti-keyword: feature + simple qualifier ────────────────

  it("does not classify simple feature qualifier as feature", () => {
    const r = classifyTask("简单加一个字段");
    // "简单" is an anti-keyword for feature, so it should fall through
    // to another category or default
    expect(r.strategy).not.toBe("subagent-loop");
  });
});

describe("buildClassificationPrompt", () => {
  it("returns empty for direct strategy", () => {
    const prompt = buildClassificationPrompt({
      category: "simple",
      strategy: "direct",
      confidence: 1.0,
      reasons: [],
    });
    expect(prompt).toBe("");
  });

  it("returns loop rules for loop strategy", () => {
    const prompt = buildClassificationPrompt({
      category: "fix",
      strategy: "loop",
      confidence: 0.8,
      reasons: ["匹配关键词"],
      suggestedAcceptance: ["测试通过"],
    });
    expect(prompt).toContain("Loop Engineering");
    expect(prompt).toContain("fix");
    expect(prompt).toContain("测试通过");
  });

  it("returns subagent rules for subagent-loop strategy", () => {
    const prompt = buildClassificationPrompt({
      category: "test",
      strategy: "subagent-loop",
      confidence: 0.9,
      reasons: ["匹配关键词"],
      suggestedAcceptance: ["覆盖率 ≥ 90%"],
    });
    expect(prompt).toContain("Subagent + Loop Engineering");
    expect(prompt).toContain("test");
    expect(prompt).toContain("覆盖率 ≥ 90%");
  });
});

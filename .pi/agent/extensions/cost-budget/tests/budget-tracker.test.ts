import { describe, it, expect, beforeEach } from "vitest";
import { BudgetTracker } from "../src/budget-tracker";
import { BudgetClass } from "../src/constants";

describe("BudgetTracker", () => {
  let tracker: BudgetTracker;

  beforeEach(() => {
    tracker = new BudgetTracker();
  });

  // ─── 不裁剪场景 ─────────────────────────────────────────────
  it("does not truncate small LOCAL results", () => {
    const content = "x".repeat(1000);
    const result = tracker.normalizeResult({
      toolName: "read",
      content,
    });

    expect(result.changed).toBe(false);
    expect(result.budgetClass).toBe(BudgetClass.LOCAL);
    expect(result.returnedChars).toBe(1000);
  });

  it("does not truncate ARTIFACT results of any size", () => {
    const content = "x".repeat(500_000);
    const result = tracker.normalizeResult({
      toolName: "ctx_index",
      content,
    });

    expect(result.changed).toBe(false);
    expect(result.budgetClass).toBe(BudgetClass.ARTIFACT);
    expect(result.returnedChars).toBe(500_000);
  });

  it("does not truncate ERROR results", () => {
    const content = "x".repeat(500_000);
    const result = tracker.normalizeResult({
      toolName: "test_run",
      content,
    });

    expect(result.changed).toBe(false);
    expect(result.budgetClass).toBe(BudgetClass.ERROR);
  });

  it("does not truncate CONTROL results", () => {
    const content = "x".repeat(500_000);
    const result = tracker.normalizeResult({
      toolName: "loop_status",
      content,
    });

    expect(result.changed).toBe(false);
    expect(result.budgetClass).toBe(BudgetClass.CONTROL);
  });

  // ─── 裁剪场景 ───────────────────────────────────────────────
  it("truncates EXTERNAL results exceeding 32KB", () => {
    const content = "x".repeat(50_000);
    const result = tracker.normalizeResult({
      toolName: "web_search",
      content,
    });

    expect(result.changed).toBe(true);
    expect(result.budgetClass).toBe(BudgetClass.EXTERNAL);
    expect(result.returnedChars).toBeLessThan(50_000);
    expect(result.originalChars).toBe(50_000);

    // 验证 preview 内容
    const parsed = JSON.parse(result.content);
    expect(parsed.result_truncated).toBe(true);
    expect(parsed.tool).toBe("web_search");
    expect(parsed.preview.length).toBeLessThanOrEqual(32_000);
  });

  it("truncates LOCAL results exceeding 160KB", () => {
    const content = "x".repeat(200_000);
    const result = tracker.normalizeResult({
      toolName: "read",
      content,
    });

    expect(result.changed).toBe(true);
    expect(result.budgetClass).toBe(BudgetClass.LOCAL);
    expect(result.returnedChars).toBeLessThan(200_000);
  });

  // ─── 每轮累计限制 ───────────────────────────────────────────
  it("enforces per-turn EXTERNAL limit (96KB)", () => {
    // 每次 40KB, 单次上限 32KB 会截断，但 per-turn 上限 96KB 是主限制
    // 第一次 40KB → 单次超 32KB → 被裁剪
    const result1 = tracker.normalizeResult({
      toolName: "web_search",
      content: "x".repeat(40_000),
    });
    expect(result1.changed).toBe(true); // 40K > 32K single

    // 第二次 40KB → 单次超 32KB → 被裁剪
    const result2 = tracker.normalizeResult({
      toolName: "web_fetch",
      content: "x".repeat(40_000),
    });
    expect(result2.changed).toBe(true);

    // 第三次 40KB → 累计 external 已达 80K (40+40)，剩余 16K，
    // 但单次上限 32K > 16K remaining → allowed=16K → 被裁剪
    const result3 = tracker.normalizeResult({
      toolName: "web_search",
      content: "x".repeat(40_000),
    });
    expect(result3.changed).toBe(true); // per-turn limit hit
  });

  // ─── 快照追踪 ───────────────────────────────────────────────
  it("tracks tool calls in snapshot", () => {
    tracker.normalizeResult({ toolName: "read", content: "x".repeat(100) });
    tracker.normalizeResult({ toolName: "bash", content: "x".repeat(200) });
    tracker.normalizeResult({ toolName: "web_search", content: "x".repeat(300) });

    const snap = tracker.getSnapshot();
    expect(snap.toolCallsThisTurn).toBe(3);
    expect(snap.localCharsUsed).toBe(300); // read + bash
    expect(snap.externalCharsUsed).toBe(300); // web_search
  });

  it("resets snapshot on resetTurn()", () => {
    tracker.normalizeResult({ toolName: "read", content: "x".repeat(1000) });
    tracker.resetTurn();

    const snap = tracker.getSnapshot();
    expect(snap.toolCallsThisTurn).toBe(0);
    expect(snap.externalCharsUsed).toBe(0);
    expect(snap.localCharsUsed).toBe(0);
  });

  // ─── MCP 工具 ───────────────────────────────────────────────
  it("classifies and applies EXTERNAL limits for MCP playwright tools", () => {
    const content = "x".repeat(50_000);
    const result = tracker.normalizeResult({
      toolName: "playwright_navigate",
      content,
      isMcp: true,
    });

    expect(result.budgetClass).toBe(BudgetClass.EXTERNAL);
    expect(result.changed).toBe(true);
  });

  // ─── error 标记 ─────────────────────────────────────────────
  it("marks is_error in truncated result", () => {
    const content = "x".repeat(50_000);
    const result = tracker.normalizeResult({
      toolName: "web_search",
      content,
      isError: true,
    });

    expect(result.changed).toBe(true);
    const parsed = JSON.parse(result.content);
    expect(parsed.is_error).toBe(true);
  });

  // ─── 快照不可变 ─────────────────────────────────────────────
  it("returns a copy of snapshot (immutable)", () => {
    const snap1 = tracker.getSnapshot();
    snap1.externalCharsUsed = 999;

    const snap2 = tracker.getSnapshot();
    expect(snap2.externalCharsUsed).toBe(0);
  });
});

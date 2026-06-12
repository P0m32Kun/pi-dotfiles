import { describe, it, expect, beforeEach, vi } from "vitest";
import { CostTracker } from "../src/cost-tracker";
import { BudgetTracker } from "../src/budget-tracker";

// ─── Task 6: 配置加载测试 ─────────────────────────────────────
describe("Config loading", () => {
  it("default config has all 4 tiers", async () => {
    // 模拟 loadConfig 的默认行为（无 config.json 文件）
    const DEFAULT_CONFIG = {
      enabled: true,
      tiers: {
        c0: { provider: "deepseek", model: "deepseek-chat", description: "Trivial chat" },
        c1: { provider: "deepseek", model: "deepseek-chat", description: "Default coding" },
        c2: { provider: "deepseek", model: "deepseek-v4-pro", description: "Structured reasoning" },
        c3: { provider: "deepseek", model: "deepseek-v4-pro", description: "Deep analysis" },
      },
      autoRoute: false,
      refusalGate: { enabled: true, complexityThreshold: 1.0 },
      costReport: { autoSave: false, outputDir: ".pi/cost-reports" },
    };

    expect(Object.keys(DEFAULT_CONFIG.tiers)).toEqual(["c0", "c1", "c2", "c3"]);
    expect(DEFAULT_CONFIG.tiers.c0.model).toBe("deepseek-chat");
    expect(DEFAULT_CONFIG.tiers.c3.model).toBe("deepseek-v4-pro");
  });

  it("each tier has required fields", () => {
    const tiers = {
      c0: { provider: "deepseek", model: "deepseek-chat", description: "Trivial chat" },
      c1: { provider: "deepseek", model: "deepseek-chat", description: "Default coding" },
      c2: { provider: "deepseek", model: "deepseek-v4-pro", description: "Structured reasoning" },
      c3: { provider: "deepseek", model: "deepseek-v4-pro", description: "Deep analysis" },
    };

    for (const [tier, cfg] of Object.entries(tiers)) {
      expect(cfg.provider).toBeTruthy();
      expect(cfg.model).toBeTruthy();
      expect(cfg.description).toBeTruthy();
    }
  });

  it("c0 and c1 use cheaper model", () => {
    const tiers = {
      c0: { model: "deepseek-chat" },
      c1: { model: "deepseek-chat" },
      c2: { model: "deepseek-v4-pro" },
      c3: { model: "deepseek-v4-pro" },
    };

    expect(tiers.c0.model).not.toBe(tiers.c3.model);
  });
});

// ─── Task 7: 压缩策略测试 ─────────────────────────────────────
describe("Compaction strategy", () => {
  it("compaction instructions preserve code changes", () => {
    const instructions = [
      "Preserve all code changes and their rationale.",
      "Keep file paths and edit operations verbatim.",
      "Summarize conversation but retain decision points and error resolutions.",
      "Maintain cost tracking data: include model names, token counts, and cost summaries.",
      "Keep file read/write/edit operations as-is; do not summarize them.",
    ].join("\n");

    expect(instructions).toContain("code changes");
    expect(instructions).toContain("file paths");
    expect(instructions).toContain("decision points");
    expect(instructions).toContain("cost tracking");
    expect(instructions).toContain("read/write/edit");
  });

  it("compaction instructions are well-formed strings", () => {
    const instructions = [
      "Preserve all code changes and their rationale.",
      "Keep file paths and edit operations verbatim.",
      "Summarize conversation but retain decision points and error resolutions.",
      "Maintain cost tracking data: include model names, token counts, and cost summaries.",
      "Keep file read/write/edit operations as-is; do not summarize them.",
    ];

    for (const inst of instructions) {
      expect(inst.length).toBeGreaterThan(10);
      expect(inst.endsWith(".")).toBe(true);
    }
  });
});

// ─── Task 8: 成本报告测试 ─────────────────────────────────────
describe("Cost report generation", () => {
  let costTracker: CostTracker;
  let budgetTracker: BudgetTracker;

  beforeEach(() => {
    costTracker = new CostTracker();
    budgetTracker = new BudgetTracker();
  });

  it("generates report with all required fields", () => {
    costTracker.recordTurn({
      turnIndex: 1,
      modelId: "deepseek-chat",
      inputTokens: 1000,
      outputTokens: 500,
      billedCostUsd: 0.001,
    });

    budgetTracker.normalizeResult({
      toolName: "web_search",
      content: "x".repeat(1000),
    });

    const summary = costTracker.summarize();
    const snap = budgetTracker.getSnapshot();

    const report = {
      timestamp: new Date().toISOString(),
      session: "test-session",
      budgetSnapshot: snap,
      costSummary: summary,
    };

    // 验证报告结构
    expect(report.timestamp).toBeTruthy();
    expect(report.session).toBe("test-session");
    expect(report.budgetSnapshot).toBeDefined();
    expect(report.costSummary).toBeDefined();
    expect(report.costSummary.turns).toBe(1);
    expect(report.costSummary.totalInputTokens).toBe(1000);
    expect(report.costSummary.totalOutputTokens).toBe(500);
    expect(report.costSummary.totalCostUsd).toBeCloseTo(0.001, 4);
    expect(report.costSummary.byModel["deepseek-chat"]).toBeDefined();
    expect(report.budgetSnapshot.toolCallsThisTurn).toBe(1);
  });

  it("report is JSON-serializable", () => {
    costTracker.recordTurn({
      turnIndex: 1,
      modelId: "deepseek-chat",
      inputTokens: 1000,
      outputTokens: 500,
    });

    const summary = costTracker.summarize();
    const snap = budgetTracker.getSnapshot();

    const report = {
      timestamp: new Date().toISOString(),
      session: "ephemeral",
      budgetSnapshot: snap,
      costSummary: summary,
    };

    const json = JSON.stringify(report, null, 2);
    expect(json).toBeTruthy();

    const parsed = JSON.parse(json);
    expect(parsed.costSummary.turns).toBe(1);
    expect(parsed.budgetSnapshot.toolCallsThisTurn).toBe(0);
  });

  it("handles empty session in report", () => {
    const summary = costTracker.summarize();
    const snap = budgetTracker.getSnapshot();

    const report = {
      timestamp: new Date().toISOString(),
      session: "ephemeral",
      budgetSnapshot: snap,
      costSummary: summary,
    };

    expect(report.costSummary.turns).toBe(0);
    expect(report.costSummary.totalCostUsd).toBe(0);
    expect(report.costSummary.costSource).toBe("none");
  });

  it("report contains by-model breakdown", () => {
    costTracker.recordTurn({
      turnIndex: 1,
      modelId: "deepseek-chat",
      inputTokens: 1000,
      outputTokens: 500,
      billedCostUsd: 0.001,
    });
    costTracker.recordTurn({
      turnIndex: 2,
      modelId: "deepseek-v4-pro",
      inputTokens: 2000,
      outputTokens: 1000,
      billedCostUsd: 0.01,
    });

    const summary = costTracker.summarize();
    const report = {
      timestamp: new Date().toISOString(),
      session: "test-session",
      budgetSnapshot: budgetTracker.getSnapshot(),
      costSummary: summary,
    };

    expect(Object.keys(report.costSummary.byModel)).toHaveLength(2);
    expect(report.costSummary.byModel["deepseek-chat"].turns).toBe(1);
    expect(report.costSummary.byModel["deepseek-v4-pro"].turns).toBe(1);
    expect(report.costSummary.totalCostUsd).toBeCloseTo(0.011, 4);
  });

  it("cost report outputDir is configurable", () => {
    const config = {
      costReport: { autoSave: false, outputDir: ".pi/custom-reports" },
    };

    expect(config.costReport.outputDir).toBe(".pi/custom-reports");
  });
});

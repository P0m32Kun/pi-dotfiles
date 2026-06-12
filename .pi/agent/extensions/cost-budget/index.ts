/**
 * cost-budget extension — 借鉴 OpenSquilla 成本节约方案的 pi 扩展
 *
 * 功能：
 * 1. 上下文预算分类 (EXTERNAL/LOCAL/ARTIFACT/ERROR/CONTROL)
 * 2. 工具输出配额执行 (tool_result 拦截 + 裁剪)
 * 3. 智能路由拒绝门控 (input 拦截 + 复杂度检测)
 * 4. 会话成本追踪 (/cost 命令)
 * 5. 任务复杂度分类 (/complexity 命令 + before_agent_start 注入)
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { BudgetTracker } from "./src/budget-tracker";
import { BudgetClass } from "./src/constants";
import { checkRefusalGate } from "./src/refusal-gate";
import { CostTracker } from "./src/cost-tracker";
import { classifyComplexity, tierToModelConfig } from "./src/complexity-classifier";
import type { ComplexityTier } from "./src/types";

interface TierConfig {
  provider: string;
  model: string;
  description: string;
  maxCostPerTurn?: number;
}

interface CostBudgetConfig {
  enabled: boolean;
  tiers: Record<ComplexityTier, TierConfig>;
  autoRoute: boolean;
  refusalGate: { enabled: boolean; complexityThreshold: number };
  costReport: { autoSave: boolean; outputDir: string };
}

const DEFAULT_CONFIG: CostBudgetConfig = {
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

async function loadConfig(cwd: string): Promise<CostBudgetConfig> {
  try {
    const configPath = join(cwd, ".pi/extensions/cost-budget/config.json");
    const raw = await readFile(configPath, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export default function (pi: ExtensionAPI) {
  const budgetTracker = new BudgetTracker();
  const costTracker = new CostTracker();
  let turnIndex = 0;
  let config: CostBudgetConfig = DEFAULT_CONFIG;

  // ═══════════════════════════════════════════════════════════
  // Task 6 — 会话启动时加载配置
  // 对齐 OpenSquilla 的 config 层级解析
  // ═══════════════════════════════════════════════════════════
  pi.on("session_start", async (_event, ctx) => {
    config = await loadConfig(ctx.cwd);

    if (config.autoRoute && ctx.hasUI) {
      ctx.ui.setStatus("cost-budget", "Auto-route enabled");
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Phase 1 — 每轮预算重置
  // ═══════════════════════════════════════════════════════════
  pi.on("turn_start", async () => {
    budgetTracker.resetTurn();
    turnIndex++;
  });

  // ═══════════════════════════════════════════════════════════
  // Phase 2 — 工具输出配额执行 (tool_result 拦截)
  // 对齐 OpenSquilla 的 ToolResultBudgetTracker
  // ═══════════════════════════════════════════════════════════
  pi.on("tool_result", async (event, ctx) => {
    let textContent: string;
    if (typeof event.content === "string") {
      textContent = event.content;
    } else if (Array.isArray(event.content)) {
      textContent = event.content
        .filter((c: any) => c?.type === "text")
        .map((c: any) => (c as any).text)
        .join("\n");
    } else {
      textContent = String(event.content ?? "");
    }

    const decision = budgetTracker.normalizeResult({
      toolName: event.toolName,
      content: textContent,
      isMcp: !!(event.input as any)?.mcpServer,
      isError: event.isError,
    });

    if (decision.changed) {
      const saved = decision.originalChars - decision.returnedChars;
      const className =
        decision.budgetClass === BudgetClass.EXTERNAL ? "EXTERNAL" : "LOCAL";

      if (ctx.hasUI) {
        ctx.ui.setStatus(
          "cost-budget",
          `[${className}] trimmed ${(saved / 1024).toFixed(0)}KB`
        );
      }

      return {
        content: decision.content,
        details: {
          ...(event.details || {}),
          budget_decision: {
            budget_class: decision.budgetClass,
            original_chars: decision.originalChars,
            returned_chars: decision.returnedChars,
            truncated: decision.changed,
          },
        },
      };
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Phase 3 — 智能路由拒绝门控 (input 拦截)
  // 对齐 OpenSquilla 的 smart_routing.should_refuse()
  // ═══════════════════════════════════════════════════════════
  pi.on("input", async (event, ctx) => {
    if (event.source === "extension") return { action: "continue" };

    const gate = checkRefusalGate(event.text);

    if (gate.warn && ctx.hasUI) {
      const proceed = await ctx.ui.confirm(
        "Complex Task Detected",
        `${gate.reason}\n\n${gate.suggestion}\n\nProceed anyway?`
      );
      if (!proceed) {
        return { action: "handled" };
      }
    }

    return { action: "continue" };
  });

  // ═══════════════════════════════════════════════════════════
  // Phase 4 — 会话成本追踪 (agent_end 事件)
  // 对齐 OpenSquilla 的 cost_rollup.py
  // ═══════════════════════════════════════════════════════════
  pi.on("agent_end", async (event, ctx) => {
    const usage = (event.message as any)?.usage;
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    const cacheReadTokens = usage?.cacheReadInputTokens ?? 0;
    const cacheWriteTokens = usage?.cacheCreationInputTokens ?? 0;
    const billedCost = usage?.cost?.total ?? 0;
    const modelId = (event.message as any)?.model ?? "unknown";

    const turn = costTracker.recordTurn({
      turnIndex,
      modelId,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      billedCostUsd: billedCost,
    });

    if (turn.costUsd > 0 && ctx.hasUI) {
      ctx.ui.setStatus(
        "cost",
        `$${turn.costUsd.toFixed(4)} (${turn.source})`
      );
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Phase 5 — 复杂度分类注入 (before_agent_start)
  // 对齐 OpenSquilla 的 SquillaRouter 后处理逻辑
  // ═══════════════════════════════════════════════════════════
  pi.on("before_agent_start", async (event, ctx) => {
    const result = classifyComplexity(event.prompt);
    const modelConfig = tierToModelConfig(result.tier);

    const routingHint = [
      ``,
      `## Task Complexity (auto-classified)`,
      `Tier: ${result.tier} (score: ${result.score.toFixed(1)})`,
      `Reasons: ${result.reasons.join(", ")}`,
      `Recommended model: ${modelConfig.recommendedModel}`,
    ].join("\n");

    return {
      systemPrompt: (event.systemPrompt || "") + routingHint,
    };
  });

  // ═══════════════════════════════════════════════════════════
  // 命令：/budget — 查看当前回合预算
  // ═══════════════════════════════════════════════════════════
  pi.registerCommand("budget", {
    description: "View current turn budget usage",
    handler: async (_args, ctx) => {
      const snap = budgetTracker.getSnapshot();
      const lines = [
        `Turn #${snap.toolCallsThisTurn}`,
        `External: ${(snap.externalCharsUsed / 1024).toFixed(0)}KB`,
        `Local: ${(snap.localCharsUsed / 1024).toFixed(0)}KB`,
        `Total: ${((snap.externalCharsUsed + snap.localCharsUsed) / 1024).toFixed(0)}KB`,
      ];
      ctx.ui.notify(lines.join(" | "), "info");
    },
  });

  // ═══════════════════════════════════════════════════════════
  // 命令：/cost — 查看会话成本
  // ═══════════════════════════════════════════════════════════
  pi.registerCommand("cost", {
    description: "Show session cost breakdown",
    handler: async (_args, ctx) => {
      const summary = costTracker.summarize();

      if (summary.turns === 0) {
        ctx.ui.notify("No turns recorded yet.", "info");
        return;
      }

      const lines = [
        `Session Cost Summary`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Source: ${summary.costSource}`,
        `Turns:  ${summary.turns}`,
        `Input:  ${(summary.totalInputTokens / 1000).toFixed(0)}K tokens`,
        `Output: ${(summary.totalOutputTokens / 1000).toFixed(0)}K tokens`,
        `Cache Read:  ${(summary.totalCacheReadTokens / 1000).toFixed(0)}K tokens`,
        `Cache Write: ${(summary.totalCacheWriteTokens / 1000).toFixed(0)}K tokens`,
        `Cost:   $${summary.totalCostUsd.toFixed(4)}`,
        ``,
        `By Model:`,
      ];

      for (const [model, stats] of Object.entries(summary.byModel)) {
        lines.push(
          `  ${model}: ${stats.turns} turns, ${(stats.inputTokens / 1000).toFixed(0)}K in, $${stats.costUsd.toFixed(4)}`
        );
      }

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // ═══════════════════════════════════════════════════════════
  // 命令：/complexity — 测试复杂度分类器
  // ═══════════════════════════════════════════════════════════
  pi.registerCommand("complexity", {
    description: "Classify the complexity of a prompt",
    handler: async (args, ctx) => {
      const prompt = args || "hello world";
      const result = classifyComplexity(prompt);
      const modelConfig = tierToModelConfig(result.tier);
      const tierCfg = config.tiers[result.tier];

      ctx.ui.notify(
        [
          `Complexity Analysis`,
          `━━━━━━━━━━━━━━━━━━━━`,
          `Tier:    ${result.tier}`,
          `Score:   ${result.score.toFixed(1)}`,
          `Reasons: ${result.reasons.join(", ")}`,
          `Model:   ${tierCfg ? tierCfg.provider + "/" + tierCfg.model : modelConfig.recommendedModel}`,
        ].join("\n"),
        "info"
      );
    },
  });

  // ═══════════════════════════════════════════════════════════
  // Task 7 — 压缩策略增强
  // 对齐 OpenSquilla 的 CompactionConfig
  // ═══════════════════════════════════════════════════════════
  pi.on("session_before_compact", async (event, ctx) => {
    const customInstructions = [
      "Preserve all code changes and their rationale.",
      "Keep file paths and edit operations verbatim.",
      "Summarize conversation but retain decision points and error resolutions.",
      "Maintain cost tracking data: include model names, token counts, and cost summaries.",
      "Keep file read/write/edit operations as-is; do not summarize them.",
    ].join("\n");

    return { customInstructions };
  });

  pi.on("session_compact", async (_event, ctx) => {
    if (ctx.hasUI) {
      ctx.ui.notify("Context compacted — older messages summarized", "info");
      ctx.ui.setStatus("cost-budget", "compacted");
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Task 8 — 成本报告仪表板
  // 对齐 OpenSquilla 的 cost CLI
  // ═══════════════════════════════════════════════════════════
  pi.registerCommand("cost-report", {
    description: "Export session cost report as JSON",
    handler: async (_args, ctx) => {
      const summary = costTracker.summarize();
      const report = {
        timestamp: new Date().toISOString(),
        session: ctx.sessionManager.getSessionFile() ?? "ephemeral",
        budgetSnapshot: budgetTracker.getSnapshot(),
        costSummary: summary,
      };

      const outputDir = join(ctx.cwd, config.costReport.outputDir);
      const reportPath = join(outputDir, `cost-${Date.now()}.json`);

      try {
        await mkdir(outputDir, { recursive: true });
        await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");
        if (ctx.hasUI) {
          ctx.ui.notify(`Report saved to ${reportPath}`, "info");
        }
      } catch (err: any) {
        if (ctx.hasUI) {
          ctx.ui.notify(`Failed to save report: ${err.message}`, "error");
        }
      }
    },
  });
}

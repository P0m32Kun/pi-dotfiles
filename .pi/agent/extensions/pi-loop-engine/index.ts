/**
 * pi-loop-engine — Iterative retry extension for pi-coding-agent.
 *
 * Detects tool failures (test, build, lint, runtime, edit) and automatically
 * triggers retries with failure context injected into the next LLM call.
 *
 * Hooks used:
 *   before_agent_start — inject loop rules into system prompt
 *   tool_result        — detect failures from tool output
 *   turn_end           — evaluate pending failures, trigger retry or escalate
 *   context            — inject failure history into next LLM call
 *
 * Registered:
 *   tool:    loop_status  — query loop engine state
 *   command: /loop-config — view/modify loop config at runtime
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import type { FailureCategory, FailureRecord } from "./detectors.js";
import { DEFAULT_DETECTORS, detectFailure } from "./detectors.js";
import {
  getLoopState,
  resetLoopState,
  getRetryCount,
  recordAttempt,
  recordFailure,
  hasPendingFailures,
  popPendingFailure,
  getAttemptHistory,
  formatLoopStatus,
} from "./loop-state.js";
import {
  buildLoopRulesPrompt,
  buildRetryMessage,
  buildContextInjection,
  buildEscalationMessage,
} from "./context-injector.js";
import { classifyTask, buildClassificationPrompt } from "./task-classifier.js";

// ── Config types ──────────────────────────────────────────────

interface LoopConfig {
  enabled: boolean;
  maxRetries: Record<FailureCategory, number>;
  strategy: "immediate" | "backoff" | "adaptive";
  contextInjection: {
    includeFailureHistory: boolean;
    includePreviousAttempts: boolean;
    maxHistoryItems: number;
  };
  escalation: {
    action: "notify" | "ask" | "stop";
  };
  exclude: {
    tools: string[];
    patterns: string[];
  };
}

// ── Defaults ──────────────────────────────────────────────────

const DEFAULT_CONFIG: LoopConfig = {
  enabled: true,
  maxRetries: {
    test: 3,
    build: 2,
    lint: 2,
    runtime: 2,
    edit: 2,
    custom: 1,
  },
  strategy: "immediate",
  contextInjection: {
    includeFailureHistory: true,
    includePreviousAttempts: true,
    maxHistoryItems: 3,
  },
  escalation: {
    action: "ask",
  },
  exclude: {
    tools: [],
    patterns: [],
  },
};

// ── Helpers ───────────────────────────────────────────────────

function getTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part: any) => {
      if (part && typeof part === "object" && part.type === "text" && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .join("\n")
    .trim();
}

function isExcluded(
  exclude: LoopConfig["exclude"],
  toolName: string,
  output: string,
): boolean {
  if (exclude.tools.includes(toolName)) return true;
  for (const pattern of exclude.patterns) {
    try {
      if (new RegExp(pattern, "i").test(output)) return true;
    } catch {
      // invalid regex, skip
    }
  }
  return false;
}

// ── Extension entry ───────────────────────────────────────────

export default function loopEngineExtension(pi: ExtensionAPI) {
  // Load config (merge with defaults)
  let config: LoopConfig = { ...DEFAULT_CONFIG };
  let pendingContextInjection: {
    failure: FailureRecord;
    attempt: number;
    maxAttempts: number;
    history: FailureRecord[];
  } | null = null;

  // ── Register tool: loop_status ──────────────────────────────

  pi.registerTool({
    name: "loop_status",
    label: "Loop Status",
    description:
      "查看当前 loop engine 状态、重试历史和配置。用于调试和监控。",
    parameters: Type.Object({
      action: Type.Optional(
        Type.Union([
          Type.Literal("status"),
          Type.Literal("reset"),
          Type.Literal("config"),
        ]),
      ),
    }),
    async execute(_toolCallId, params) {
      const action = params.action ?? "status";

      if (action === "reset") {
        resetLoopState();
        return {
          content: [{ type: "text", text: "Loop state reset. 所有重试计数已清零。" }],
        };
      }

      if (action === "config") {
        return {
          content: [
            {
              type: "text",
              text: "## Loop Engine Config\n\n```json\n" + JSON.stringify(config, null, 2) + "\n```",
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: formatLoopStatus() }],
      };
    },
  });

  // ── Register command: /loop-config ──────────────────────────

  pi.registerCommand("loop-config", {
    description: "查看/修改 loop engine 配置 (例: /loop-config maxRetries.test=5)",
    handler: async (args, ctx) => {
      if (!args.trim()) {
        ctx.ui.notify(
          "当前配置:\n" + JSON.stringify(config, null, 2),
          "info",
        );
        return;
      }

      const eqIdx = args.indexOf("=");
      if (eqIdx === -1) {
        ctx.ui.notify("格式: key=value (例: maxRetries.test=5)", "warning");
        return;
      }

      const key = args.slice(0, eqIdx).trim();
      const value = args.slice(eqIdx + 1).trim();

      try {
        applyConfigOverride(config, key, value);
        ctx.ui.notify(`✅ Loop config: ${key} = ${value}`, "info");
      } catch (err: any) {
        ctx.ui.notify(`❌ 配置更新失败: ${err.message}`, "error");
      }
    },
  });

  // ── Hook: before_agent_start → inject loop rules ────────────

  pi.on("before_agent_start", (event) => {
    if (!config.enabled) return;

    const state = getLoopState();
    const rules = buildLoopRulesPrompt(
      config.maxRetries,
      hasPendingFailures(),
    );

    // Task auto-classification: analyze user prompt and inject strategy
    const classification = classifyTask(event.prompt);
    const classificationPrompt = buildClassificationPrompt(classification);

    return {
      systemPrompt: event.systemPrompt + "\n\n" + rules + classificationPrompt,
    };
  });

  // ── Hook: tool_result → detect failures ─────────────────────

  pi.on("tool_result", (event) => {
    if (!config.enabled) return;

    const toolName = event.toolName;
    const output = getTextContent(event.content);
    const isError = event.isError;

    // Skip excluded tools
    if (isExcluded(config.exclude, toolName, output)) return;

    // Get exit code from details if available (bash tool)
    let exitCode: number | undefined;
    if (toolName === "bash" && event.details && typeof event.details === "object") {
      exitCode = (event.details as any).exitCode;
    }

    // Run detectors
    const result = detectFailure(
      DEFAULT_DETECTORS,
      toolName,
      output,
      isError,
      exitCode,
    );

    if (result) {
      const state = getLoopState();
      const attempt = getRetryCount(result.detector.category) + 1;

      const failure: FailureRecord = {
        category: result.detector.category,
        detector: result.detector.name,
        tool: toolName,
        output: output.slice(0, 3000),
        timestamp: Date.now(),
        hint: result.detector.retryHint,
        resolved: false,
        attempt,
      };

      recordFailure(failure);
    }
  });

  // ── Hook: turn_end → evaluate & trigger retry ───────────────

  pi.on("turn_end", async (_event, ctx) => {
    if (!config.enabled) return;
    if (!hasPendingFailures()) return;

    const failure = popPendingFailure();
    if (!failure) return;

    const category = failure.category;
    const currentCount = getRetryCount(category);
    const maxAttempts = config.maxRetries[category] ?? 1;

    if (currentCount >= maxAttempts) {
      // Escalation
      const escMsg = buildEscalationMessage(failure, currentCount, maxAttempts);

      if (config.escalation.action === "stop") {
        ctx.ui.notify(`⚠️ Loop Engine: ${category} 重试已达上限，已停止`, "warning");
        return;
      }

      if (config.escalation.action === "ask") {
        ctx.ui.notify(
          `⚠️ Loop Engine: ${category} 重试已达上限 (${currentCount}/${maxAttempts})`,
          "warning",
        );
      }

      // For "ask" and "notify", inject escalation as a user message
      pendingContextInjection = {
        failure,
        attempt: currentCount,
        maxAttempts,
        history: getAttemptHistory(category, config.contextInjection.maxHistoryItems),
      };

      pi.sendUserMessage(escMsg);
      return;
    }

    // Record this retry attempt
    recordAttempt(category);

    // Build retry message
    const retryMsg = buildRetryMessage(failure, currentCount + 1, maxAttempts);

    // Prepare context injection for the next LLM call
    pendingContextInjection = {
      failure,
      attempt: currentCount + 1,
      maxAttempts,
      history: getAttemptHistory(category, config.contextInjection.maxHistoryItems),
    };

    // Notify user
    ctx.ui.notify(
      `🔄 Loop Engine: ${category} 失败，第 ${currentCount + 1}/${maxAttempts} 次重试`,
      "warning",
    );

    // Update status bar
    ctx.ui.setStatus(
      "loop-engine",
      `🔄 retry ${currentCount + 1}/${maxAttempts} (${category})`,
    );

    // Trigger retry via user message
    pi.sendUserMessage(retryMsg);
  });

  // ── Hook: context → inject failure history ──────────────────

  pi.on("context", (event) => {
    if (!config.enabled) return;
    if (!pendingContextInjection) return;

    const inj = pendingContextInjection;
    pendingContextInjection = null;

    const contextText = buildContextInjection(
      inj.failure,
      inj.attempt,
      inj.maxAttempts,
      inj.history,
    );

    const contextMsg = {
      role: "user" as const,
      content: [{ type: "text", text: contextText }],
    };

    return {
      messages: [...event.messages, contextMsg],
    };
  });

  // ── Hook: session_start → reset state ───────────────────────

  pi.on("session_start", (_event, ctx) => {
    resetLoopState();
    ctx.ui.setStatus("loop-engine", undefined);
  });

  // ── Hook: agent_end → mark successes & clear status ─────────

  pi.on("agent_end", (_event, ctx) => {
    const state = getLoopState();

    // If no pending failures and we had retries, mark as success
    if (!hasPendingFailures() && state.totalRetries > 0) {
      // Clear status bar
      ctx.ui.setStatus("loop-engine", undefined);
    }
  });
}

// ── Config override helper ────────────────────────────────────

function applyConfigOverride(config: LoopConfig, key: string, value: string): void {
  const parts = key.split(".");

  if (parts[0] === "enabled") {
    config.enabled = value === "true";
  } else if (parts[0] === "maxRetries" && parts[1]) {
    const cat = parts[1] as FailureCategory;
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) throw new Error("必须是非负整数");
    config.maxRetries[cat] = num;
  } else if (parts[0] === "strategy") {
    if (!["immediate", "backoff", "adaptive"].includes(value)) {
      throw new Error("必须是 immediate / backoff / adaptive");
    }
    config.strategy = value as LoopConfig["strategy"];
  } else if (parts[0] === "escalation" && parts[1] === "action") {
    if (!["notify", "ask", "stop"].includes(value)) {
      throw new Error("必须是 notify / ask / stop");
    }
    config.escalation.action = value as LoopConfig["escalation"]["action"];
  } else if (parts[0] === "contextInjection" && parts[1]) {
    const sub = parts[1] as keyof LoopConfig["contextInjection"];
    if (sub === "maxHistoryItems") {
      config.contextInjection.maxHistoryItems = parseInt(value, 10);
    } else if (typeof config.contextInjection[sub] === "boolean") {
      (config.contextInjection as any)[sub] = value === "true";
    }
  } else {
    throw new Error(`未知配置键: ${key}`);
  }
}

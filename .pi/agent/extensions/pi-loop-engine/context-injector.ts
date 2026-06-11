/**
 * Context injection for pi-loop-engine.
 *
 * Builds retry prompts and failure context to inject into
 * the agent's conversation when a retry is triggered.
 */

import type { FailureRecord } from "./detectors.js";

/**
 * Build the system prompt addition for loop engine rules.
 */
export function buildLoopRulesPrompt(
  maxRetries: Record<string, number>,
  hasPending: boolean,
): string {
  const lines = [
    "",
    "## Loop Engine Rules (ENFORCED BY EXTENSION)",
    "",
    "You are operating under an automated loop engine. The following rules are MANDATORY:",
    "",
    "1. **When a test fails**: Analyze the failure, fix the code, and re-run the test. Do NOT skip or ignore test failures.",
    "2. **When a build fails**: Fix the compilation error and rebuild. Do NOT proceed with broken code.",
    "3. **When a lint check fails**: Fix the lint errors and re-check.",
    "4. **After each retry**: Explain what changed and why you believe it will fix the issue.",
    "5. **Do NOT give up after first failure** — the loop engine will automatically trigger retries.",
    "6. **Do NOT mark a task as complete if tests are failing.**",
    "",
    "Max retries per category:",
  ];

  for (const [cat, max] of Object.entries(maxRetries)) {
    lines.push(`- ${cat}: ${max}`);
  }

  if (hasPending) {
    lines.push("");
    lines.push("**There are pending failures that need to be addressed.**");
  }

  return lines.join("\n");
}

/**
 * Build a retry message to send as a user message when triggering a retry.
 */
export function buildRetryMessage(
  failure: FailureRecord,
  attempt: number,
  maxAttempts: number,
): string {
  const lines = [
    `[Loop Engine 自动重试] ${failure.category} 失败 (${attempt}/${maxAttempts})`,
    "",
    `检测器: ${failure.detector}`,
    `提示: ${failure.hint}`,
    "",
    "失败输出:",
    "```",
    failure.output.slice(0, 1500),
    "```",
    "",
    `请分析失败原因并修复。这是第 ${attempt} 次重试（最多 ${maxAttempts} 次）。`,
    "修复后重新执行失败的操作。",
  ];

  return lines.join("\n");
}

/**
 * Build context injection for the next LLM call after a failure.
 */
export function buildContextInjection(
  failure: FailureRecord,
  attempt: number,
  maxAttempts: number,
  history: FailureRecord[],
): string {
  const lines = [
    `[Loop Engine Context] 上一次尝试失败 (${attempt}/${maxAttempts}):`,
    `- 分类: ${failure.category}`,
    `- 检测器: ${failure.detector}`,
    `- 提示: ${failure.hint}`,
    "",
  ];

  // Include history of previous attempts if available
  if (history.length > 1) {
    lines.push("历史尝试:");
    for (let i = 0; i < history.length - 1; i++) {
      const h = history[i];
      lines.push(`  第 ${i + 1} 次: ${h.detector} - ${h.output.slice(0, 200)}`);
    }
    lines.push("");
  }

  lines.push("失败输出 (截断):");
  lines.push("```");
  lines.push(failure.output.slice(0, 1500));
  lines.push("```");
  lines.push("");
  lines.push("请分析失败原因，修复后重新执行。");

  return lines.join("\n");
}

/**
 * Build an escalation message when max retries are reached.
 */
export function buildEscalationMessage(
  failure: FailureRecord,
  attempt: number,
  maxAttempts: number,
): string {
  const lines = [
    `⚠️ **Loop Engine: 已达重试上限** (${attempt}/${maxAttempts})`,
    "",
    `分类: ${failure.category}`,
    `检测器: ${failure.detector}`,
    `最后提示: ${failure.hint}`,
    "",
    "最后失败输出:",
    "```",
    failure.output.slice(0, 1000),
    "```",
    "",
    "请决定下一步:",
    "- 继续尝试（说明你的新策略）",
    "- 手动介入修复",
    "- 放弃此任务",
  ];

  return lines.join("\n");
}

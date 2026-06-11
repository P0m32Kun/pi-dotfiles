/**
 * Loop state management for pi-loop-engine.
 *
 * Tracks retry counts, failure history, and resolution status.
 * State is per-session and persisted via pi.appendEntry().
 */

import type { FailureCategory, FailureRecord } from "./detectors.js";

export interface LoopState {
  /** Retry counts per category */
  attempts: Record<string, number>;
  /** All failures in this session */
  failures: FailureRecord[];
  /** Currently pending (unresolved) failures */
  pendingFailures: FailureRecord[];
  /** Total retries across all categories */
  totalRetries: number;
  /** Times a retry led to success */
  totalSuccesses: number;
  /** Timestamp of last state change */
  lastUpdated: number;
}

export function createLoopState(): LoopState {
  return {
    attempts: {},
    failures: [],
    pendingFailures: [],
    totalRetries: 0,
    totalSuccesses: 0,
    lastUpdated: Date.now(),
  };
}

const state: LoopState = createLoopState();

export function getLoopState(): LoopState {
  return state;
}

export function resetLoopState(): void {
  state.attempts = {};
  state.failures = [];
  state.pendingFailures = [];
  state.totalRetries = 0;
  state.totalSuccesses = 0;
  state.lastUpdated = Date.now();
}

export function getRetryCount(category: FailureCategory): number {
  return state.attempts[category] ?? 0;
}

export function recordAttempt(category: FailureCategory): void {
  state.attempts[category] = (state.attempts[category] ?? 0) + 1;
  state.totalRetries++;
  state.lastUpdated = Date.now();
}

export function recordFailure(failure: FailureRecord): void {
  state.failures.push(failure);
  state.pendingFailures.push(failure);
  state.lastUpdated = Date.now();
}

export function markResolved(category: FailureCategory): void {
  // Mark the most recent pending failure of this category as resolved
  for (let i = state.pendingFailures.length - 1; i >= 0; i--) {
    if (state.pendingFailures[i].category === category && !state.pendingFailures[i].resolved) {
      state.pendingFailures[i].resolved = true;
      state.pendingFailures[i].resolvedAt = Date.now();
      state.totalSuccesses++;
      break;
    }
  }
  // Remove resolved from pending
  state.pendingFailures = state.pendingFailures.filter((f) => !f.resolved);
  state.lastUpdated = Date.now();
}

export function hasPendingFailures(): boolean {
  return state.pendingFailures.length > 0;
}

export function popPendingFailure(): FailureRecord | undefined {
  return state.pendingFailures.shift();
}

export function getAttemptHistory(
  category: FailureCategory,
  maxItems: number,
): FailureRecord[] {
  return state.failures
    .filter((f) => f.category === category)
    .slice(-maxItems);
}

export function formatLoopStatus(): string {
  const lines: string[] = ["## Loop Engine Status", ""];

  // Current attempts
  const categories = Object.keys(state.attempts);
  if (categories.length > 0) {
    lines.push("### 重试统计");
    for (const cat of categories) {
      lines.push(`- ${cat}: ${state.attempts[cat]} 次重试`);
    }
    lines.push("");
  }

  // Pending failures
  if (state.pendingFailures.length > 0) {
    lines.push("### 待处理失败");
    for (const f of state.pendingFailures) {
      lines.push(`- [${f.category}] ${f.detector}: ${f.hint}`);
    }
    lines.push("");
  }

  // Summary
  lines.push("### 总计");
  lines.push(`- 总重试次数: ${state.totalRetries}`);
  lines.push(`- 重试成功次数: ${state.totalSuccesses}`);
  lines.push(`- 失败记录数: ${state.failures.length}`);
  lines.push(`- 待处理: ${state.pendingFailures.length}`);

  return lines.join("\n");
}

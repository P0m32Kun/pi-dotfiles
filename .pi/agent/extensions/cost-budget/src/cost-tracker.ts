/**
 * 会话成本追踪器 —— 对齐 OpenSquilla 的 cost_rollup.py
 *
 * 成本来源分类：
 * - provider_billed: provider 直接返回的计费数据
 * - our_estimate: 根据 token 估算
 * - unavailable: 有 token 但没有价格数据
 * - none: 没有 token 数据
 * - mixed: 混合来源
 */

export type CostSource =
  | "provider_billed"
  | "our_estimate"
  | "unavailable"
  | "none"
  | "mixed";

export interface TurnCost {
  turnIndex: number;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  billedCostUsd: number;
  source: CostSource;
}

export interface SessionCostSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalCostUsd: number;
  totalBilledCostUsd: number;
  costSource: CostSource;
  turns: number;
  byModel: Record<
    string,
    {
      turns: number;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
    }
  >;
}

/**
 * 归一化成本来源 —— 对齐 OpenSquilla 的 normalize_event_cost_source()
 */
export function normalizeCostSource(params: {
  billedCostUsd: number;
  estimatedCostUsd: number;
  hasTokens: boolean;
}): CostSource {
  const { billedCostUsd, estimatedCostUsd, hasTokens } = params;

  if (billedCostUsd > 0 && estimatedCostUsd > billedCostUsd) {
    return "mixed";
  }
  if (billedCostUsd > 0) {
    return "provider_billed";
  }
  if (estimatedCostUsd > 0) {
    return "our_estimate";
  }
  if (hasTokens) {
    return "unavailable";
  }
  return "none";
}

/**
 * 汇总会话成本来源 —— 对齐 OpenSquilla 的 rollup_cost_source()
 */
export function rollupCostSource(
  billedCostUsd: number,
  estimatedCostComponentUsd: number,
  missingCostEntries: number,
): CostSource {
  const hasBilled = billedCostUsd > 0;
  const hasEstimate = estimatedCostComponentUsd > 0;
  const hasUnavailable = missingCostEntries > 0;
  const present = (+hasBilled) + (+hasEstimate) + (+hasUnavailable);

  if (present > 1) return "mixed";
  if (hasBilled) return "provider_billed";
  if (hasEstimate) return "our_estimate";
  if (hasUnavailable) return "unavailable";
  return "none";
}

// DeepSeek 默认定价 (USD / 1M tokens)
const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  "deepseek-chat": { input: 0.14, output: 0.28 },
  "deepseek-reasoner": { input: 0.55, output: 2.19 },
};

/**
 * 基于 token 估算成本（当 provider 不返回计费时的 fallback）
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  modelId: string,
  pricing: Record<string, { input: number; output: number }> = DEFAULT_PRICING,
): number {
  for (const [key, p] of Object.entries(pricing)) {
    if (modelId.includes(key)) {
      return (
        (inputTokens / 1_000_000) * p.input +
        (outputTokens / 1_000_000) * p.output
      );
    }
  }
  return 0;
}

/**
 * 会话成本追踪器
 */
export class CostTracker {
  private turns: TurnCost[] = [];

  /**
   * 记录一回合的成本
   */
  recordTurn(params: {
    turnIndex: number;
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    billedCostUsd?: number;
  }): TurnCost {
    const {
      turnIndex,
      modelId,
      inputTokens,
      outputTokens,
      cacheReadTokens = 0,
      cacheWriteTokens = 0,
      billedCostUsd = 0,
    } = params;

    const estimatedCost = estimateCost(inputTokens, outputTokens, modelId);
    const hasTokens = inputTokens > 0 || outputTokens > 0;

    const source = normalizeCostSource({
      billedCostUsd,
      estimatedCostUsd: estimatedCost,
      hasTokens,
    });

    const turn: TurnCost = {
      turnIndex,
      modelId,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      costUsd: Math.max(billedCostUsd, estimatedCost),
      billedCostUsd,
      source,
    };

    this.turns.push(turn);
    return turn;
  }

  /**
   * 汇总会话成本 —— 对齐 OpenSquilla 的 rollup_cost_source()
   */
  summarize(): SessionCostSummary {
    const byModel: SessionCostSummary["byModel"] = {};

    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;
    let totalCost = 0;
    let totalBilled = 0;
    let hasBilled = false;
    let hasEstimate = false;
    let hasUnavailable = false;

    for (const turn of this.turns) {
      totalInput += turn.inputTokens;
      totalOutput += turn.outputTokens;
      totalCacheRead += turn.cacheReadTokens;
      totalCacheWrite += turn.cacheWriteTokens;
      totalCost += turn.costUsd;
      totalBilled += turn.billedCostUsd;

      if (turn.source === "provider_billed") hasBilled = true;
      if (turn.source === "our_estimate") hasEstimate = true;
      if (turn.source === "unavailable") hasUnavailable = true;

      if (!byModel[turn.modelId]) {
        byModel[turn.modelId] = {
          turns: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
        };
      }
      byModel[turn.modelId].turns++;
      byModel[turn.modelId].inputTokens += turn.inputTokens;
      byModel[turn.modelId].outputTokens += turn.outputTokens;
      byModel[turn.modelId].costUsd += turn.costUsd;
    }

    const missingCostEntries = this.turns.filter(
      (t) => t.source === "unavailable",
    ).length;

    const costSource = rollupCostSource(
      totalBilled,
      totalCost - totalBilled,
      missingCostEntries,
    );

    return {
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalCacheReadTokens: totalCacheRead,
      totalCacheWriteTokens: totalCacheWrite,
      totalCostUsd: totalCost,
      totalBilledCostUsd: totalBilled,
      costSource,
      turns: this.turns.length,
      byModel,
    };
  }

  /** 获取本轮回合数据 */
  getLastTurn(): TurnCost | undefined {
    return this.turns[this.turns.length - 1];
  }

  /** 获取所有回合 */
  getTurns(): readonly TurnCost[] {
    return this.turns;
  }

  /** 清除历史 */
  reset(): void {
    this.turns = [];
  }
}

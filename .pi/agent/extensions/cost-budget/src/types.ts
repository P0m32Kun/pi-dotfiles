import type { BudgetClass } from "./constants";

/** 单次工具调用结果的预算决策 */
export interface ToolResultBudgetDecision {
  /** 最终传给 LLM 的内容 */
  content: string;
  /** 是否被裁剪过 */
  changed: boolean;
  /** 原始字符数 */
  originalChars: number;
  /** 裁剪后字符数 */
  returnedChars: number;
  /** 预算类别 */
  budgetClass: BudgetClass;
}

/** 每轮上下文预算快照 */
export interface ContextBudgetSnapshot {
  /** 该轮已消费的 EXTERNAL 字符数 */
  externalCharsUsed: number;
  /** 该轮已消费的 LOCAL 字符数 */
  localCharsUsed: number;
  /** 该轮工具调用次数 */
  toolCallsThisTurn: number;
}

/** 复杂度分类结果 */
export type ComplexityTier = "c0" | "c1" | "c2" | "c3";

export interface ComplexityResult {
  tier: ComplexityTier;
  score: number;
  reasons: string[];
}

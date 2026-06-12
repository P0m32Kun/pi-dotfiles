import { BudgetClass, DEFAULT_BUDGET } from "./constants";
import { classifyTool } from "./classifier";
import type { ToolResultBudgetDecision, ContextBudgetSnapshot } from "./types";

/**
 * 上下文预算跟踪器 —— 对齐 OpenSquilla 的 ToolResultBudgetTracker
 *
 * 核心理念：
 * - 外部工具（web_search, web_fetch 等）→ 严格限制，防止网页内容撑爆上下文
 * - 本地工具（read, bash, edit 等）→ 宽松限制，因为它们输出可控
 * - 产物/错误/控制 → 不裁剪
 */
export class BudgetTracker {
  private snapshot: ContextBudgetSnapshot = {
    externalCharsUsed: 0,
    localCharsUsed: 0,
    toolCallsThisTurn: 0,
  };

  /**
   * 处理工具结果 —— 决定是否需要裁剪
   * 模仿 OpenSquilla 的 ToolResultBudgetTracker.normalize()
   */
  normalizeResult(params: {
    toolName: string;
    content: string;
    isMcp?: boolean;
    isError?: boolean;
  }): ToolResultBudgetDecision {
    const { toolName, content, isMcp = false, isError = false } = params;
    const budgetClass = classifyTool(toolName, isMcp);
    const budget = DEFAULT_BUDGET[budgetClass];
    const originalChars = content.length;

    this.snapshot.toolCallsThisTurn++;

    // ARTIFACT / ERROR / CONTROL → 不裁剪
    if (
      budgetClass === BudgetClass.ARTIFACT ||
      budgetClass === BudgetClass.ERROR ||
      budgetClass === BudgetClass.CONTROL
    ) {
      return {
        content,
        changed: false,
        originalChars,
        returnedChars: originalChars,
        budgetClass,
      };
    }

    // 提前检查每轮预算是否已耗尽
    if (budget.resultCharsPerTurn !== null) {
      const used =
        budgetClass === BudgetClass.EXTERNAL
          ? this.snapshot.externalCharsUsed
          : this.snapshot.localCharsUsed;
      if (used >= budget.resultCharsPerTurn) {
        // 本轮配额已用完，强制裁剪
        return this.forceTruncate(toolName, content, originalChars, isError, budgetClass);
      }
    }

    // 计算允许的字符数
    let allowed = Infinity;

    // 单次限制
    if (budget.singleResultChars !== null) {
      allowed = Math.min(allowed, budget.singleResultChars);
    }

    // 每轮限制
    if (budget.resultCharsPerTurn !== null) {
      const used =
        budgetClass === BudgetClass.EXTERNAL
          ? this.snapshot.externalCharsUsed
          : this.snapshot.localCharsUsed;
      const remaining = Math.max(0, budget.resultCharsPerTurn - used);
      allowed = Math.min(allowed, remaining);
    }

    // 不需要裁剪
    if (originalChars <= allowed) {
      this.account(budgetClass, originalChars);
      return {
        content,
        changed: false,
        originalChars,
        returnedChars: originalChars,
        budgetClass,
      };
    }

    // 执行裁剪 —— 保留前 allowed 字符 + 截断标记
    const safePreviewLen = Math.max(0, Math.floor(allowed));
    const preview = content.slice(0, safePreviewLen);
    const compacted = JSON.stringify({
      result_truncated: true,
      result_original_chars: originalChars,
      tool: toolName,
      is_error: isError,
      preview,
    });

    // 用原始字符数计账（而非 compacted.length），确保累计预算正确
    this.account(budgetClass, originalChars);

    return {
      content: compacted,
      changed: true,
      originalChars,
      returnedChars: compacted.length,
      budgetClass,
    };
  }

  /** 重置每轮统计（在 turn_start 时调用） */
  resetTurn(): void {
    this.snapshot = {
      externalCharsUsed: 0,
      localCharsUsed: 0,
      toolCallsThisTurn: 0,
    };
  }

  /** 获取当前快照 */
  getSnapshot(): Readonly<ContextBudgetSnapshot> {
    return { ...this.snapshot };
  }

  /** 当每轮配额耗尽时强制裁剪 */
  private forceTruncate(
    toolName: string,
    content: string,
    originalChars: number,
    isError: boolean,
    budgetClass: BudgetClass,
  ): ToolResultBudgetDecision {
    const compacted = JSON.stringify({
      result_truncated: true,
      result_original_chars: originalChars,
      tool: toolName,
      is_error: isError,
      preview: "",
      budget_exhausted: true,
    });
    this.account(budgetClass, originalChars);
    return {
      content: compacted,
      changed: true,
      originalChars,
      returnedChars: compacted.length,
      budgetClass,
    };
  }

  private account(budgetClass: BudgetClass, chars: number): void {
    if (budgetClass === BudgetClass.EXTERNAL) {
      this.snapshot.externalCharsUsed += chars;
    } else {
      this.snapshot.localCharsUsed += chars;
    }
  }
}

// 预算类别 —— 对齐 OpenSquilla 的 ContextBudgetClass
export enum BudgetClass {
  EXTERNAL = "external", // 网络请求、搜索、fetch → 最严格限制
  LOCAL = "local", // 文件系统、shell、git → 宽松限制
  ARTIFACT = "artifact", // 产物输出 → 不限制
  ERROR = "error", // 错误输出 → 最小保留
  CONTROL = "control", // 控制消息 → 最小保留
  UNKNOWN = "unknown", // 未知工具 → 默认限制
}

// 字符数估算常量
export const CHARS_PER_TOKEN = 4;

// 大型上下文模型的阈值（token）
export const LARGE_CONTEXT_MIN_TOKENS = 64_000;

// 默认配额（对齐 OpenSquilla 的比例设计）
// 解释：外部工具的上下文消耗不可预测（网页大小未知），因此比例极低
// 本地工具的输出可控，因此比例较高
export const DEFAULT_BUDGET: Record<
  BudgetClass,
  {
    singleResultChars: number | null;
    resultCharsPerTurn: number | null;
    argumentFraction: number;
  }
> = {
  [BudgetClass.EXTERNAL]: {
    singleResultChars: 32_000, // 单次 32KB
    resultCharsPerTurn: 96_000, // 每轮 96KB
    argumentFraction: 0.05, // 参数预算 5%
  },
  [BudgetClass.LOCAL]: {
    singleResultChars: 160_000, // 单次 160KB
    resultCharsPerTurn: 320_000, // 每轮 320KB
    argumentFraction: 0.16, // 参数预算 16%
  },
  [BudgetClass.ARTIFACT]: {
    singleResultChars: null, // 不限制
    resultCharsPerTurn: null,
    argumentFraction: 0.16,
  },
  [BudgetClass.ERROR]: {
    singleResultChars: null,
    resultCharsPerTurn: null,
    argumentFraction: 0.16,
  },
  [BudgetClass.CONTROL]: {
    singleResultChars: null,
    resultCharsPerTurn: null,
    argumentFraction: 0.16,
  },
  [BudgetClass.UNKNOWN]: {
    singleResultChars: 80_000,
    resultCharsPerTurn: 160_000,
    argumentFraction: 0.1,
  },
};

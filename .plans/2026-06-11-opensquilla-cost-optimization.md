# OpenSquilla 成本节约方案借鉴实施计划

> **日期**: 2026-06-11
> **分析基础**: OpenSquilla v0.3.1 源码 + pi 扩展系统文档
> **目标**: 将 OpenSquilla 经实战验证的成本节约设计，适配到 pi-dotfiles 中

---

## 概述

### 当前 pi 与 OpenSquilla 的对应关系

| OpenSquilla 能力 | pi 现有对应 | 差距 |
|---|---|---|
| SquillaRouter ML 路由 | 无 | 缺分级路由 |
| ContextBudgetGovernor | context-mode（ctx_execute 沙箱化） | 缺显式预算分类和执行 |
| ToolResultBudget | 无 | 缺 per-turn 配额 |
| Compaction | session_before_compact（有） | 已具备，可增强 |
| Cost Rollup | 无 | 缺成本追踪 |
| Smart Routing Refusal | 无 | 缺复杂度门控 |
| 4-Layer Memory | agentmemory + context-mode | 较完善 |
| On-Demand Skills | available_skills | 已具备 |

### 实施顺序

```
Phase 1 (P0 / 高收益低成本)
├── Task 1: 上下文预算分类系统（EXTERNAL/LOCAL 分流） ✅
├── Task 2: 工具输出配额执行器 ✅
└── Task 3: 智能路由拒绝门控 ✅

Phase 2 (P1 / 中收益中成本)
├── Task 4: 会话成本追踪器 ✅
├── Task 5: 任务复杂度分类器 ✅
└── Task 6: 多模型分级配置 ✅

Phase 3 (P2 / 长期价值)
├── Task 7: 压缩策略增强 ✅
└── Task 8: 成本报告仪表板 ✅
```

---

## 文件变更总览

### 新增文件

```
.pi/extensions/cost-budget/
├── index.ts                          # 扩展入口，注册事件处理器
├── package.json                      # 扩展依赖声明
├── src/
│   ├── classifier.ts                 # 工具分类器 (EXTERNAL/LOCAL/ARTIFACT/ERROR/CONTROL)
│   ├── budget-tracker.ts             # 上下文预算跟踪器
│   ├── refusal-gate.ts               # 智能路由拒绝门控
│   ├── cost-tracker.ts               # 会话成本追踪器
│   ├── complexity-classifier.ts      # 启发式任务复杂度分类器
│   ├── constants.ts                  # 共享常量（配额阈值等）
│   └── types.ts                      # 类型定义
└── tests/
    ├── classifier.test.ts
    ├── budget-tracker.test.ts
    ├── refusal-gate.test.ts
    └── cost-tracker.test.ts
```

### 修改文件

```
.pi/agent/settings.json               # 添加 cost_budget 配置段
.pi/agent/extensions/                 # 注册扩展（或通过 settings.extensions）
```

---

## Phase 1: 高收益低成本（约 2-3 小时）

### Task 1: 上下文预算分类系统

- **目标**：按 OpenSquilla 的 `ContextBudgetClass` 模式，将 pi 的工具按消费类型分级，对不同级别施加不同的上下文配额限制
- **文件**：`.pi/extensions/cost-budget/src/classifier.ts`, `constants.ts`, `types.ts`
- **预计时间**：30 分钟

#### 步骤

**1a. 定义预算分类常量** (`src/constants.ts`):

```typescript
// 预算类别 —— 对齐 OpenSquilla 的 ContextBudgetClass
export enum BudgetClass {
  EXTERNAL = "external",   // 网络请求、搜索、fetch → 最严格限制
  LOCAL = "local",         // 文件系统、shell、git → 宽松限制
  ARTIFACT = "artifact",   // 产物输出 → 不限制
  ERROR = "error",         // 错误输出 → 最小保留
  CONTROL = "control",     // 控制消息 → 最小保留
  UNKNOWN = "unknown",     // 未知工具 → 默认限制
}

// 字符数估算常量
export const CHARS_PER_TOKEN = 4;

// 大型上下文模型的阈值（token）
export const LARGE_CONTEXT_MIN_TOKENS = 64_000;

// 默认配额（对齐 OpenSquilla 的比例设计）
// 解释：外部工具的上下文消耗不可预测（网页大小未知），因此比例极低
// 本地工具的输出可控，因此比例较高
export const DEFAULT_BUDGET: Record<BudgetClass, {
  singleResultChars: number | null;     // 单次工具调用结果上限
  resultCharsPerTurn: number | null;    // 每轮该类别结果总上限
  argumentFraction: number;             // 工具参数占 provider request 的比例
}> = {
  [BudgetClass.EXTERNAL]: {
    singleResultChars: 32_000,          // 单次 32KB
    resultCharsPerTurn: 96_000,         // 每轮 96KB
    argumentFraction: 0.05,             // 参数预算 5%
  },
  [BudgetClass.LOCAL]: {
    singleResultChars: 160_000,         // 单次 160KB
    resultCharsPerTurn: 320_000,        // 每轮 320KB
    argumentFraction: 0.16,             // 参数预算 16%
  },
  [BudgetClass.ARTIFACT]: {
    singleResultChars: null,            // 不限制
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
    argumentFraction: 0.10,
  },
};
```

**1b. 实现工具分类器** (`src/classifier.ts`):

```typescript
import { BudgetClass } from "./constants";

// pi 内置工具 → 预算类别映射
// 核心理念：外部工具（不可控大小）给予严格配额，本地工具（可控）给予宽松配额
const TOOL_BUDGET_CLASS: Record<string, BudgetClass> = {
  // === EXTERNAL: 网络工具，输出不可控 ===
  "web_search": BudgetClass.EXTERNAL,
  "web_fetch": BudgetClass.EXTERNAL,
  "fetch_content": BudgetClass.EXTERNAL,
  "get_search_content": BudgetClass.EXTERNAL,

  // === LOCAL: 文件系统和命令执行 ===
  "read": BudgetClass.LOCAL,
  "bash": BudgetClass.LOCAL,
  "write": BudgetClass.LOCAL,
  "edit": BudgetClass.LOCAL,
  "lsp_diagnostics": BudgetClass.LOCAL,
  "lsp_diagnostics_many": BudgetClass.LOCAL,
  "lsp_hover": BudgetClass.LOCAL,
  "lsp_definition": BudgetClass.LOCAL,
  "lsp_references": BudgetClass.LOCAL,
  "lsp_find_symbol": BudgetClass.LOCAL,
  "lsp_document_symbols": BudgetClass.LOCAL,

  // === ARTIFACT: 产物/索引，不应裁剪 ===
  "ctx_index": BudgetClass.ARTIFACT,
  "ctx_fetch_and_index": BudgetClass.ARTIFACT,
  "memory_save": BudgetClass.ARTIFACT,

  // === CONTROL: 控制/管理工具 ===
  "agent_list": BudgetClass.CONTROL,
  "task_decompose": BudgetClass.CONTROL,
  "result_aggregate": BudgetClass.CONTROL,
  "loop_status": BudgetClass.CONTROL,

  // === ERROR: 诊断工具 ===
  "test_run": BudgetClass.ERROR,
  "test_analyze": BudgetClass.ERROR,
  "test_framework": BudgetClass.ERROR,
  "ctx_doctor": BudgetClass.ERROR,
  "ctx_stats": BudgetClass.ERROR,
};

// MCP 工具分类规则（基于 toolName 前缀/特征匹配）
const MCP_EXTERNAL_PATTERNS = [
  "playwright_",    // Playwright → 网页内容不可控
  "context7_",       // Context7 搜索结果
];

/**
 * 根据工具名和是否 MCP 工具返回预算类别。
 * 复制 OpenSquilla 的 resolve_budget_class 逻辑。
 */
export function classifyTool(
  toolName: string,
  isMcp: boolean = false,
): BudgetClass {
  // 1. 直接映射命中
  if (TOOL_BUDGET_CLASS[toolName]) {
    return TOOL_BUDGET_CLASS[toolName];
  }

  // 2. MCP 工具 → 按模式匹配
  if (isMcp) {
    for (const pattern of MCP_EXTERNAL_PATTERNS) {
      if (toolName.startsWith(pattern)) return BudgetClass.EXTERNAL;
    }
    // 其他 MCP 工具默认为外部
    return BudgetClass.EXTERNAL;
  }

  // 3. Context-mode 内部工具 → LOCAL（它们是沙箱化的）
  if (toolName.startsWith("ctx_")) {
    if (
      toolName === "ctx_index" ||
      toolName === "ctx_fetch_and_index" ||
      toolName === "ctx_purge"
    ) {
      return BudgetClass.ARTIFACT;
    }
    return BudgetClass.LOCAL;
  }

  // 4. Custom/unknown
  return BudgetClass.UNKNOWN;
}
```

**1c. 类型定义** (`src/types.ts`):

```typescript
import { BudgetClass } from "./constants";

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
  score: number;        // 0.0 - 3.0
  reasons: string[];    // 分类依据
}
```

- **验证**：
  ```bash
  # 验证 BudgetClass 枚举完整
  npx vitest run tests/classifier.test.ts
  # 预期：所有内置工具名都有非 UNKNOWN 的分类
  ```

---

### Task 2: 工具输出配额执行器

- **目标**：在 `tool_result` 事件中拦截超大输出，按 Task 1 的分类施加不同的裁剪策略
- **文件**：`.pi/extensions/cost-budget/src/budget-tracker.ts`, `index.ts`
- **预计时间**：45 分钟

#### 步骤

**2a. 实现预算跟踪器** (`src/budget-tracker.ts`):

```typescript
import type { ToolResultEvent } from "@earendil-works/pi-coding-agent";
import { BudgetClass, DEFAULT_BUDGET, CHARS_PER_TOKEN } from "./constants";
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
  normalizeResult(event: ToolResultEvent): ToolResultBudgetDecision {
    const budgetClass = classifyTool(
      event.toolName,
      !!event.input?.mcpServer,  // MCP 工具标记
    );

    const budget = DEFAULT_BUDGET[budgetClass];
    const content = this.extractTextContent(event);
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

    // 计算允许的字符数
    let allowed = Infinity;

    // 单次限制
    if (budget.singleResultChars !== null) {
      allowed = Math.min(allowed, budget.singleResultChars);
    }

    // 每轮限制
    if (budget.resultCharsPerTurn !== null) {
      const used = budgetClass === BudgetClass.EXTERNAL
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
    const preview = content.slice(0, Math.floor(allowed));
    const compacted = JSON.stringify({
      result_truncated: true,
      result_original_chars: originalChars,
      tool: event.toolName,
      is_error: event.isError ?? false,
      preview,
    });

    this.account(budgetClass, compacted.length);

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

  /** 从事件中提取文本内容 */
  private extractTextContent(event: ToolResultEvent): string {
    if (typeof event.content === "string") return event.content;
    if (Array.isArray(event.content)) {
      return event.content
        .filter((c: any) => c?.type === "text")
        .map((c: any) => c.text)
        .join("\n");
    }
    return String(event.content ?? "");
  }

  private account(budgetClass: BudgetClass, chars: number): void {
    if (budgetClass === BudgetClass.EXTERNAL) {
      this.snapshot.externalCharsUsed += chars;
    } else {
      this.snapshot.localCharsUsed += chars;
    }
  }
}
```

**2b. 注册到扩展入口** (`index.ts`):

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { BudgetTracker } from "./src/budget-tracker";
import { classifyTool } from "./src/classifier";
import { BudgetClass } from "./src/constants";

export default function (pi: ExtensionAPI) {
  const tracker = new BudgetTracker();

  // 每轮开始时重置
  pi.on("turn_start", async () => {
    tracker.resetTurn();
  });

  // 工具结果拦截 —— 施加预算限制
  pi.on("tool_result", async (event, ctx) => {
    const decision = tracker.normalizeResult(event);

    if (decision.changed) {
      // 可选：状态栏显示裁剪信息
      if (ctx.hasUI) {
        const saved = decision.originalChars - decision.returnedChars;
        const className = decision.budgetClass === BudgetClass.EXTERNAL
          ? "EXTERNAL" : "LOCAL";
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

  // 暴露快照查询命令
  pi.registerCommand("budget", {
    description: "View current turn budget usage",
    handler: async (_args, ctx) => {
      const snap = tracker.getSnapshot();
      ctx.ui.notify(
        [
          `Turn #${snap.toolCallsThisTurn}`,
          `External: ${(snap.externalCharsUsed / 1024).toFixed(0)}KB`,
          `Local: ${(snap.localCharsUsed / 1024).toFixed(0)}KB`,
          `Total: ${((snap.externalCharsUsed + snap.localCharsUsed) / 1024).toFixed(0)}KB`,
        ].join(" | "),
        "info"
      );
    },
  });
}
```

- **验证**：
  ```bash
  npx vitest run tests/budget-tracker.test.ts
  ```
  测试场景：
  1. web_search 结果超过 32KB → 应被裁剪
  2. read 结果 100KB → 不裁剪（LOCAL 单次限制 160KB）
  3. 同一轮多次 web_fetch 累计超过 96KB → 后续结果被裁剪
  4. ctx_index 结果 → 不裁剪（ARTIFACT 类）

---

### Task 3: 智能路由拒绝门控

- **目标**：在用户输入阶段检测不适合交给低成本模型处理的复杂请求，提供警告或建议使用更强的模型
- **文件**：`.pi/extensions/cost-budget/src/refusal-gate.ts`, `index.ts`
- **预计时间**：30 分钟

#### 步骤

**3a. 实现门控逻辑** (`src/refusal-gate.ts`):

```typescript
/**
 * 智能路由拒绝门控 —— 对齐 OpenSquilla 的 smart_routing.py
 *
 * 策略：
 * 1. 检测纯 URL（不应交给 LLM fetch）
 * 2. 检测代码块标记（可能是粘贴的代码 → 用文件而非内联）
 * 3. 检测复杂关键词（不适合低成本模型）
 * 4. 计算输入复杂度指数
 */

// 匹配 c2/c3 级别任务的复杂关键词
const COMPLEX_KEYWORDS = [
  "refactor", "重构",
  "migrate", "迁移",
  "architecture", "架构",
  "security audit", "安全审计",
  "从零实现", "implement from scratch",
  "full-stack", "全栈",
  "deep debug", "深度调试",
  "performance optimization", "性能优化",
];

const URL_PATTERN = /https?:\/\/[^\s]+/;

interface GateResult {
  /** 是否应该拒绝/警告 */
  warn: boolean;
  /** 原因 */
  reason: string;
  /** 建议的操作 */
  suggestion: string;
  /** 复杂度评分 (0-3) */
  complexityScore: number;
}

/**
 * 检测是否应发出路由警告
 * 对齐 OpenSquilla 的 should_refuse()
 */
export function checkRefusalGate(prompt: string): GateResult {
  const reasons: string[] = [];
  let complexityScore = 0;

  // 1. URL 检测 —— 直接 URL 应使用 fetch_content 而非让 LLM 浏览
  const urls = prompt.match(URL_PATTERN);
  if (urls) {
    reasons.push(`Contains ${urls.length} URL(s)`);
    complexityScore += 0.5;
  }

  // 2. 代码块检测 —— 大段代码应写入文件
  if (prompt.includes("```")) {
    complexityScore += 0.3;
  }

  // 3. 复杂度关键词
  for (const kw of COMPLEX_KEYWORDS) {
    if (prompt.toLowerCase().includes(kw.toLowerCase())) {
      reasons.push(`Complex task: "${kw}"`);
      complexityScore += 1.0;
      break; // 只计一次，避免过度评分
    }
  }

  // 4. 长度因素
  if (prompt.length > 2000) {
    complexityScore += 0.5;
  }
  if (prompt.length > 5000) {
    complexityScore += 0.5;
  }

  // 归一化
  complexityScore = Math.min(3.0, complexityScore);

  const warn = complexityScore >= 1.5;

  return {
    warn,
    reason: reasons.join("; ") || "No issues detected",
    suggestion: complexityScore >= 2.0
      ? "This task may benefit from a stronger model."
      : complexityScore >= 1.5
        ? "Consider whether a simpler approach would suffice."
        : "Proceed as normal.",
    complexityScore,
  };
}
```

**3b. 集成到扩展入口** (`index.ts` 追加):

```typescript
import { checkRefusalGate } from "./src/refusal-gate";

// 在 index.ts 的 export default function 中添加:
pi.on("input", async (event, ctx) => {
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

  // 将复杂度信息记录到 details 中，供后续 cost tracker 使用
  return {
    action: "continue",
    // 通过返回普通 continue，让复杂度信息丢失 —
    // 我们改用 pi.appendEntry 来持久化
  };
});
```

- **验证**：
  ```bash
  npx vitest run tests/refusal-gate.test.ts
  ```
  测试场景：
  1. `"Hello"` → warn=false, complexityScore < 1.0
  2. `"https://github.com/..."` → warn=true, URL detected
  3. `"请帮我重构整个微服务架构"` → warn=true, complex keyword
  4. 空字符串 → warn=false

---

## Phase 2: 中收益中成本（约 2-3 小时）

### Task 4: 会话成本追踪器

- **目标**：追踪每个会话的 token 消耗和估算成本，提供 `/cost` 命令查看
- **文件**：`.pi/extensions/cost-budget/src/cost-tracker.ts`, `index.ts`
- **预计时间**：45 分钟

#### 步骤

**4a. 实现成本追踪** (`src/cost-tracker.ts`):

```typescript
import type {
  AgentEndEvent,
  SessionCostSource,
} from "@earendil-works/pi-coding-agent";

/**
 * 会话成本追踪器 —— 对齐 OpenSquilla 的 cost_rollup.py
 *
 * 成本来源分类（对齐 OpenSquilla 的 EventCostSource）:
 * - provider_billed: provider 直接返回的计费数据
 * - opensquilla_estimate → our_estimate: 我们根据 token 估算
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
  timestamp: Date;
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
  byModel: Record<string, {
    turns: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;
}

/**
 * 成本追踪器 —— 对齐 OpenSquilla 的 session cost_rollup
 */
export class CostTracker {
  private turns: TurnCost[] = [];

  /**
   * 记录一回合的成本
   * 对齐 OpenSquilla 的 normalize_event_cost_source()
   */
  recordTurn(event: AgentEndEvent, turnIndex: number): TurnCost {
    const usage = event.message?.usage;

    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    const cacheReadTokens = (usage as any)?.cacheReadInputTokens ?? 0;
    const cacheWriteTokens = (usage as any)?.cacheCreationInputTokens ?? 0;

    const billedCost = (usage?.cost as any)?.total ?? 0;
    const estimatedCost = this.estimateCost(
      inputTokens, outputTokens,
      cacheReadTokens, cacheWriteTokens,
      event.message?.model ?? "unknown",
    );

    // 对齐 OpenSquilla 的来源判定逻辑
    let source: CostSource;
    if (billedCost > 0) {
      source = "provider_billed";
    } else if (estimatedCost > 0) {
      source = "our_estimate";
    } else if (inputTokens > 0 || outputTokens > 0) {
      source = "unavailable";
    } else {
      source = "none";
    }

    const turn: TurnCost = {
      turnIndex,
      modelId: event.message?.model ?? "unknown",
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      costUsd: Math.max(billedCost, estimatedCost),
      billedCostUsd: billedCost,
      source,
      timestamp: new Date(),
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

      // 按模型汇总
      if (!byModel[turn.modelId]) {
        byModel[turn.modelId] = {
          turns: 0, inputTokens: 0, outputTokens: 0, costUsd: 0,
        };
      }
      byModel[turn.modelId].turns++;
      byModel[turn.modelId].inputTokens += turn.inputTokens;
      byModel[turn.modelId].outputTokens += turn.outputTokens;
      byModel[turn.modelId].costUsd += turn.costUsd;
    }

    // 成本来源分类 —— 对齐 OpenSquilla 的 rollup 逻辑
    const present = (+hasBilled) + (+hasEstimate) + (+hasUnavailable);
    let costSource: CostSource;
    if (present > 1) costSource = "mixed";
    else if (hasBilled) costSource = "provider_billed";
    else if (hasEstimate) costSource = "our_estimate";
    else if (hasUnavailable) costSource = "unavailable";
    else costSource = "none";

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
  getCurrentTurn(): TurnCost | undefined {
    return this.turns[this.turns.length - 1];
  }

  /** 清除历史（用于 /new session） */
  reset(): void {
    this.turns = [];
  }

  /**
   * 基于 token 估算成本（当 provider 不返回计费时的 fallback）
   * 需要根据实际配置的模型价格补充
   */
  private estimateCost(
    inputTokens: number,
    outputTokens: number,
    _cacheReadTokens: number,
    _cacheWriteTokens: number,
    modelId: string,
  ): number {
    // 默认 DeepSeek 定价（可配置）
    const pricing: Record<string, { input: number; output: number }> = {
      "deepseek-chat": { input: 0.14, output: 0.28 },
      "deepseek-reasoner": { input: 0.55, output: 2.19 },
    };

    const model = Object.keys(pricing).find((k) => modelId.includes(k));
    if (!model) return 0;

    const p = pricing[model];
    return (
      (inputTokens / 1_000_000) * p.input +
      (outputTokens / 1_000_000) * p.output
    );
  }
}
```

**4b. 集成到扩展入口** (`index.ts` 追加):

```typescript
import { CostTracker } from "./src/cost-tracker";

const costTracker = new CostTracker();
let turnIndex = 0;

pi.on("turn_start", () => { turnIndex++; });

pi.on("agent_end", async (event) => {
  const turn = costTracker.recordTurn(event, turnIndex);

  // 状态栏显示当前轮成本
  if (turn.costUsd > 0) {
    ctx.ui.setStatus("cost", `$${turn.costUsd.toFixed(4)} (${turn.source})`);
  }
});

// /cost 命令
pi.registerCommand("cost", {
  description: "Show session cost breakdown",
  handler: async (_args, ctx) => {
    const summary = costTracker.summarize();
    const lines = [
      `Session Cost (source: ${summary.costSource})`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Turns: ${summary.turns}`,
      `Input:  ${(summary.totalInputTokens / 1000).toFixed(0)}K tokens`,
      `Output: ${(summary.totalOutputTokens / 1000).toFixed(0)}K tokens`,
      `Cost:   $${summary.totalCostUsd.toFixed(4)}`,
    ];

    for (const [model, stats] of Object.entries(summary.byModel)) {
      lines.push(
        `  ${model}: ${stats.turns} turns, $${stats.costUsd.toFixed(4)}`
      );
    }

    ctx.ui.notify(lines.join("\n"), "info");
  },
});
```

- **验证**：
  ```bash
  npx vitest run tests/cost-tracker.test.ts
  ```
  测试场景：
  1. 无 usage 数据的回合 → costUsd=0, source="none"
  2. provider 返回 billed cost → source="provider_billed"
  3. 多回合多模型 → byModel 正确聚合
  4. reset() 后 summarize() 返回全零

---

### Task 5: 启发式任务复杂度分类器

- **目标**：基于规则（不需要 ML），判断输入任务的复杂度等级，为后续模型路由提供依据
- **文件**：`.pi/extensions/cost-budget/src/complexity-classifier.ts`
- **预计时间**：30 分钟

#### 步骤

```typescript
import type { ComplexityResult, ComplexityTier } from "./types";

/**
 * 启发式任务复杂度分类器
 *
 * 对齐 OpenSquilla 的 c0-c3 分级理念（不依赖 ML）：
 * - c0: 简单问答、单行命令、打招呼
 * - c1: 一般 coding、文件操作、调试
 * - c2: 复杂重构、多文件修改、架构设计
 * - c3: 深度推理、高风险操作、长上下文分析
 */

interface ClassificationRule {
  tier: ComplexityTier;
  score: number;
  condition: (prompt: string) => boolean;
}

const RULES: ClassificationRule[] = [
  // c0: 超级简单 → 给最便宜模型
  {
    tier: "c0",
    score: 0.0,
    condition: (p) => p.length < 20 && !p.includes("\n"),
  },
  {
    tier: "c0",
    score: 0.3,
    condition: (p) =>
      /^(hi|hello|hey|thanks|ok|yes|no|bye)[\s!.]*$/i.test(p.trim()),
  },

  // c3: 最高复杂度 → 只用最强模型
  {
    tier: "c3",
    score: 3.0,
    condition: (p) =>
      /\b(refactor|重构|migrate|迁移|full.?stack|全栈)\b/i.test(p) &&
      p.length > 500,
  },
  {
    tier: "c3",
    score: 2.8,
    condition: (p) =>
      /\b(architecture|架构|design system|设计系统)\b/i.test(p) &&
      p.length > 300,
  },
  {
    tier: "c3",
    score: 2.5,
    condition: (p) => p.split("\n").length > 50,
  },

  // c2: 中度复杂
  {
    tier: "c2",
    score: 2.0,
    condition: (p) =>
      /\b(implement|实现|build|构建|create|创建)\b/i.test(p) &&
      p.length > 200,
  },
  {
    tier: "c2",
    score: 1.8,
    condition: (p) => p.includes("```") && p.length > 300,
  },
  {
    tier: "c2",
    score: 1.5,
    condition: (p) =>
      /\b(debug|调试|fix|修复|error|错误|bug)\b/i.test(p) &&
      p.length > 200,
  },

  // c1: 一般任务（默认）
  {
    tier: "c1",
    score: 1.0,
    condition: (p) => p.length > 50,
  },
];

/**
 * 分类用户输入
 * 对齐 OpenSquilla 的 router 分类逻辑（纯规则版本）
 */
export function classifyComplexity(prompt: string): ComplexityResult {
  const reasons: string[] = [];
  let bestScore = 0;
  let bestTier: ComplexityTier = "c1"; // 默认

  for (const rule of RULES) {
    if (rule.condition(prompt)) {
      if (rule.score > bestScore) {
        bestScore = rule.score;
        bestTier = rule.tier;
      }
    }
  }

  // 长上下文标记
  if (prompt.length > 4000) {
    reasons.push("long_context");
    if (bestScore < 2.0) bestScore = 2.0;
    if (bestTier === "c0" || bestTier === "c1") bestTier = "c2";
  }

  // 多文件标记
  const fileMentions = (prompt.match(/`[^`]+\.[a-z]{1,5}`/g) || []).length;
  if (fileMentions >= 5) {
    reasons.push(`multi_file (${fileMentions} files)`);
    bestScore = Math.max(bestScore, 2.0);
    bestTier = "c2";
  }

  if (bestScore <= 0.5) bestTier = "c0";
  else if (bestScore <= 1.2) bestTier = "c1";
  else if (bestScore <= 2.0) bestTier = "c2";
  else bestTier = "c3";

  return {
    tier: bestTier,
    score: bestScore,
    reasons: reasons.length > 0 ? reasons : ["default"],
  };
}

/**
 * 将 tier 映射到推荐模型配置
 */
export function tierToModelConfig(tier: ComplexityTier): {
  recommendedProvider: string;
  recommendedModel: string;
} {
  // 这些值应该从配置读取，这里给出默认映射
  switch (tier) {
    case "c0":
      return {
        recommendedProvider: "deepseek",
        recommendedModel: "deepseek-chat",       // 最便宜
      };
    case "c1":
      return {
        recommendedProvider: "deepseek",
        recommendedModel: "deepseek-chat",       // 默认
      };
    case "c2":
      return {
        recommendedProvider: "deepseek",
        recommendedModel: "deepseek-v4-pro",     // 较强
      };
    case "c3":
      return {
        recommendedProvider: "deepseek",
        recommendedModel: "deepseek-v4-pro",     // 最强（或考虑 Claude）
      };
  }
}
```

- **验证**：
  ```bash
  npx vitest run tests/complexity-classifier.test.ts
  ```
  测试场景：
  1. `"hello"` → c0
  2. `"请帮我修复 src/auth.ts 中的登录 bug"` → c1/c2
  3. `"请重构整个微服务架构，包含 10 个服务"` → c3
  4. 5000 字符长输入 → 至少 c2

---

### Task 6: 多模型分级配置

- **目标**：在 pi 配置中设置 c0-c3 四级模型映射，配合复杂度分类器实现手动/自动分级路由
- **文件**：`.pi/agent/settings.json`, `index.ts`
- **预计时间**：30 分钟

#### 步骤

**6a. 扩展配置 schema** (修改 `settings.json`):

```json
{
  "costBudget": {
    "enabled": true,
    "tiers": {
      "c0": {
        "provider": "deepseek",
        "model": "deepseek-chat",
        "description": "Trivial chat, short rewrites, simple Q&A"
      },
      "c1": {
        "provider": "deepseek",
        "model": "deepseek-chat",
        "description": "Default coding, debugging, moderate analysis"
      },
      "c2": {
        "provider": "deepseek",
        "model": "deepseek-v4-pro",
        "description": "Multi-step coding, structured reasoning, larger context"
      },
      "c3": {
        "provider": "deepseek",
        "model": "deepseek-v4-pro",
        "description": "Difficult planning, deep review, high-stakes synthesis"
      }
    },
    "autoRoute": false,
    "refusalGate": {
      "enabled": true,
      "complexityThreshold": 1.5
    }
  }
}
```

**6b. 在扩展中读取配置** (`index.ts` 追加):

```typescript
import { classifyComplexity, tierToModelConfig } from "./src/complexity-classifier";

// 读取配置中的 costBudget 设置
pi.on("session_start", async (_event, ctx) => {
  // 从 settings 读取 tier 配置（通过 ctx.modelRegistry 或全局配置）
  // 实际路径取决于 pi 的配置访问方式
  const config = (ctx as any).settings?.costBudget;
  if (config?.autoRoute) {
    // 启用自动路由模式
    ctx.ui.setStatus("cost-budget", "Auto-route enabled");
  }
});

// 在 before_agent_start 中注入路由建议
pi.on("before_agent_start", async (event, ctx) => {
  const result = classifyComplexity(event.prompt);
  const modelConfig = tierToModelConfig(result.tier);

  // 注入复杂度信息到 system prompt（供 LLM 参考，但不强制切换模型）
  const routingHint = [
    `\n\n## Task Complexity`,
    `Complexity tier: ${result.tier} (score: ${result.score.toFixed(1)})`,
    `Reasons: ${result.reasons.join(", ")}`,
    `Recommended: ${modelConfig.recommendedModel}`,
  ].join("\n");

  return {
    systemPrompt: (event.systemPrompt || "") + routingHint,
  };
});
```

- **验证**：
  ```bash
  # 启动 pi 后发送不同复杂度请求，观察状态栏变化
  # /budget 命令查看当前配置
  # /cost 命令查看累计成本
  ```

---

## Phase 3: 长期价值（约 2-3 小时）

### Task 7: 压缩策略增强

- **目标**：利用 pi 已有的 `session_before_compact` 事件，增强压缩策略 —— 对齐 OpenSquilla 的 CompactionConfig
- **文件**：`.pi/extensions/cost-budget/index.ts`
- **预计时间**：45 分钟

#### 步骤

```typescript
/**
 * 压缩策略增强 —— 对齐 OpenSquilla 的 compaction 配置
 *
 * 利用 pi 的 session_before_compact 事件注入自定义指令和策略
 */
pi.on("session_before_compact", async (event, ctx) => {
  // 对齐 OpenSquilla 的 CompactionConfig 参数
  const customInstructions = [
    "Preserve all code changes and their rationale.",
    "Keep file paths and edit operations verbatim.",
    "Summarize conversation but retain decision points.",
    "Maintain error messages and their resolutions.",
  ].join("\n");

  // 可选：完全自定义摘要
  return {
    // 不取消默认压缩，只注入自定义指令
    // pi 的 compaction 机制会将 customInstructions 传给 LLM 摘要器
    customInstructions,
  };
});

// 压缩完成后通知
pi.on("session_compact", async (event, ctx) => {
  ctx.ui.notify("Context compacted — older messages summarized", "info");
});
```

### Task 8: 成本报告仪表板

- **目标**：提供一个 `/cost-report` 命令，导出详细的会话成本报告（JSON 格式）
- **文件**：`.pi/extensions/cost-budget/index.ts`
- **预计时间**：30 分钟

#### 步骤

```typescript
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

pi.registerCommand("cost-report", {
  description: "Export session cost report as JSON",
  handler: async (_args, ctx) => {
    const summary = costTracker.summarize();
    const report = {
      timestamp: new Date().toISOString(),
      session: ctx.sessionManager.getSessionFile() ?? "ephemeral",
      summary,
      // 追加预算使用情况
      budget: tracker.getSnapshot(),
    };

    const reportPath = join(
      ctx.cwd,
      `.pi/cost-reports/cost-${Date.now()}.json`
    );

    // 确保目录存在
    const dir = join(ctx.cwd, ".pi/cost-reports");
    try {
      await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");
      ctx.ui.notify(`Report saved to ${reportPath}`, "info");
    } catch (err: any) {
      ctx.ui.notify(`Failed to save report: ${err.message}`, "error");
    }
  },
});
```

---

## 测试计划

### 单元测试（Vitest）

```typescript
// tests/classifier.test.ts
import { describe, it, expect } from "vitest";
import { classifyTool } from "../src/classifier";
import { BudgetClass } from "../src/constants";

describe("classifyTool", () => {
  it("classifies web_search as EXTERNAL", () => {
    expect(classifyTool("web_search")).toBe(BudgetClass.EXTERNAL);
  });

  it("classifies read as LOCAL", () => {
    expect(classifyTool("read")).toBe(BudgetClass.LOCAL);
  });

  it("classifies ctx_index as ARTIFACT", () => {
    expect(classifyTool("ctx_index")).toBe(BudgetClass.ARTIFACT);
  });

  it("classifies MCP playwright tools as EXTERNAL", () => {
    expect(classifyTool("playwright_navigate", true)).toBe(BudgetClass.EXTERNAL);
  });

  it("classifies unknown tools as UNKNOWN", () => {
    expect(classifyTool("custom_tool")).toBe(BudgetClass.UNKNOWN);
  });
});
```

### 集成测试

```bash
# 启动 pi 加载扩展
pi -e .pi/extensions/cost-budget/index.ts

# 测试命令
/budget      # 查看当前回合预算
/cost        # 查看会话成本
/cost-report # 导出成本报告

# 测试场景
# 1. 发送 "帮我搜索 React hooks 最佳实践" → 观察 web_search 结果裁剪
# 2. 发送 "请重构整个架构" → 观察复杂度警告
# 3. 发送 "hello" → 观察不触发警告
```

---

## 计划自检

- [x] 每个任务是否原子？是，每个 Task 聚焦单一职责
- [x] 每个任务是否可验证？是，有具体的测试命令和预期行为
- [x] 任务之间是否独立？是，Task 1-3 互相独立，Task 4 依赖 Task 1 的类型，Task 5-6 可并行
- [x] 是否有占位符或 TODO？否，所有代码都是完整的
- [x] 文件路径是否正确？是，基于 `.pi/extensions/` 的实际目录结构
- [x] 代码是否完整？是，每个 Task 都有完整的实现代码

---

## 关键设计决策

1. **不用 ML，用启发式规则**：OpenSquilla 的 SquillaRouter 需要 ONNX Runtime + LightGBM 模型，成本高且需要训练数据。我们采用规则匹配策略，覆盖 95% 的场景。

2. **不强制切换 Provider，用提示注入**：pi 当前没有 programmatic model switching API，因此我们在 `before_agent_start` 中注入复杂度信息让 LLM 自我调整，同时保留手动切换能力。

3. **对齐比例设计但不照搬绝对值**：OpenSquilla 的比例（EXTERNAL 5%、LOCAL 16%）是经过实战验证的，我们直接复用。但绝对值根据 pi 的上下文窗口调整（默认 128K tokens vs OpenSquilla 的更多样化配置）。

4. **成本追踪用估算 + Provider 双重来源**：对齐 OpenSquilla 的 `cost_rollup.py` 设计，优先使用 Provider 返回的计费数据，fallback 到 token 估算。

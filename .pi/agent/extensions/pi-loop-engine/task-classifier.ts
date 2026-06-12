/**
 * Task classifier for pi-loop-engine.
 *
 * Analyzes the user's prompt to determine the task category
 * and recommends the appropriate execution strategy.
 */

export type TaskCategory =
  | "test"          // 写测试、补全覆盖率、E2E
  | "fix"           // 修 bug、修复错误
  | "feature"       // 新功能开发
  | "refactor"      // 重构、清理代码
  | "research"      // 调研、分析、阅读代码
  | "docs"          // 文档更新
  | "simple";       // 简单直接任务

export type ExecutionStrategy =
  | "direct"              // 直接执行，不需要 loop
  | "loop"                // 需要 loop engineering（失败自动重试）
  | "subagent-loop";      // 需要 subagent + acceptance + loop

export interface TaskClassification {
  category: TaskCategory;
  strategy: ExecutionStrategy;
  confidence: number;       // 0-1
  reasons: string[];
  suggestedAcceptance?: string[];  // 建议的验收标准
}

// ── Keyword patterns ──────────────────────────────────────────

interface PatternRule {
  category: TaskCategory;
  strategy: ExecutionStrategy;
  keywords: RegExp[];
  antiKeywords?: RegExp[];  // 排除词
  acceptanceHints?: string[];
}

const PATTERN_RULES: PatternRule[] = [
  {
    category: "test",
    strategy: "subagent-loop",
    keywords: [
      /测试覆盖/i,
      /test coverage/i,
      /补全.*测试/i,
      /写.*测试/i,
      /write.*test/i,
      /e2e.*test/i,
      /端到端.*测试/i,
      /单元测试/i,
      /unit test/i,
      /集成测试/i,
      /integration test/i,
      /测试.*补全/i,
      /测试.*扩展/i,
      /测试.*完善/i,
      /tdd/i,
      /test.driven/i,
      /红绿重构/i,
    ],
    acceptanceHints: [
      "测试通过 (go test / npm test)",
      "覆盖率满足目标",
      "无回归 (现有测试不 break)",
    ],
  },
  {
    category: "fix",
    strategy: "loop",
    keywords: [
      /修复.*bug/i,
      /fix.*bug/i,
      /修复.*错误/i,
      /fix.*error/i,
      /解决问题/i,
      /fix.*issue/i,
      /hotfix/i,
      /故障排查/i,
      /debug/i,
      /修复.*失败/i,
      /fix.*fail/i,
      /修复.*报错/i,
    ],
    acceptanceHints: [
      "问题复现步骤不再触发",
      "相关测试通过",
      "无回归",
    ],
  },
  {
    category: "feature",
    strategy: "subagent-loop",
    keywords: [
      /新功能/i,
      /new feature/i,
      /实现.*功能/i,
      /implement.*feature/i,
      /开发.*功能/i,
      /添加.*支持/i,
      /add.*support/i,
      /新增.*模块/i,
      /功能开发/i,
    ],
    antiKeywords: [
      /简单/i,
      /小改/i,
      /just/i,
      /only/i,
    ],
    acceptanceHints: [
      "功能按 spec 工作",
      "有对应测试覆盖",
      "编译通过",
    ],
  },
  {
    category: "refactor",
    strategy: "loop",
    keywords: [
      /重构/i,
      /refactor/i,
      /清理.*代码/i,
      /code.?clean/i,
      /优化.*结构/i,
      /重写/i,
      /rewrite/i,
    ],
    acceptanceHints: [
      "行为不变 (现有测试通过)",
      "代码更清晰",
      "无功能回归",
    ],
  },
  {
    category: "research",
    strategy: "direct",
    keywords: [
      /分析一下/i,
      /调研/i,
      /研究/i,
      /看看.*怎么/i,
      /explain/i,
      /how does.*work/i,
      /阅读.*代码/i,
      /review.*code/i,
      /对比/i,
      /compare/i,
      /深度分析/i,
    ],
  },
  {
    category: "docs",
    strategy: "direct",
    keywords: [
      /更新.*文档/i,
      /update.*doc/i,
      /写.*readme/i,
      /文档同步/i,
      /doc.?sync/i,
      /注释/i,
    ],
  },
  {
    category: "simple",
    strategy: "direct",
    keywords: [
      /^加一个/i,
      /^添加一条/i,
      /^修改.*一行/i,
      /^改一下/i,
      /rename/i,
      /move.*file/i,
      /删除.*注释/i,
    ],
  },
];

// ── Classifier ────────────────────────────────────────────────

/**
 * Classify a user prompt into a task category and execution strategy.
 */
export function classifyTask(prompt: string): TaskClassification {
  if (!prompt || prompt.trim().length === 0) {
    return {
      category: "simple",
      strategy: "direct",
      confidence: 1.0,
      reasons: ["空输入"],
    };
  }

  const normalized = prompt.trim();
  let bestMatch: TaskClassification | null = null;
  let bestScore = 0;

  for (const rule of PATTERN_RULES) {
    let score = 0;
    const matchedKeywords: string[] = [];

    // Check anti-keywords first — if any match, skip this rule
    if (rule.antiKeywords) {
      const hasAntiMatch = rule.antiKeywords.some((ak) => ak.test(normalized));
      if (hasAntiMatch) continue;
    }

    for (const kw of rule.keywords) {
      if (kw.test(normalized)) {
        score++;
        matchedKeywords.push(kw.source);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        category: rule.category,
        strategy: rule.strategy,
        confidence: Math.min(score / 3, 1.0),  // 3+ matches = full confidence
        reasons: matchedKeywords.map((kw) => `匹配关键词: ${kw}`),
        suggestedAcceptance: rule.acceptanceHints,
      };
    }
  }

  // Default: simple/direct
  if (!bestMatch) {
    return {
      category: "simple",
      strategy: "direct",
      confidence: 0.5,
      reasons: ["未匹配到已知模式，默认为简单任务"],
    };
  }

  return bestMatch;
}

/**
 * Build the loop engineering injection prompt based on task classification.
 */
export function buildClassificationPrompt(classification: TaskClassification): string {
  if (classification.strategy === "direct") {
    return "";  // No injection needed for direct tasks
  }

  const lines = [
    "",
    "## Task Auto-Classification (by Loop Engine)",
    "",
    `**Task category**: ${classification.category}`,
    `**Execution strategy**: ${classification.strategy}`,
    `**Confidence**: ${Math.round(classification.confidence * 100)}%`,
    "",
  ];

  if (classification.strategy === "loop") {
    lines.push(
      "This task requires **Loop Engineering**. Rules:",
      "- Define acceptance criteria before starting",
      "- Run tests/verification after each change",
      "- If verification fails, analyze and fix — the loop engine will auto-retry",
      "- Do NOT mark complete until all acceptance criteria pass",
      "",
    );
  }

  if (classification.strategy === "subagent-loop") {
    lines.push(
      "This task requires **Subagent + Loop Engineering**. Rules:",
      "1. Define clear acceptance criteria (what = done)",
      "2. Use `subagent` tool to delegate implementation",
      "3. Include `acceptance` in the subagent config with:",
      "   - `criteria`: measurable success conditions",
      "   - `verify`: shell commands to validate",
      "   - `stopRules`: when to stop iterating",
      "4. Review subagent output against acceptance criteria",
      "5. If criteria not met, send follow-up message to subagent",
      "",
    );
  }

  if (classification.suggestedAcceptance && classification.suggestedAcceptance.length > 0) {
    lines.push("**Suggested acceptance criteria**:");
    for (const hint of classification.suggestedAcceptance) {
      lines.push(`- ${hint}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

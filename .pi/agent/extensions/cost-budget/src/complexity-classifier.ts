/**
 * 启发式任务复杂度分类器
 *
 * 对齐 OpenSquilla 的 c0-c3 分级理念（不依赖 ML）：
 * - c0: 简单问答、单行命令、打招呼
 * - c1: 一般 coding、文件操作、调试
 * - c2: 复杂重构、多文件修改、架构设计
 * - c3: 深度推理、高风险操作、长上下文分析
 */

import type { ComplexityResult, ComplexityTier } from "./types";

interface ClassificationRule {
  tier: ComplexityTier;
  score: number;
  condition: (prompt: string) => boolean;
  reason: string;
}

const RULES: ClassificationRule[] = [
  // ─── c0: 超级简单 → 最便宜模型 ─────────────────────────────
  {
    tier: "c0",
    score: 0.0,
    condition: (p) => p.length < 20 && !p.includes("\n"),
    reason: "very_short",
  },
  {
    tier: "c0",
    score: 0.3,
    condition: (p) => /^(hi|hello|hey|thanks|ok|yes|no|bye)[\s!.]*$/i.test(p.trim()),
    reason: "greeting",
  },

  // ─── c3: 最高复杂度 → 只用最强模型 ──────────────────────────
  {
    tier: "c3",
    score: 3.0,
    condition: (p) => {
      const hasKw = /\b(refactor|migrate|full.?stack)\b/i.test(p) || /重构|迁移|全栈/.test(p);
      return hasKw && p.length > 200;
    },
    reason: "complex_task_long",
  },
  {
    tier: "c3",
    score: 2.8,
    condition: (p) => {
      const hasKw = /\b(architecture|design system)\b/i.test(p) || /架构|设计系统/.test(p);
      return hasKw && p.length > 40;
    },
    reason: "architecture_long",
  },
  {
    tier: "c3",
    score: 2.5,
    condition: (p) => p.split("\n").length > 50,
    reason: "very_long_multiline",
  },

  // ─── c2: 中度复杂 ──────────────────────────────────────────
  {
    tier: "c2",
    score: 2.0,
    condition: (p) => {
      const hasKw = /\b(implement|build|create)\b/i.test(p) || /实现|构建|创建/.test(p);
      return hasKw && p.length > 80;
    },
    reason: "implementation_request",
  },
  {
    tier: "c2",
    score: 1.8,
    condition: (p) => p.includes("```") && p.length > 200,
    reason: "code_block_long",
  },
  {
    tier: "c2",
    score: 1.5,
    condition: (p) => {
      const hasKw = /\b(debug|fix|error|bug)\b/i.test(p) || /调试|修复|错误/.test(p);
      return hasKw && p.length > 100;
    },
    reason: "debugging_request",
  },
  {
    tier: "c2",
    score: 1.5,
    condition: (p) => {
      const hasKw = /\b(security|audit|optimize|performance)\b/i.test(p) || /安全|审计|优化|性能/.test(p);
      return hasKw && p.length > 100;
    },
    reason: "optimization_request",
  },

  // ─── c1: 一般任务（默认） ───────────────────────────────────
  {
    tier: "c1",
    score: 1.0,
    condition: (p) => p.length > 30,
    reason: "medium_length",
  },
];

/**
 * 分类用户输入
 * 对齐 OpenSquilla 的 router 分类逻辑（纯规则版本）
 */
export function classifyComplexity(prompt: string): ComplexityResult {
  const reasons: string[] = [];
  let bestScore = 0;
  let bestTier: ComplexityTier = "c1";

  for (const rule of RULES) {
    if (rule.condition(prompt)) {
      if (rule.score > bestScore) {
        bestScore = rule.score;
        bestTier = rule.tier;
        reasons.push(rule.reason);
      }
    }
  }

  // 长上下文修正
  if (prompt.length > 4000) {
    reasons.push("long_context");
    if (bestScore < 2.0) bestScore = 2.0;
    if (bestTier === "c0" || bestTier === "c1") bestTier = "c2";
  }

  // 多文件修正
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
  switch (tier) {
    case "c0":
      return { recommendedProvider: "deepseek", recommendedModel: "deepseek-chat" };
    case "c1":
      return { recommendedProvider: "deepseek", recommendedModel: "deepseek-chat" };
    case "c2":
      return { recommendedProvider: "deepseek", recommendedModel: "deepseek-v4-pro" };
    case "c3":
      return { recommendedProvider: "deepseek", recommendedModel: "deepseek-v4-pro" };
  }
}

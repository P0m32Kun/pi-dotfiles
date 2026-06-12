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
  "refactor",
  "重构",
  "migrate",
  "迁移",
  "architecture",
  "架构",
  "security audit",
  "安全审计",
  "从零实现",
  "implement from scratch",
  "full-stack",
  "全栈",
  "deep debug",
  "深度调试",
  "performance optimization",
  "性能优化",
];

const URL_PATTERN = /https?:\/\/[^\s]+/;

export interface GateResult {
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

  // 单个关键词匹配即视为应警告（对齐 OpenSquilla 的 should_refuse 行为）
  const warn = complexityScore >= 1.0;

  return {
    warn,
    reason: reasons.join("; ") || "No issues detected",
    suggestion:
      complexityScore >= 2.0
        ? "This task may benefit from a stronger model."
        : complexityScore >= 1.5
          ? "Consider whether a simpler approach would suffice."
          : "Proceed as normal.",
    complexityScore,
  };
}

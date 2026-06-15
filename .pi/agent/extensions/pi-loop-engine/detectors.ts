/**
 * Failure detectors for pi-loop-engine.
 *
 * Each detector defines a pattern match on tool results.
 * When a match fires, the engine records a failure and may trigger a retry.
 */

export type FailureCategory = "test" | "build" | "lint" | "runtime" | "edit" | "custom";

export interface DetectorRule {
  name: string;
  match: {
    tool: string;
    exitCode?: number | number[];
    outputPattern?: string;
    errorPattern?: string;
    /** Regex to match the command string — if set, only applies when command matches */
    commandPattern?: string;
    /** Regex to exclude commands — if set, skips detection when command matches */
    excludeCommandPattern?: string;
    /** Regex to exclude output — if set, skips detection when output matches */
    excludeOutputPattern?: string;
  };
  category: FailureCategory;
  retryHint: string;
  requiresHuman: boolean;
}

export interface FailureRecord {
  category: FailureCategory;
  detector: string;
  tool: string;
  output: string;
  timestamp: number;
  hint: string;
  resolved: boolean;
  resolvedAt?: number;
  attempt: number;
}

export const DEFAULT_DETECTORS: DetectorRule[] = [
  {
    name: "test-failure",
    match: {
      tool: "bash",
      outputPattern:
        "((?<!\\(\\d+\\s)FAIL(ED)?(?!\\s*\\(0\\))|✗|✘|❌|test.*failed|Error:.*expect|AssertionError|assert.*fail|not ok \\d+|FAILED\\s+(?!0)\\d+)",
      // Also skip test summary lines like "PASS (100) FAIL (0)"
      excludeOutputPattern: "PASS\\s*\\(\\d+\\).*FAIL\\s*\\(0\\)",
      // Exclude search/read commands to avoid false positives from grep output
      excludeCommandPattern:
        "^(grep|rg|find|cat|head|tail|less|more|wc|awk|sed|cut|sort|uniq|file|ls|tree|git)",
    },
    category: "test",
    retryHint: "测试失败了。分析失败原因，修复后重新运行测试。",
    requiresHuman: false,
  },
  {
    name: "build-error",
    match: {
      tool: "bash",
      outputPattern:
        "(error\\[|Build failed|Compilation error|TS\\d{4}:|Cannot find module|SyntaxError:|Unexpected token|Module not found)",
      excludeCommandPattern:
        "^(grep|rg|find|cat|head|tail|less|more|wc|awk|sed|cut|sort|uniq|file|ls|tree|git)",
    },
    category: "build",
    retryHint: "编译错误。分析错误信息，修复代码后重新编译。",
    requiresHuman: false,
  },
  {
    name: "lint-error",
    match: {
      tool: "bash",
      outputPattern:
        "(eslint.*error|prettier.*error|lint.*failed|\\d+ errors? found|biome.*error|oxlint.*error)",
    },
    category: "lint",
    retryHint: "Lint 错误。修复 lint 问题后重新检查。",
    requiresHuman: false,
  },
  {
    name: "runtime-error",
    match: {
      tool: "bash",
      exitCode: [1, 2, 126, 127, 134, 137, 139],
      errorPattern:
        "(Error:|Exception:|Traceback|Segmentation fault|SIGABRT|SIGSEGV|panic:|fatal:)",
    },
    category: "runtime",
    retryHint: "运行时错误。分析错误堆栈，修复后重新运行。",
    requiresHuman: false,
  },
  {
    name: "edit-conflict",
    match: {
      tool: "edit",
      errorPattern:
        "(old_string.*not found|No match|Could not find|does not appear|oldText.*not found)",
    },
    category: "edit",
    retryHint: "编辑失败。重新读取文件内容，找到正确的 old_string 后重试。",
    requiresHuman: false,
  },
];

/**
 * Evaluate a tool result against all detector rules.
 * Returns the first matching failure, or null if no match.
 */
export function detectFailure(
  detectors: DetectorRule[],
  toolName: string,
  output: string,
  isError: boolean,
  exitCode?: number,
  command?: string,
): { detector: DetectorRule; matched: boolean } | null {
  for (const rule of detectors) {
    if (rule.match.tool !== toolName) continue;

    // Skip if command matches the exclude pattern (e.g., grep/search commands)
    if (command && rule.match.excludeCommandPattern) {
      try {
        if (new RegExp(rule.match.excludeCommandPattern, "i").test(command.trim())) {
          continue;
        }
      } catch {
        // Invalid regex, skip
      }
    }

    // Only apply if command matches the required pattern
    if (command && rule.match.commandPattern) {
      try {
        if (!new RegExp(rule.match.commandPattern, "i").test(command)) {
          continue;
        }
      } catch {
        // Invalid regex, skip
      }
    }

    // Skip if output matches the exclude pattern (e.g., summary lines with 0 failures)
    if (rule.match.excludeOutputPattern) {
      try {
        if (new RegExp(rule.match.excludeOutputPattern, "i").test(output)) {
          continue;
        }
      } catch {
        // Invalid regex, skip
      }
    }

    let matched = false;

    // Check exit code
    if (rule.match.exitCode !== undefined && exitCode !== undefined) {
      const codes = Array.isArray(rule.match.exitCode)
        ? rule.match.exitCode
        : [rule.match.exitCode];
      if (codes.includes(exitCode)) {
        matched = true;
      }
    }

    // Check output pattern
    if (rule.match.outputPattern) {
      try {
        if (new RegExp(rule.match.outputPattern, "i").test(output)) {
          matched = true;
        }
      } catch {
        // Invalid regex, skip
      }
    }

    // Check error pattern (only when tool reported error)
    if (rule.match.errorPattern && isError) {
      try {
        if (new RegExp(rule.match.errorPattern, "i").test(output)) {
          matched = true;
        }
      } catch {
        // Invalid regex, skip
      }
    }

    if (matched) {
      return { detector: rule, matched: true };
    }
  }

  return null;
}

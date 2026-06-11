/**
 * Type definitions for pi-test-integration.
 *
 * Defines test framework adapters, coverage, and failure analysis types.
 */

// ── Test Framework Types ───────────────────────────────────

export interface TestFrameworkAdapter {
  name: string;
  detect(projectPath: string): Promise<boolean>;
  runTests(options: TestRunOptions): Promise<TestResult>;
  getCoverage?(options: CoverageOptions): Promise<CoverageReport>;
}

export interface TestRunOptions {
  pattern?: string;
  watch?: boolean;
  bail?: boolean;
  timeout?: number;
  env?: Record<string, string>;
  cwd?: string;
}

export interface TestResult {
  status: 'passed' | 'failed' | 'error';
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  tests: TestCase[];
  error?: string;
}

export interface TestCase {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  stack?: string;
  file?: string;
}

// ── Coverage Types ─────────────────────────────────────────

export interface CoverageOptions {
  cwd?: string;
  reporters?: string[];
}

export interface CoverageReport {
  total: CoverageSummary;
  files: FileCoverage[];
  timestamp: string;
}

export interface CoverageSummary {
  lines: CoverageMetric;
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
}

export interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

export interface FileCoverage {
  path: string;
  summary: CoverageSummary;
  uncoveredLines: number[];
}

// ── Failure Analysis Types ─────────────────────────────────

export interface FailureAnalyzer {
  analyze(failure: TestFailure): Promise<FailureAnalysis>;
}

export interface TestFailure {
  testName: string;
  error: string;
  stack?: string;
  actual?: unknown;
  expected?: unknown;
  file?: string;
}

export interface FailureAnalysis {
  rootCause: string;
  suggestion: string;
  relatedFiles: string[];
  similarFailures?: TestFailure[];
  confidence: number;
}

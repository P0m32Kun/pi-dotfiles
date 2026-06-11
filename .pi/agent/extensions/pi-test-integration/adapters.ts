/**
 * Test framework adapters for pi-test-integration.
 *
 * Provides adapters for Vitest, Jest, and Pytest.
 */

import type {
  TestFrameworkAdapter,
  TestRunOptions,
  TestResult,
  TestCase,
  CoverageOptions,
  CoverageReport
} from './types.js';

/**
 * Vitest adapter.
 */
export class VitestAdapter implements TestFrameworkAdapter {
  name = 'vitest';

  async detect(projectPath: string): Promise<boolean> {
    try {
      // Check for vitest config files
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      
      const configFiles = [
        'vitest.config.ts',
        'vitest.config.js',
        'vitest.config.mts',
        'vite.config.ts',
        'vite.config.js'
      ];

      for (const config of configFiles) {
        try {
          await fs.access(path.join(projectPath, config));
          return true;
        } catch {
          // Continue
        }
      }

      // Check package.json for vitest dependency
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return !!(packageJson.devDependencies?.vitest || packageJson.dependencies?.vitest);
    } catch {
      return false;
    }
  }

  async runTests(options: TestRunOptions): Promise<TestResult> {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    const args = ['run'];
    if (options.pattern) args.push(options.pattern);
    if (options.bail) args.push('--bail');
    if (options.timeout) args.push(`--testTimeout=${options.timeout}`);

    try {
      const { stdout, stderr, exitCode } = await execAsync(
        `npx vitest ${args.join(' ')}`,
        {
          cwd: options.cwd,
          env: { ...process.env, ...options.env },
          timeout: options.timeout
        }
      );

      return this.parseOutput(stdout, stderr, exitCode);
    } catch (error: any) {
      return {
        status: 'error',
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        tests: [],
        error: error.message
      };
    }
  }

  private parseOutput(stdout: string, stderr: string, exitCode: number): TestResult {
    // Parse vitest JSON output
    try {
      const output = JSON.parse(stdout);
      const tests: TestCase[] = [];

      if (output.testResults) {
        for (const file of output.testResults) {
          for (const test of file.assertionResults || []) {
            tests.push({
              name: test.fullName || test.title,
              status: test.status === 'passed' ? 'passed' : test.status === 'failed' ? 'failed' : 'skipped',
              duration: test.duration || 0,
              error: test.failureMessages?.[0],
              file: file.name
            });
          }
        }
      }

      const passed = tests.filter(t => t.status === 'passed').length;
      const failed = tests.filter(t => t.status === 'failed').length;
      const skipped = tests.filter(t => t.status === 'skipped').length;

      return {
        status: exitCode === 0 ? 'passed' : 'failed',
        total: tests.length,
        passed,
        failed,
        skipped,
        duration: output.testResults?.[0]?.perfStats?.runtime || 0,
        tests
      };
    } catch {
      // Fallback: parse text output
      return {
        status: exitCode === 0 ? 'passed' : 'failed',
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        tests: [],
        error: stderr || stdout
      };
    }
  }
}

/**
 * Jest adapter.
 */
export class JestAdapter implements TestFrameworkAdapter {
  name = 'jest';

  async detect(projectPath: string): Promise<boolean> {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');

      // Check for jest config files
      const configFiles = [
        'jest.config.js',
        'jest.config.ts',
        'jest.config.mjs',
        'jest.config.cjs'
      ];

      for (const config of configFiles) {
        try {
          await fs.access(path.join(projectPath, config));
          return true;
        } catch {
          // Continue
        }
      }

      // Check package.json for jest dependency
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return !!(packageJson.devDependencies?.jest || packageJson.dependencies?.jest);
    } catch {
      return false;
    }
  }

  async runTests(options: TestRunOptions): Promise<TestResult> {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    const args = ['--json'];
    if (options.pattern) args.push(options.pattern);
    if (options.bail) args.push('--bail');
    if (options.timeout) args.push(`--testTimeout=${options.timeout}`);

    try {
      const { stdout, stderr, exitCode } = await execAsync(
        `npx jest ${args.join(' ')}`,
        {
          cwd: options.cwd,
          env: { ...process.env, ...options.env },
          timeout: options.timeout
        }
      );

      return this.parseOutput(stdout, stderr, exitCode);
    } catch (error: any) {
      return {
        status: 'error',
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        tests: [],
        error: error.message
      };
    }
  }

  private parseOutput(stdout: string, stderr: string, exitCode: number): TestResult {
    try {
      const output = JSON.parse(stdout);
      const tests: TestCase[] = [];

      if (output.testResults) {
        for (const file of output.testResults) {
          for (const test of file.assertionResults || []) {
            tests.push({
              name: test.fullName || test.title,
              status: test.status === 'passed' ? 'passed' : test.status === 'failed' ? 'failed' : 'skipped',
              duration: test.duration || 0,
              error: test.failureMessages?.[0],
              file: file.name
            });
          }
        }
      }

      return {
        status: exitCode === 0 ? 'passed' : 'failed',
        total: output.numTotalTests || 0,
        passed: output.numPassedTests || 0,
        failed: output.numFailedTests || 0,
        skipped: output.numPendingTests || 0,
        duration: output.testResults?.[0]?.perfStats?.runtime || 0,
        tests
      };
    } catch {
      return {
        status: exitCode === 0 ? 'passed' : 'failed',
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        tests: [],
        error: stderr || stdout
      };
    }
  }
}

/**
 * Pytest adapter.
 */
export class PytestAdapter implements TestFrameworkAdapter {
  name = 'pytest';

  async detect(projectPath: string): Promise<boolean> {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');

      // Check for pytest config files
      const configFiles = [
        'pytest.ini',
        'pyproject.toml',
        'setup.cfg',
        'conftest.py'
      ];

      for (const config of configFiles) {
        try {
          await fs.access(path.join(projectPath, config));
          return true;
        } catch {
          // Continue
        }
      }

      // Check for test files
      const files = await fs.readdir(projectPath);
      return files.some(f => f.startsWith('test_') || f.endsWith('_test.py'));
    } catch {
      return false;
    }
  }

  async runTests(options: TestRunOptions): Promise<TestResult> {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    const args = ['--tb=short', '-q'];
    if (options.pattern) args.push(options.pattern);
    if (options.bail) args.push('-x');

    try {
      const { stdout, stderr, exitCode } = await execAsync(
        `python -m pytest ${args.join(' ')}`,
        {
          cwd: options.cwd,
          env: { ...process.env, ...options.env },
          timeout: options.timeout
        }
      );

      return this.parseOutput(stdout, stderr, exitCode);
    } catch (error: any) {
      return {
        status: 'error',
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        tests: [],
        error: error.message
      };
    }
  }

  private parseOutput(stdout: string, stderr: string, exitCode: number): TestResult {
    // Parse pytest output
    const tests: TestCase[] = [];
    
    // Match test results from output
    const passedMatch = stdout.match(/(\d+) passed/);
    const failedMatch = stdout.match(/(\d+) failed/);
    const skippedMatch = stdout.match(/(\d+) skipped/);

    const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
    const skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0;

    return {
      status: exitCode === 0 ? 'passed' : 'failed',
      total: passed + failed + skipped,
      passed,
      failed,
      skipped,
      duration: 0,
      tests,
      error: failed > 0 ? stderr : undefined
    };
  }
}

/**
 * Detect which test framework is used in the project.
 */
export async function detectFramework(projectPath: string): Promise<TestFrameworkAdapter | null> {
  const adapters = [
    new VitestAdapter(),
    new JestAdapter(),
    new PytestAdapter()
  ];

  for (const adapter of adapters) {
    if (await adapter.detect(projectPath)) {
      return adapter;
    }
  }

  return null;
}

/**
 * Create an adapter by name.
 */
export function createAdapter(name: string): TestFrameworkAdapter {
  switch (name) {
    case 'vitest':
      return new VitestAdapter();
    case 'jest':
      return new JestAdapter();
    case 'pytest':
      return new PytestAdapter();
    default:
      throw new Error(`Unknown test framework: ${name}`);
  }
}

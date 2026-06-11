/**
 * Failure analyzer for pi-test-integration.
 *
 * Analyzes test failures and provides suggestions for fixes.
 */

import type { TestFailure, FailureAnalysis, FailureAnalyzer } from './types.js';

export class FailureAnalyzerImpl implements FailureAnalyzer {
  /**
   * Analyze a test failure and provide suggestions.
   */
  async analyze(failure: TestFailure): Promise<FailureAnalysis> {
    const error = failure.error.toLowerCase();
    
    // Analyze based on error patterns
    if (error.includes('expected') && error.includes('to equal')) {
      return this.analyzeAssertionError(failure);
    }

    if (error.includes('typeerror') || error.includes('cannot read property')) {
      return this.analyzeTypeError(failure);
    }

    if (error.includes('referenceerror') || error.includes('is not defined')) {
      return this.analyzeReferenceError(failure);
    }

    if (error.includes('syntaxerror') || error.includes('unexpected token')) {
      return this.analyzeSyntaxError(failure);
    }

    if (error.includes('timeout') || error.includes('timed out')) {
      return this.analyzeTimeoutError(failure);
    }

    if (error.includes('assertionerror') || error.includes('assert')) {
      return this.analyzeAssertionError(failure);
    }

    // Default analysis
    return this.analyzeGenericError(failure);
  }

  /**
   * Analyze assertion errors (expected vs actual).
   */
  private analyzeAssertionError(failure: TestFailure): FailureAnalysis {
    const suggestion = failure.actual !== undefined && failure.expected !== undefined
      ? `Expected ${JSON.stringify(failure.expected)} but got ${JSON.stringify(failure.actual)}. Check your test assertions.`
      : 'Assertion failed. Verify the expected values match the actual output.';

    return {
      rootCause: `Assertion error: ${failure.error}`,
      suggestion,
      relatedFiles: failure.file ? [failure.file] : [],
      confidence: 0.9
    };
  }

  /**
   * Analyze TypeError (undefined properties, etc).
   */
  private analyzeTypeError(failure: TestFailure): FailureAnalysis {
    let rootCause = 'TypeError detected';
    let suggestion = 'Check for undefined or null values before accessing properties.';

    if (failure.error.includes('undefined')) {
      rootCause = 'Accessing property of undefined';
      suggestion = 'Ensure the object is defined before accessing its properties. Use optional chaining (?.) or null checks.';
    } else if (failure.error.includes('null')) {
      rootCause = 'Accessing property of null';
      suggestion = 'Ensure the object is not null before accessing its properties.';
    } else if (failure.error.includes('not a function')) {
      rootCause = 'Calling non-function as function';
      suggestion = 'Check that the variable is actually a function before calling it.';
    }

    return {
      rootCause,
      suggestion,
      relatedFiles: failure.file ? [failure.file] : [],
      confidence: 0.85
    };
  }

  /**
   * Analyze ReferenceError (undefined variables).
   */
  private analyzeReferenceError(failure: TestFailure): FailureAnalysis {
    const match = failure.error.match(/(\w+) is not defined/);
    const variableName = match ? match[1] : 'variable';

    return {
      rootCause: `Variable "${variableName}" is not defined`,
      suggestion: `Ensure "${variableName}" is imported or declared before use. Check for typos in variable names.`,
      relatedFiles: failure.file ? [failure.file] : [],
      confidence: 0.9
    };
  }

  /**
   * Analyze SyntaxError.
   */
  private analyzeSyntaxError(failure: TestFailure): FailureAnalysis {
    return {
      rootCause: `Syntax error: ${failure.error}`,
      suggestion: 'Check for missing brackets, semicolons, or invalid syntax in your code.',
      relatedFiles: failure.file ? [failure.file] : [],
      confidence: 0.85
    };
  }

  /**
   * Analyze timeout errors.
   */
  private analyzeTimeoutError(failure: TestFailure): FailureAnalysis {
    return {
      rootCause: 'Test timed out',
      suggestion: 'The test took too long to complete. Consider:\n- Increasing the timeout\n- Optimizing the code\n- Checking for infinite loops\n- Using async/await properly',
      relatedFiles: failure.file ? [failure.file] : [],
      confidence: 0.8
    };
  }

  /**
   * Analyze generic errors.
   */
  private analyzeGenericError(failure: TestFailure): FailureAnalysis {
    return {
      rootCause: failure.error,
      suggestion: 'Review the error message and stack trace to identify the issue.',
      relatedFiles: failure.file ? [failure.file] : [],
      confidence: 0.5
    };
  }
}

/**
 * Create a failure analyzer.
 */
export function createFailureAnalyzer(): FailureAnalyzerImpl {
  return new FailureAnalyzerImpl();
}

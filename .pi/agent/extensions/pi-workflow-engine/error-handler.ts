/**
 * Error handling for pi-workflow-engine.
 *
 * Provides retry, skip, rollback, and fallback error handling strategies.
 */

export interface RetryConfig {
  maxAttempts: number;
  strategy?: 'immediate' | 'backoff' | 'adaptive';
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface ErrorHandlerConfig {
  maxRetries: number;
  strategies?: {
    retry?: RetryConfig;
    skip?: { enabled: boolean };
    rollback?: { enabled: boolean };
    fallback?: { enabled: boolean };
  };
  classifiers?: Record<string, (error: Error) => boolean>;
}

export interface HandleOptions {
  on_failure: 'stop' | 'retry' | 'skip' | 'rollback' | 'fallback';
  rollback?: () => Promise<unknown>;
  fallback?: () => Promise<unknown>;
  context?: Record<string, unknown>;
}

export interface HandleResult {
  status: 'success' | 'failure' | 'skipped' | 'rolled_back' | 'fallback';
  output?: unknown;
  error?: string;
  attempts: number;
  duration: number;
  errorType?: string;
}

export interface ErrorHistoryEntry {
  error: string;
  errorType: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private errorHistory: ErrorHistoryEntry[] = [];

  constructor(config: ErrorHandlerConfig) {
    this.config = config;
  }

  /**
   * Handle an operation with error handling strategy.
   */
  async handle(
    operation: () => Promise<unknown>,
    options: HandleOptions
  ): Promise<HandleResult> {
    const startTime = Date.now();
    const maxAttempts = options.on_failure === 'retry'
      ? (this.config.strategies?.retry?.maxAttempts ?? this.config.maxRetries)
      : 1;

    let lastError: Error | null = null;
    let attempts = 0;

    // Attempt operation
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;
      try {
        const output = await operation();
        return {
          status: 'success',
          output,
          attempts,
          duration: Date.now() - startTime
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Record error
        this.errorHistory.push({
          error: lastError.message,
          errorType: this.classifyError(lastError),
          timestamp: Date.now(),
          context: options.context
        });

        // Apply retry delay if not last attempt
        if (attempt < maxAttempts && options.on_failure === 'retry') {
          const delay = this.calculateRetryDelay(attempt);
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }

    // Handle failure based on strategy
    if (!lastError) {
      throw new Error('Operation failed without error');
    }

    switch (options.on_failure) {
      case 'retry':
      case 'stop':
        return {
          status: 'failure',
          error: lastError.message,
          attempts,
          duration: Date.now() - startTime,
          errorType: this.classifyError(lastError)
        };

      case 'skip':
        return {
          status: 'skipped',
          error: lastError.message,
          attempts,
          duration: Date.now() - startTime,
          errorType: this.classifyError(lastError)
        };

      case 'rollback':
        if (options.rollback) {
          await options.rollback();
        }
        return {
          status: 'rolled_back',
          error: lastError.message,
          attempts,
          duration: Date.now() - startTime,
          errorType: this.classifyError(lastError)
        };

      case 'fallback':
        if (options.fallback) {
          const output = await options.fallback();
          return {
            status: 'fallback',
            output,
            attempts,
            duration: Date.now() - startTime,
            errorType: this.classifyError(lastError)
          };
        }
        return {
          status: 'failure',
          error: lastError.message,
          attempts,
          duration: Date.now() - startTime,
          errorType: this.classifyError(lastError)
        };

      default:
        return {
          status: 'failure',
          error: lastError.message,
          attempts,
          duration: Date.now() - startTime,
          errorType: this.classifyError(lastError)
        };
    }
  }

  /**
   * Classify an error type.
   */
  classifyError(error: Error): string {
    const message = error.message.toLowerCase();

    // Check custom classifiers first
    if (this.config.classifiers) {
      for (const [type, classifier] of Object.entries(this.config.classifiers)) {
        if (classifier(error)) {
          return type;
        }
      }
    }

    // Built-in classifiers
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('rate limit')) return 'rate_limit';
    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('permission') || message.includes('forbidden')) return 'permission';
    if (message.includes('not found') || message.includes('404')) return 'not_found';

    return 'unknown';
  }

  /**
   * Calculate retry delay based on strategy.
   */
  private calculateRetryDelay(attempt: number): number {
    const strategy = this.config.strategies?.retry?.strategy ?? 'immediate';
    const baseDelay = this.config.strategies?.retry?.baseDelayMs ?? 1000;
    const maxDelay = this.config.strategies?.retry?.maxDelayMs ?? 30000;

    switch (strategy) {
      case 'immediate':
        return 0;
      case 'backoff':
        return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      case 'adaptive':
        return Math.min(baseDelay * attempt, maxDelay);
      default:
        return 0;
    }
  }

  /**
   * Get error history.
   */
  getErrorHistory(): ErrorHistoryEntry[] {
    return [...this.errorHistory];
  }

  /**
   * Clear error history.
   */
  clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Get error statistics.
   */
  getStats(): { total: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const entry of this.errorHistory) {
      byType[entry.errorType] = (byType[entry.errorType] ?? 0) + 1;
    }
    return {
      total: this.errorHistory.length,
      byType
    };
  }
}

/**
 * Create an error handler from configuration.
 */
export function createErrorHandler(config: ErrorHandlerConfig): ErrorHandler {
  return new ErrorHandler(config);
}

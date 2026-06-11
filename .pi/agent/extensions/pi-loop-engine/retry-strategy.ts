/**
 * Retry strategies for pi-loop-engine.
 *
 * Provides multiple retry strategies: immediate, backoff, and adaptive.
 */

export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  lastError: Error;
  elapsedMs: number;
}

export interface RetryResult {
  retry: boolean;
  delayMs: number;
  reason?: string;
}

export interface RetryStrategy {
  name: string;
  shouldRetry(context: RetryContext): Promise<RetryResult>;
}

export interface ImmediateStrategyConfig {
  maxAttempts: number;
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Immediate retry strategy - retries immediately without delay.
 */
export class ImmediateStrategy implements RetryStrategy {
  name = 'immediate';
  private config: ImmediateStrategyConfig;

  constructor(config: ImmediateStrategyConfig) {
    this.config = config;
  }

  async shouldRetry(context: RetryContext): Promise<RetryResult> {
    if (context.attempt >= this.config.maxAttempts) {
      return { retry: false, delayMs: 0, reason: 'maxAttempts reached' };
    }

    if (this.config.shouldRetry && !this.config.shouldRetry(context.lastError)) {
      return { retry: false, delayMs: 0, reason: 'shouldRetry returned false' };
    }

    return { retry: true, delayMs: 0 };
  }
}

export interface BackoffStrategyConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  jitter?: boolean;
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Exponential backoff retry strategy.
 *
 * Increases delay with each attempt using exponential backoff.
 * Supports optional jitter to avoid thundering herd.
 */
export class BackoffStrategy implements RetryStrategy {
  name = 'backoff';
  private config: Required<Omit<BackoffStrategyConfig, 'shouldRetry'>> & Pick<BackoffStrategyConfig, 'shouldRetry'>;

  constructor(config: BackoffStrategyConfig) {
    this.config = {
      maxAttempts: config.maxAttempts,
      baseDelayMs: config.baseDelayMs,
      maxDelayMs: config.maxDelayMs ?? 30000,
      jitter: config.jitter ?? true,
      shouldRetry: config.shouldRetry
    };
  }

  async shouldRetry(context: RetryContext): Promise<RetryResult> {
    if (context.attempt >= this.config.maxAttempts) {
      return { retry: false, delayMs: 0, reason: 'maxAttempts reached' };
    }

    if (this.config.shouldRetry && !this.config.shouldRetry(context.lastError)) {
      return { retry: false, delayMs: 0, reason: 'shouldRetry returned false' };
    }

    // Calculate exponential backoff
    let delay = this.config.baseDelayMs * Math.pow(2, context.attempt - 1);
    
    // Apply max delay cap
    delay = Math.min(delay, this.config.maxDelayMs);
    
    // Apply jitter if enabled
    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return { retry: true, delayMs: Math.round(delay) };
  }
}

export interface AdaptiveStrategyConfig {
  maxAttempts: number;
  baseDelayMs: number;
  errorDelays?: Record<string, number>;
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Adaptive retry strategy.
 *
 * Adjusts delay based on error type.
 * Different error types can have different delay configurations.
 */
export class AdaptiveStrategy implements RetryStrategy {
  name = 'adaptive';
  private config: Required<Omit<AdaptiveStrategyConfig, 'shouldRetry'>> & Pick<AdaptiveStrategyConfig, 'shouldRetry'>;

  constructor(config: AdaptiveStrategyConfig) {
    this.config = {
      maxAttempts: config.maxAttempts,
      baseDelayMs: config.baseDelayMs,
      errorDelays: config.errorDelays ?? {},
      shouldRetry: config.shouldRetry
    };
  }

  async shouldRetry(context: RetryContext): Promise<RetryResult> {
    if (context.attempt >= this.config.maxAttempts) {
      return { retry: false, delayMs: 0, reason: 'maxAttempts reached' };
    }

    if (this.config.shouldRetry && !this.config.shouldRetry(context.lastError)) {
      return { retry: false, delayMs: 0, reason: 'shouldRetry returned false' };
    }

    // Determine delay based on error type
    const errorMessage = context.lastError.message.toLowerCase();
    let delay = this.config.baseDelayMs;

    for (const [errorPattern, errorDelay] of Object.entries(this.config.errorDelays)) {
      if (errorPattern !== 'default' && errorMessage.includes(errorPattern.toLowerCase())) {
        delay = errorDelay;
        break;
      }
    }

    // Use default delay if no specific pattern matched
    if (delay === this.config.baseDelayMs && this.config.errorDelays.default) {
      delay = this.config.errorDelays.default;
    }

    return { retry: true, delayMs: delay };
  }
}

/**
 * Create a retry strategy instance based on type and configuration.
 */
export function createRetryStrategy(
  type: 'immediate' | 'backoff' | 'adaptive',
  config: Record<string, unknown>
): RetryStrategy {
  switch (type) {
    case 'immediate':
      return new ImmediateStrategy(config as ImmediateStrategyConfig);
    case 'backoff':
      return new BackoffStrategy(config as BackoffStrategyConfig);
    case 'adaptive':
      return new AdaptiveStrategy(config as AdaptiveStrategyConfig);
    default:
      throw new Error(`Unknown retry strategy type: ${type}`);
  }
}

/**
 * Utility: Sleep for specified milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

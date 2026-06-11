import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ImmediateStrategy,
  BackoffStrategy,
  AdaptiveStrategy,
  createRetryStrategy,
  type RetryStrategy,
  type RetryContext
} from './retry-strategy.js';

describe('retry-strategy', () => {
  describe('ImmediateStrategy', () => {
    it('should always retry immediately', async () => {
      const strategy = new ImmediateStrategy({ maxAttempts: 3 });
      
      const context: RetryContext = {
        attempt: 1,
        maxAttempts: 3,
        lastError: new Error('test'),
        elapsedMs: 0
      };

      const result = await strategy.shouldRetry(context);
      expect(result.retry).toBe(true);
      expect(result.delayMs).toBe(0);
    });

    it('should not retry after max attempts', async () => {
      const strategy = new ImmediateStrategy({ maxAttempts: 3 });
      
      const context: RetryContext = {
        attempt: 3,
        maxAttempts: 3,
        lastError: new Error('test'),
        elapsedMs: 100
      };

      const result = await strategy.shouldRetry(context);
      expect(result.retry).toBe(false);
    });

    it('should respect custom shouldRetry function', async () => {
      const strategy = new ImmediateStrategy({
        maxAttempts: 5,
        shouldRetry: (error) => error.message !== 'fatal'
      });
      
      const context: RetryContext = {
        attempt: 1,
        maxAttempts: 5,
        lastError: new Error('fatal'),
        elapsedMs: 0
      };

      const result = await strategy.shouldRetry(context);
      expect(result.retry).toBe(false);
    });
  });

  describe('BackoffStrategy', () => {
    it('should increase delay with each attempt', async () => {
      const strategy = new BackoffStrategy({
        maxAttempts: 5,
        baseDelayMs: 100,
        maxDelayMs: 10000
      });

      const delays: number[] = [];
      for (let attempt = 1; attempt <= 4; attempt++) {
        const context: RetryContext = {
          attempt,
          maxAttempts: 5,
          lastError: new Error('test'),
          elapsedMs: 0
        };
        const result = await strategy.shouldRetry(context);
        delays.push(result.delayMs);
      }

      // Each delay should be greater than the previous
      expect(delays[1]).toBeGreaterThan(delays[0]);
      expect(delays[2]).toBeGreaterThan(delays[1]);
      expect(delays[3]).toBeGreaterThan(delays[2]);
    });

    it('should respect maxDelayMs', async () => {
      const strategy = new BackoffStrategy({
        maxAttempts: 10,
        baseDelayMs: 1000,
        maxDelayMs: 5000
      });

      const context: RetryContext = {
        attempt: 10,
        maxAttempts: 10,
        lastError: new Error('test'),
        elapsedMs: 0
      };

      const result = await strategy.shouldRetry(context);
      expect(result.delayMs).toBeLessThanOrEqual(5000);
    });

    it('should not retry after max attempts', async () => {
      const strategy = new BackoffStrategy({
        maxAttempts: 3,
        baseDelayMs: 100
      });

      const context: RetryContext = {
        attempt: 3,
        maxAttempts: 3,
        lastError: new Error('test'),
        elapsedMs: 0
      };

      const result = await strategy.shouldRetry(context);
      expect(result.retry).toBe(false);
    });

    it('should support jitter', async () => {
      const strategy = new BackoffStrategy({
        maxAttempts: 5,
        baseDelayMs: 1000,
        jitter: true
      });

      const context: RetryContext = {
        attempt: 2,
        maxAttempts: 5,
        lastError: new Error('test'),
        elapsedMs: 0
      };

      const result = await strategy.shouldRetry(context);
      // With jitter, delay should be less than base * 2^attempt
      expect(result.delayMs).toBeLessThan(1000 * Math.pow(2, 2));
    });
  });

  describe('AdaptiveStrategy', () => {
    it('should adjust delay based on error type', async () => {
      const strategy = new AdaptiveStrategy({
        maxAttempts: 5,
        baseDelayMs: 100,
        errorDelays: {
          'rate_limit': 5000,
          'timeout': 2000,
          'default': 100
        }
      });

      const rateLimitContext: RetryContext = {
        attempt: 1,
        maxAttempts: 5,
        lastError: new Error('rate_limit exceeded'),
        elapsedMs: 0
      };

      const timeoutContext: RetryContext = {
        attempt: 1,
        maxAttempts: 5,
        lastError: new Error('timeout occurred'),
        elapsedMs: 0
      };

      const rateLimitResult = await strategy.shouldRetry(rateLimitContext);
      const timeoutResult = await strategy.shouldRetry(timeoutContext);

      expect(rateLimitResult.delayMs).toBe(5000);
      expect(timeoutResult.delayMs).toBe(2000);
    });

    it('should use default delay for unknown errors', async () => {
      const strategy = new AdaptiveStrategy({
        maxAttempts: 5,
        baseDelayMs: 100,
        errorDelays: {
          'rate_limit': 5000,
          'default': 100
        }
      });

      const context: RetryContext = {
        attempt: 1,
        maxAttempts: 5,
        lastError: new Error('unknown error'),
        elapsedMs: 0
      };

      const result = await strategy.shouldRetry(context);
      expect(result.delayMs).toBe(100);
    });

    it('should not retry after max attempts', async () => {
      const strategy = new AdaptiveStrategy({
        maxAttempts: 3,
        baseDelayMs: 100
      });

      const context: RetryContext = {
        attempt: 3,
        maxAttempts: 3,
        lastError: new Error('test'),
        elapsedMs: 0
      };

      const result = await strategy.shouldRetry(context);
      expect(result.retry).toBe(false);
    });
  });

  describe('createRetryStrategy', () => {
    it('should create ImmediateStrategy', () => {
      const strategy = createRetryStrategy('immediate', { maxAttempts: 3 });
      expect(strategy).toBeInstanceOf(ImmediateStrategy);
    });

    it('should create BackoffStrategy', () => {
      const strategy = createRetryStrategy('backoff', { maxAttempts: 3, baseDelayMs: 100 });
      expect(strategy).toBeInstanceOf(BackoffStrategy);
    });

    it('should create AdaptiveStrategy', () => {
      const strategy = createRetryStrategy('adaptive', { maxAttempts: 3 });
      expect(strategy).toBeInstanceOf(AdaptiveStrategy);
    });

    it('should throw for unknown strategy type', () => {
      expect(() => createRetryStrategy('unknown' as any, { maxAttempts: 3 })).toThrow();
    });
  });
});

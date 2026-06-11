import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorHandler, type ErrorHandlerConfig } from './error-handler.js';

describe('ErrorHandler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = new ErrorHandler({
      maxRetries: 3,
      strategies: {
        retry: { maxAttempts: 3, strategy: 'immediate' },
        skip: { enabled: true },
        rollback: { enabled: true },
        fallback: { enabled: true }
      }
    });
  });

  describe('handle', () => {
    it('should retry on failure', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      });

      const result = await handler.handle(operation, { on_failure: 'retry' });

      expect(result.status).toBe('success');
      expect(result.attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should skip on failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Step failed'));

      const result = await handler.handle(operation, { on_failure: 'skip' });

      expect(result.status).toBe('skipped');
      expect(result.error).toBe('Step failed');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should rollback on failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Step failed'));
      const rollback = vi.fn().mockResolvedValue({ rolledBack: true });

      const result = await handler.handle(operation, {
        on_failure: 'rollback',
        rollback
      });

      expect(result.status).toBe('rolled_back');
      expect(rollback).toHaveBeenCalled();
    });

    it('should use fallback on failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Step failed'));
      const fallback = vi.fn().mockResolvedValue({ fallback: true });

      const result = await handler.handle(operation, {
        on_failure: 'fallback',
        fallback
      });

      expect(result.status).toBe('fallback');
      expect(result.output).toEqual({ fallback: true });
      expect(fallback).toHaveBeenCalled();
    });

    it('should stop on failure by default', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Step failed'));

      const result = await handler.handle(operation, { on_failure: 'stop' });

      expect(result.status).toBe('failure');
      expect(result.error).toBe('Step failed');
    });
  });

  describe('retry strategies', () => {
    it('should use backoff strategy', async () => {
      const delays: number[] = [];
      const originalSetTimeout = globalThis.setTimeout;
      
      globalThis.setTimeout = vi.fn().mockImplementation((fn, delay) => {
        delays.push(delay);
        return originalSetTimeout(fn, 0);
      });

      const handler = new ErrorHandler({
        maxRetries: 3,
        strategies: {
          retry: { maxAttempts: 3, strategy: 'backoff', baseDelayMs: 100 }
        }
      });

      let attempts = 0;
      const operation = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      });

      await handler.handle(operation, { on_failure: 'retry' });

      globalThis.setTimeout = originalSetTimeout;

      expect(delays.length).toBe(2);
      expect(delays[1]).toBeGreaterThan(delays[0]);
    });

    it('should respect max attempts', async () => {
      const handler = new ErrorHandler({
        maxRetries: 2,
        strategies: {
          retry: { maxAttempts: 2, strategy: 'immediate' }
        }
      });

      const operation = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      const result = await handler.handle(operation, { on_failure: 'retry' });

      expect(result.status).toBe('failure');
      expect(result.attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('error classification', () => {
    it('should classify errors', () => {
      expect(handler.classifyError(new Error('timeout'))).toBe('timeout');
      expect(handler.classifyError(new Error('rate limit exceeded'))).toBe('rate_limit');
      expect(handler.classifyError(new Error('network error'))).toBe('network');
      expect(handler.classifyError(new Error('unknown'))).toBe('unknown');
    });

    it('should use custom classifier', () => {
      const customHandler = new ErrorHandler({
        maxRetries: 3,
        classifiers: {
          custom: (error) => error.message.includes('custom')
        }
      });

      expect(customHandler.classifyError(new Error('custom error'))).toBe('custom');
    });
  });

  describe('error history', () => {
    it('should track error history', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Test error'));

      await handler.handle(operation, { on_failure: 'skip' });
      await handler.handle(operation, { on_failure: 'skip' });

      const history = handler.getErrorHistory();
      expect(history).toHaveLength(2);
      expect(history[0].error).toBe('Test error');
    });

    it('should clear error history', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Test error'));

      await handler.handle(operation, { on_failure: 'skip' });
      handler.clearHistory();

      const history = handler.getErrorHistory();
      expect(history).toHaveLength(0);
    });
  });
});

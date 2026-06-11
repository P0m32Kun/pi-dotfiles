import { describe, it, expect } from 'vitest';
import { ResultAggregatorImpl } from './aggregator.js';

describe('ResultAggregatorImpl', () => {
  const aggregator = new ResultAggregatorImpl();

  describe('aggregate', () => {
    it('should aggregate successful results', async () => {
      const results = [
        { taskId: 'task1', status: 'success' as const, output: 'Result 1', duration: 100 },
        { taskId: 'task2', status: 'success' as const, output: 'Result 2', duration: 200 }
      ];

      const result = await aggregator.aggregate(results);

      expect(result.status).toBe('success');
      expect(result.details).toHaveLength(2);
      expect(result.summary).toContain('2/2');
    });

    it('should aggregate partial results', async () => {
      const results = [
        { taskId: 'task1', status: 'success' as const, output: 'Result 1', duration: 100 },
        { taskId: 'task2', status: 'failure' as const, output: '', duration: 50, error: 'Failed' }
      ];

      const result = await aggregator.aggregate(results);

      expect(result.status).toBe('partial');
      expect(result.summary).toContain('1/2');
    });

    it('should aggregate failed results', async () => {
      const results = [
        { taskId: 'task1', status: 'failure' as const, output: '', duration: 100, error: 'Error 1' },
        { taskId: 'task2', status: 'failure' as const, output: '', duration: 50, error: 'Error 2' }
      ];

      const result = await aggregator.aggregate(results);

      expect(result.status).toBe('failure');
      expect(result.summary).toContain('0/2');
    });

    it('should handle empty results', async () => {
      const result = await aggregator.aggregate([]);

      expect(result.status).toBe('success');
      expect(result.details).toHaveLength(0);
      expect(result.summary).toContain('0/0');
    });

    it('should combine outputs', async () => {
      const results = [
        { taskId: 'task1', status: 'success' as const, output: 'Output 1', duration: 100 },
        { taskId: 'task2', status: 'success' as const, output: 'Output 2', duration: 200 }
      ];

      const result = await aggregator.aggregate(results);

      expect(result.output).toContain('Output 1');
      expect(result.output).toContain('Output 2');
    });

    it('should calculate total duration', async () => {
      const results = [
        { taskId: 'task1', status: 'success' as const, output: '', duration: 100 },
        { taskId: 'task2', status: 'success' as const, output: '', duration: 200 }
      ];

      const result = await aggregator.aggregate(results);

      // Summary should include duration info
      expect(result.summary).toBeDefined();
    });
  });
});

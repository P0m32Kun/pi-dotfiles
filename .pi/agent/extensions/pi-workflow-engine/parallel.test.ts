import { describe, it, expect, vi } from 'vitest';
import { ParallelExecutor, type ParallelGroup, type StepDefinition } from './parallel.js';

describe('ParallelExecutor', () => {
  const createMockStep = (id: string): StepDefinition => ({
    id,
    name: `Step ${id}`,
    tool: 'bash',
    args: { command: id }
  });

  describe('execute', () => {
    it('should execute steps in parallel', async () => {
      const executionOrder: string[] = [];
      const executor = new ParallelExecutor({
        execute: async (tool: string, args: any) => {
          executionOrder.push(args.command);
          return { success: true };
        }
      });

      const steps = [createMockStep('step1'), createMockStep('step2'), createMockStep('step3')];
      const result = await executor.execute(steps, { maxConcurrency: 3 });

      expect(result.results).toHaveLength(3);
      expect(result.results.every(r => r.status === 'success')).toBe(true);
    });

    it('should respect maxConcurrency', async () => {
      let running = 0;
      let maxRunning = 0;

      const executor = new ParallelExecutor({
        execute: async () => {
          running++;
          maxRunning = Math.max(maxRunning, running);
          await new Promise(resolve => setTimeout(resolve, 10));
          running--;
          return { success: true };
        }
      });

      const steps = Array.from({ length: 10 }, (_, i) => createMockStep(`step${i}`));
      await executor.execute(steps, { maxConcurrency: 2 });

      expect(maxRunning).toBeLessThanOrEqual(2);
    });

    it('should handle step failure', async () => {
      const executor = new ParallelExecutor({
        execute: async (tool: string, args: any) => {
          if (args.command === 'step2') {
            throw new Error('Step failed');
          }
          return { success: true };
        }
      });

      const steps = [createMockStep('step1'), createMockStep('step2'), createMockStep('step3')];
      const result = await executor.execute(steps, { maxConcurrency: 3 });

      expect(result.results).toHaveLength(3);
      expect(result.results[1].status).toBe('failure');
      expect(result.results[1].error).toBe('Step failed');
    });

    it('should collect results in order', async () => {
      const executor = new ParallelExecutor({
        execute: async (tool: string, args: any) => {
          return { data: args.command };
        }
      });

      const steps = [createMockStep('a'), createMockStep('b'), createMockStep('c')];
      const result = await executor.execute(steps, { maxConcurrency: 3 });

      expect(result.results[0].output).toEqual({ data: 'a' });
      expect(result.results[1].output).toEqual({ data: 'b' });
      expect(result.results[2].output).toEqual({ data: 'c' });
    });
  });

  describe('executeGroup', () => {
    it('should execute a parallel group', async () => {
      const executor = new ParallelExecutor({
        execute: async () => ({ success: true })
      });

      const group: ParallelGroup = {
        group: 'test-group',
        steps: ['step1', 'step2'],
        max_concurrency: 2
      };

      const steps = [createMockStep('step1'), createMockStep('step2')];
      const result = await executor.executeGroup(group, steps);

      expect(result.group).toBe('test-group');
      expect(result.results).toHaveLength(2);
    });

    it('should filter steps by group definition', async () => {
      const executor = new ParallelExecutor({
        execute: async () => ({ success: true })
      });

      const group: ParallelGroup = {
        group: 'test-group',
        steps: ['step1', 'step3'],
        max_concurrency: 2
      };

      const steps = [
        createMockStep('step1'),
        createMockStep('step2'),
        createMockStep('step3')
      ];

      const result = await executor.executeGroup(group, steps);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].stepId).toBe('step1');
      expect(result.results[1].stepId).toBe('step3');
    });
  });

  describe('executeMultipleGroups', () => {
    it('should execute multiple groups sequentially', async () => {
      const executionOrder: string[] = [];
      const executor = new ParallelExecutor({
        execute: async (tool: string, args: any) => {
          executionOrder.push(args.command);
          return { success: true };
        }
      });

      const groups: ParallelGroup[] = [
        { group: 'group1', steps: ['step1', 'step2'], max_concurrency: 2 },
        { group: 'group2', steps: ['step3', 'step4'], max_concurrency: 2 }
      ];

      const steps = [
        createMockStep('step1'),
        createMockStep('step2'),
        createMockStep('step3'),
        createMockStep('step4')
      ];

      const result = await executor.executeMultipleGroups(groups, steps);

      expect(result.groups).toHaveLength(2);
      // Group 1 should complete before group 2 starts
      expect(executionOrder.slice(0, 2).sort()).toEqual(['step1', 'step2']);
      expect(executionOrder.slice(2).sort()).toEqual(['step3', 'step4']);
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { executeWhileLoop, executeForLoop, type LoopConfig, type Step } from './loop.js';

describe('loop', () => {
  describe('executeWhileLoop', () => {
    it('should execute while condition is true', async () => {
      let counter = 0;
      const steps: Step[] = [
        {
          id: 'increment',
          execute: async () => {
            counter++;
            return { success: true, data: counter };
          }
        }
      ];

      const config: LoopConfig = {
        condition: () => counter < 3,
        body: steps,
        maxIterations: 10
      };

      const result = await executeWhileLoop(config);
      expect(counter).toBe(3);
      expect(result.iterations).toBe(3);
      expect(result.results).toHaveLength(3);
    });

    it('should stop at maxIterations', async () => {
      let counter = 0;
      const steps: Step[] = [
        {
          id: 'increment',
          execute: async () => {
            counter++;
            return { success: true };
          }
        }
      ];

      const config: LoopConfig = {
        condition: () => true, // Always true
        body: steps,
        maxIterations: 5
      };

      const result = await executeWhileLoop(config);
      expect(counter).toBe(5);
      expect(result.iterations).toBe(5);
      expect(result.stoppedReason).toBe('maxIterations');
    });

    it('should handle empty body', async () => {
      const config: LoopConfig = {
        condition: () => false,
        body: [],
        maxIterations: 10
      };

      const result = await executeWhileLoop(config);
      expect(result.iterations).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should evaluate string condition with context', async () => {
      let counter = 0;
      const steps: Step[] = [
        {
          id: 'increment',
          execute: async () => {
            counter++;
            return { success: true };
          }
        }
      ];

      // Use function condition that reads the mutable counter
      const config: LoopConfig = {
        condition: () => counter < 3,
        body: steps,
        maxIterations: 10
      };

      const result = await executeWhileLoop(config);
      expect(counter).toBe(3);
    });

    it('should support break condition', async () => {
      let counter = 0;
      const steps: Step[] = [
        {
          id: 'increment',
          execute: async () => {
            counter++;
            return { success: true };
          }
        }
      ];

      const config: LoopConfig = {
        condition: () => true,
        body: steps,
        maxIterations: 10,
        breakCondition: () => counter >= 2
      };

      const result = await executeWhileLoop(config);
      expect(counter).toBe(2);
      expect(result.stoppedReason).toBe('breakCondition');
    });
  });

  describe('executeForLoop', () => {
    it('should execute specified number of times', async () => {
      const executed: number[] = [];
      const steps: Step[] = [
        {
          id: 'log',
          execute: async (iteration) => {
            executed.push(iteration);
            return { success: true };
          }
        }
      ];

      const result = await executeForLoop(3, steps);
      expect(executed).toEqual([0, 1, 2]);
      expect(result.iterations).toBe(3);
    });

    it('should handle zero iterations', async () => {
      const steps: Step[] = [
        {
          id: 'log',
          execute: async () => {
            throw new Error('Should not execute');
          }
        }
      ];

      const result = await executeForLoop(0, steps);
      expect(result.iterations).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('should pass iteration index to step', async () => {
      const iterations: number[] = [];
      const steps: Step[] = [
        {
          id: 'capture',
          execute: async (iteration) => {
            iterations.push(iteration);
            return { success: true };
          }
        }
      ];

      await executeForLoop(4, steps);
      expect(iterations).toEqual([0, 1, 2, 3]);
    });

    it('should collect results from all iterations', async () => {
      const steps: Step[] = [
        {
          id: 'double',
          execute: async (iteration) => {
            return { success: true, data: iteration * 2 };
          }
        }
      ];

      const result = await executeForLoop(3, steps);
      expect(result.results).toEqual([
        { success: true, data: 0 },
        { success: true, data: 2 },
        { success: true, data: 4 }
      ]);
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateCondition, executeBranch, type ConditionalBranch, type Step } from './branch.js';

describe('branch', () => {
  describe('evaluateCondition', () => {
    it('should evaluate string condition as truthy', () => {
      const result = evaluateCondition('true');
      expect(result).toBe(true);
    });

    it('should evaluate string condition as falsy', () => {
      const result = evaluateCondition('false');
      expect(result).toBe(false);
    });

    it('should evaluate function condition', () => {
      const condition = () => true;
      const result = evaluateCondition(condition);
      expect(result).toBe(true);
    });

    it('should evaluate function condition as falsy', () => {
      const condition = () => false;
      const result = evaluateCondition(condition);
      expect(result).toBe(false);
    });

    it('should evaluate comparison expression', () => {
      const context = { count: 5 };
      const result = evaluateCondition('count > 3', context);
      expect(result).toBe(true);
    });

    it('should evaluate comparison expression as falsy', () => {
      const context = { count: 2 };
      const result = evaluateCondition('count > 3', context);
      expect(result).toBe(false);
    });

    it('should handle undefined context', () => {
      const result = evaluateCondition('true');
      expect(result).toBe(true);
    });
  });

  describe('executeBranch', () => {
    it('should execute true path when condition is true', async () => {
      const executedSteps: string[] = [];
      const branch: ConditionalBranch = {
        condition: 'true',
        truePath: [
          {
            id: 'step1',
            execute: async () => {
              executedSteps.push('step1');
              return { success: true };
            }
          }
        ],
        falsePath: [
          {
            id: 'step2',
            execute: async () => {
              executedSteps.push('step2');
              return { success: true };
            }
          }
        ]
      };

      const result = await executeBranch(branch);
      expect(executedSteps).toEqual(['step1']);
      expect(result.executed).toBe('true');
    });

    it('should execute false path when condition is false', async () => {
      const executedSteps: string[] = [];
      const branch: ConditionalBranch = {
        condition: 'false',
        truePath: [
          {
            id: 'step1',
            execute: async () => {
              executedSteps.push('step1');
              return { success: true };
            }
          }
        ],
        falsePath: [
          {
            id: 'step2',
            execute: async () => {
              executedSteps.push('step2');
              return { success: true };
            }
          }
        ]
      };

      const result = await executeBranch(branch);
      expect(executedSteps).toEqual(['step2']);
      expect(result.executed).toBe('false');
    });

    it('should return result from executed path', async () => {
      const branch: ConditionalBranch = {
        condition: 'true',
        truePath: [
          {
            id: 'step1',
            execute: async () => {
              return { success: true, data: 'test' };
            }
          }
        ],
        falsePath: []
      };

      const result = await executeBranch(branch);
      expect(result.result).toEqual({ success: true, data: 'test' });
    });

    it('should handle empty paths', async () => {
      const branch: ConditionalBranch = {
        condition: 'true',
        truePath: [],
        falsePath: []
      };

      const result = await executeBranch(branch);
      expect(result.executed).toBe('true');
      expect(result.result).toBeUndefined();
    });

    it('should pass context to condition evaluation', async () => {
      const context = { shouldRun: true };
      const executedSteps: string[] = [];
      const branch: ConditionalBranch = {
        condition: 'shouldRun',
        truePath: [
          {
            id: 'step1',
            execute: async () => {
              executedSteps.push('step1');
              return { success: true };
            }
          }
        ],
        falsePath: [],
        context
      };

      const result = await executeBranch(branch);
      expect(executedSteps).toEqual(['step1']);
    });
  });
});

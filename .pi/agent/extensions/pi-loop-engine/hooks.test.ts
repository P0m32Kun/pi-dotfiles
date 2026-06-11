import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HookSystemImpl, type Hook, type HookContext, type HookResult, type HookType } from './hooks.js';

describe('HookSystemImpl', () => {
  let hookSystem: HookSystemImpl;

  beforeEach(() => {
    hookSystem = new HookSystemImpl();
  });

  describe('register', () => {
    it('should register a hook', () => {
      const hook: Hook = {
        name: 'test-hook',
        type: 'before_loop',
        priority: 10,
        execute: async () => ({ continue: true })
      };

      hookSystem.register(hook);

      expect(hookSystem.list()).toHaveLength(1);
      expect(hookSystem.list()[0].name).toBe('test-hook');
    });

    it('should register multiple hooks', () => {
      hookSystem.register({
        name: 'hook1',
        type: 'before_loop',
        priority: 10,
        execute: async () => ({ continue: true })
      });

      hookSystem.register({
        name: 'hook2',
        type: 'after_loop',
        priority: 20,
        execute: async () => ({ continue: true })
      });

      expect(hookSystem.list()).toHaveLength(2);
    });

    it('should replace hook with same name', () => {
      const hook1: Hook = {
        name: 'test-hook',
        type: 'before_loop',
        priority: 10,
        execute: async () => ({ continue: true })
      };

      const hook2: Hook = {
        name: 'test-hook',
        type: 'before_loop',
        priority: 20,
        execute: async () => ({ continue: false })
      };

      hookSystem.register(hook1);
      hookSystem.register(hook2);

      expect(hookSystem.list()).toHaveLength(1);
      expect(hookSystem.list()[0].priority).toBe(20);
    });
  });

  describe('unregister', () => {
    it('should unregister a hook', () => {
      hookSystem.register({
        name: 'test-hook',
        type: 'before_loop',
        priority: 10,
        execute: async () => ({ continue: true })
      });

      hookSystem.unregister('test-hook');

      expect(hookSystem.list()).toHaveLength(0);
    });

    it('should do nothing when unregistering non-existent hook', () => {
      hookSystem.unregister('non-existent');

      expect(hookSystem.list()).toHaveLength(0);
    });
  });

  describe('execute', () => {
    it('should execute hooks in priority order', async () => {
      const executionOrder: number[] = [];

      hookSystem.register({
        name: 'hook2',
        type: 'before_loop',
        priority: 20,
        execute: async () => {
          executionOrder.push(2);
          return { continue: true };
        }
      });

      hookSystem.register({
        name: 'hook1',
        type: 'before_loop',
        priority: 10,
        execute: async () => {
          executionOrder.push(1);
          return { continue: true };
        }
      });

      await hookSystem.execute('before_loop', {
        task: 'test',
        state: { attempts: {}, failures: [], pendingFailures: [], totalRetries: 0, totalSuccesses: 0, lastUpdated: Date.now() }
      });

      expect(executionOrder).toEqual([1, 2]);
    });

    it('should stop execution when hook returns continue: false', async () => {
      const executionOrder: number[] = [];

      hookSystem.register({
        name: 'hook1',
        type: 'before_loop',
        priority: 10,
        execute: async () => {
          executionOrder.push(1);
          return { continue: false, message: 'Stop' };
        }
      });

      hookSystem.register({
        name: 'hook2',
        type: 'before_loop',
        priority: 20,
        execute: async () => {
          executionOrder.push(2);
          return { continue: true };
        }
      });

      const results = await hookSystem.execute('before_loop', {
        task: 'test',
        state: { attempts: {}, failures: [], pendingFailures: [], totalRetries: 0, totalSuccesses: 0, lastUpdated: Date.now() }
      });

      expect(executionOrder).toEqual([1]);
      expect(results).toHaveLength(1);
      expect(results[0].continue).toBe(false);
    });

    it('should only execute hooks matching the type', async () => {
      const executionOrder: string[] = [];

      hookSystem.register({
        name: 'before-hook',
        type: 'before_loop',
        priority: 10,
        execute: async () => {
          executionOrder.push('before');
          return { continue: true };
        }
      });

      hookSystem.register({
        name: 'after-hook',
        type: 'after_loop',
        priority: 10,
        execute: async () => {
          executionOrder.push('after');
          return { continue: true };
        }
      });

      await hookSystem.execute('before_loop', {
        task: 'test',
        state: { attempts: {}, failures: [], pendingFailures: [], totalRetries: 0, totalSuccesses: 0, lastUpdated: Date.now() }
      });

      expect(executionOrder).toEqual(['before']);
    });

    it('should support hooks with multiple types', async () => {
      const executionOrder: string[] = [];

      hookSystem.register({
        name: 'multi-hook',
        type: ['before_loop', 'after_loop'],
        priority: 10,
        execute: async () => {
          executionOrder.push('multi');
          return { continue: true };
        }
      });

      await hookSystem.execute('before_loop', {
        task: 'test',
        state: { attempts: {}, failures: [], pendingFailures: [], totalRetries: 0, totalSuccesses: 0, lastUpdated: Date.now() }
      });

      await hookSystem.execute('after_loop', {
        task: 'test',
        state: { attempts: {}, failures: [], pendingFailures: [], totalRetries: 0, totalSuccesses: 0, lastUpdated: Date.now() }
      });

      expect(executionOrder).toEqual(['multi', 'multi']);
    });
  });

  describe('enable/disable', () => {
    it('should disable and enable a hook', async () => {
      const executionOrder: number[] = [];

      hookSystem.register({
        name: 'test-hook',
        type: 'before_loop',
        priority: 10,
        execute: async () => {
          executionOrder.push(1);
          return { continue: true };
        }
      });

      // Disable hook
      hookSystem.disable('test-hook');

      await hookSystem.execute('before_loop', {
        task: 'test',
        state: { attempts: {}, failures: [], pendingFailures: [], totalRetries: 0, totalSuccesses: 0, lastUpdated: Date.now() }
      });

      expect(executionOrder).toEqual([]);

      // Enable hook
      hookSystem.enable('test-hook');

      await hookSystem.execute('before_loop', {
        task: 'test',
        state: { attempts: {}, failures: [], pendingFailures: [], totalRetries: 0, totalSuccesses: 0, lastUpdated: Date.now() }
      });

      expect(executionOrder).toEqual([1]);
    });
  });
});

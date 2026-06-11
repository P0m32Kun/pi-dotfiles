import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutomationTriggerManagerImpl, type TriggerConfig, type TriggerResult } from './triggers.js';

describe('AutomationTriggerManagerImpl', () => {
  let manager: AutomationTriggerManagerImpl;

  beforeEach(() => {
    manager = new AutomationTriggerManagerImpl();
  });

  afterEach(async () => {
    await manager.stop();
  });

  describe('register', () => {
    it('should register a trigger', () => {
      const config: TriggerConfig = {
        type: 'cron',
        name: 'test-trigger',
        enabled: true,
        config: { schedule: '*/5 * * * *' },
        task: 'test task'
      };

      manager.register(config);

      expect(manager.list()).toHaveLength(1);
      expect(manager.list()[0].name).toBe('test-trigger');
    });

    it('should register multiple triggers', () => {
      manager.register({
        type: 'cron',
        name: 'trigger1',
        enabled: true,
        config: { schedule: '*/5 * * * *' },
        task: 'task1'
      });

      manager.register({
        type: 'cron',
        name: 'trigger2',
        enabled: true,
        config: { schedule: '*/10 * * * *' },
        task: 'task2'
      });

      expect(manager.list()).toHaveLength(2);
    });
  });

  describe('unregister', () => {
    it('should unregister a trigger', () => {
      manager.register({
        type: 'cron',
        name: 'test-trigger',
        enabled: true,
        config: { schedule: '*/5 * * * *' },
        task: 'test task'
      });

      manager.unregister('test-trigger');

      expect(manager.list()).toHaveLength(0);
    });
  });

  describe('enable/disable', () => {
    it('should enable and disable a trigger', () => {
      manager.register({
        type: 'cron',
        name: 'test-trigger',
        enabled: true,
        config: { schedule: '*/5 * * * *' },
        task: 'test task'
      });

      manager.disable('test-trigger');
      expect(manager.list()[0].enabled).toBe(false);

      manager.enable('test-trigger');
      expect(manager.list()[0].enabled).toBe(true);
    });
  });

  describe('trigger', () => {
    it('should manually trigger a task', async () => {
      const taskFn = vi.fn().mockResolvedValue(undefined);

      manager.register({
        type: 'cron',
        name: 'test-trigger',
        enabled: true,
        config: { schedule: '*/5 * * * *' },
        task: 'test task',
        action: taskFn
      });

      const result = await manager.trigger('test-trigger');

      expect(result.success).toBe(true);
      expect(taskFn).toHaveBeenCalled();
    });

    it('should return error for non-existent trigger', async () => {
      const result = await manager.trigger('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

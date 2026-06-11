import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from './core.js';
import type { WorkflowDefinition, ToolExecutor } from './types.js';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let mockToolExecutor: ToolExecutor;

  beforeEach(() => {
    mockToolExecutor = {
      execute: vi.fn().mockResolvedValue({ success: true })
    };
    engine = new WorkflowEngine(mockToolExecutor);
  });

  describe('load', () => {
    it('should load a valid workflow definition', async () => {
      const definition: WorkflowDefinition = {
        name: 'test-workflow',
        version: '1.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            tool: 'bash',
            args: { command: 'echo hello' }
          }
        ]
      };

      await engine.load(definition);
      const status = engine.getStatus();
      expect(status.loaded).toBe(true);
      expect(status.name).toBe('test-workflow');
    });

    it('should reject workflow without steps', async () => {
      const definition: WorkflowDefinition = {
        name: 'empty-workflow',
        version: '1.0',
        steps: []
      };

      await expect(engine.load(definition)).rejects.toThrow('Workflow must have at least one step');
    });

    it('should reject workflow with duplicate step ids', async () => {
      const definition: WorkflowDefinition = {
        name: 'duplicate-workflow',
        version: '1.0',
        steps: [
          { id: 'step1', name: 'Step 1', tool: 'bash', args: {} },
          { id: 'step1', name: 'Step 1 Duplicate', tool: 'bash', args: {} }
        ]
      };

      await expect(engine.load(definition)).rejects.toThrow('Duplicate step id: step1');
    });
  });

  describe('execute', () => {
    it('should execute a simple workflow', async () => {
      const definition: WorkflowDefinition = {
        name: 'simple-workflow',
        version: '1.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            tool: 'bash',
            args: { command: 'echo hello' }
          }
        ]
      };

      await engine.load(definition);
      const result = await engine.execute();

      expect(result.status).toBe('completed');
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].status).toBe('success');
      expect(mockToolExecutor.execute).toHaveBeenCalledWith('bash', { command: 'echo hello' });
    });

    it('should execute steps in dependency order', async () => {
      const executionOrder: string[] = [];
      mockToolExecutor.execute = vi.fn().mockImplementation(async (tool: string, args: any) => {
        executionOrder.push(args.command);
        return { success: true };
      });

      const definition: WorkflowDefinition = {
        name: 'ordered-workflow',
        version: '1.0',
        steps: [
          { id: 'step2', name: 'Step 2', tool: 'bash', args: { command: 'step2' }, depends_on: ['step1'] },
          { id: 'step1', name: 'Step 1', tool: 'bash', args: { command: 'step1' } },
          { id: 'step3', name: 'Step 3', tool: 'bash', args: { command: 'step3' }, depends_on: ['step2'] }
        ]
      };

      await engine.load(definition);
      const result = await engine.execute();

      expect(executionOrder).toEqual(['step1', 'step2', 'step3']);
      expect(result.status).toBe('completed');
    });

    it('should stop on failure when on_failure is stop', async () => {
      mockToolExecutor.execute = vi.fn()
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Step failed'));

      const definition: WorkflowDefinition = {
        name: 'fail-workflow',
        version: '1.0',
        steps: [
          { id: 'step1', name: 'Step 1', tool: 'bash', args: {} },
          { id: 'step2', name: 'Step 2', tool: 'bash', args: {}, on_failure: 'stop' }
        ]
      };

      await engine.load(definition);
      const result = await engine.execute();

      expect(result.status).toBe('failed');
      expect(result.steps[1].status).toBe('failure');
    });

    it('should retry on failure when configured', async () => {
      let callCount = 0;
      mockToolExecutor.execute = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      });

      const definition: WorkflowDefinition = {
        name: 'retry-workflow',
        version: '1.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            tool: 'bash',
            args: {},
            on_failure: 'retry',
            retry: { max_attempts: 3, strategy: 'immediate' }
          }
        ]
      };

      await engine.load(definition);
      const result = await engine.execute();

      expect(result.status).toBe('completed');
      expect(result.steps[0].attempts).toBe(3);
    });

    it('should skip step when on_failure is skip', async () => {
      mockToolExecutor.execute = vi.fn()
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('Step failed'));

      const definition: WorkflowDefinition = {
        name: 'skip-workflow',
        version: '1.0',
        steps: [
          { id: 'step1', name: 'Step 1', tool: 'bash', args: {} },
          { id: 'step2', name: 'Step 2', tool: 'bash', args: {}, on_failure: 'skip' }
        ]
      };

      await engine.load(definition);
      const result = await engine.execute();

      expect(result.status).toBe('completed');
      expect(result.steps[1].status).toBe('skipped');
    });
  });

  describe('condition evaluation', () => {
    it('should skip step when condition is false', async () => {
      const definition: WorkflowDefinition = {
        name: 'conditional-workflow',
        version: '1.0',
        steps: [
          { id: 'step1', name: 'Step 1', tool: 'bash', args: {} },
          { id: 'step2', name: 'Step 2', tool: 'bash', args: {}, condition: 'false' }
        ]
      };

      await engine.load(definition);
      const result = await engine.execute();

      expect(result.steps[0].status).toBe('success');
      expect(result.steps[1].status).toBe('skipped');
    });

    it('should execute step when condition is true', async () => {
      const definition: WorkflowDefinition = {
        name: 'conditional-workflow',
        version: '1.0',
        steps: [
          { id: 'step1', name: 'Step 1', tool: 'bash', args: {} },
          { id: 'step2', name: 'Step 2', tool: 'bash', args: {}, condition: 'true' }
        ]
      };

      await engine.load(definition);
      const result = await engine.execute();

      expect(result.steps[0].status).toBe('success');
      expect(result.steps[1].status).toBe('success');
    });
  });

  describe('parallel execution', () => {
    it('should execute parallel steps concurrently', async () => {
      const executionOrder: string[] = [];
      mockToolExecutor.execute = vi.fn().mockImplementation(async (tool: string, args: any) => {
        executionOrder.push(args.command);
        return { success: true };
      });

      const definition: WorkflowDefinition = {
        name: 'parallel-workflow',
        version: '1.0',
        steps: [
          { id: 'step1', name: 'Step 1', tool: 'bash', args: { command: 'step1' } },
          { id: 'step2', name: 'Step 2', tool: 'bash', args: { command: 'step2' } },
          { id: 'step3', name: 'Step 3', tool: 'bash', args: { command: 'step3' } }
        ],
        parallel: [
          { group: 'parallel-group', steps: ['step1', 'step2', 'step3'], max_concurrency: 3 }
        ]
      };

      await engine.load(definition);
      const result = await engine.execute();

      expect(result.status).toBe('completed');
      expect(result.steps).toHaveLength(3);
    });
  });

  describe('state machine', () => {
    it('should track state transitions', async () => {
      const definition: WorkflowDefinition = {
        name: 'state-workflow',
        version: '1.0',
        steps: [],
        states: [
          { name: 'idle', transitions: [{ to: 'running', event: 'start' }] },
          { name: 'running', transitions: [{ to: 'completed', event: 'finish' }] },
          { name: 'completed', transitions: [] }
        ],
        initial_state: 'idle'
      };

      await engine.load(definition);
      
      expect(engine.getCurrentState()).toBe('idle');
      
      await engine.triggerEvent('start');
      expect(engine.getCurrentState()).toBe('running');
      
      await engine.triggerEvent('finish');
      expect(engine.getCurrentState()).toBe('completed');
    });

    it('should reject invalid transitions', async () => {
      const definition: WorkflowDefinition = {
        name: 'state-workflow',
        version: '1.0',
        steps: [],
        states: [
          { name: 'idle', transitions: [{ to: 'running', event: 'start' }] }
        ],
        initial_state: 'idle'
      };

      await engine.load(definition);
      
      await expect(engine.triggerEvent('invalid')).rejects.toThrow('No transition for event "invalid" in state "idle"');
    });
  });

  describe('pause and resume', () => {
    it('should pause and resume workflow', async () => {
      let callCount = 0;
      mockToolExecutor.execute = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          engine.pause();
        }
        return { success: true };
      });

      const definition: WorkflowDefinition = {
        name: 'pausable-workflow',
        version: '1.0',
        steps: [
          { id: 'step1', name: 'Step 1', tool: 'bash', args: {} },
          { id: 'step2', name: 'Step 2', tool: 'bash', args: {} },
          { id: 'step3', name: 'Step 3', tool: 'bash', args: {} }
        ]
      };

      await engine.load(definition);
      const result = await engine.execute();

      expect(result.status).toBe('paused');
      expect(result.steps).toHaveLength(2);

      const resumeResult = await engine.resume();
      expect(resumeResult.status).toBe('completed');
      expect(resumeResult.steps).toHaveLength(3);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiAgentExecutor, type AgentExecutor, type SingleResult } from './executor.js';

describe('MultiAgentExecutor', () => {
  let mockAgentExecutor: AgentExecutor;
  let executor: MultiAgentExecutor;

  const createMockResult = (agent: string, task: string): SingleResult => ({
    agent,
    agentSource: 'user',
    task,
    exitCode: 0,
    output: `Result from ${agent}: ${task}`,
    duration: 100
  });

  beforeEach(() => {
    mockAgentExecutor = {
      execute: vi.fn().mockImplementation(async (agent: string, task: string) => {
        return createMockResult(agent, task);
      })
    };
    executor = new MultiAgentExecutor(mockAgentExecutor);
  });

  describe('single mode', () => {
    it('should execute single agent task', async () => {
      const result = await executor.execute({
        mode: 'single',
        agent: 'coder',
        task: 'Write hello world'
      });

      expect(result.mode).toBe('single');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].agent).toBe('coder');
      expect(result.results[0].task).toBe('Write hello world');
      expect(mockAgentExecutor.execute).toHaveBeenCalledWith('coder', 'Write hello world', undefined);
    });

    it('should pass cwd to executor', async () => {
      await executor.execute({
        mode: 'single',
        agent: 'coder',
        task: 'Write code',
        cwd: '/project'
      });

      expect(mockAgentExecutor.execute).toHaveBeenCalledWith('coder', 'Write code', '/project');
    });
  });

  describe('parallel mode', () => {
    it('should execute multiple tasks in parallel', async () => {
      const result = await executor.execute({
        mode: 'parallel',
        tasks: [
          { agent: 'coder', task: 'Task 1' },
          { agent: 'tester', task: 'Task 2' },
          { agent: 'reviewer', task: 'Task 3' }
        ]
      });

      expect(result.mode).toBe('parallel');
      expect(result.results).toHaveLength(3);
      expect(mockAgentExecutor.execute).toHaveBeenCalledTimes(3);
    });

    it('should respect maxConcurrency', async () => {
      let running = 0;
      let maxRunning = 0;

      mockAgentExecutor.execute = vi.fn().mockImplementation(async (agent: string, task: string) => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise(resolve => setTimeout(resolve, 10));
        running--;
        return createMockResult(agent, task);
      });

      await executor.execute({
        mode: 'parallel',
        tasks: [
          { agent: 'a', task: '1' },
          { agent: 'b', task: '2' },
          { agent: 'c', task: '3' },
          { agent: 'd', task: '4' }
        ],
        maxConcurrency: 2
      });

      expect(maxRunning).toBeLessThanOrEqual(2);
    });

    it('should handle task failure', async () => {
      mockAgentExecutor.execute = vi.fn()
        .mockResolvedValueOnce(createMockResult('a', '1'))
        .mockRejectedValueOnce(new Error('Task failed'))
        .mockResolvedValueOnce(createMockResult('c', '3'));

      const result = await executor.execute({
        mode: 'parallel',
        tasks: [
          { agent: 'a', task: '1' },
          { agent: 'b', task: '2' },
          { agent: 'c', task: '3' }
        ]
      });

      expect(result.results).toHaveLength(3);
      expect(result.results[1].exitCode).toBe(1);
      expect(result.results[1].error).toBe('Task failed');
    });
  });

  describe('chain mode', () => {
    it('should execute steps sequentially with {previous} placeholder', async () => {
      mockAgentExecutor.execute = vi.fn()
        .mockResolvedValueOnce(createMockResult('step1', 'First step'))
        .mockResolvedValueOnce({
          ...createMockResult('step2', 'Second step'),
          output: 'Final output'
        });

      const result = await executor.execute({
        mode: 'chain',
        steps: [
          { agent: 'step1', task: 'First step' },
          { agent: 'step2', task: 'Continue with {previous}' }
        ]
      });

      expect(result.mode).toBe('chain');
      expect(result.results).toHaveLength(2);
      
      // Second step should receive previous output
      const secondCall = (mockAgentExecutor.execute as any).mock.calls[1];
      expect(secondCall[1]).toContain('Result from step1');
    });

    it('should stop chain on failure', async () => {
      mockAgentExecutor.execute = vi.fn()
        .mockResolvedValueOnce(createMockResult('step1', 'First'))
        .mockRejectedValueOnce(new Error('Step failed'));

      const result = await executor.execute({
        mode: 'chain',
        steps: [
          { agent: 'step1', task: 'First' },
          { agent: 'step2', task: 'Second' },
          { agent: 'step3', task: 'Third' }
        ]
      });

      expect(result.results).toHaveLength(2);
      expect(result.results[1].exitCode).toBe(1);
    });
  });

  describe('auto mode', () => {
    it('should decompose task and execute', async () => {
      const decomposer = {
        decompose: vi.fn().mockResolvedValue([
          { id: 'sub1', description: 'Sub task 1', dependencies: [], priority: 1, type: 'code' },
          { id: 'sub2', description: 'Sub task 2', dependencies: ['sub1'], priority: 2, type: 'test' }
        ])
      };

      const aggregator = {
        aggregate: vi.fn().mockResolvedValue({
          status: 'success',
          output: 'Aggregated result',
          summary: 'All tasks completed',
          details: []
        })
      };

      const autoExecutor = new MultiAgentExecutor(mockAgentExecutor, decomposer, aggregator);

      const result = await autoExecutor.execute({
        mode: 'auto',
        task: 'Build a complete feature',
        decompose: true,
        aggregate: true
      });

      expect(result.mode).toBe('auto');
      expect(decomposer.decompose).toHaveBeenCalled();
      expect(mockAgentExecutor.execute).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle executor errors gracefully', async () => {
      mockAgentExecutor.execute = vi.fn().mockRejectedValue(new Error('Executor error'));

      const result = await executor.execute({
        mode: 'single',
        agent: 'coder',
        task: 'Fail task'
      });

      expect(result.results[0].exitCode).toBe(1);
      expect(result.results[0].error).toBe('Executor error');
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { TaskDecomposerImpl, CodeModuleStrategy, FeatureStrategy, TestStrategy } from './decomposer.js';

describe('TaskDecomposerImpl', () => {
  describe('decompose', () => {
    it('should decompose task using matching strategy', async () => {
      const strategy = new CodeModuleStrategy();
      const decomposer = new TaskDecomposerImpl([strategy]);

      const result = await decomposer.decompose('Implement user authentication module', {});

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].type).toBe('code');
    });

    it('should return single task when no strategy matches', async () => {
      const decomposer = new TaskDecomposerImpl([]);

      const result = await decomposer.decompose('Simple task', {});

      expect(result).toHaveLength(1);
      expect(result[0].description).toBe('Simple task');
    });

    it('should use first matching strategy', async () => {
      const strategy1 = { name: 's1', canHandle: () => true, decompose: async () => [{ id: '1', description: 'From s1', dependencies: [], priority: 1, type: 'code' as const }] };
      const strategy2 = { name: 's2', canHandle: () => true, decompose: async () => [{ id: '2', description: 'From s2', dependencies: [], priority: 1, type: 'code' as const }] };

      const decomposer = new TaskDecomposerImpl([strategy1, strategy2]);
      const result = await decomposer.decompose('task', {});

      expect(result[0].description).toBe('From s1');
    });
  });
});

describe('CodeModuleStrategy', () => {
  const strategy = new CodeModuleStrategy();

  it('should identify code module tasks', () => {
    expect(strategy.canHandle('Implement user module')).toBe(true);
    expect(strategy.canHandle('Create authentication service')).toBe(true);
    expect(strategy.canHandle('Build API endpoint')).toBe(true);
    expect(strategy.canHandle('Write documentation')).toBe(false);
  });

  it('should decompose into subtasks', async () => {
    const result = await strategy.decompose('Implement user authentication module', {});

    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.some(t => t.type === 'code')).toBe(true);
    expect(result.some(t => t.type === 'test')).toBe(true);
  });

  it('should set dependencies correctly', async () => {
    const result = await strategy.decompose('Create API endpoint', {});

    // Test task should depend on implementation task
    const testTask = result.find(t => t.type === 'test');
    const implementTask = result.find(t => t.description.includes('Implement'));

    if (testTask && implementTask) {
      expect(testTask.dependencies).toContain(implementTask.id);
    }
  });
});

describe('FeatureStrategy', () => {
  const strategy = new FeatureStrategy();

  it('should identify feature tasks', () => {
    expect(strategy.canHandle('Add user registration feature')).toBe(true);
    expect(strategy.canHandle('Implement search functionality')).toBe(true);
    expect(strategy.canHandle('Fix bug in login')).toBe(false);
  });

  it('should decompose feature into phases', async () => {
    const result = await strategy.decompose('Add user registration feature', {});

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some(t => t.type === 'code')).toBe(true);
  });
});

describe('TestStrategy', () => {
  const strategy = new TestStrategy();

  it('should identify test tasks', () => {
    expect(strategy.canHandle('Write unit tests for auth')).toBe(true);
    expect(strategy.canHandle('Add integration tests')).toBe(true);
    expect(strategy.canHandle('Create test suite')).toBe(true);
    expect(strategy.canHandle('Implement feature')).toBe(false);
  });

  it('should decompose test task', async () => {
    const result = await strategy.decompose('Write unit tests for authentication', {});

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].type).toBe('test');
  });
});

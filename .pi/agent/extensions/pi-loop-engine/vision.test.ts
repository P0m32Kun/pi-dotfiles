import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VisionManagerImpl, type Vision } from './vision.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('VisionManagerImpl', () => {
  let manager: VisionManagerImpl;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vision-test-'));
    manager = new VisionManagerImpl(tmpDir);
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('should load VISION.md file', async () => {
      const content = `# VISION.md

## 项目目标
构建一个高性能的 Web 应用

## 约束条件
- 不使用外部依赖
- 代码覆盖率 > 80%

## 当前阶段
实现用户认证模块

## 禁止事项
- 不要修改数据库 schema
- 不要删除现有测试`;

      await fs.promises.writeFile(path.join(tmpDir, 'VISION.md'), content, 'utf-8');

      const vision = await manager.load();

      expect(vision.goals).toContain('构建一个高性能的 Web 应用');
      expect(vision.constraints).toHaveLength(2);
      expect(vision.currentPhase).toBe('实现用户认证模块');
      expect(vision.forbidden).toHaveLength(2);
    });

    it('should return default vision when file not exists', async () => {
      const vision = await manager.load();

      expect(vision.goals).toEqual([]);
      expect(vision.constraints).toEqual([]);
      expect(vision.currentPhase).toBe('');
      expect(vision.forbidden).toEqual([]);
    });

    it('should load custom path', async () => {
      const customPath = path.join(tmpDir, 'custom-vision.md');
      const content = `## 项目目标
自定义目标`;

      await fs.promises.writeFile(customPath, content, 'utf-8');

      const vision = await manager.load(customPath);

      expect(vision.goals).toContain('自定义目标');
    });

    it('should handle invalid markdown gracefully', async () => {
      await fs.promises.writeFile(path.join(tmpDir, 'VISION.md'), 'invalid content', 'utf-8');

      const vision = await manager.load();

      expect(vision.goals).toEqual([]);
    });
  });

  describe('save', () => {
    it('should save vision to VISION.md', async () => {
      const vision: Vision = {
        goals: ['目标1', '目标2'],
        constraints: ['约束1'],
        currentPhase: '阶段1',
        forbidden: ['禁止1']
      };

      await manager.save(vision);

      const content = await fs.promises.readFile(path.join(tmpDir, 'VISION.md'), 'utf-8');
      expect(content).toContain('目标1');
      expect(content).toContain('约束1');
      expect(content).toContain('阶段1');
      expect(content).toContain('禁止1');
    });

    it('should save to custom path', async () => {
      const customPath = path.join(tmpDir, 'custom-vision.md');
      const vision: Vision = {
        goals: ['自定义目标'],
        constraints: [],
        currentPhase: '',
        forbidden: []
      };

      await manager.save(vision, customPath);

      const content = await fs.promises.readFile(customPath, 'utf-8');
      expect(content).toContain('自定义目标');
    });
  });

  describe('injectToPrompt', () => {
    it('should format vision for prompt injection', () => {
      const vision: Vision = {
        goals: ['目标1', '目标2'],
        constraints: ['约束1', '约束2'],
        currentPhase: '阶段1',
        forbidden: ['禁止1', '禁止2']
      };

      const prompt = manager.injectToPrompt(vision);

      expect(prompt).toContain('# 项目愿景');
      expect(prompt).toContain('## 目标');
      expect(prompt).toContain('- 目标1');
      expect(prompt).toContain('- 目标2');
      expect(prompt).toContain('## 约束');
      expect(prompt).toContain('- 约束1');
      expect(prompt).toContain('## 当前阶段');
      expect(prompt).toContain('阶段1');
      expect(prompt).toContain('## 禁止事项');
      expect(prompt).toContain('- 禁止1');
    });

    it('should handle empty vision', () => {
      const vision: Vision = {
        goals: [],
        constraints: [],
        currentPhase: '',
        forbidden: []
      };

      const prompt = manager.injectToPrompt(vision);

      expect(prompt).toContain('# 项目愿景');
    });
  });
});

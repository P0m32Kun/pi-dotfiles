import { describe, it, expect } from 'vitest';
import { DriftDetectorImpl, type Vision, type DriftResult } from './drift-detector.js';

describe('DriftDetectorImpl', () => {
  const detector = new DriftDetectorImpl();

  const sampleVision: Vision = {
    goals: ['构建一个高性能的 Web 应用', '支持 1000 并发用户'],
    constraints: ['不使用外部依赖', '代码覆盖率 > 80%', '响应时间 < 100ms'],
    currentPhase: '实现用户认证模块',
    forbidden: ['修改数据库 schema', '删除现有测试', '引入 breaking changes']
  };

  describe('checkDrift', () => {
    it('should detect forbidden task', async () => {
      const result = await detector.checkDrift('修改数据库 schema 添加新字段', sampleVision);

      expect(result.drifted).toBe(true);
      expect(result.reason).toContain('禁止事项');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect constraint violation', async () => {
      const result = await detector.checkDrift('添加 lodash 依赖', sampleVision);

      expect(result.drifted).toBe(true);
      expect(result.reason).toContain('约束');
    });

    it('should detect phase drift', async () => {
      const result = await detector.checkDrift('实现支付模块', sampleVision);

      expect(result.drifted).toBe(true);
      expect(result.reason).toContain('阶段');
    });

    it('should pass valid task', async () => {
      const result = await detector.checkDrift('实现用户登录功能', sampleVision);

      expect(result.drifted).toBe(false);
      expect(result.confidence).toBe(1.0);
    });

    it('should handle empty vision', async () => {
      const emptyVision: Vision = {
        goals: [],
        constraints: [],
        currentPhase: '',
        forbidden: []
      };

      const result = await detector.checkDrift('任何任务', emptyVision);

      expect(result.drifted).toBe(false);
    });

    it('should be case insensitive', async () => {
      const visionWithEnglish: Vision = {
        goals: ['Build high performance web app'],
        constraints: ['No external dependencies'],
        currentPhase: 'Implement user authentication',
        forbidden: ['Modify database schema', 'Delete existing tests']
      };

      const result = await detector.checkDrift('MODIFY DATABASE SCHEMA', visionWithEnglish);

      expect(result.drifted).toBe(true);
    });
  });
});

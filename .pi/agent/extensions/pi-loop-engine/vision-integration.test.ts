import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VisionManagerImpl, type Vision } from './vision.js';
import { DriftDetectorImpl } from './drift-detector.js';
import { VisionInjectorImpl } from './vision-injector.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('Vision Integration', () => {
  let visionManager: VisionManagerImpl;
  let driftDetector: DriftDetectorImpl;
  let visionInjector: VisionInjectorImpl;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vision-integration-'));
    visionManager = new VisionManagerImpl(tmpDir);
    driftDetector = new DriftDetectorImpl();
    visionInjector = new VisionInjectorImpl();
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  describe('Full workflow', () => {
    it('should load vision, check drift, and inject into prompt', async () => {
      // 1. Create VISION.md
      const vision: Vision = {
        goals: ['构建一个高性能的 Web 应用'],
        constraints: ['不使用外部依赖', '代码覆盖率 > 80%'],
        currentPhase: '实现用户认证模块',
        forbidden: ['修改数据库 schema', '删除现有测试']
      };
      await visionManager.save(vision);

      // 2. Load vision
      const loadedVision = await visionManager.load();
      expect(loadedVision.goals).toContain('构建一个高性能的 Web 应用');

      // 3. Check drift for valid task
      const validDrift = await driftDetector.checkDrift('实现用户登录功能', loadedVision);
      expect(validDrift.drifted).toBe(false);

      // 4. Check drift for invalid task
      const invalidDrift = await driftDetector.checkDrift('修改数据库 schema 添加新字段', loadedVision);
      expect(invalidDrift.drifted).toBe(true);

      // 5. Inject into prompt
      const injection = visionInjector.createInjection(loadedVision, invalidDrift);
      expect(injection).toContain('# 项目愿景');
      expect(injection).toContain('构建一个高性能的 Web 应用');
      expect(injection).toContain('⚠️ 目标漂移警告');
      expect(injection).toContain('违反禁止事项');
    });

    it('should handle missing VISION.md gracefully', async () => {
      // 1. Load vision (file doesn't exist)
      const vision = await visionManager.load();
      expect(vision.goals).toEqual([]);

      // 2. Check drift (should not drift with empty vision)
      const drift = await driftDetector.checkDrift('任何任务', vision);
      expect(drift.drifted).toBe(false);

      // 3. Inject into prompt
      const injection = visionInjector.createInjection(vision, drift);
      expect(injection).toContain('# 项目愿景');
    });

    it('should save and reload vision', async () => {
      // 1. Create and save vision
      const vision: Vision = {
        goals: ['目标1', '目标2'],
        constraints: ['约束1'],
        currentPhase: '阶段1',
        forbidden: ['禁止1']
      };
      await visionManager.save(vision);

      // 2. Reload vision
      const reloaded = await visionManager.load();

      // 3. Verify all fields
      expect(reloaded.goals).toEqual(['目标1', '目标2']);
      expect(reloaded.constraints).toEqual(['约束1']);
      expect(reloaded.currentPhase).toBe('阶段1');
      expect(reloaded.forbidden).toEqual(['禁止1']);
    });
  });
});

/**
 * Goal drift detector for pi-loop-engine.
 *
 * Detects when a task deviates from the project vision defined in VISION.md.
 */

import type { Vision } from './vision.js';

export interface DriftResult {
  drifted: boolean;
  reason?: string;
  suggestion?: string;
  confidence: number;
}

export interface DriftDetector {
  checkDrift(task: string, vision: Vision): Promise<DriftResult>;
}

export class DriftDetectorImpl implements DriftDetector {
  /**
   * Check if a task drifts from the project vision.
   */
  async checkDrift(task: string, vision: Vision): Promise<DriftResult> {
    const taskLower = task.toLowerCase();

    // Check forbidden items first (highest priority)
    const forbiddenResult = this.checkForbidden(taskLower, vision.forbidden);
    if (forbiddenResult.drifted) {
      return forbiddenResult;
    }

    // Check constraints
    const constraintResult = this.checkConstraints(taskLower, vision.constraints);
    if (constraintResult.drifted) {
      return constraintResult;
    }

    // Check phase alignment
    const phaseResult = this.checkPhase(taskLower, vision.currentPhase);
    if (phaseResult.drifted) {
      return phaseResult;
    }

    return { drifted: false, confidence: 1.0 };
  }

  /**
   * Check if task violates forbidden items.
   */
  private checkForbidden(task: string, forbidden: string[]): DriftResult {
    for (const item of forbidden) {
      const itemLower = item.toLowerCase();
      
      // Check for exact match or significant overlap
      if (task.includes(itemLower)) {
        return {
          drifted: true,
          reason: `违反禁止事项: ${item}`,
          suggestion: `请避免 "${item}"，参考 VISION.md 中的禁止事项`,
          confidence: 0.9
        };
      }

      // Check for keyword match (supports both Chinese and English)
      const keywords = itemLower.split(/[\s,，]+/).filter(k => k.length > 0);
      const matchCount = keywords.filter(k => task.includes(k)).length;
      if (matchCount >= keywords.length * 0.7 && keywords.length > 1) {
        return {
          drifted: true,
          reason: `可能违反禁止事项: ${item}`,
          suggestion: `请确认是否违反 "${item}"`,
          confidence: 0.7
        };
      }

      // Check English keywords in task (case-insensitive)
      const taskWords = task.split(/[\s,，]+/);
      const itemWords = itemLower.split(/[\s,，]+/);
      const englishMatch = itemWords.filter(w => 
        w.length > 2 && taskWords.some(tw => tw.includes(w) || w.includes(tw))
      ).length;
      if (englishMatch >= itemWords.length * 0.7 && itemWords.length > 1) {
        return {
          drifted: true,
          reason: `可能违反禁止事项: ${item}`,
          suggestion: `请确认是否违反 "${item}"`,
          confidence: 0.7
        };
      }
    }

    return { drifted: false, confidence: 1.0 };
  }

  /**
   * Check if task violates constraints.
   */
  private checkConstraints(task: string, constraints: string[]): DriftResult {
    for (const constraint of constraints) {
      const constraintLower = constraint.toLowerCase();

      // Check for dependency constraints
      if (constraintLower.includes('不使用外部依赖') || constraintLower.includes('no external dependencies')) {
        if (task.includes('npm install') || task.includes('yarn add') || task.includes('pnpm add') || 
            task.includes('依赖') || task.includes('dependency') || task.includes('dependencies')) {
          return {
            drifted: true,
            reason: '违反约束: 不使用外部依赖',
            suggestion: '请使用内置功能或重新实现所需功能',
            confidence: 0.85
          };
        }
      }

      // Check for coverage constraints
      if (constraintLower.includes('代码覆盖率') || constraintLower.includes('coverage')) {
        if (task.includes('删除测试') || task.includes('移除测试') || 
            task.includes('delete test') || task.includes('remove test')) {
          return {
            drifted: true,
            reason: '违反约束: 代码覆盖率要求',
            suggestion: '请保持或增加测试覆盖率',
            confidence: 0.8
          };
        }
      }
    }

    return { drifted: false, confidence: 1.0 };
  }

  /**
   * Check if task aligns with current phase.
   */
  private checkPhase(task: string, currentPhase: string): DriftResult {
    if (!currentPhase) {
      return { drifted: false, confidence: 1.0 };
    }

    const phaseLower = currentPhase.toLowerCase();
    const phaseKeywords = phaseLower.split(/\s+/).filter(k => k.length > 2);

    // If task has phase keywords, it's likely aligned
    const hasPhaseKeyword = phaseKeywords.some(k => task.includes(k));
    if (hasPhaseKeyword) {
      return { drifted: false, confidence: 1.0 };
    }

    // Check for common phase-incompatible keywords
    const incompatibleKeywords = [
      '支付', 'payment', 'pay',
      '认证', 'authentication', 'auth',
      '部署', 'deploy', 'deployment',
      '架构', 'architecture', 'refactor'
    ];

    const hasIncompatible = incompatibleKeywords.some(k => task.includes(k));
    if (hasIncompatible && !phaseKeywords.some(k => task.includes(k))) {
      return {
        drifted: true,
        reason: `任务不属于当前阶段: ${currentPhase}`,
        suggestion: `请专注于当前阶段: ${currentPhase}`,
        confidence: 0.6
      };
    }

    return { drifted: false, confidence: 1.0 };
  }
}

/**
 * Create a DriftDetector instance.
 */
export function createDriftDetector(): DriftDetectorImpl {
  return new DriftDetectorImpl();
}

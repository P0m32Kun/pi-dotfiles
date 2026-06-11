/**
 * Vision injector for pi-loop-engine.
 *
 * Injects VISION.md content into the system prompt.
 */

import type { Vision } from './vision.js';
import type { DriftResult } from './drift-detector.js';

export interface VisionInjector {
  /**
   * Format vision for prompt injection.
   */
  formatForPrompt(vision: Vision): string;

  /**
   * Format drift result for prompt injection.
   */
  formatDriftWarning(drift: DriftResult): string;

  /**
   * Create a complete injection with vision and drift check.
   */
  createInjection(vision: Vision, drift?: DriftResult): string;
}

export class VisionInjectorImpl implements VisionInjector {
  /**
   * Format vision for prompt injection.
   */
  formatForPrompt(vision: Vision): string {
    const parts: string[] = ['# 项目愿景\n'];

    if (vision.goals.length > 0) {
      parts.push('## 目标');
      for (const goal of vision.goals) {
        parts.push(`- ${goal}`);
      }
      parts.push('');
    }

    if (vision.constraints.length > 0) {
      parts.push('## 约束条件');
      for (const constraint of vision.constraints) {
        parts.push(`- ${constraint}`);
      }
      parts.push('');
    }

    if (vision.currentPhase) {
      parts.push('## 当前阶段');
      parts.push(vision.currentPhase);
      parts.push('');
    }

    if (vision.forbidden.length > 0) {
      parts.push('## 禁止事项');
      for (const forbidden of vision.forbidden) {
        parts.push(`- ${forbidden}`);
      }
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Format drift result for prompt injection.
   */
  formatDriftWarning(drift: DriftResult): string {
    if (!drift.drifted) {
      return '';
    }

    const parts: string[] = ['⚠️ 目标漂移警告\n'];

    if (drift.reason) {
      parts.push(`原因: ${drift.reason}`);
    }

    if (drift.suggestion) {
      parts.push(`建议: ${drift.suggestion}`);
    }

    parts.push(`置信度: ${(drift.confidence * 100).toFixed(0)}%`);

    return parts.join('\n');
  }

  /**
   * Create a complete injection with vision and drift check.
   */
  createInjection(vision: Vision, drift?: DriftResult): string {
    const parts: string[] = [];

    // Add vision
    parts.push(this.formatForPrompt(vision));

    // Add drift warning if drifted
    if (drift && drift.drifted) {
      parts.push(this.formatDriftWarning(drift));
    }

    return parts.join('\n');
  }
}

/**
 * Create a VisionInjector instance.
 */
export function createVisionInjector(): VisionInjectorImpl {
  return new VisionInjectorImpl();
}

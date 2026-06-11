/**
 * VISION.md management for pi-loop-engine.
 *
 * Provides loading, parsing, saving, and prompt injection for VISION.md files.
 * Used to prevent goal drift in long-running loops.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface Vision {
  goals: string[];
  constraints: string[];
  currentPhase: string;
  forbidden: string[];
  metadata?: Record<string, unknown>;
}

export interface VisionManager {
  load(filePath?: string): Promise<Vision>;
  save(vision: Vision, filePath?: string): Promise<void>;
  injectToPrompt(vision: Vision): string;
}

export class VisionManagerImpl implements VisionManager {
  private basePath: string;

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }

  /**
   * Load VISION.md file and parse it into a Vision object.
   */
  async load(filePath?: string): Promise<Vision> {
    const visionPath = filePath || path.join(this.basePath, 'VISION.md');

    try {
      const content = await fs.readFile(visionPath, 'utf-8');
      return this.parse(content);
    } catch (error) {
      // Return empty vision if file doesn't exist
      return {
        goals: [],
        constraints: [],
        currentPhase: '',
        forbidden: []
      };
    }
  }

  /**
   * Save Vision object to VISION.md file.
   */
  async save(vision: Vision, filePath?: string): Promise<void> {
    const visionPath = filePath || path.join(this.basePath, 'VISION.md');
    const content = this.format(vision);

    // Ensure directory exists
    const dir = path.dirname(visionPath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(visionPath, content, 'utf-8');
  }

  /**
   * Format Vision object for prompt injection.
   */
  injectToPrompt(vision: Vision): string {
    const parts: string[] = ['# 项目愿景'];

    if (vision.goals.length > 0) {
      parts.push('\n## 目标');
      for (const goal of vision.goals) {
        parts.push(`- ${goal}`);
      }
    }

    if (vision.constraints.length > 0) {
      parts.push('\n## 约束');
      for (const constraint of vision.constraints) {
        parts.push(`- ${constraint}`);
      }
    }

    if (vision.currentPhase) {
      parts.push('\n## 当前阶段');
      parts.push(vision.currentPhase);
    }

    if (vision.forbidden.length > 0) {
      parts.push('\n## 禁止事项');
      for (const forbidden of vision.forbidden) {
        parts.push(`- ${forbidden}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Parse markdown content into Vision object.
   */
  private parse(content: string): Vision {
    const vision: Vision = {
      goals: [],
      constraints: [],
      currentPhase: '',
      forbidden: []
    };

    const lines = content.split('\n');
    let currentSection: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect section headers
      if (trimmed.startsWith('## ')) {
        const section = trimmed.slice(3).trim().toLowerCase();
        
        if (section.includes('目标') || section.includes('goal')) {
          currentSection = 'goals';
        } else if (section.includes('约束') || section.includes('constraint')) {
          currentSection = 'constraints';
        } else if (section.includes('阶段') || section.includes('phase')) {
          currentSection = 'currentPhase';
        } else if (section.includes('禁止') || section.includes('forbidden')) {
          currentSection = 'forbidden';
        } else {
          currentSection = null;
        }
        continue;
      }

      // Capture items for list sections
      if (currentSection === 'goals' || currentSection === 'constraints' || currentSection === 'forbidden') {
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const item = trimmed.slice(2).trim();
          if (item) {
            vision[currentSection].push(item);
          }
        } else if (trimmed && !trimmed.startsWith('#')) {
          // Support plain text format (no list prefix)
          vision[currentSection].push(trimmed);
        }
      }

      // Capture phase content
      if (currentSection === 'currentPhase' && trimmed && !trimmed.startsWith('#')) {
        if (!vision.currentPhase) {
          vision.currentPhase = trimmed;
        }
      }
    }

    return vision;
  }

  /**
   * Format Vision object into markdown content.
   */
  private format(vision: Vision): string {
    const parts: string[] = ['# VISION.md'];

    parts.push('\n## 项目目标');
    if (vision.goals.length > 0) {
      for (const goal of vision.goals) {
        parts.push(`${goal}`);
      }
    } else {
      parts.push('(未定义)');
    }

    parts.push('\n## 约束条件');
    if (vision.constraints.length > 0) {
      for (const constraint of vision.constraints) {
        parts.push(`- ${constraint}`);
      }
    } else {
      parts.push('(无)');
    }

    parts.push('\n## 当前阶段');
    parts.push(vision.currentPhase || '(未定义)');

    parts.push('\n## 禁止事项');
    if (vision.forbidden.length > 0) {
      for (const forbidden of vision.forbidden) {
        parts.push(`- ${forbidden}`);
      }
    } else {
      parts.push('(无)');
    }

    return parts.join('\n');
  }
}

/**
 * Create a VisionManager instance.
 */
export function createVisionManager(basePath?: string): VisionManagerImpl {
  return new VisionManagerImpl(basePath);
}

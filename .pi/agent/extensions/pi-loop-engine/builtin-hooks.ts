/**
 * Built-in hooks for pi-loop-engine.
 *
 * Provides commonly used hooks for vision checking,
 * security checking, state saving, and logging.
 */

import type { Hook, HookContext, HookResult } from './hooks.js';
import type { VisionManager } from './vision.js';
import type { DriftDetector } from './drift-detector.js';
import type { VisionInjector } from './vision-injector.js';

/**
 * Create a vision check hook that checks for goal drift before each loop.
 */
export function createVisionCheckHook(
  visionManager: VisionManager,
  driftDetector: DriftDetector,
  visionInjector: VisionInjector
): Hook {
  return {
    name: 'vision-check',
    type: 'before_loop',
    priority: 10,
    enabled: true,
    execute: async (context: HookContext): Promise<HookResult> => {
      try {
        const vision = await visionManager.load();
        
        // Skip if no vision defined
        if (vision.goals.length === 0 && vision.forbidden.length === 0) {
          return { continue: true };
        }

        const drift = await driftDetector.checkDrift(context.task, vision);

        if (drift.drifted) {
          return {
            continue: false,
            message: visionInjector.formatDriftWarning(drift),
            inject: visionInjector.createInjection(vision, drift)
          };
        }

        return {
          continue: true,
          inject: visionInjector.formatForPrompt(vision)
        };
      } catch (error) {
        // Don't block on vision check errors
        return { continue: true };
      }
    }
  };
}

/**
 * Create a security check hook that validates tool calls.
 */
export function createSecurityCheckHook(): Hook {
  return {
    name: 'security-check',
    type: 'before_tool_call',
    priority: 20,
    enabled: true,
    execute: async (context: HookContext): Promise<HookResult> => {
      if (context.toolName === 'bash' && context.toolArgs?.command) {
        const command = context.toolArgs.command as string;

        // Check for dangerous commands
        const dangerousPatterns = [
          { pattern: /rm\s+-rf\s+\/(?!\w)/, name: 'rm -rf /' },
          { pattern: />\s*\/dev\/sd[a-z]/, name: 'dd to disk' },
          { pattern: /mkfs\./, name: 'mkfs' },
          { pattern: /:\(\)\{\s*:\|:&\s*\};:/, name: 'fork bomb' },
          { pattern: /chmod\s+777/, name: 'chmod 777' },
          { pattern: /curl.*\|\s*bash/, name: 'curl | bash' },
          { pattern: /wget.*\|\s*bash/, name: 'wget | bash' }
        ];

        for (const { pattern, name } of dangerousPatterns) {
          if (pattern.test(command)) {
            return {
              continue: false,
              message: `⚠️ 安全检查失败: 检测到危险命令 "${name}"`
            };
          }
        }

        // Warn on sudo
        if (command.includes('sudo')) {
          return {
            continue: true,
            message: '⚠️ 命令使用了 sudo，请确认权限需求'
          };
        }
      }

      return { continue: true };
    }
  };
}

/**
 * Create a state save hook that saves loop state after each iteration.
 */
export function createStateSaveHook(
  saveState: (state: unknown) => Promise<void>
): Hook {
  return {
    name: 'state-save',
    type: 'after_loop',
    priority: 100,
    enabled: true,
    execute: async (context: HookContext): Promise<HookResult> => {
      try {
        await saveState({
          task: context.task,
          state: context.state,
          timestamp: Date.now()
        });
      } catch (error) {
        // Don't block on save errors
        console.error('Failed to save loop state:', error);
      }

      return { continue: true };
    }
  };
}

/**
 * Create a logging hook that logs loop events.
 */
export function createLoggingHook(): Hook {
  return {
    name: 'logging',
    type: ['before_loop', 'after_loop', 'on_error'],
    priority: 200,
    enabled: true,
    execute: async (context: HookContext): Promise<HookResult> => {
      const timestamp = new Date().toISOString();

      switch (context.type) {
        case 'before_loop':
          console.log(`[${timestamp}] 🔄 Loop started: ${context.task}`);
          break;
        case 'after_loop':
          console.log(`[${timestamp}] ✅ Loop completed: ${context.task}`);
          break;
        case 'on_error':
          console.error(`[${timestamp}] ❌ Loop error: ${context.error?.message}`);
          break;
      }

      return { continue: true };
    }
  };
}

/**
 * Create a metrics hook that tracks loop performance.
 */
export function createMetricsHook(): Hook & { getMetrics: () => Metrics } {
  const metrics: Metrics = {
    totalLoops: 0,
    successfulLoops: 0,
    failedLoops: 0,
    averageDuration: 0,
    lastLoopTime: null
  };

  let startTime: number;

  return {
    name: 'metrics',
    type: ['before_loop', 'after_loop', 'on_error'],
    priority: 150,
    enabled: true,
    execute: async (context: HookContext): Promise<HookResult> => {
      switch (context.type) {
        case 'before_loop':
          startTime = Date.now();
          metrics.totalLoops++;
          metrics.lastLoopTime = new Date();
          break;
        case 'after_loop':
          metrics.successfulLoops++;
          const duration = Date.now() - startTime;
          metrics.averageDuration = 
            (metrics.averageDuration * (metrics.successfulLoops - 1) + duration) / metrics.successfulLoops;
          break;
        case 'on_error':
          metrics.failedLoops++;
          break;
      }

      return { continue: true };
    },
    getMetrics: () => ({ ...metrics })
  };
}

export interface Metrics {
  totalLoops: number;
  successfulLoops: number;
  failedLoops: number;
  averageDuration: number;
  lastLoopTime: Date | null;
}

/**
 * Create all default hooks.
 */
export function createDefaultHooks(
  visionManager: VisionManager,
  driftDetector: DriftDetector,
  visionInjector: VisionInjector,
  saveState?: (state: unknown) => Promise<void>
): Hook[] {
  const hooks: Hook[] = [
    createVisionCheckHook(visionManager, driftDetector, visionInjector),
    createSecurityCheckHook(),
    createLoggingHook()
  ];

  if (saveState) {
    hooks.push(createStateSaveHook(saveState));
  }

  return hooks;
}

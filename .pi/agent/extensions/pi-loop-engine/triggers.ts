/**
 * Automation triggers for pi-loop-engine.
 *
 * Provides cron, event, and file-based triggers for automated loop execution.
 */

export type TriggerType = 'cron' | 'event' | 'file';

export interface CronConfig {
  schedule: string;
  timezone?: string;
}

export interface EventConfig {
  source: 'git' | 'github' | 'issue' | 'custom';
  event: string;
  filter?: Record<string, unknown>;
}

export interface FileConfig {
  paths: string[];
  pattern: string;
  debounce?: number;
}

export interface TriggerConfig {
  type: TriggerType;
  name: string;
  enabled: boolean;
  config: CronConfig | EventConfig | FileConfig;
  task: string;
  action?: () => Promise<void>;
  stopCondition?: () => Promise<boolean>;
  maxRuns?: number;
}

export interface TriggerResult {
  success: boolean;
  trigger: string;
  task: string;
  output?: unknown;
  error?: string;
  duration: number;
}

export interface AutomationTriggerManager {
  register(config: TriggerConfig): void;
  unregister(name: string): void;
  enable(name: string): void;
  disable(name: string): void;
  trigger(name: string): Promise<TriggerResult>;
  list(): TriggerConfig[];
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class AutomationTriggerManagerImpl implements AutomationTriggerManager {
  private triggers: Map<string, TriggerConfig> = new Map();
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private running = false;
  private runCounts: Map<string, number> = new Map();

  register(config: TriggerConfig): void {
    this.triggers.set(config.name, config);
    this.runCounts.set(config.name, 0);
  }

  unregister(name: string): void {
    this.stopTrigger(name);
    this.triggers.delete(name);
    this.runCounts.delete(name);
  }

  enable(name: string): void {
    const trigger = this.triggers.get(name);
    if (trigger) {
      trigger.enabled = true;
      if (this.running) {
        this.startTrigger(trigger);
      }
    }
  }

  disable(name: string): void {
    const trigger = this.triggers.get(name);
    if (trigger) {
      trigger.enabled = false;
      this.stopTrigger(name);
    }
  }

  async trigger(name: string): Promise<TriggerResult> {
    const trigger = this.triggers.get(name);
    if (!trigger) {
      return {
        success: false,
        trigger: name,
        task: '',
        error: `Trigger "${name}" not found`,
        duration: 0
      };
    }
    return this.executeTrigger(trigger);
  }

  list(): TriggerConfig[] {
    return Array.from(this.triggers.values());
  }

  async start(): Promise<void> {
    this.running = true;
    for (const trigger of this.triggers.values()) {
      if (trigger.enabled) {
        this.startTrigger(trigger);
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    for (const name of this.timers.keys()) {
      this.stopTrigger(name);
    }
  }

  private startTrigger(trigger: TriggerConfig): void {
    if (trigger.type === 'cron') {
      this.startCronTrigger(trigger);
    }
  }

  private startCronTrigger(trigger: TriggerConfig): void {
    const cronConfig = trigger.config as CronConfig;
    const intervalMs = parseCronToMs(cronConfig.schedule);
    if (intervalMs <= 0) return;

    const timer = setInterval(async () => {
      if (!trigger.enabled) return;
      const runCount = this.runCounts.get(trigger.name) ?? 0;
      if (trigger.maxRuns && runCount >= trigger.maxRuns) {
        this.stopTrigger(trigger.name);
        return;
      }
      if (trigger.stopCondition && await trigger.stopCondition()) {
        this.stopTrigger(trigger.name);
        return;
      }
      await this.executeTrigger(trigger);
      this.runCounts.set(trigger.name, runCount + 1);
    }, intervalMs);

    this.timers.set(trigger.name, timer);
  }

  private stopTrigger(name: string): void {
    const timer = this.timers.get(name);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(name);
    }
  }

  private async executeTrigger(trigger: TriggerConfig): Promise<TriggerResult> {
    const startTime = Date.now();
    try {
      if (trigger.action) {
        await trigger.action();
      }
      return {
        success: true,
        trigger: trigger.name,
        task: trigger.task,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        trigger: trigger.name,
        task: trigger.task,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }
}

/**
 * Parse a simple cron expression to milliseconds.
 * Supports format: star-slash-N star star star star.
 */
function parseCronToMs(schedule: string): number {
  // Use RegExp constructor to avoid esbuild parsing */ as comment end
  const cronPattern = new RegExp('^(\\d+|\\*/\\d+)\\s+\\*\\s+\\*\\s+\\*\\s+\\*$');
  const match = schedule.match(cronPattern);
  if (match) {
    const first = match[1];
    if (first.startsWith('*/')) {
      return parseInt(first.slice(2)) * 60 * 1000;
    }
    return parseInt(first) * 60 * 1000;
  }
  return 60 * 1000;
}

export function createAutomationTriggerManager(): AutomationTriggerManagerImpl {
  return new AutomationTriggerManagerImpl();
}

/**
 * Hook system for pi-loop-engine.
 *
 * Provides registration, execution, and management of hooks
 * at various points in the loop lifecycle.
 */

export type HookType =
  | 'before_loop'      // Before loop starts
  | 'after_loop'       // After loop ends
  | 'before_tool_call' // Before tool call
  | 'after_tool_call'  // After tool call
  | 'on_error'         // On error
  | 'before_commit'    // Before commit
  | 'after_commit'     // After commit
  | 'before_agent'     // Before agent starts
  | 'after_agent';     // After agent ends

export interface LoopState {
  attempts: Record<string, number>;
  failures: unknown[];
  pendingFailures: unknown[];
  totalRetries: number;
  totalSuccesses: number;
  lastUpdated: number;
}

export interface HookContext {
  type: HookType;
  task: string;
  state: LoopState;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  error?: Error;
  metadata?: Record<string, unknown>;
}

export interface HookResult {
  continue: boolean;     // Whether to continue execution
  message?: string;      // Message
  inject?: string;       // Inject into context
  modify?: Record<string, unknown>; // Modify parameters
}

export interface Hook {
  name: string;
  type: HookType | HookType[];
  priority: number;      // Lower number = higher priority
  enabled: boolean;
  execute: (context: HookContext) => Promise<HookResult>;
}

export interface HookSystem {
  register(hook: Hook): void;
  unregister(name: string): void;
  execute(type: HookType, context: Omit<HookContext, 'type'>): Promise<HookResult[]>;
  list(): Hook[];
  enable(name: string): void;
  disable(name: string): void;
}

export class HookSystemImpl implements HookSystem {
  private hooks: Map<string, Hook> = new Map();

  /**
   * Register a hook.
   */
  register(hook: Hook): void {
    // Ensure hook is enabled by default
    if (hook.enabled === undefined) {
      hook.enabled = true;
    }
    this.hooks.set(hook.name, hook);
  }

  /**
   * Unregister a hook.
   */
  unregister(name: string): void {
    this.hooks.delete(name);
  }

  /**
   * Execute hooks matching the type in priority order.
   */
  async execute(type: HookType, context: Omit<HookContext, 'type'>): Promise<HookResult[]> {
    const results: HookResult[] = [];

    // Get hooks matching the type and sort by priority
    const matchingHooks = Array.from(this.hooks.values())
      .filter(hook => {
        if (!hook.enabled) return false;
        
        const types = Array.isArray(hook.type) ? hook.type : [hook.type];
        return types.includes(type);
      })
      .sort((a, b) => a.priority - b.priority);

    // Execute hooks in order
    for (const hook of matchingHooks) {
      const hookContext: HookContext = {
        ...context,
        type
      };

      const result = await hook.execute(hookContext);
      results.push(result);

      // Stop if hook says not to continue
      if (!result.continue) {
        break;
      }
    }

    return results;
  }

  /**
   * List all registered hooks.
   */
  list(): Hook[] {
    return Array.from(this.hooks.values());
  }

  /**
   * Enable a hook.
   */
  enable(name: string): void {
    const hook = this.hooks.get(name);
    if (hook) {
      hook.enabled = true;
    }
  }

  /**
   * Disable a hook.
   */
  disable(name: string): void {
    const hook = this.hooks.get(name);
    if (hook) {
      hook.enabled = false;
    }
  }
}

/**
 * Create a HookSystem instance.
 */
export function createHookSystem(): HookSystemImpl {
  return new HookSystemImpl();
}

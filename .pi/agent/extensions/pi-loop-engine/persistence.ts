/**
 * State persistence for pi-loop-engine.
 *
 * Provides file and memory-based persistence for loop state,
 * enabling resume after restart.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface LoopState {
  attempts: Record<string, number>;
  failures: unknown[];
  totalRetries: number;
  totalSuccesses: number;
  lastUpdated: number;
  loopCounters: Record<string, number>;
  branchHistory: unknown[];
}

export interface StatePersistence {
  save(state: LoopState): Promise<void>;
  load(): Promise<LoopState | null>;
  clear(): Promise<void>;
}

/**
 * Memory-based persistence (for testing or temporary state).
 */
export class MemoryPersistence implements StatePersistence {
  private state: LoopState | null = null;

  async save(state: LoopState): Promise<void> {
    this.state = { ...state };
  }

  async load(): Promise<LoopState | null> {
    return this.state ? { ...this.state } : null;
  }

  async clear(): Promise<void> {
    this.state = null;
  }
}

/**
 * File-based persistence (for durable state across restarts).
 */
export class FilePersistence implements StatePersistence {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async save(state: LoopState): Promise<void> {
    const dir = path.dirname(this.filePath);
    
    // Create directory if it doesn't exist
    try {
      await fs.promises.access(dir);
    } catch {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    const json = JSON.stringify(state, null, 2);
    await fs.promises.writeFile(this.filePath, json, 'utf-8');
  }

  async load(): Promise<LoopState | null> {
    try {
      const json = await fs.promises.readFile(this.filePath, 'utf-8');
      const state = JSON.parse(json) as LoopState;
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      // Invalid JSON or other error
      return null;
    }
  }

  async clear(): Promise<void> {
    try {
      await fs.promises.unlink(this.filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

/**
 * Create a persistence instance based on configuration.
 */
export function createPersistence(config: {
  type: 'file' | 'memory';
  path?: string;
}): StatePersistence {
  if (config.type === 'memory') {
    return new MemoryPersistence();
  }

  if (!config.path) {
    throw new Error('File persistence requires a path');
  }

  return new FilePersistence(config.path);
}

/**
 * Merge two loop states (for combining partial states).
 */
export function mergeStates(
  existing: LoopState,
  incoming: Partial<LoopState>
): LoopState {
  return {
    attempts: { ...existing.attempts, ...incoming.attempts },
    failures: [...existing.failures, ...(incoming.failures ?? [])],
    totalRetries: existing.totalRetries + (incoming.totalRetries ?? 0),
    totalSuccesses: existing.totalSuccesses + (incoming.totalSuccesses ?? 0),
    lastUpdated: Math.max(existing.lastUpdated, incoming.lastUpdated ?? 0),
    loopCounters: { ...existing.loopCounters, ...incoming.loopCounters },
    branchHistory: [...existing.branchHistory, ...(incoming.branchHistory ?? [])],
  };
}

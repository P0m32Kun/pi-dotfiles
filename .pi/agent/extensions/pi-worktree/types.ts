/**
 * Type definitions for pi-worktree.
 *
 * Defines Git Worktree management interfaces.
 */

export interface Worktree {
  path: string;
  branch: string;
  head: string;
  createdAt: Date;
  status: 'active' | 'completed' | 'failed';
}

export interface WorktreeCreateOptions {
  branch: string;
  baseBranch?: string;
  path?: string;
}

export interface WorktreeStatus {
  branch: string;
  ahead: number;
  behind: number;
  dirty: boolean;
  files: string[];
}

export interface WorktreeManager {
  create(options: WorktreeCreateOptions): Promise<Worktree>;
  cleanup(worktree: Worktree): Promise<void>;
  cleanupAll(): Promise<void>;
  list(): Promise<Worktree[]>;
  merge(worktree: Worktree, target: string): Promise<void>;
  getStatus(worktree: Worktree): Promise<WorktreeStatus>;
}

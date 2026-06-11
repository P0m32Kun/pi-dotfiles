/**
 * Git Worktree manager for pi-worktree.
 *
 * Provides isolated working directories for parallel agent execution.
 */

import type { Worktree, WorktreeCreateOptions, WorktreeStatus, WorktreeManager } from './types.js';

export class GitWorktreeManager implements WorktreeManager {
  private basePath: string;

  constructor(basePath: string = '.worktrees') {
    this.basePath = basePath;
  }

  /**
   * Create a new git worktree.
   */
  async create(options: WorktreeCreateOptions): Promise<Worktree> {
    const branch = options.branch;
    const baseBranch = options.baseBranch || 'main';
    const worktreePath = options.path || `${this.basePath}/${branch}`;

    // Validate branch name
    if (!this.validateBranchName(branch)) {
      throw new Error(`Invalid branch name: ${branch}`);
    }

    // Create branch if it doesn't exist
    try {
      await this.exec(`git branch ${branch} ${baseBranch}`);
    } catch {
      // Branch might already exist, continue
    }

    // Create worktree
    await this.exec(`git worktree add ${worktreePath} ${branch}`);

    return {
      path: worktreePath,
      branch,
      head: await this.getHead(worktreePath),
      createdAt: new Date(),
      status: 'active'
    };
  }

  /**
   * Remove a git worktree.
   */
  async cleanup(worktree: Worktree): Promise<void> {
    await this.exec(`git worktree remove ${worktree.path} --force`);
  }

  /**
   * Remove all completed worktrees.
   */
  async cleanupAll(): Promise<void> {
    const worktrees = await this.list();
    for (const worktree of worktrees) {
      if (worktree.status !== 'active') {
        await this.cleanup(worktree);
      }
    }
  }

  /**
   * List all git worktrees.
   */
  async list(): Promise<Worktree[]> {
    const output = await this.exec('git worktree list --porcelain');
    return this.parseWorktreeList(output);
  }

  /**
   * Merge worktree branch into target branch.
   */
  async merge(worktree: Worktree, target: string): Promise<void> {
    await this.exec(`git checkout ${target}`);
    await this.exec(`git merge ${worktree.branch} --no-ff -m "Merge ${worktree.branch}"`);
    worktree.status = 'completed';
  }

  /**
   * Get status of a worktree.
   */
  async getStatus(worktree: Worktree): Promise<WorktreeStatus> {
    const output = await this.exec(`git -C ${worktree.path} status --porcelain`);
    const files = this.parseStatus(output);

    let ahead = 0;
    let behind = 0;

    try {
      const aheadOutput = await this.exec(
        `git -C ${worktree.path} rev-list --count HEAD..origin/main`
      );
      ahead = parseInt(aheadOutput.trim()) || 0;
    } catch {
      // Ignore if remote doesn't exist
    }

    try {
      const behindOutput = await this.exec(
        `git -C ${worktree.path} rev-list --count origin/main..HEAD`
      );
      behind = parseInt(behindOutput.trim()) || 0;
    } catch {
      // Ignore if remote doesn't exist
    }

    return {
      branch: worktree.branch,
      ahead,
      behind,
      dirty: files.length > 0,
      files
    };
  }

  /**
   * Parse git worktree list --porcelain output.
   */
  parseWorktreeList(output: string): Worktree[] {
    const worktrees: Worktree[] = [];
    const blocks = output.split('\n\n').filter(b => b.trim());

    for (const block of blocks) {
      const lines = block.split('\n');
      let path = '';
      let head = '';
      let branch = '';

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          path = line.slice(9);
        } else if (line.startsWith('HEAD ')) {
          head = line.slice(5);
        } else if (line.startsWith('branch ')) {
          branch = line.slice(7).replace('refs/heads/', '');
        }
      }

      if (path) {
        worktrees.push({
          path,
          branch: branch || 'detached',
          head,
          createdAt: new Date(),
          status: 'active'
        });
      }
    }

    return worktrees;
  }

  /**
   * Parse git status --porcelain output.
   */
  parseStatus(output: string): string[] {
    const files: string[] = [];
    const lines = output.split('\n').filter(l => l.trim());

    for (const line of lines) {
      // Format: XY filename
      if (line.length >= 3) {
        files.push(line.slice(3).trim());
      }
    }

    return files;
  }

  /**
   * Validate git branch name.
   */
  validateBranchName(name: string): boolean {
    if (!name || name.length === 0) return false;
    // Git branch name rules (simplified)
    const invalidPattern = /[\s~^:?*[\\]|]/;
    return !invalidPattern.test(name);
  }

  /**
   * Get HEAD commit hash.
   */
  private async getHead(path: string): Promise<string> {
    const output = await this.exec(`git -C ${path} rev-parse HEAD`);
    return output.trim();
  }

  /**
   * Execute a shell command.
   */
  private async exec(command: string): Promise<string> {
    const { exec: execCb } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(execCb);

    const { stdout } = await execAsync(command);
    return stdout;
  }
}

export function createWorktreeManager(basePath?: string): GitWorktreeManager {
  return new GitWorktreeManager(basePath);
}

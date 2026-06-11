import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitWorktreeManager } from './worktree.js';

describe('GitWorktreeManager', () => {
  let manager: GitWorktreeManager;

  beforeEach(() => {
    manager = new GitWorktreeManager('/tmp/test-worktrees');
  });

  describe('parseWorktreeList', () => {
    it('should parse git worktree list output', () => {
      const output = `worktree /path/to/main
HEAD abc123
branch refs/heads/main

worktree /path/to/feature
HEAD def456
branch refs/heads/feature-branch

worktree /path/to/detached
HEAD ghi789
`;

      const worktrees = manager.parseWorktreeList(output);

      expect(worktrees).toHaveLength(3);
      expect(worktrees[0].path).toBe('/path/to/main');
      expect(worktrees[0].branch).toBe('main');
      expect(worktrees[0].head).toBe('abc123');
      expect(worktrees[1].path).toBe('/path/to/feature');
      expect(worktrees[1].branch).toBe('feature-branch');
    });

    it('should handle empty output', () => {
      const worktrees = manager.parseWorktreeList('');
      expect(worktrees).toHaveLength(0);
    });
  });

  describe('parseStatus', () => {
    it('should parse git status output', () => {
      const output = ` M file1.ts
A  file2.ts
D  file3.ts
?? file4.ts
`;

      const files = manager.parseStatus(output);

      expect(files).toHaveLength(4);
      expect(files).toContain('file1.ts');
      expect(files).toContain('file2.ts');
      expect(files).toContain('file3.ts');
      expect(files).toContain('file4.ts');
    });

    it('should handle empty status', () => {
      const files = manager.parseStatus('');
      expect(files).toHaveLength(0);
    });
  });

  describe('validateBranchName', () => {
    it('should accept valid branch names', () => {
      expect(manager.validateBranchName('feature/my-feature')).toBe(true);
      expect(manager.validateBranchName('bugfix-123')).toBe(true);
      expect(manager.validateBranchName('release-v1.0')).toBe(true);
    });

    it('should reject invalid branch names', () => {
      expect(manager.validateBranchName('')).toBe(false);
      expect(manager.validateBranchName('branch with spaces')).toBe(false);
      expect(manager.validateBranchName('~branch')).toBe(false);
      expect(manager.validateBranchName('^branch')).toBe(false);
    });
  });
});

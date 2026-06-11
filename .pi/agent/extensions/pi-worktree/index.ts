/**
 * pi-worktree - Git Worktree isolation extension for pi-coding-agent.
 *
 * Provides isolated working directories for parallel agent execution.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { GitWorktreeManager } from "./worktree.js";

export default function worktreeExtension(pi: ExtensionAPI) {
  const manager = new GitWorktreeManager();

  // ── Register tool: worktree_create ──────────────────────

  pi.registerTool({
    name: "worktree_create",
    label: "Create Worktree",
    description: "创建 Git Worktree，提供隔离的工作目录。",
    parameters: Type.Object({
      branch: Type.String({ description: "分支名称" }),
      baseBranch: Type.Optional(Type.String({ description: "基础分支 (默认 main)" }))
    }),
    async execute(_toolCallId, params) {
      try {
        const worktree = await manager.create({
          branch: params.branch,
          baseBranch: params.baseBranch
        });

        return {
          content: [{
            type: "text",
            text: `✅ Worktree 已创建\n- 路径: ${worktree.path}\n- 分支: ${worktree.branch}\n- HEAD: ${worktree.head}`
          }],
          details: worktree
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ 创建失败: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  });

  // ── Register tool: worktree_list ────────────────────────

  pi.registerTool({
    name: "worktree_list",
    label: "List Worktrees",
    description: "列出所有 Git Worktree。",
    parameters: Type.Object({}),
    async execute() {
      try {
        const worktrees = await manager.list();

        if (worktrees.length === 0) {
          return {
            content: [{ type: "text", text: "没有 Worktree" }]
          };
        }

        let text = `## Worktrees (${worktrees.length})\n\n`;
        for (const wt of worktrees) {
          text += `- **${wt.branch}**: ${wt.path}\n`;
          text += `  HEAD: ${wt.head}\n`;
        }

        return {
          content: [{ type: "text", text }],
          details: { worktrees }
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ 列表失败: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  });

  // ── Register tool: worktree_cleanup ─────────────────────

  pi.registerTool({
    name: "worktree_cleanup",
    label: "Cleanup Worktree",
    description: "清理 Git Worktree。",
    parameters: Type.Object({
      path: Type.Optional(Type.String({ description: "Worktree 路径 (清理所有已完成的)" }))
    }),
    async execute(_toolCallId, params) {
      try {
        if (params.path) {
          await manager.cleanup({ path: params.path } as any);
          return {
            content: [{ type: "text", text: `✅ Worktree 已清理: ${params.path}` }]
          };
        }

        await manager.cleanupAll();
        return {
          content: [{ type: "text", text: "✅ 所有已完成的 Worktree 已清理" }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ 清理失败: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  });

  // ── Register tool: worktree_merge ───────────────────────

  pi.registerTool({
    name: "worktree_merge",
    label: "Merge Worktree",
    description: "合并 Worktree 分支到目标分支。",
    parameters: Type.Object({
      path: Type.String({ description: "Worktree 路径" }),
      target: Type.String({ description: "目标分支" })
    }),
    async execute(_toolCallId, params) {
      try {
        const worktree = { path: params.path, branch: '' };
        await manager.merge(worktree, params.target);

        return {
          content: [{
            type: "text",
            text: `✅ 分支已合并到 ${params.target}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ 合并失败: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  });

  // ── Register command: /worktree ─────────────────────────

  pi.registerCommand("worktree", {
    description: "Worktree 管理 (create/list/cleanup/merge)",
    getArgumentCompletions: (prefix: string) => {
      const commands = ["create", "list", "cleanup", "merge"];
      return commands
        .filter(c => c.startsWith(prefix))
        .map(c => ({ value: c, label: c }));
    },
    handler: async (args, ctx) => {
      const [command] = args.split(/\s+/);

      switch (command) {
        case "list":
          const worktrees = await manager.list();
          ctx.ui.notify(
            worktrees.length > 0
              ? `${worktrees.length} 个 Worktree`
              : "没有 Worktree",
            "info"
          );
          break;

        case "cleanup":
          await manager.cleanupAll();
          ctx.ui.notify("已清理所有已完成的 Worktree", "info");
          break;

        default:
          ctx.ui.notify("用法: /worktree [create|list|cleanup|merge]", "warning");
      }
    }
  });

  // ── Register session event ──────────────────────────────

  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setStatus("worktree", "🌿 worktree");
  });
}

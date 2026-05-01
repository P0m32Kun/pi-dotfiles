import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const MEMORY_DIR = join(homedir(), ".pi", "agent", "memories");

function readMemory(file: string): string {
  const path = join(MEMORY_DIR, file);
  if (!existsSync(path)) return "";
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

function writeMemory(file: string, content: string) {
  if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true });
  writeFileSync(join(MEMORY_DIR, file), content, "utf-8");
}

function buildMemoryContext(): string {
  const files: [string, string][] = [
    ["preferences.md", "📋 编码偏好"],
    ["lessons.md", "⚠️ 历史教训"],
    ["conventions.md", "📜 项目约定"],
    ["project-notes.md", "📝 项目笔记"],
  ];

  const parts: string[] = [];
  for (const [file, title] of files) {
    const content = readMemory(file).trim();
    if (content) {
      parts.push(`${title}\n${content}`);
    }
  }

  if (parts.length === 0) return "（暂无长期记忆）";

  return [
    "═══════════════════════════════════════════════════════════════",
    "                    📚 用户长期记忆 📚",
    "═══════════════════════════════════════════════════════════════",
    "",
    ...parts,
    "",
    "═══════════════════════════════════════════════════════════════",
    "⚠️ 重要：以上记忆来自用户的历史纠正和偏好设定。",
    "   你必须在后续回复中严格遵循这些约定，避免重复犯错。",
    "═══════════════════════════════════════════════════════════════",
  ].join("\n");
}

export default function (pi: ExtensionAPI) {
  // ── 1. session_start: 尝试自动注入记忆 ──
  pi.on("session_start", async (_event, ctx) => {
    const memory = buildMemoryContext();
    if (memory.includes("暂无长期记忆")) return;

    try {
      // 将记忆作为一条特殊的 CustomMessage 注入 session
      // 这样 LLM 在后续回复中会看到这段上下文
      (pi as any).appendEntry?.({
        id: `mem-${Date.now()}`,
        parentId: _event?.entryId,
        timestamp: Date.now(),
        type: "custom",
        role: "custom",
        content: memory,
        label: "🧠 长期记忆",
      });
    } catch {
      // 如果 appendEntry 不支持此格式，静默失败
      // 用户仍可通过 /loadmem 手动加载
    }

    ctx.ui.notify("🧠 长期记忆已加载", "info");
  });

  // ── 2. load_user_memories tool: 显式加载 ──
  pi.registerTool({
    name: "load_user_memories",
    label: "Load Memories",
    description:
      "加载用户的长期记忆（编码偏好、历史教训、项目约定、项目笔记）。在开始新任务或对用户偏好不确定时，必须调用此工具。",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      const memory = buildMemoryContext();
      return {
        content: [{ type: "text", text: memory }],
        details: {},
      };
    },
  });

  // ── 3. add_user_lesson tool: 记录教训 ──
  pi.registerTool({
    name: "add_user_lesson",
    label: "Add Lesson",
    description:
      "记录用户的纠正、偏好或踩坑记录。当用户指出你的错误、表达某种编码偏好、或提到某个约定时，立即调用此工具记录。",
    parameters: Type.Object({
      category: Type.String({
        enum: ["preference", "lesson", "convention", "project-note"],
        description: "记忆分类：preference(偏好), lesson(教训), convention(约定), project-note(项目笔记)",
      }),
      content: Type.String({
        description: "要记录的内容。简洁、明确、可执行。例如：'Go 错误处理必须用显式 if err != nil，禁止用 panic'",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const fileMap: Record<string, string> = {
        preference: "preferences.md",
        lesson: "lessons.md",
        convention: "conventions.md",
        "project-note": "project-notes.md",
      };
      const file = fileMap[params.category];
      const existing = readMemory(file);
      const timestamp = new Date().toISOString().split("T")[0];
      const newEntry = `- ${timestamp}: ${params.content}`;
      writeMemory(file, existing.trimEnd() + "\n" + newEntry + "\n");
      return {
        content: [
          { type: "text", text: `✅ 已记录到 \`${file}\`:\n${newEntry}` },
        ],
        details: {},
      };
    },
  });

  // ── 4. /remember 命令: 快速手动记录 ──
  pi.registerCommand("remember", {
    description: "快速记录一个教训或偏好到长期记忆",
    handler: async (args, ctx) => {
      if (!args || args.trim().length === 0) {
        ctx.ui.notify(
          "用法: /remember [preference|lesson|convention|project-note] 内容",
          "warning"
        );
        return;
      }

      const parts = args.trim().split(/\s+/);
      const category = parts[0];
      const content = parts.slice(1).join(" ");

      const fileMap: Record<string, string> = {
        preference: "preferences.md",
        lesson: "lessons.md",
        convention: "conventions.md",
        "project-note": "project-notes.md",
      };
      const file = fileMap[category];
      if (!file) {
        ctx.ui.notify(
          `未知类型: ${category}。可用: preference, lesson, convention, project-note`,
          "error"
        );
        return;
      }
      if (!content) {
        ctx.ui.notify("请提供要记录的内容", "warning");
        return;
      }

      const existing = readMemory(file);
      const timestamp = new Date().toISOString().split("T")[0];
      writeMemory(file, existing.trimEnd() + "\n" + `- ${timestamp}: ${content}` + "\n");
      ctx.ui.notify(`✅ 已记录到 ${file}`, "success");
    },
  });

  // ── 5. /showmem 命令: 查看当前记忆 ──
  pi.registerCommand("showmem", {
    description: "查看用户的长期记忆文件内容",
    handler: async (_args, ctx) => {
      const memory = buildMemoryContext();
      ctx.ui.notify("记忆已加载到上下文，请查看对话历史", "info");
      // 将记忆作为自定义消息显示
      try {
        (pi as any).appendEntry?.({
          id: `mem-show-${Date.now()}`,
          timestamp: Date.now(),
          type: "custom",
          role: "custom",
          content: memory,
          label: "🧠 长期记忆",
        });
      } catch {
        ctx.ui.notify("无法显示记忆，请直接查看 ~/.pi/agent/memories/", "warning");
      }
    },
  });
}

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

/* ═══════════════════════════════════════════════════════
   magic-context-lite for pi
   核心目标：在 context 变满之前主动压缩，减少 token
   ═══════════════════════════════════════════════════════ */

/* ─── 配置 ─── */
const STORAGE_DIR = path.join(os.homedir(), ".pi", "agent", "magic-context");
const CFG_PATH = path.join(STORAGE_DIR, "config.json");

interface Cfg {
  maxTokens?: number;      // 触发压缩的 token 阈值，默认 60000
  keepRecent?: number;     // 保留最近 N 轮对话完整，默认 6
  truncateToolResult?: number; // 旧工具结果截断长度，默认 300
  truncateAssistant?: number;  // 旧 assistant 消息截断长度，默认 600
}

function loadCfg(): Cfg {
  if (!fs.existsSync(CFG_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CFG_PATH, "utf-8")); } catch { return {}; }
}

function saveCfg(cfg: Cfg) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2));
}

/* ─── Token 估算 ─── */
function estimateTokens(text: string): number {
  // 混合语言启发式：中文 ~1.5 chars/token，英文 ~4，代码 ~3.5
  // 简单平均取 3 chars/token
  return Math.ceil(text.length / 3);
}

function estimateMessageTokens(msg: any): number {
  if (!msg) return 0;
  if (typeof msg.content === "string") {
    return estimateTokens(msg.content) + 4; // +4 是消息结构开销
  }
  if (Array.isArray(msg.content)) {
    return msg.content.reduce((sum: number, part: any) => {
      if (typeof part === "string") return sum + estimateTokens(part);
      if (part?.type === "text" && typeof part.text === "string") return sum + estimateTokens(part.text);
      if (part?.type === "image_url" || part?.type === "image") return sum + 1000; // 图片估算
      return sum + estimateTokens(JSON.stringify(part));
    }, 0) + 4;
  }
  return estimateTokens(JSON.stringify(msg)) + 4;
}

function estimateMessagesTokens(messages: any[]): number {
  // system prompt 开销 ~200 tokens
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0) + 200;
}

/* ─── 记忆存储（仅用于 compaction 摘要，不注入 system prompt） ─── */
const MEMORIES_FILE = path.join(STORAGE_DIR, "memories.json");

interface Memory {
  id: string;
  project: string;
  content: string;
  source: "compact" | "manual";
  createdAt: number;
}

function loadAllMemories(): Memory[] {
  if (!fs.existsSync(MEMORIES_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(MEMORIES_FILE, "utf-8")); } catch { return []; }
}

function saveAllMemories(all: Memory[]) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  fs.writeFileSync(MEMORIES_FILE, JSON.stringify(all, null, 2));
}

function addMemory(project: string, content: string, source: "compact" | "manual") {
  const all = loadAllMemories();
  all.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    project,
    content: content.trim(),
    source,
    createdAt: Date.now(),
  });
  // 每个项目最多 50 条，全局最多 500 条
  const byProject = new Map<string, Memory[]>();
  for (const m of all) byProject.set(m.project, [...(byProject.get(m.project) || []), m]);
  const trimmed: Memory[] = [];
  for (const [, list] of byProject) trimmed.push(...list.slice(-50));
  saveAllMemories(trimmed.slice(-500));
}

function searchMemories(project: string, query: string): Memory[] {
  const q = query.toLowerCase();
  return loadAllMemories()
    .filter(m => m.project === project && m.content.toLowerCase().includes(q))
    .sort((a, b) => b.createdAt - a.createdAt);
}

function deleteMemory(project: string, index: number) {
  const all = loadAllMemories();
  const projectMemories = all.filter(m => m.project === project);
  const target = projectMemories[index];
  if (!target) return false;
  saveAllMemories(all.filter(m => m.id !== target.id));
  return true;
}

function projectId(cwd: string): string { return cwd; }

/* ─── 消息压缩策略 ─── */

/**
 * 智能压缩消息列表。
 * 原则：
 * 1. 保留最近 keepRecent 轮对话完整（user + assistant + 其间工具）
 * 2. 更旧的消息结构性压缩：
 *    - 超长 toolResult → 截断 + 标记原始长度
 *    - 超长 assistant → 截断 + 标记
 *    - 连续多个 toolResult → 合并为占位符
 * 3. 不调用 LLM，纯规则驱动，零延迟
 */
function compressMessages(messages: any[], cfg: Cfg): { messages: any[]; savedTokens: number } {
  const maxTokens = cfg.maxTokens ?? 60000;
  const keepRecent = cfg.keepRecent ?? 6;
  const truncateTool = cfg.truncateToolResult ?? 300;
  const truncateAsst = cfg.truncateAssistant ?? 600;

  if (messages.length === 0) return { messages, savedTokens: 0 };

  const originalTokens = estimateMessagesTokens(messages);
  if (originalTokens < maxTokens * 0.75) {
    return { messages, savedTokens: 0 }; // 还早，不压
  }

  // 识别最近的 user-assistant "轮次"
  const turns: { start: number; end: number }[] = [];
  let lastUserIdx = -1;
  for (let i = 0; i < messages.length; i++) {
    const role = messages[i]?.role;
    if (role === "user") {
      if (lastUserIdx >= 0) {
        turns.push({ start: lastUserIdx, end: i - 1 });
      }
      lastUserIdx = i;
    }
  }
  if (lastUserIdx >= 0) turns.push({ start: lastUserIdx, end: messages.length - 1 });

  // 保留最近 keepRecent 轮完整
  const keepTurnCount = Math.max(1, keepRecent);
  const cutoffIndex = turns.length > keepTurnCount
    ? turns[turns.length - keepTurnCount].start
    : 0;

  let savedTokens = 0;
  const compressed = messages.map((msg, idx) => {
    if (idx >= cutoffIndex) return msg; // 保留

    const role = msg?.role;

    // 压缩 tool 结果
    if (role === "tool" || role === "tool_result") {
      const text = extractText(msg);
      if (text && text.length > truncateTool) {
        const truncated = text.slice(0, truncateTool);
        const marker = `\n\n...[truncated from ${text.length} chars, ${estimateTokens(text)} tokens]`;
        savedTokens += estimateTokens(text) - estimateTokens(truncated + marker);
        return setText(msg, truncated + marker);
      }
    }

    // 压缩旧 assistant 消息
    if (role === "assistant") {
      const text = extractText(msg);
      if (text && text.length > truncateAsst) {
        const truncated = text.slice(0, truncateAsst);
        const marker = `\n\n...[truncated from ${text.length} chars]`;
        savedTokens += estimateTokens(text) - estimateTokens(truncated + marker);
        return setText(msg, truncated + marker);
      }
    }

    return msg;
  });

  return { messages: compressed, savedTokens };
}

function extractText(msg: any): string | null {
  if (!msg) return null;
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (typeof part === "string") return part;
      if (part?.type === "text" && typeof part.text === "string") return part.text;
    }
  }
  return null;
}

function setText(msg: any, text: string): any {
  if (typeof msg.content === "string") return { ...msg, content: text };
  if (Array.isArray(msg.content)) {
    const newContent = msg.content.map((part: any) => {
      if (typeof part === "string") return text;
      if (part?.type === "text") return { ...part, text };
      return part;
    });
    return { ...msg, content: newContent };
  }
  return { ...msg, content: text };
}

/* ─── Extension ─── */
export default function (pi: ExtensionAPI) {
  const cfg = loadCfg();
  let lastCompressInfo = "";
  let currentModelCtxWindow = 128000;

  /* 1. 记录当前模型的 context window */
  pi.on("model_select", async (event) => {
    currentModelCtxWindow = event.model?.contextWindow ?? 128000;
    // 如果用户没手动设 maxTokens，自动跟随模型
    if (!cfg.maxTokens) {
      cfg.maxTokens = Math.floor(currentModelCtxWindow * 0.7);
    }
  });

  /* 2. 核心：context 事件中主动压缩 */
  pi.on("context", async (event, ctx) => {
    const effectiveCfg = {
      ...cfg,
      maxTokens: cfg.maxTokens ?? Math.floor(currentModelCtxWindow * 0.7),
    };

    const originalTokens = estimateMessagesTokens(event.messages);
    const { messages, savedTokens } = compressMessages(event.messages, effectiveCfg);

    if (savedTokens > 0) {
      lastCompressInfo = `compressed -${savedTokens}t`;
      ctx.ui.setStatus("magic-context", `🗜️ ${lastCompressInfo}`);
    }

    return { messages };
  });

  /* 3. Compaction 时保存摘要到记忆库 */
  pi.on("session_compact", async (event, ctx) => {
    const summary = event.compactionEntry?.summary;
    if (!summary || summary.length < 10) return;
    const pid = projectId(ctx.cwd);
    addMemory(pid, summary, "compact");
  });

  /* 4. 记忆工具（按需检索，不自动注入） */
  pi.registerTool({
    name: "memory_add",
    label: "Add Memory",
    description: "将关键信息保存到跨会话记忆库。适用于架构决策、重要约束、踩坑记录等。",
    parameters: Type.Object({
      content: Type.String({ description: "要保存的记忆内容" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const pid = projectId(ctx.cwd);
      addMemory(pid, params.content, "manual");
      return {
        content: [{ type: "text", text: "✅ 已保存到记忆库" }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "memory_search",
    label: "Search Memory",
    description: "搜索历史会话中保存的记忆",
    parameters: Type.Object({
      query: Type.String({ description: "搜索关键词" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const pid = projectId(ctx.cwd);
      const results = searchMemories(pid, params.query);
      if (results.length === 0) {
        return { content: [{ type: "text", text: "未找到匹配记忆" }], details: {} };
      }
      const lines = results.map((m, i) =>
        `${i + 1}. ${m.content.slice(0, 180)}${m.content.length > 180 ? "…" : ""}`
      );
      return {
        content: [{ type: "text", text: `找到 ${results.length} 条：\n${lines.join("\n")}` }],
        details: {},
      };
    },
  });

  /* 5. 命令 */
  pi.registerCommand("memories", {
    description: "列出当前项目的记忆",
    handler: async (_args, ctx) => {
      const pid = projectId(ctx.cwd);
      const all = loadAllMemories().filter(m => m.project === pid);
      if (all.length === 0) { ctx.ui.notify("📝 暂无记忆", "info"); return; }
      ctx.ui.notify(`🧠 ${all.length} 条记忆：`, "info");
      all.forEach((m, i) => {
        const src = m.source === "compact" ? "📦" : "✍️";
        ctx.ui.notify(`  ${src} ${i + 1}. ${m.content.slice(0, 60)}${m.content.length > 60 ? "…" : ""}`, "info");
      });
    },
  });

  pi.registerCommand("memory-rm", {
    description: "删除记忆，用法：/memory-rm <序号>",
    handler: async (args, ctx) => {
      const idx = parseInt(args.trim(), 10) - 1;
      if (isNaN(idx) || idx < 0) { ctx.ui.notify("❌ 用法：/memory-rm <序号>", "error"); return; }
      const pid = projectId(ctx.cwd);
      if (deleteMemory(pid, idx)) ctx.ui.notify("✅ 已删除", "success");
      else ctx.ui.notify("❌ 序号无效", "error");
    },
  });

  /* 6. 状态条 */
  pi.on("session_start", async (_event, ctx) => {
    const pid = projectId(ctx.cwd);
    const count = loadAllMemories().filter(m => m.project === pid).length;
    if (count > 0) ctx.ui.setStatus("magic-context", `🧠 ${count}`);
  });

  pi.on("turn_end", async (_event, ctx) => {
    if (lastCompressInfo) {
      ctx.ui.setStatus("magic-context", `🗜️ ${lastCompressInfo}`);
    }
  });
}

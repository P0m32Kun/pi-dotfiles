/**
 * yagni extension — Anti-over-engineering rules injected every turn.
 *
 * Inspired by DietrichGebert/ponytail, replaces the yagni SKILL.md
 * with a guaranteed injection via before_agent_start hook.
 *
 * Hooks:
 *   before_agent_start — inject yagni rules into system prompt
 *   session_start      — restore mode from persisted state
 *   input              — detect "stop yagni" / "yagni off" natural language
 *
 * Commands:
 *   /yagni [on|off|status] — control yagni mode
 *
 * State:
 *   mode persisted via appendEntry, survives session restarts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { YAGNI_RULES } from "./rules.js";

type YagniMode = "on" | "off";

const DEFAULT_MODE: YagniMode = "on";
const ENTRY_TYPE = "yagni-mode";

function normalizeMode(raw: string | undefined | null): YagniMode | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (lower === "on" || lower === "full" || lower === "lite" || lower === "ultra") return "on";
  if (lower === "off" || lower === "none") return "off";
  return null;
}

/** Walk session entries backwards to find the last yagni-mode entry. */
function resolveSessionMode(entries: any[], fallback: YagniMode): YagniMode {
  if (!Array.isArray(entries)) return fallback;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry?.type !== "custom" || entry?.customType !== ENTRY_TYPE) continue;
    const mode = normalizeMode(entry?.data?.mode);
    if (mode) return mode;
  }
  return fallback;
}

export default function yagniExtension(pi: ExtensionAPI) {
  let currentMode: YagniMode = DEFAULT_MODE;

  // ── Commands ────────────────────────────────────────────────

  pi.registerCommand("yagni", {
    description: "Toggle YAGNI anti-over-engineering mode (on/off/status)",
    handler: async (args, ctx) => {
      const arg = (args || "").trim().toLowerCase();

      if (!arg || arg === "status") {
        ctx.ui.notify(`YAGNI mode: ${currentMode}`, "info");
        return;
      }

      if (arg === "on" || arg === "full" || arg === "lite") {
        currentMode = "on";
        pi.appendEntry(ENTRY_TYPE, { mode: "on" });
        ctx.ui.notify("YAGNI mode: ON — lazy senior dev active", "info");
        return;
      }

      if (arg === "off" || arg === "none") {
        currentMode = "off";
        pi.appendEntry(ENTRY_TYPE, { mode: "off" });
        ctx.ui.notify("YAGNI mode: OFF — full engineering freedom", "info");
        return;
      }

      ctx.ui.notify("Usage: /yagni [on|off|status]", "warning");
    },
  });

  // ── Hooks ───────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    const entries =
      ctx?.sessionManager?.getBranch?.() ||
      ctx?.sessionManager?.getEntries?.() ||
      [];
    currentMode = resolveSessionMode(entries, DEFAULT_MODE);
  });

  pi.on("input", async (event) => {
    // Skip extension-injected messages
    if (event?.source === "extension") return;

    const text = String(event?.text || "").toLowerCase();
    if (currentMode !== "off" && /\b(stop yagni|yagni off|关闭 yagni)\b/i.test(text)) {
      currentMode = "off";
      pi.appendEntry(ENTRY_TYPE, { mode: "off" });
    }
  });

  pi.on("before_agent_start", async (event) => {
    if (currentMode === "off") return;

    return {
      systemPrompt: `${event.systemPrompt}\n\n${YAGNI_RULES}`,
    };
  });
}

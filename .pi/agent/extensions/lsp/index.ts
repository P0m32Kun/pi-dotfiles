/**
 * LSP Extension for pi-coding-agent
 *
 * Provides Language Server Protocol integration as a tool:
 * - diagnostics, definition, references, hover, symbols, rename, code_actions, type_definition, implementation, status, reload
 *
 * Place in ~/.pi/agent/extensions/lsp/ for auto-discovery.
 * Configure servers via .pi/lsp.json or .lsp.json in project root.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import * as path from "node:path";
import * as fs from "node:fs";
import { LspClient } from "./client.js";
import { loadConfig, getServerForFile, getServersForFile, getAllServers, type LspConfig, type ServerConfig } from "./config.js";
import { resolvePath, formatDiagnostic, formatLocation, readFileContent, uriToFile } from "./utils.js";

// ─── Tool Schema ───────────────────────────────────────────────────────────

const lspSchema = Type.Object({
	action: StringEnum([
		"diagnostics",
		"definition",
		"type_definition",
		"implementation",
		"references",
		"hover",
		"symbols",
		"rename",
		"code_actions",
		"status",
		"reload",
	], { description: "LSP operation to perform" }),
	file: Type.Optional(Type.String({ description: "File path (relative to project root or absolute)" })),
	line: Type.Optional(Type.Number({ description: "Line number (1-indexed)" })),
	symbol: Type.Optional(Type.String({ description: "Symbol/substring on the target line to resolve column position" })),
	occurrence: Type.Optional(Type.Number({ description: "Symbol occurrence on line (1-indexed, default: 1)" })),
	query: Type.Optional(Type.String({ description: "Search query (for workspace symbols)" })),
	new_name: Type.Optional(Type.String({ description: "New name for rename operation" })),
	apply: Type.Optional(Type.Boolean({ description: "Apply edits for rename/code_actions (default: false)" })),
	timeout: Type.Optional(Type.Number({ description: "Request timeout in seconds (5-60, default: 20)" })),
});

// ─── Client Pool ───────────────────────────────────────────────────────────

class ClientPool {
	private clients = new Map<string, LspClient>();
	private config: LspConfig | null = null;

	getConfig(cwd: string): LspConfig {
		if (!this.config) this.config = loadConfig(cwd);
		return this.config;
	}

	invalidateConfig() {
		this.config = null;
	}

	async getClientForFile(filePath: string, cwd: string): Promise<LspClient | null> {
		const config = this.getConfig(cwd);
		const entry = getServerForFile(config, filePath);
		if (!entry) return null;
		return this.getOrCreate(entry[0], entry[1], cwd);
	}

	async getOrCreate(name: string, config: ServerConfig, cwd: string): Promise<LspClient> {
		let client = this.clients.get(name);
		if (client) return client;

		client = await LspClient.create(name, config, cwd);
		this.clients.set(name, client);
		return client;
	}

	getAllClients(): Map<string, LspClient> {
		return this.clients;
	}

	async shutdownAll() {
		const shutdowns: Promise<void>[] = [];
		for (const [name, client] of this.clients) {
			shutdowns.push(client.shutdown());
		}
		await Promise.allSettled(shutdowns);
		this.clients.clear();
	}

	async restartServer(name: string, cwd: string) {
		const client = this.clients.get(name);
		if (client) {
			await client.shutdown();
			this.clients.delete(name);
		}
		// Will be recreated on next use
	}
}

// ─── Result formatting ─────────────────────────────────────────────────────

const SEVERITY_LABELS: Record<number, string> = { 1: "error", 2: "warning", 3: "info", 4: "hint" };
const SYMBOL_KINDS: Record<number, string> = {
	1: "File", 2: "Module", 3: "Namespace", 4: "Package", 5: "Class", 6: "Method",
	7: "Property", 8: "Field", 9: "Constructor", 10: "Enum", 11: "Interface",
	12: "Function", 13: "Variable", 14: "Constant", 15: "String", 16: "Number",
	17: "Boolean", 18: "Array", 19: "Object", 20: "Key", 21: "Null", 22: "EnumMember",
	23: "Struct", 24: "Event", 25: "Operator", 26: "TypeParameter",
};

function formatDiagResult(result: { file: string; diagnostics: any[] }, cwd: string): string {
	if (result.diagnostics.length === 0) {
		return `✓ No issues found in ${path.relative(cwd, result.file)}`;
	}

	const lines: string[] = [];
	for (const d of result.diagnostics) {
		const sev = SEVERITY_LABELS[d.severity ?? 1] ?? "error";
		const line = d.range.start.line + 1;
		const col = d.range.start.character + 1;
		const code = d.code ? ` [${d.code}]` : "";
		const source = d.source ? ` (${d.source})` : "";
		const fileRel = path.relative(cwd, result.file);
		lines.push(`${fileRel}:${line}:${col}: ${sev}${source}${code}: ${d.message}`);
	}
	return lines.join("\n");
}

function formatLocationResult(locations: any[], cwd: string, content?: string): string {
	if (locations.length === 0) return "No results found.";

	const lines: string[] = [];
	for (const loc of locations.slice(0, 50)) {
		const fileRel = path.relative(cwd, uriToFile(loc.uri));
		const line = loc.range.start.line + 1;
		const col = loc.range.start.character + 1;
		lines.push(`${fileRel}:${line}:${col}`);

		// Add context line if available
		if (content) {
			const lineText = content.split("\n")[loc.range.start.line]?.trim();
			if (lineText) lines.push(`  → ${lineText}`);
		}
	}
	if (locations.length > 50) {
		lines.push(`... and ${locations.length - 50} more`);
	}
	return lines.join("\n");
}

// ─── Apply workspace edits ─────────────────────────────────────────────────

function applyWorkspaceEdit(changes: Record<string, any>, cwd: string): string {
	const applied: string[] = [];
	for (const [uri, edits] of Object.entries(changes)) {
		const filePath = uriToFile(uri);
		const content = readFileContent(filePath);
		if (!content) continue;

		const lines = content.split("\n");
		const sortedEdits = [...(edits as any[])].sort((a, b) => {
			if (a.range.start.line !== b.range.start.line) return b.range.start.line - a.range.start.line;
			return b.range.start.character - a.range.start.character;
		});

		for (const edit of sortedEdits) {
			const { start, end } = edit.range;
			if (start.line === end.line) {
				const line = lines[start.line] ?? "";
				lines[start.line] = line.slice(0, start.character) + edit.newText + line.slice(end.character);
			} else {
				const startLine = lines[start.line] ?? "";
				const endLine = lines[end.line] ?? "";
				const newContent = startLine.slice(0, start.character) + edit.newText + endLine.slice(end.character);
				lines.splice(start.line, end.line - start.line + 1, ...newContent.split("\n"));
			}
		}

		fs.writeFileSync(filePath, lines.join("\n"));
		applied.push(path.relative(cwd, filePath));
	}
	return applied.join(", ");
}

// ─── Extension ─────────────────────────────────────────────────────────────

export default function lspExtension(pi: ExtensionAPI) {
	const pool = new ClientPool();

	// ─── Configuration ──────────────────────────────────────────────

	/** Whether to run LSP diagnostics after write/edit (default: true) */
	// TODO: make configurable via .pi/lsp.json when pi exposes settings API
	const diagnosticsOnWrite = true;

	// ─── Cleanup on session shutdown ───────────────────────────────

	pi.on("session_shutdown", async () => {
		await pool.shutdownAll();
	});

	// ─── Writethrough: auto-diagnostics after write/edit ───────────

	pi.on("tool_result", async (event, ctx) => {
		if (!diagnosticsOnWrite) return;
		if (event.toolName !== "write" && event.toolName !== "edit") return;
		if (event.isError) return;

		const inputPath = event.input.path as string | undefined;
		if (!inputPath) return;

		const filePath = resolvePath(inputPath, process.cwd());
		const ext = path.extname(filePath).toLowerCase();

		// Only trigger for file types we have LSP servers for
		const config = pool.getConfig(process.cwd());
		const serverEntry = getServerForFile(config, filePath);
		if (!serverEntry) return;

		// Run diagnostics asynchronously — don't block the tool result
		const diagPromise = (async () => {
			try {
				const client = await pool.getClientForFile(filePath, process.cwd());
				if (!client) return;

				// Notify LSP that the file was saved (triggers fresh diagnostics)
				client.notifySaved(filePath);

				const result = await client.getDiagnostics(filePath, 15_000);

				// Only report if there are actual errors or warnings
				const errors = result.diagnostics.filter((d: any) => d.severity === 1 || d.severity === 2);
				if (errors.length === 0) return;

				const lines: string[] = [`[LSP] Diagnostics after ${event.toolName} ${path.relative(process.cwd(), filePath)}:`];
				for (const d of errors) {
					const sev = SEVERITY_LABELS[d.severity ?? 1] ?? "error";
					const line = d.range.start.line + 1;
					const code = d.code ? ` [${d.code}]` : "";
					lines.push(`  ${sev}: L${line}: ${d.message}${code}`);
				}

				// Inject as a steer message — LLM sees it before next tool call
				pi.sendMessage({
					customType: "lsp-diagnostics",
					content: lines.join("\n"),
					display: true,
					details: { source: "lsp", file: filePath, errors: errors.length },
				}, {
					deliverAs: "steer",
				});
			} catch {
				// Silently ignore LSP errors in writethrough — don't disrupt the agent
			}
		})();

		// Don't await — let diagnostics run in background
		ctx.signal?.addEventListener?.("abort", () => {}, { once: true });
	});

	pi.registerTool({
		name: "lsp",
		label: "LSP",
		description: `Interacts with Language Server Protocol servers for code intelligence.

<operations>
- \`diagnostics\`: Get errors/warnings for a file. Returns all LSP diagnostics for the file.
- \`definition\`: Go to symbol definition. Returns file path + line + source context.
- \`type_definition\`: Go to symbol type definition. Returns file path + line + source context.
- \`implementation\`: Find concrete implementations. Returns locations with source context.
- \`references\`: Find all references to a symbol. Returns locations with source context.
- \`hover\`: Get type info and documentation for a symbol.
- \`symbols\`: List all symbols in a file with their kinds and positions.
- \`rename\`: Rename a symbol across the codebase. Preview or apply edits.
- \`code_actions\`: List available quick-fixes, refactors, and import actions for a position.
- \`status\`: Show active LSP servers and their status.
- \`reload\`: Restart an LSP server (specify file to restart its server, or omit for all).
</operations>

<parameters>
- \`file\`: File path (relative or absolute). Required for most operations.
- \`line\`: 1-indexed line number. Required for position-based operations (definition, references, hover, rename, code_actions).
- \`symbol\`: Substring on the target line used to resolve column position automatically.
- \`occurrence\`: 1-indexed match index when symbol appears multiple times on the same line (default: 1).
- \`new_name\`: Required for rename operation.
- \`apply\`: Apply edits for rename/code_actions (default: false for code_actions, true for rename).
- \`timeout\`: Request timeout in seconds (5-60, default: 20).
</parameters>

<caution>
- Requires a running LSP server for the target language (e.g., gopls for Go, rust-analyzer for Rust, pyright for Python).
- Some operations require the file to exist on disk.
- First invocation for a language may be slow while the server initializes.
</caution>`,
		parameters: lspSchema,

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const cwd = process.cwd();
			const timeoutSec = Math.max(5, Math.min(60, params.timeout ?? 20));
			const timeoutMs = timeoutSec * 1000;

			try {
				// ─── Status (no file needed) ─────────────────────────
				if (params.action === "status") {
					return handleStatus(cwd);
				}

				// ─── Reload ──────────────────────────────────────────
				if (params.action === "reload") {
					return handleReload(params, cwd);
				}

				// ─── File required for all other actions ─────────────
				if (!params.file) {
					return errorResult("Parameter 'file' is required for this action.");
				}

				const filePath = resolvePath(params.file, cwd);
				if (!fs.existsSync(filePath)) {
					return errorResult(`File not found: ${params.file}`);
				}

				// Get or create LSP client for this file
				const client = await pool.getClientForFile(filePath, cwd);
				if (!client) {
					const ext = path.extname(filePath);
					return errorResult(`No LSP server configured for ${ext} files. Configure in .pi/lsp.json or ensure the language server is installed.`);
				}

				// Resolve column from symbol if provided
				let character = 0;
				if (params.line && params.symbol) {
					character = client.resolvePosition(filePath, params.line, params.symbol, params.occurrence ?? 1);
				}

				// ─── Dispatch operations ──────────────────────────────
				switch (params.action) {
					case "diagnostics": {
						const result = await client.getDiagnostics(filePath, timeoutMs);
						return textResult(formatDiagResult(result, cwd));
					}

					case "definition": {
						if (!params.line) return errorResult("'line' is required for definition.");
						const locations = await client.getDefinition(filePath, params.line, character, timeoutMs);
						const content = readFileContent(filePath) ?? undefined;
						return textResult(formatLocationResult(locations, cwd, content));
					}

					case "type_definition": {
						if (!params.line) return errorResult("'line' is required for type_definition.");
						const locations = await client.getTypeDefinition(filePath, params.line, character, timeoutMs);
						const content = readFileContent(filePath) ?? undefined;
						return textResult(formatLocationResult(locations, cwd, content));
					}

					case "implementation": {
						if (!params.line) return errorResult("'line' is required for implementation.");
						const locations = await client.getImplementation(filePath, params.line, character, timeoutMs);
						const content = readFileContent(filePath) ?? undefined;
						return textResult(formatLocationResult(locations, cwd, content));
					}

					case "references": {
						if (!params.line) return errorResult("'line' is required for references.");
						const locations = await client.getReferences(filePath, params.line, character, timeoutMs);
						const content = readFileContent(filePath) ?? undefined;
						return textResult(formatLocationResult(locations, cwd, content));
					}

					case "hover": {
						if (!params.line) return errorResult("'line' is required for hover.");
						const result = await client.getHover(filePath, params.line, character, timeoutMs);
						return textResult(result ?? "No hover information available.");
					}

					case "symbols": {
						const symbols = await client.getSymbols(filePath, timeoutMs);
						if (symbols.length === 0) return textResult("No symbols found.");
						const lines = formatSymbols(symbols, cwd, filePath, 0);
						return textResult(lines.join("\n"));
					}

					case "rename": {
						if (!params.line) return errorResult("'line' is required for rename.");
						if (!params.new_name) return errorResult("'new_name' is required for rename.");
						const changes = await client.rename(filePath, params.line, character, params.new_name, timeoutMs);
						if (!changes) return textResult("Cannot rename this symbol.");
						if (params.apply !== false) {
							const applied = applyWorkspaceEdit(changes, cwd);
							return textResult(`Renamed to '${params.new_name}' in: ${applied}`);
						}
						// Preview
						const preview = Object.entries(changes)
							.map(([uri, edits]) => {
								const file = path.relative(cwd, uriToFile(uri));
								return `${file}: ${(edits as any[]).length} edit(s)`;
							})
							.join("\n");
						return textResult(`Preview rename to '${params.new_name}':\n${preview}`);
					}

					case "code_actions": {
						if (!params.line) return errorResult("'line' is required for code_actions.");
						const actions = await client.getCodeActions(filePath, params.line, character, timeoutMs);
						if (actions.length === 0) return textResult("No code actions available.");
						const lines = actions.map((a, i) => `${i + 1}. ${a.title}${a.kind ? ` (${a.kind})` : ""}`);
						return textResult(lines.join("\n"));
					}

					default:
						return errorResult(`Unknown action: ${params.action}`);
				}
			} catch (err: any) {
				return errorResult(`LSP error: ${err.message}`);
			}
		},
	});

	// ─── Helpers ────────────────────────────────────────────────────────

	function handleStatus(cwd: string): any {
		const config = pool.getConfig(cwd);
		const allServers = getAllServers(config);
		const activeClients = pool.getAllClients();

		if (allServers.length === 0) {
			return textResult("No LSP servers configured for this project.");
		}

		const lines: string[] = ["LSP Servers:"];
		for (const [name, server] of allServers) {
			const client = activeClients.get(name);
			const status = client ? client.status : "stopped";
			const types = server.fileTypes.join(", ");
			const icon = status === "ready" ? "●" : status === "initializing" ? "◐" : "○";
			lines.push(`  ${icon} ${name} (${types}) — ${status}`);
		}
		return textResult(lines.join("\n"));
	}

	async function handleReload(params: any, cwd: string): Promise<any> {
		if (!params.file) {
			// Reload all servers
			await pool.shutdownAll();
			pool.invalidateConfig();
			return textResult("All LSP servers restarted. They will re-initialize on next use.");
		}

		const filePath = resolvePath(params.file, cwd);
		const config = pool.getConfig(cwd);
		const entry = getServerForFile(config, filePath);
		if (!entry) {
			return errorResult(`No server configured for ${path.extname(filePath)} files.`);
		}

		await pool.restartServer(entry[0], cwd);
		return textResult(`Restarted LSP server: ${entry[0]}`);
	}

	function formatSymbols(symbols: any[], cwd: string, filePath: string, indent: number): string[] {
		const prefix = "  ".repeat(indent);
		const lines: string[] = [];
		for (const sym of symbols) {
			const kind = SYMBOL_KINDS[sym.kind] ?? "Unknown";
			const line = sym.selectionRange.start.line + 1;
			const relPath = path.relative(cwd, filePath);
			const detail = sym.detail ? ` — ${sym.detail}` : "";
			lines.push(`${prefix}${kind} ${sym.name}${detail} (${relPath}:${line})`);
			if (sym.children) {
				lines.push(...formatSymbols(sym.children, cwd, filePath, indent + 1));
			}
		}
		return lines;
	}

	function textResult(text: string) {
		return { content: [{ type: "text" as const, text }], details: {} };
	}

	function errorResult(message: string) {
		return { content: [{ type: "text" as const, text: `Error: ${message}` }], details: { error: true }, isError: true };
	}
}

import * as path from "node:path";
import { JsonRpcTransport } from "./json-rpc.js";
import { loadConfig as loadLspConfig, resolveCommand, type ServerConfig, type LspConfig } from "./config.js";
import { pathToUri, uriToFile, detectLanguageId, readFileContent, resolveSymbolColumn } from "./utils.js";

// ─── LSP Types (minimal subset) ───────────────────────────────────────────

interface Position { line: number; character: number }
interface Range { start: Position; end: Position }
interface Location { uri: string; range: Range }
interface LocationLink { targetUri: string; targetRange: Range; targetSelectionRange: Range }
interface Diagnostic { range: Range; severity?: number; message: string; code?: string | number; source?: string }
interface DocumentSymbol {
	name: string; kind: number; range: Range; selectionRange: Range;
	children?: DocumentSymbol[]; detail?: string;
}
interface Hover { contents: unknown; range?: Range }
interface TextEdit { range: Range; newText: string }
interface CodeAction { title: string; kind?: string; edit?: { changes?: Record<string, TextEdit[]> }; command?: { command: string } }

// ─── Client Capabilities ───────────────────────────────────────────────────

const CLIENT_CAPABILITIES = {
	textDocument: {
		synchronization: { didSave: true, dynamicRegistration: false, willSave: false, willSaveWaitUntil: false },
		hover: { contentFormat: ["markdown", "plaintext"] },
		definition: { dynamicRegistration: false, linkSupport: true },
		typeDefinition: { dynamicRegistration: false, linkSupport: true },
		implementation: { dynamicRegistration: false, linkSupport: true },
		references: { dynamicRegistration: false },
		documentSymbol: { dynamicRegistration: false, hierarchicalDocumentSymbolSupport: true },
		rename: { dynamicRegistration: false, prepareSupport: false },
		publishDiagnostics: { relatedInformation: true },
		codeAction: { dynamicRegistration: false },
	},
	workspace: { symbol: { dynamicRegistration: false } },
};

// ─── Open file tracking ────────────────────────────────────────────────────

interface OpenFile {
	version: number;
	content: string;
}

// ─── LspClient ─────────────────────────────────────────────────────────────

export class LspClient {
	readonly name: string;
	readonly config: ServerConfig;

	private transport: JsonRpcTransport;
	private capabilities: Record<string, unknown> = {};
	private openFiles = new Map<string, OpenFile>();
	private diagnostics = new Map<string, Diagnostic[]>();
	private initialized = false;
	private initPromise: Promise<void> | null = null;

	private constructor(name: string, config: ServerConfig, cwd: string) {
		this.name = name;
		this.config = config;

		const command = resolveCommand(config.command, cwd);
		this.transport = new JsonRpcTransport(command, config.args, cwd);

		// Listen for diagnostic notifications
		this.transport.on("notification", (method: string, params: any) => {
			if (method === "textDocument/publishDiagnostics" && params) {
				const fileUri = params.uri;
				this.diagnostics.set(fileUri, params.diagnostics ?? []);
			}
		});
	}

	/**
	 * Create and initialize an LSP client. Returns a ready-to-use client.
	 */
	static async create(name: string, config: ServerConfig, cwd: string): Promise<LspClient> {
		const client = new LspClient(name, config, cwd);
		await client.initialize(cwd);
		return client;
	}

	private async initialize(cwd: string): Promise<void> {
		if (this.initPromise) return this.initPromise;

		this.initPromise = (async () => {
			const rootUri = pathToUri(cwd);
			const result: any = await this.transport.request("initialize", {
				processId: process.pid,
				rootUri,
				rootPath: cwd,
				capabilities: CLIENT_CAPABILITIES,
				initializationOptions: this.config.initOptions ?? {},
			}, 60_000); // 60s init timeout for large projects

			this.capabilities = result?.capabilities ?? {};
			this.transport.notify("initialized", {});

			// Apply settings if provided
			if (this.config.settings && Object.keys(this.config.settings).length > 0) {
				this.transport.notify("workspace/didChangeConfiguration", {
					settings: this.config.settings,
				});
			}

			this.initialized = true;
		})();

		return this.initPromise;
	}

	// ─── File sync ──────────────────────────────────────────────────────

	async ensureFileOpen(filePath: string): Promise<string | null> {
		const uri = pathToUri(filePath);
		const content = readFileContent(filePath);
		if (content === null) return null;

		const existing = this.openFiles.get(uri);
		if (existing) {
			// Update if content changed
			if (existing.content !== content) {
				existing.version++;
				existing.content = content;
				this.transport.notify("textDocument/didChange", {
					textDocument: { uri, version: existing.version },
					contentChanges: [{ text: content }],
				});
			}
			return content;
		}

		// Open the file
		this.openFiles.set(uri, { version: 1, content });
		this.transport.notify("textDocument/didOpen", {
			textDocument: {
				uri,
				languageId: detectLanguageId(filePath),
				version: 1,
				text: content,
			},
		});
		return content;
	}

	closeFile(filePath: string) {
		const uri = pathToUri(filePath);
		if (this.openFiles.delete(uri)) {
			this.transport.notify("textDocument/didClose", { textDocument: { uri } });
		}
	}

	notifySaved(filePath: string) {
		const uri = pathToUri(filePath);
		this.transport.notify("textDocument/didSave", { textDocument: { uri } });
	}

	// ─── Operations ─────────────────────────────────────────────────────

	async getDiagnostics(filePath: string, timeoutMs: number = 15_000): Promise<{ file: string; diagnostics: Diagnostic[] }> {
		const content = await this.ensureFileOpen(filePath);
		if (content === null) {
			return { file: filePath, diagnostics: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, message: `File not found: ${filePath}`, severity: 1 }] };
		}

		const uri = pathToUri(filePath);

		// Wait for diagnostics to arrive
		return new Promise((resolve) => {
			// If we already have diagnostics, return immediately (but with a small delay for freshness)
			const check = () => {
				const diags = this.diagnostics.get(uri);
				if (diags !== undefined) {
					resolve({ file: filePath, diagnostics: diags });
					return true;
				}
				return false;
			};

			if (check()) return;

			const timer = setTimeout(() => {
				this.transport.removeListener("notification", handler);
				// Return whatever we have (may be empty)
				resolve({ file: filePath, diagnostics: this.diagnostics.get(uri) ?? [] });
			}, timeoutMs);

			const handler = (method: string, params: any) => {
				if (method === "textDocument/publishDiagnostics" && params?.uri === uri) {
					clearTimeout(timer);
					this.transport.removeListener("notification", handler);
					resolve({ file: filePath, diagnostics: params.diagnostics ?? [] });
				}
			};

			this.transport.on("notification", handler);
		});
	}

	async getDefinition(filePath: string, line: number, character: number, timeoutMs: number = 15_000): Promise<Location[]> {
		await this.ensureFileOpen(filePath);
		const result = await this.transport.request("textDocument/definition", {
			textDocument: { uri: pathToUri(filePath) },
			position: { line: line - 1, character },
		}, timeoutMs);

		return this.normalizeLocations(result);
	}

	async getTypeDefinition(filePath: string, line: number, character: number, timeoutMs: number = 15_000): Promise<Location[]> {
		await this.ensureFileOpen(filePath);
		const result = await this.transport.request("textDocument/typeDefinition", {
			textDocument: { uri: pathToUri(filePath) },
			position: { line: line - 1, character },
		}, timeoutMs);

		return this.normalizeLocations(result);
	}

	async getImplementation(filePath: string, line: number, character: number, timeoutMs: number = 15_000): Promise<Location[]> {
		await this.ensureFileOpen(filePath);
		const result = await this.transport.request("textDocument/implementation", {
			textDocument: { uri: pathToUri(filePath) },
			position: { line: line - 1, character },
		}, timeoutMs);

		return this.normalizeLocations(result);
	}

	async getReferences(filePath: string, line: number, character: number, timeoutMs: number = 15_000): Promise<Location[]> {
		await this.ensureFileOpen(filePath);
		const result = await this.transport.request("textDocument/references", {
			textDocument: { uri: pathToUri(filePath) },
			position: { line: line - 1, character },
			context: { includeDeclaration: true },
		}, timeoutMs);

		return Array.isArray(result) ? result : [];
	}

	async getHover(filePath: string, line: number, character: number, timeoutMs: number = 10_000): Promise<string | null> {
		await this.ensureFileOpen(filePath);
		const result: any = await this.transport.request("textDocument/hover", {
			textDocument: { uri: pathToUri(filePath) },
			position: { line: line - 1, character },
		}, timeoutMs);

		if (!result) return null;
		return this.extractHoverText(result);
	}

	async getSymbols(filePath: string, timeoutMs: number = 10_000): Promise<DocumentSymbol[]> {
		await this.ensureFileOpen(filePath);
		const result = await this.transport.request("textDocument/documentSymbol", {
			textDocument: { uri: pathToUri(filePath) },
		}, timeoutMs);

		return Array.isArray(result) ? result : [];
	}

	async rename(filePath: string, line: number, character: number, newName: string, timeoutMs: number = 10_000): Promise<Record<string, TextEdit[]> | null> {
		await this.ensureFileOpen(filePath);
		const result: any = await this.transport.request("textDocument/rename", {
			textDocument: { uri: pathToUri(filePath) },
			position: { line: line - 1, character },
			newName,
		}, timeoutMs);

		return result?.changes ?? null;
	}

	async getCodeActions(filePath: string, line: number, character: number, timeoutMs: number = 10_000): Promise<CodeAction[]> {
		await this.ensureFileOpen(filePath);
		const result = await this.transport.request("textDocument/codeAction", {
			textDocument: { uri: pathToUri(filePath) },
			range: { start: { line: line - 1, character }, end: { line: line - 1, character } },
			context: { diagnostics: [] },
		}, timeoutMs);

		return Array.isArray(result) ? result : [];
	}

	// ─── Helpers ────────────────────────────────────────────────────────

	private normalizeLocations(result: unknown): Location[] {
		if (!result) return [];
		if (Array.isArray(result)) {
			return result.flatMap((item: any) => {
				if (item.uri) return [item as Location];
				if (item.targetUri) return [{ uri: item.targetUri, range: item.targetRange } as Location];
				return [];
			});
		}
		if (typeof result === "object" && result !== null) {
			const r = result as any;
			if (r.uri) return [r as Location];
			if (r.targetUri) return [{ uri: r.targetUri, range: r.targetRange } as Location];
		}
		return [];
	}

	private extractHoverText(hover: any): string {
		const contents = hover.contents;
		if (typeof contents === "string") return contents;
		if (Array.isArray(contents)) {
			return contents.map((c: any) => {
				if (typeof c === "string") return c;
				if (c.value) return c.value;
				return String(c);
			}).join("\n\n");
		}
		if (contents?.value) return contents.value;
		return JSON.stringify(contents);
	}

	/**
	 * Resolve a (line, symbol) pair to a 0-indexed character position.
	 */
	resolvePosition(filePath: string, line1: number, symbol?: string, occurrence: number = 1): number {
		if (!symbol) return 0;
		const content = readFileContent(filePath);
		if (!content) return 0;
		const col = resolveSymbolColumn(content, line1, symbol, occurrence);
		return col >= 0 ? col : 0;
	}

	// ─── Lifecycle ──────────────────────────────────────────────────────

	get status(): "ready" | "initializing" | "disposed" {
		if (this.transport === null) return "disposed";
		return this.initialized ? "ready" : "initializing";
	}

	async shutdown() {
		try {
			await this.transport.request("shutdown", undefined, 5000);
		} catch {}
		this.transport.notify("exit");
		this.transport.dispose();
	}
}

import * as path from "node:path";
import * as fs from "node:fs";

// ─── URI conversion ────────────────────────────────────────────────────────

export function pathToUri(filePath: string): string {
	const absolute = path.resolve(filePath);
	// Encode each path segment for URI compliance
	const parts = absolute.split("/").map(encodeURIComponent);
	return `file://${parts.join("/")}`;
}

export function uriToFile(uri: string): string {
	if (!uri.startsWith("file://")) return uri;
	const withoutScheme = uri.slice("file://".length);
	return decodeURIComponent(withoutScheme);
}

// ─── Language detection ────────────────────────────────────────────────────

const EXT_TO_LANGUAGE: Record<string, string> = {
	".go": "go",
	".rs": "rust",
	".py": "python",
	".pyi": "python",
	".ts": "typescript",
	".tsx": "typescriptreact",
	".js": "javascript",
	".jsx": "javascriptreact",
	".c": "c",
	".cpp": "cpp",
	".cc": "cpp",
	".cxx": "cpp",
	".h": "c",
	".hpp": "cpp",
	".zig": "zig",
	".java": "java",
	".kt": "kotlin",
	".scala": "scala",
	".rb": "ruby",
	".lua": "lua",
	".ex": "elixir",
	".exs": "elixir",
	".erl": "erlang",
	".hs": "haskell",
	".ml": "ocaml",
	".mli": "ocaml",
	".cs": "csharp",
	".php": "php",
	".swift": "swift",
	".sh": "shellscript",
	".bash": "shellscript",
	".json": "json",
	".yaml": "yaml",
	".yml": "yaml",
	".toml": "toml",
	".md": "markdown",
	".html": "html",
	".css": "css",
	".scss": "scss",
	".sql": "sql",
	".nix": "nix",
	".vim": "vim",
};

export function detectLanguageId(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase();
	return EXT_TO_LANGUAGE[ext] ?? ext.slice(1);
}

// ─── Symbol → column resolution ───────────────────────────────────────────

/**
 * Find the column position of a symbol on a given line.
 * Lines and columns are 0-indexed internally; convert from 1-indexed as needed.
 */
export function resolveSymbolColumn(
	fileContent: string,
	line1: number,
	symbol: string,
	occurrence: number = 1,
): number {
	const lines = fileContent.split("\n");
	const lineText = lines[line1 - 1];
	if (!lineText) return -1;

	let col = -1;
	for (let i = 0; i < occurrence; i++) {
		col = lineText.indexOf(symbol, col + 1);
		if (col === -1) return -1;
	}
	return col;
}

// ─── File reading ──────────────────────────────────────────────────────────

export function readFileContent(filePath: string): string | null {
	try {
		return fs.readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}
}

export function fileExists(filePath: string): boolean {
	return fs.existsSync(filePath);
}

// ─── Path resolution ───────────────────────────────────────────────────────

export function resolvePath(filePath: string, cwd: string): string {
	if (path.isAbsolute(filePath)) return filePath;
	if (filePath.startsWith("~/")) {
		return path.join(process.env.HOME ?? "~", filePath.slice(2));
	}
	return path.resolve(cwd, filePath);
}

// ─── Formatting helpers ────────────────────────────────────────────────────

export interface Diagnostic {
	range: { start: { line: number; character: number }; end: { line: number; character: number } };
	severity?: number;
	message: string;
	code?: string | number;
	source?: string;
}

export interface Location {
	uri: string;
	range: { start: { line: number; character: number }; end: { line: number; character: number } };
}

const SEVERITY_LABELS: Record<number, string> = {
	1: "error",
	2: "warning",
	3: "info",
	4: "hint",
};

export function formatDiagnostic(diag: Diagnostic, cwd: string): string {
	const file = path.relative(cwd, uriToFile(diag.uri ?? ""));
	const line = diag.range.start.line + 1;
	const sev = SEVERITY_LABELS[diag.severity ?? 1] ?? "error";
	const code = diag.code ? ` [${diag.code}]` : "";
	const source = diag.source ? ` (${diag.source})` : "";
	return `${file}:${line}: ${sev}${source}${code}: ${diag.message}`;
}

export function formatLocation(loc: Location, cwd: string, content?: string): string {
	const file = path.relative(cwd, uriToFile(loc.uri));
	const line = loc.range.start.line + 1;
	const col = loc.range.start.character + 1;
	let result = `${file}:${line}:${col}`;
	if (content) {
		const snippet = content.split("\n")[loc.range.start.line]?.trim();
		if (snippet) result += `\n  → ${snippet}`;
	}
	return result;
}

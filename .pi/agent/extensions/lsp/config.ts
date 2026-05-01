import * as path from "node:path";
import * as fs from "node:fs";
import { readFileContent, uriToFile } from "./utils.js";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ServerConfig {
	command: string;
	args: string[];
	fileTypes: string[];
	rootMarkers: string[];
	initOptions?: Record<string, unknown>;
	settings?: Record<string, unknown>;
	isLinter?: boolean;
}

export interface LspConfig {
	servers: Record<string, ServerConfig>;
	idleTimeoutMs?: number;
}

// ─── Default server configs ────────────────────────────────────────────────

const DEFAULTS: Record<string, Partial<ServerConfig>> = {
	"gopls": {
		command: "gopls",
		args: ["serve"],
		fileTypes: [".go"],
		rootMarkers: ["go.mod", "go.work"],
		settings: {
			gopls: {
				analyses: { unusedparams: true, shadow: true },
				staticcheck: true,
				gofumpt: true,
			},
		},
	},
	"rust-analyzer": {
		command: "rust-analyzer",
		args: [],
		fileTypes: [".rs"],
		rootMarkers: ["Cargo.toml"],
		initOptions: {},
		settings: {},
	},
	"pyright": {
		command: "pyright-langserver",
		args: ["--stdio"],
		fileTypes: [".py", ".pyi"],
		rootMarkers: ["pyproject.toml", "pyrightconfig.json", "setup.py", "requirements.txt"],
		settings: {
			python: {
				analysis: {
					autoSearchPaths: true,
					diagnosticMode: "openFilesOnly",
					useLibraryCodeForTypes: true,
				},
			},
		},
	},
	"basedpyright": {
		command: "basedpyright-langserver",
		args: ["--stdio"],
		fileTypes: [".py", ".pyi"],
		rootMarkers: ["pyproject.toml", "pyrightconfig.json", "setup.py"],
		settings: {
			basedpyright: {
				analysis: {
					autoSearchPaths: true,
					diagnosticMode: "openFilesOnly",
					useLibraryCodeForTypes: true,
				},
			},
		},
	},
	"ruff": {
		command: "ruff",
		args: ["server"],
		fileTypes: [".py", ".pyi"],
		rootMarkers: ["pyproject.toml", "ruff.toml", ".ruff.toml"],
		isLinter: true,
	},
	"typescript-language-server": {
		command: "typescript-language-server",
		args: ["--stdio"],
		fileTypes: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
		rootMarkers: ["package.json", "tsconfig.json", "jsconfig.json"],
		initOptions: {
			hostInfo: "pi-coding-agent",
			preferences: {
				includeInlayParameterNameHints: "all",
				includeInlayVariableTypeHints: true,
			},
		},
	},
	"clangd": {
		command: "clangd",
		args: ["--background-index"],
		fileTypes: [".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx"],
		rootMarkers: ["compile_commands.json", "CMakeLists.txt", ".clangd", "Makefile"],
	},
	"zls": {
		command: "zls",
		args: [],
		fileTypes: [".zig"],
		rootMarkers: ["build.zig", "build.zig.zon"],
	},
	"hls": {
		command: "haskell-language-server-wrapper",
		args: ["--lsp"],
		fileTypes: [".hs", ".lhs"],
		rootMarkers: ["stack.yaml", "cabal.project", "package.yaml"],
	},
	"ocamllsp": {
		command: "ocamllsp",
		args: [],
		fileTypes: [".ml", ".mli"],
		rootMarkers: ["dune-project", "dune"],
	},
	"elixir-ls": {
		command: "elixir-ls",
		args: ["--stdio"],
		fileTypes: [".ex", ".exs"],
		rootMarkers: ["mix.exs"],
	},
	"solargraph": {
		command: "solargraph",
		args: ["stdio"],
		fileTypes: [".rb"],
		rootMarkers: ["Gemfile", ".solargraph.yml"],
	},
	"lua-language-server": {
		command: "lua-language-server",
		args: ["--stdio"],
		fileTypes: [".lua"],
		rootMarkers: [".luarc.json", ".luacheckrc"],
	},
	"kotlin-lsp": {
		command: "kotlin-lsp",
		args: ["--stdio"],
		fileTypes: [".kt", ".kts"],
		rootMarkers: ["build.gradle", "build.gradle.kts"],
	},
	"jdtls": {
		command: "jdtls",
		args: [],
		fileTypes: [".java"],
		rootMarkers: ["pom.xml", "build.gradle"],
	},
	"phpactor": {
		command: "phpactor",
		args: ["language-server"],
		fileTypes: [".php"],
		rootMarkers: ["composer.json"],
	},
	"ols": {
		command: "ols",
		args: [],
		fileTypes: [".odin"],
		rootMarkers: ["ols.json"],
	},
};

// ─── Config loading ────────────────────────────────────────────────────────

function normalizeServerConfig(name: string, config: Partial<ServerConfig>): ServerConfig | null {
	if (!config.command || !config.fileTypes?.length || !config.rootMarkers?.length) return null;
	return {
		command: config.command,
		args: config.args ?? [],
		fileTypes: config.fileTypes,
		rootMarkers: config.rootMarkers,
		initOptions: config.initOptions,
		settings: config.settings,
		isLinter: config.isLinter,
	};
}

function mergeConfigs(base: Record<string, ServerConfig>, overrides: Record<string, Partial<ServerConfig>>): Record<string, ServerConfig> {
	const result = { ...base };
	for (const [name, override] of Object.entries(overrides)) {
		if (override.command === null || override.command === "") {
			// Explicitly disable a default server
			delete result[name];
			continue;
		}
		const existing = result[name];
		const merged = existing ? { ...existing, ...override } : override;
		const normalized = normalizeServerConfig(name, merged);
		if (normalized) result[name] = normalized;
	}
	return result;
}

function loadConfigFile(filePath: string): Record<string, Partial<ServerConfig>> | null {
	try {
		const content = fs.readFileSync(filePath, "utf-8");
		const parsed = JSON.parse(content);
		// Support both { servers: { ... } } and { serverName: { ... } } formats
		if (parsed.servers && typeof parsed.servers === "object") {
			return parsed.servers;
		}
		// Treat top-level keys as server configs (filter out non-config keys)
		const servers: Record<string, Partial<ServerConfig>> = {};
		for (const [key, val] of Object.entries(parsed)) {
			if (key === "idleTimeoutMs") continue;
			if (typeof val === "object" && val !== null) servers[key] = val as Partial<ServerConfig>;
		}
		return Object.keys(servers).length > 0 ? servers : null;
	} catch {
		return null;
	}
}

/**
 * Check if any root marker exists in the given directory or its parents (up to cwd).
 */
function hasRootMarker(cwd: string, markers: string[]): boolean {
	for (const marker of markers) {
		// Simple check: does the marker exist in cwd?
		if (fs.existsSync(path.join(cwd, marker))) return true;
	}
	return false;
}

/**
 * Try to resolve a local binary (e.g., from node_modules/.bin or .venv/bin).
 */
function resolveLocalCommand(command: string, cwd: string): string | null {
	// node_modules/.bin/<command>
	const nmBin = path.join(cwd, "node_modules", ".bin", command);
	if (fs.existsSync(nmBin)) return nmBin;

	// .venv/bin/<command>
	const venvBin = path.join(cwd, ".venv", "bin", command);
	if (fs.existsSync(venvBin)) return venvBin;

	return null;
}

export function resolveCommand(command: string, cwd: string): string {
	// Try local resolution first
	const local = resolveLocalCommand(command, cwd);
	if (local) return local;
	return command;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Load the merged LSP configuration: defaults + project overrides.
 */
export function loadConfig(cwd: string): LspConfig {
	// Start with defaults that have root markers present
	const servers: Record<string, ServerConfig> = {};
	for (const [name, def] of Object.entries(DEFAULTS)) {
		const config = normalizeServerConfig(name, def);
		if (config && hasRootMarker(cwd, config.rootMarkers)) {
			servers[name] = config;
		}
	}

	// Load project overrides
	const configPaths = [
		path.join(cwd, ".pi", "lsp.json"),
		path.join(cwd, ".lsp.json"),
	];

	for (const configPath of configPaths) {
		const overrides = loadConfigFile(configPath);
		if (overrides) {
			const merged = mergeConfigs(servers, overrides);
			Object.assign(servers, merged);
		}
	}

	return { servers };
}

/**
 * Get all servers matching a file's extension.
 */
export function getServersForFile(config: LspConfig, filePath: string): Array<[string, ServerConfig]> {
	const ext = path.extname(filePath).toLowerCase();
	const result: Array<[string, ServerConfig]> = [];
	for (const [name, server] of Object.entries(config.servers)) {
		if (server.fileTypes.includes(ext)) {
			result.push([name, server]);
		}
	}
	// Prefer non-linter servers (full language servers) over linters
	result.sort(([_, a], [__, b]) => (a.isLinter ? 1 : 0) - (b.isLinter ? 1 : 0));
	return result;
}

/**
 * Get the primary server for a file (first non-linter match).
 */
export function getServerForFile(config: LspConfig, filePath: string): [string, ServerConfig] | null {
	const servers = getServersForFile(config, filePath);
	return servers.length > 0 ? servers[0] : null;
}

/**
 * Get all configured servers (for status display).
 */
export function getAllServers(config: LspConfig): Array<[string, ServerConfig]> {
	return Object.entries(config.servers);
}

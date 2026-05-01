import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

// ─── JSON-RPC Types ────────────────────────────────────────────────────────

interface JsonRpcRequest {
	jsonrpc: "2.0";
	id: number;
	method: string;
	params?: unknown;
}

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id: number;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}

interface JsonRpcNotification {
	jsonrpc: "2.0";
	method: string;
	params?: unknown;
}

type JsonRpcMessage = JsonRpcRequest | JsonRpcResponse | JsonRpcNotification;

// ─── JSON-RPC Transport ────────────────────────────────────────────────────

export class JsonRpcTransport extends EventEmitter {
	private proc: ChildProcess;
	private buffer = Buffer.alloc(0);
	private nextId = 1;
	private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
	private disposed = false;

	constructor(command: string, args: string[], cwd: string) {
		super();
		this.proc = spawn(command, args, {
			cwd,
			stdio: ["pipe", "pipe", "pipe"],
			env: { ...process.env },
		});

		this.proc.stdout!.on("data", (chunk: Buffer) => {
			this.buffer = Buffer.concat([this.buffer, chunk]);
			this.tryParse();
		});

		this.proc.stderr!.on("data", (data: Buffer) => {
			// Forward server logs for debugging (rate-limited in practice)
			const msg = data.toString().trim();
			if (msg) this.emit("log", msg);
		});

		this.proc.on("error", (err) => {
			this.emit("error", err);
		});

		this.proc.on("exit", (code) => {
			this.emit("exit", code);
			// Reject all pending requests
			for (const [id, { reject }] of this.pending) {
				reject(new Error(`LSP server exited with code ${code}`));
				this.pending.delete(id);
			}
		});
	}

	private tryParse() {
		while (true) {
			if (this.buffer.length < 16) break; // minimum header size

			const headerEnd = this.buffer.indexOf("\r\n\r\n");
			if (headerEnd === -1) break;

			const headerStr = this.buffer.subarray(0, headerEnd).toString("ascii");
			const match = headerStr.match(/Content-Length:\s*(\d+)/i);
			if (!match) break;

			const contentLength = parseInt(match[1], 10);
			const bodyStart = headerEnd + 4;

			if (this.buffer.length < bodyStart + contentLength) break;

			const body = this.buffer.subarray(bodyStart, bodyStart + contentLength).toString("utf-8");
			this.buffer = this.buffer.subarray(bodyStart + contentLength);

			try {
				const message: JsonRpcMessage = JSON.parse(body);
				this.handleMessage(message);
			} catch (err) {
				this.emit("error", new Error(`JSON-RPC parse error: ${err}`));
			}
		}
	}

	private handleMessage(message: JsonRpcMessage) {
		if ("id" in message && "method" in message) {
			// Server → Client request (we don't handle these for now)
			this.emit("request", message);
		} else if ("id" in message && !("method" in message)) {
			// Response to our request
			const id = message.id;
			const pending = this.pending.get(id);
			if (pending) {
				this.pending.delete(id);
				if (message.error) {
					pending.reject(new Error(`LSP error ${message.error.code}: ${message.error.message}`));
				} else {
					pending.resolve(message.result);
				}
			}
		} else if ("method" in message) {
			// Notification
			this.emit("notification", message.method, message.params);
		}
	}

	send(message: Omit<JsonRpcRequest, "jsonrpc"> | Omit<JsonRpcNotification, "jsonrpc">) {
		if (this.disposed) return;
		const full = { jsonrpc: "2.0" as const, ...message };
		const body = JSON.stringify(full);
		const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
		this.proc.stdin!.write(header + body);
	}

	request(method: string, params?: unknown, timeoutMs: number = 30_000): Promise<unknown> {
		return new Promise((resolve, reject) => {
			if (this.disposed) {
				reject(new Error("Transport disposed"));
				return;
			}

			const id = this.nextId++;
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`LSP request '${method}' timed out after ${timeoutMs}ms`));
			}, timeoutMs);

			this.pending.set(id, {
				resolve: (v) => {
					clearTimeout(timer);
					resolve(v);
				},
				reject: (e) => {
					clearTimeout(timer);
					reject(e);
				},
			});

			this.send({ id, method, params });
		});
	}

	notify(method: string, params?: unknown) {
		this.send({ method, params });
	}

	dispose() {
		this.disposed = true;
		for (const [, { reject }] of this.pending) {
			reject(new Error("Transport disposed"));
		}
		this.pending.clear();
		try {
			this.proc.stdin!.end();
			this.proc.kill("SIGTERM");
			// Force kill after 3s
			setTimeout(() => {
				try { this.proc.kill("SIGKILL"); } catch {}
			}, 3000);
		} catch {}
	}

	get pid(): number | undefined {
		return this.proc.pid;
	}
}

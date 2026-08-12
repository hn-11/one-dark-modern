// Minimal LSP client + semantic-token session, shared by the audit scripts.
//
// Hardening rules (docs/IMPROVEMENT-IDEAS.md item 15): a language server that
// dies, refuses to initialize, or answers with a JSON-RPC error must make the
// audit fail loudly. A silent empty token list looks exactly like "the theme is
// clean", which is the one failure mode this harness must never have.
import { spawn, type ChildProcess } from "node:child_process";
import { pathToFileURL } from "node:url";

export interface SemToken {
  line: number;
  start: number;
  len: number;
  type: string;
  modifiers: string[];
}
export interface Legend {
  tokenTypes: string[];
  tokenModifiers: string[];
}

const INITIALIZE_TIMEOUT_MS = 60_000;
// generous: a cold rust-analyzer has to run `cargo metadata` + `cargo check`
const QUIESCENT_TIMEOUT_MS = 300_000;

interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

class Lsp {
  private proc: ChildProcess;
  private buf = Buffer.alloc(0);
  private id = 0;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; method: string }
  >();
  private configResponse: unknown;
  private stderrChunks: string[] = [];
  private exited: { code: number | null; signal: NodeJS.Signals | null } | null = null;
  private spawnError: Error | null = null;
  readonly label: string;
  /** set by the owner to observe server -> client notifications */
  onNotification?: (method: string, params: unknown) => void;

  constructor(
    cmd: string,
    args: string[],
    cwd: string,
    configResponse: unknown,
    env?: Record<string, string>
  ) {
    this.configResponse = configResponse;
    this.label = [cmd, ...args].join(" ");
    // stderr is piped (not "ignore") so a crash/panic message survives to the
    // failure report instead of being thrown away.
    this.proc = spawn(cmd, args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: env ? { ...process.env, ...env } : process.env,
    });
    this.proc.stdout!.on("data", (chunk: Buffer) => this.onData(chunk));
    this.proc.stderr!.on("data", (chunk: Buffer) => {
      this.stderrChunks.push(chunk.toString());
      // keep the buffer bounded; a chatty server must not eat all the memory
      if (this.stderrChunks.length > 500) this.stderrChunks.splice(0, 250);
    });
    this.proc.on("error", (err) => {
      this.spawnError = err;
      this.failAll(new Error(`failed to spawn ${this.label}: ${err.message}`));
    });
    this.proc.on("exit", (code, signal) => {
      this.exited = { code, signal };
      this.failAll(
        new Error(
          `${this.label} exited (code=${code}, signal=${signal}) with requests in flight\n  ` +
            this.diagnostics()
        )
      );
    });
    // stdin EPIPE after the child is gone would otherwise be an unhandled throw
    this.proc.stdin!.on("error", () => {});
  }

  /** Everything stderr produced so far, trimmed to something printable. */
  stderr(): string {
    const s = this.stderrChunks.join("").trimEnd();
    return s.length > 8000 ? s.slice(0, 4000) + "\n  […]\n" + s.slice(-4000) : s;
  }

  /** Human-readable context appended to every error thrown out of this client. */
  diagnostics(): string {
    const parts: string[] = [];
    if (this.spawnError) parts.push(`spawn error: ${this.spawnError.message}`);
    if (this.exited)
      parts.push(`process exited: code=${this.exited.code} signal=${this.exited.signal}`);
    const err = this.stderr();
    parts.push(err ? `stderr:\n${err.replace(/^/gm, "    ")}` : "stderr: (empty)");
    return parts.join("\n  ");
  }

  private failAll(err: Error): void {
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
  }

  private onData(chunk: Buffer): void {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      const headerEnd = this.buf.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const m = /Content-Length: (\d+)/.exec(this.buf.subarray(0, headerEnd).toString());
      if (!m) return;
      const len = parseInt(m[1], 10);
      if (this.buf.length < headerEnd + 4 + len) return;
      const msg = JSON.parse(this.buf.subarray(headerEnd + 4, headerEnd + 4 + len).toString());
      this.buf = this.buf.subarray(headerEnd + 4 + len);
      this.dispatch(msg);
    }
  }

  private dispatch(msg: {
    id?: number;
    method?: string;
    params?: unknown;
    result?: unknown;
    error?: RpcError;
  }): void {
    if (msg.method && msg.id !== undefined) {
      // server -> client request
      let result: unknown = null;
      if (msg.method === "workspace/configuration") {
        const items = (msg.params as { items: unknown[] }).items;
        result = items.map(() => this.configResponse);
      }
      this.send({ jsonrpc: "2.0", id: msg.id, result });
    } else if (msg.method && msg.id === undefined) {
      // server -> client notification
      this.onNotification?.(msg.method, msg.params);
    } else if (msg.id !== undefined && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      if (msg.error) {
        p.reject(
          new Error(
            `${this.label}: ${p.method} responded with JSON-RPC error ` +
              `${msg.error.code}: ${msg.error.message}\n  ${this.diagnostics()}`
          )
        );
      } else {
        p.resolve(msg.result);
      }
    }
  }

  private send(obj: unknown): void {
    const s = JSON.stringify(obj);
    this.proc.stdin!.write(`Content-Length: ${Buffer.byteLength(s)}\r\n\r\n${s}`);
  }

  request<T>(method: string, params: unknown, timeoutMs?: number): Promise<T> {
    if (this.exited)
      return Promise.reject(
        new Error(`${this.label}: cannot send ${method}, process already exited\n  ${this.diagnostics()}`)
      );
    const id = ++this.id;
    const p = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, method });
      if (timeoutMs !== undefined) {
        const timer = setTimeout(() => {
          if (!this.pending.has(id)) return;
          this.pending.delete(id);
          reject(
            new Error(
              `${this.label}: ${method} timed out after ${timeoutMs}ms\n  ${this.diagnostics()}`
            )
          );
        }, timeoutMs);
        timer.unref?.();
      }
    });
    this.send({ jsonrpc: "2.0", id, method, params });
    return p;
  }

  notify(method: string, params: unknown): void {
    this.send({ jsonrpc: "2.0", method, params });
  }

  hasExited(): boolean {
    return this.exited !== null || this.spawnError !== null;
  }

  kill(): void {
    this.proc.kill();
  }
}

export class SemanticSession {
  private lsp: Lsp;
  private legend: Legend | undefined;
  private ready: Promise<void>;
  private quiescent: Promise<void> | null = null;
  /**
   * `opts.env` is merged over the inherited environment. It exists for servers
   * that write build artefacts next to the fixture they are reading
   * (rust-analyzer runs `cargo check`, which would drop a `target/` directory
   * inside `audit/fixtures/` and change what the oracle walks); pointing the
   * tool at a scratch directory keeps the fixture tree exactly as committed.
   *
   * `opts.waitQuiescent` is the rust-analyzer correctness fix. While the
   * workspace is still loading, rust-analyzer answers semanticTokens/full with
   * a *provisional* highlighting computed without name resolution: `usize`
   * comes back as `namespace`, a `const` usage as `struct`, a parameter as
   * `const`. Those answers are non-empty and stable for several seconds, so
   * neither the retry loop below nor a "wait until it stops changing" heuristic
   * can tell them apart from the real thing - and auditing them would compare
   * the theme against colours no user ever sees. rust-analyzer announces the
   * real state with `experimental/serverStatus` (`quiescent: true`), which this
   * flag opts into and waits for.
   */
  constructor(
    cmd: string,
    args: string[],
    cwd: string,
    initOptions: unknown,
    configResponse: unknown,
    opts: { env?: Record<string, string>; waitQuiescent?: boolean } = {}
  ) {
    this.lsp = new Lsp(cmd, args, cwd, configResponse, opts.env);
    if (opts.waitQuiescent) {
      this.quiescent = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              new Error(
                `${this.lsp.label}: no quiescent experimental/serverStatus within ` +
                  `${QUIESCENT_TIMEOUT_MS}ms - the workspace never finished loading, so ` +
                  `every semantic token would be provisional\n  ${this.lsp.diagnostics()}`
              )
            ),
          QUIESCENT_TIMEOUT_MS
        );
        timer.unref?.();
        this.lsp.onNotification = (method, params): void => {
          if (method !== "experimental/serverStatus") return;
          const p = params as { quiescent?: boolean; health?: string };
          if (p.quiescent !== true) return;
          clearTimeout(timer);
          if (p.health === "error")
            reject(
              new Error(
                `${this.lsp.label}: reported health="error" while loading the workspace\n  ` +
                  this.lsp.diagnostics()
              )
            );
          else resolve();
        };
      });
      this.quiescent.catch(() => {});
    }
    this.ready = this.lsp
      .request<{ capabilities: { semanticTokensProvider?: { legend: Legend } } }>(
        "initialize",
        {
          processId: process.pid,
          rootUri: pathToFileURL(cwd).toString(),
          workspaceFolders: [{ uri: pathToFileURL(cwd).toString(), name: "fixture" }],
          initializationOptions: initOptions,
          capabilities: {
            workspace: { configuration: true },
            // rust-analyzer only sends experimental/serverStatus to a client
            // that asks for it; harmless noise for every other server
            experimental: { serverStatusNotification: true },
            textDocument: {
              semanticTokens: {
                requests: { full: true },
                tokenTypes: [],
                tokenModifiers: [],
                formats: ["relative"],
              },
            },
          },
        },
        INITIALIZE_TIMEOUT_MS
      )
      .then((init) => {
        this.legend = init.capabilities.semanticTokensProvider?.legend;
        if (!this.legend)
          throw new Error(
            `${this.lsp.label}: initialize returned no semanticTokensProvider legend ` +
              `- this server cannot answer the audit\n  ${this.lsp.diagnostics()}`
          );
        this.lsp.notify("initialized", {});
      });
    // a rejected `ready` that nobody has awaited yet must not crash the process
    this.ready.catch(() => {});
  }

  async tokens(path: string, languageId: string, text: string): Promise<SemToken[]> {
    await this.ready;
    if (this.quiescent) await this.quiescent;
    const uri = pathToFileURL(path).toString();
    this.lsp.notify("textDocument/didOpen", {
      textDocument: { uri, languageId, version: 1, text },
    });
    let data: number[] | null = null;
    for (let i = 0; i < 30; i++) {
      if (this.lsp.hasExited())
        throw new Error(
          `${this.lsp.label}: server died while tokenizing ${path}\n  ${this.lsp.diagnostics()}`
        );
      const r = await this.lsp.request<{ data: number[] } | null>(
        "textDocument/semanticTokens/full",
        { textDocument: { uri } },
        30_000
      );
      if (r && r.data && r.data.length > 0) {
        data = r.data;
        break;
      }
      await new Promise((res) => setTimeout(res, 500));
    }
    if (!data || !this.legend) return [];
    const toks: SemToken[] = [];
    let line = 0;
    let start = 0;
    for (let i = 0; i < data.length; i += 5) {
      line += data[i];
      start = data[i] === 0 ? start + data[i + 1] : data[i + 1];
      const mods: string[] = [];
      for (let b = 0; b < this.legend.tokenModifiers.length; b++)
        if (data[i + 4] & (1 << b)) mods.push(this.legend.tokenModifiers[b]);
      toks.push({ line, start, len: data[i + 2], type: this.legend.tokenTypes[data[i + 3]], modifiers: mods });
    }
    return toks;
  }

  /** stderr + exit state, for the caller's failure report. */
  diagnostics(): string {
    return this.lsp.diagnostics();
  }

  kill(): void {
    this.lsp.kill();
  }
}

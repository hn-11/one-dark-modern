// Minimal LSP client + semantic-token session, shared by the audit scripts.
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

class Lsp {
  private proc: ChildProcess;
  private buf = Buffer.alloc(0);
  private id = 0;
  private pending = new Map<number, (v: unknown) => void>();
  private configResponse: unknown;
  constructor(cmd: string, args: string[], cwd: string, configResponse: unknown) {
    this.configResponse = configResponse;
    this.proc = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "ignore"] });
    this.proc.stdout!.on("data", (chunk: Buffer) => this.onData(chunk));
  }
  private onData(chunk: Buffer): void {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      const headerEnd = this.buf.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const m = /Content-Length: (\d+)/.exec(this.buf.slice(0, headerEnd).toString());
      if (!m) return;
      const len = parseInt(m[1], 10);
      if (this.buf.length < headerEnd + 4 + len) return;
      const msg = JSON.parse(this.buf.slice(headerEnd + 4, headerEnd + 4 + len).toString());
      this.buf = this.buf.slice(headerEnd + 4 + len);
      this.dispatch(msg);
    }
  }
  private dispatch(msg: { id?: number; method?: string; params?: unknown; result?: unknown }): void {
    if (msg.method && msg.id !== undefined) {
      let result: unknown = null;
      if (msg.method === "workspace/configuration") {
        const items = (msg.params as { items: unknown[] }).items;
        result = items.map(() => this.configResponse);
      }
      this.send({ jsonrpc: "2.0", id: msg.id, result });
    } else if (msg.id !== undefined && this.pending.has(msg.id)) {
      this.pending.get(msg.id)!(msg.result);
      this.pending.delete(msg.id);
    }
  }
  private send(obj: unknown): void {
    const s = JSON.stringify(obj);
    this.proc.stdin!.write(`Content-Length: ${Buffer.byteLength(s)}\r\n\r\n${s}`);
  }
  request<T>(method: string, params: unknown): Promise<T> {
    const id = ++this.id;
    this.send({ jsonrpc: "2.0", id, method, params });
    return new Promise((res) => this.pending.set(id, res as (v: unknown) => void));
  }
  notify(method: string, params: unknown): void {
    this.send({ jsonrpc: "2.0", method, params });
  }
  kill(): void {
    this.proc.kill();
  }
}

export class SemanticSession {
  private lsp: Lsp;
  private legend: Legend | undefined;
  private ready: Promise<void>;
  constructor(cmd: string, args: string[], cwd: string, initOptions: unknown, configResponse: unknown) {
    this.lsp = new Lsp(cmd, args, cwd, configResponse);
    this.ready = this.lsp
      .request<{ capabilities: { semanticTokensProvider?: { legend: Legend } } }>("initialize", {
        processId: process.pid,
        rootUri: pathToFileURL(cwd).toString(),
        workspaceFolders: [{ uri: pathToFileURL(cwd).toString(), name: "fixture" }],
        initializationOptions: initOptions,
        capabilities: {
          workspace: { configuration: true },
          textDocument: {
            semanticTokens: {
              requests: { full: true },
              tokenTypes: [],
              tokenModifiers: [],
              formats: ["relative"],
            },
          },
        },
      })
      .then((init) => {
        this.legend = init.capabilities.semanticTokensProvider?.legend;
        this.lsp.notify("initialized", {});
      });
  }
  async tokens(path: string, languageId: string, text: string): Promise<SemToken[]> {
    await this.ready;
    const uri = pathToFileURL(path).toString();
    this.lsp.notify("textDocument/didOpen", {
      textDocument: { uri, languageId, version: 1, text },
    });
    let data: number[] | null = null;
    for (let i = 0; i < 30; i++) {
      const r = await this.lsp.request<{ data: number[] } | null>("textDocument/semanticTokens/full", {
        textDocument: { uri },
      });
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
  kill(): void {
    this.lsp.kill();
  }
}

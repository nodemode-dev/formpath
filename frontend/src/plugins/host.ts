import type { Engine } from '../engine';
import { api } from '../io/api';
import type { AgentBridge } from '../automation/agent-bridge';
import type { Commands } from '../ui/commands';

const OFF = 'formpth.plugins.off';
const CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src 'none'; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; manifest-src 'none'; form-action 'none'; base-uri 'none'";

const RUNTIME = `<script>
(() => {
  for (const k of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'RTCRtpSender', 'RTCRtpReceiver', 'RTCRtpTransceiver', 'RTCIceTransport', 'RTCDtlsTransport', 'RTCSctpTransport']) { try { Object.defineProperty(window, k, { value: undefined, writable: false, configurable: false }); } catch (e) { } }
  const pending = new Map(), commands = {}; let n = 0, name = '';
  const send = (m) => parent.postMessage(Object.assign({ formpthPlugin: true }, m), '*');
  const rpc = (op, args) => new Promise((ok, no) => { const id = ++n; pending.set(id, { ok, no }); send({ id, op, args }); });
  addEventListener('message', async (e) => {
    const m = e.data;
    if (!m || e.source !== parent) return;
    if (m.formpthReply && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.no(new Error(m.error)) : p.ok(m.result); return; }
    if (m.formpthRun) {
      try { const f = commands[m.command]; if (!f) throw new Error('No command ' + m.command); await f(); send({ op: 'done', runId: m.runId }); }
      catch (err) { send({ op: 'done', runId: m.runId, error: String(err && err.message || err) }); }
    }
  });
  window.formpth = {
    register(spec) {
      name = String(spec && spec.name || 'Plugin');
      const list = (spec && spec.commands || []).filter((c) => c && c.id && typeof c.run === 'function');
      for (const c of list) commands[c.id] = c.run;
      send({ op: 'register', args: { name, commands: list.map((c) => ({ id: String(c.id), label: String(c.label || c.id) })) } });
    },
    call: (tool, args) => rpc('call', { tool, args: args || {} }),
    getDocument: () => rpc('call', { tool: 'get_document', args: {} }).then((r) => r && r.structuredContent),
    getSvg: (scope) => rpc('call', { tool: 'get_svg', args: { scope: scope || 'artboard' } }).then((r) => r && r.content && r.content[0] && r.content[0].text),
    placeSvg: (svg, x, y) => rpc('placeSvg', { svg: String(svg), x: Number(x) || 0, y: Number(y) || 0 }),
  };
})();
<\/script>`;

interface Loaded { name: string; frame: HTMLIFrameElement; label: string; commands: Array<{ id: string; label: string }> }

export class PluginHost {
  private readonly loaded = new Map<string, Loaded>();
  private readonly runs = new Map<number, (error?: string) => void>();
  private runId = 0;
  onChange: () => void = () => {};
  placeSvg: (svg: string, at: { x: number; y: number }) => Promise<string[]> = async () => [];

  constructor(private readonly engine: Engine, private readonly bridge: AgentBridge, private readonly commands: Commands, private readonly note: (text: string, kind?: 'info' | 'error') => void) {
    window.addEventListener('message', (e) => void this.receive(e));
  }

  off(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(OFF) ?? '[]') as string[]); } catch { return new Set(); } }
  setOn(name: string, on: boolean): void {
    const s = this.off();
    if (on) s.delete(name); else s.add(name);
    try { localStorage.setItem(OFF, JSON.stringify([...s])); } catch { }
    if (on) void this.load(name); else this.unload(name);
  }

  async loadAll(): Promise<void> {
    const off = this.off();
    for (const p of await api.plugins()) if (!off.has(p.name) && !this.loaded.has(p.name)) await this.load(p.name);
  }

  async load(name: string): Promise<void> {
    this.unload(name);
    let code = '';
    try { code = await api.pluginCode(name); } catch { this.note(`${name} could not be read.`, 'error'); return; }
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.hidden = true;
    frame.title = `Plugin ${name}`;
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.srcdoc = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta http-equiv="x-dns-prefetch-control" content="off">${RUNTIME}<script>\n${code.replace(/<\/script/gi, '<\\/script')}\n<\/script>`;
    this.loaded.set(name, { name, frame, label: name.replace(/\.js$/, ''), commands: [] });
    document.body.appendChild(frame);
  }

  unload(name: string): void {
    const p = this.loaded.get(name);
    if (!p) return;
    for (const c of p.commands) this.commands.remove(this.id(name, c.id));
    p.frame.remove();
    this.loaded.delete(name);
    this.onChange();
  }

  commandIds(): string[] { return [...this.loaded.values()].flatMap((p) => p.commands.map((c) => this.id(p.name, c.id))); }

  private id(plugin: string, cmd: string): string { return `plugin:${plugin}:${cmd}`; }

  private run(p: Loaded, command: string, label: string): void {
    const runId = ++this.runId;
    this.runs.set(runId, (error) => { if (error) this.note(`${label}: ${error}`, 'error'); });
    p.frame.contentWindow?.postMessage({ formpthRun: true, runId, command }, '*');
  }

  private async receive(e: MessageEvent): Promise<void> {
    const p = [...this.loaded.values()].find((x) => x.frame.contentWindow === e.source);
    const m = e.data as { formpthPlugin?: boolean; id?: number; op?: string; args?: Record<string, unknown>; runId?: number; error?: string };
    if (!p || !m || m.formpthPlugin !== true) return;
    const reply = (result?: unknown, error?: string): void => { p.frame.contentWindow?.postMessage({ formpthReply: true, id: m.id, result, error }, '*'); };
    try {
      switch (m.op) {
        case 'register': {
          const cmds = Array.isArray(m.args?.commands) ? (m.args.commands as Array<{ id: string; label: string }>).slice(0, 40) : [];
          for (const c of p.commands) this.commands.remove(this.id(p.name, c.id));
          p.label = String(m.args?.name ?? p.label).slice(0, 60);
          p.commands = cmds.map((c) => ({ id: String(c.id).slice(0, 60), label: String(c.label).slice(0, 80) }));
          for (const c of p.commands) this.commands.add({ id: this.id(p.name, c.id), label: c.label, enabled: () => !!this.engine.current, run: () => this.run(p, c.id, c.label) });
          this.onChange();
          return;
        }
        case 'done': { const f = this.runs.get(m.runId ?? -1); this.runs.delete(m.runId ?? -1); f?.(m.error); return; }
        case 'call': {
          const tool = String(m.args?.tool ?? '');
          if (/^(open_file|save_project|export_file|place_image)$/.test(tool)) { reply(undefined, `${tool} reads or writes files, which plugins cannot do.`); return; }
          reply(await this.bridge.run(tool, (m.args?.args ?? {}) as Record<string, unknown>));
          return;
        }
        case 'placeSvg': {
          if (!this.engine.current) { reply(undefined, 'No document is open.'); return; }
          reply(await this.placeSvg(String(m.args?.svg ?? ''), { x: Number(m.args?.x) || 0, y: Number(m.args?.y) || 0 }));
          return;
        }
        default: reply(undefined, `Unknown request ${m.op}.`);
      }
    } catch (err) { reply(undefined, err instanceof Error ? err.message : String(err)); }
  }
}

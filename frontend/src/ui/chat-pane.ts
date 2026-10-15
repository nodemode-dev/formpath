import { api, socketTo } from '../io/api';
import { el, q, setClass, setHidden, setText } from './dom';
import { askForm } from './form-dialog';
import { icon } from './icons';
import { MarkdownStream } from './markdown';

interface Part { kind: 'text' | 'tool'; text?: string; id?: string; name?: string; input?: string; status?: string; images?: string[] }
interface Meta { seconds?: number; turns?: number | null; costUsd?: number | null }
interface Message { role: 'user' | 'assistant'; text?: string; note?: string; parts?: Part[]; error?: string; meta?: Meta }
interface Usage { input: number; output: number; costUsd: number; context: number; window: number; model: string }
interface State { busy: boolean; messages: Message[]; turn: number; session: string; usage?: Usage }
type Event = Record<string, unknown> & { type: string };

function tokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k`;
  return String(n);
}

export class ChatPane {
  readonly root = el(`<div class="ft-chat" hidden>
<div class="ft-chat-bar"><span class="ft-chat-status cv-note"></span><span class="ft-chat-usage" title="Memory: how much of Claude's working memory this conversation uses. Chat: everything sent and written in this conversation, and what it cost."></span><span class="ft-dock-spacer"></span>
<button type="button" class="cv-btn ft-chat-stop" hidden>Stop</button>
<button type="button" class="cv-btn ft-chat-adopt" title="Bring a conversation you had in a Claude Code tab into this chat">From Claude Code...</button>
<button type="button" class="cv-btn ft-chat-handoff" title="Continue this conversation in a Claude Code terminal tab">Open in Claude Code</button>
<button type="button" class="cv-btn ft-chat-new">New Chat</button></div>
<div class="ft-chat-log" role="log" aria-live="polite"><p class="ft-chat-empty cv-note">Ask Claude in the line below to draw, restyle, arrange or export the open document. It works through formpth's own tools, every change appears in the window as it happens, and each one can be undone.</p></div>
</div>`);
  onFail: (err: unknown) => void = () => undefined;
  onHandoff: (session: string) => void = () => undefined;
  onBusy: (busy: boolean) => void = () => undefined;
  private readonly log = q(this.root, '.ft-chat-log');
  private readonly empty = q(this.root, '.ft-chat-empty');
  private readonly meter = q(this.root, '.ft-chat-usage');
  private readonly stopBtn = q<HTMLButtonElement>(this.root, '.ft-chat-stop');
  private reply: HTMLElement | null = null;
  private md: MarkdownStream | null = null;
  private usage: Usage = { input: 0, output: 0, costUsd: 0, context: 0, window: 0, model: '' };
  private readonly chips = new Map<string, HTMLElement>();
  private busy = false;
  private loaded = false;
  private socket: WebSocket | null = null;

  constructor() {
    this.stopBtn.addEventListener('click', () => void api.chatCancel().catch((e) => this.onFail(e)));
    q(this.root, '.ft-chat-new').addEventListener('click', () => void api.chatReset().catch((e) => this.onFail(e)));
    q(this.root, '.ft-chat-handoff').addEventListener('click', () => void this.handoff());
    q(this.root, '.ft-chat-adopt').addEventListener('click', () => void this.adopt());
  }

  async load(): Promise<void> {
    this.listen();
    if (this.loaded) return;
    this.loaded = true;
    try {
      const s = await api.chatState<State>();
      for (const m of s.messages) {
        if (m.role === 'user') { this.user(m.text ?? '', m.note ?? ''); continue; }
        this.begin();
        for (const p of m.parts ?? []) {
          if (p.kind === 'text') this.delta(p.text ?? '');
          else this.tool(p);
        }
        this.close(m.error ?? '', m.meta ?? {});
      }
      if (s.usage) this.showUsage(s.usage);
      if (s.busy) { this.begin(); this.setBusy(true); }
    } catch (err) { this.loaded = false; this.onFail(err); }
  }

  async send(text: string, context = '', note = ''): Promise<void> {
    this.listen();
    try { await api.chatSend(text, context, note); } catch (err) { this.onFail(err); }
  }

  isBusy(): boolean { return this.busy; }

  private listen(): void {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    const socket = socketTo('/claude/chat/stream');
    this.socket = socket;
    socket.addEventListener('message', (msg) => {
      try { this.on(JSON.parse(String(msg.data)) as Event); } catch { return; }
    });
    socket.addEventListener('close', () => { if (this.socket === socket) this.socket = null; });
  }

  private on(e: Event): void {
    switch (e.type) {
      case 'start': this.user(String(e.text ?? ''), String(e.note ?? '')); this.begin(); break;
      case 'delta': this.delta(String(e.text ?? '')); break;
      case 'tool': this.tool({ kind: 'tool', id: String(e.id ?? ''), name: String(e.name ?? ''), input: String(e.input ?? ''), status: 'running' }); break;
      case 'toolDone': {
        const c = this.chips.get(String(e.id ?? ''));
        if (!c) break;
        this.status(c, String(e.status ?? 'done'));
        if (Array.isArray(e.images) && e.images.length) this.images(c, e.images as string[]);
        break;
      }
      case 'usage': this.showUsage({ ...this.usage, context: Number(e.context ?? 0), window: Number(e.window ?? 0) || this.usage.window, model: String(e.model ?? this.usage.model) }); break;
      case 'done': this.close(String(e.error ?? ''), (e.meta ?? {}) as Meta); if (e.usage) this.showUsage(e.usage as Usage); break;
      case 'reset': this.clear(); this.showUsage({ input: 0, output: 0, costUsd: 0, context: 0, window: 0, model: '' }); break;
      case 'adopted': this.clear(); this.loaded = false; void this.load(); break;
      default: break;
    }
  }

  private clear(): void {
    this.log.replaceChildren(this.empty);
    setHidden(this.empty, false);
    this.reply = null;
    this.md = null;
    this.chips.clear();
    this.setBusy(false);
  }

  private setBusy(on: boolean): void {
    this.busy = on;
    setHidden(this.stopBtn, !on);
    setText(q(this.root, '.ft-chat-status'), on ? 'Claude is working...' : '');
    this.onBusy(on);
  }

  private scroll(): void {
    const l = this.log;
    if (l.scrollHeight - l.scrollTop - l.clientHeight < 80) l.scrollTop = l.scrollHeight;
  }

  private user(text: string, note = ''): void {
    setHidden(this.empty, true);
    const n = el('<div class="ft-chat-msg is-user"><span class="ft-chat-said"></span></div>');
    setText(q(n, '.ft-chat-said'), text);
    if (note) { const m = el('<span class="ft-chat-note"></span>'); setText(m, note); n.appendChild(m); }
    this.log.appendChild(n);
    this.scroll();
  }

  private begin(): void {
    setHidden(this.empty, true);
    this.endText();
    this.reply = el('<div class="ft-chat-msg is-claude"></div>');
    this.log.appendChild(this.reply);
    this.setBusy(true);
    this.scroll();
  }

  private delta(text: string): void {
    if (!this.reply) this.begin();
    if (!this.md) { this.md = new MarkdownStream('ft-chat-text ft-md'); this.reply?.appendChild(this.md.root); }
    this.md.push(text);
    this.scroll();
  }

  private endText(): void {
    this.md?.end();
    this.md = null;
  }

  private images(after: HTMLElement, names: string[]): void {
    const row = el('<div class="ft-chat-images"></div>');
    for (const name of names.slice(0, 6)) {
      const img = el<HTMLImageElement>('<img alt="What Claude looked at" decoding="async" draggable="false">');
      img.src = api.chatImage(name);
      row.appendChild(img);
    }
    after.after(row);
    this.scroll();
  }

  private showUsage(u: Usage): void {
    this.usage = u;
    const parts: string[] = [];
    if (u.context) parts.push(`Memory ${tokens(u.context)}${u.window ? ` of ${tokens(u.window)}` : ''}`);
    if (u.input || u.output) parts.push(`Chat ${tokens(u.input + u.output)} tokens${u.costUsd ? ` · $${u.costUsd.toFixed(u.costUsd < 1 ? 3 : 2)}` : ''}`);
    setText(this.meter, parts.join(' · '));
    setClass(this.meter, 'is-high', !!u.window && u.context / u.window > 0.8);
  }

  private async handoff(): Promise<void> {
    try {
      const s = await api.chatState<State>();
      if (!s.session) { this.onFail(new Error('Start a conversation here first; then it can continue in Claude Code.')); return; }
      if (s.busy) { this.onFail(new Error('Wait for Claude to finish, or press Stop, before moving the conversation.')); return; }
      this.onHandoff(s.session);
    } catch (err) { this.onFail(err); }
  }

  private async adopt(): Promise<void> {
    try {
      const r = await api.chatSessions();
      if (!r.sessions.length) { this.onFail(new Error('There is no Claude Code conversation in formpth yet: open one with the Claude Code button first.')); return; }
      const when = (t: number) => new Date(t * 1000).toLocaleString(document.documentElement.lang || undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const choices = r.sessions.map((s): readonly [string, string] => [s.id, `${when(s.modified)} · ${s.title || 'untitled'}${s.current ? ' (this chat)' : ''}`]);
      const v = await askForm('Continue from Claude Code', [
        { kind: 'note', text: 'Brings a conversation from a Claude Code tab into this chat: its messages show here and your next message continues it.' },
        { kind: 'select', key: 'session', label: 'Conversation', value: choices[0][0], choices },
      ], { ok: 'Continue Here' });
      if (v) await api.chatAdopt(String(v.session));
    } catch (err) { this.onFail(err); }
  }

  private tool(p: Part): void {
    if (!this.reply) this.begin();
    this.endText();
    const chip = el(`<div class="ft-chat-tool"><span class="ft-chat-tool-mark">${icon('terminal', 11)}</span><span class="ft-chat-tool-name"></span><span class="ft-chat-tool-input"></span></div>`);
    setText(q(chip, '.ft-chat-tool-name'), p.name ?? '');
    setText(q(chip, '.ft-chat-tool-input'), p.input ?? '');
    chip.title = p.input ?? '';
    this.status(chip, p.status ?? 'running');
    if (p.id) this.chips.set(p.id, chip);
    this.reply?.appendChild(chip);
    if (p.images?.length) this.images(chip, p.images);
    this.scroll();
  }

  private status(chip: HTMLElement, s: string): void {
    for (const k of ['running', 'done', 'error']) setClass(chip, `is-${k}`, s === k);
  }

  private close(error: string, meta: Meta): void {
    if (!this.reply) this.begin();
    this.endText();
    for (const c of this.reply?.querySelectorAll<HTMLElement>('.ft-chat-tool.is-running') ?? []) this.status(c, 'done');
    if (error) {
      const n = el('<div class="ft-chat-error"></div>');
      setText(n, error);
      this.reply?.appendChild(n);
    }
    if (meta.seconds !== undefined) {
      const n = el('<div class="ft-chat-meta"></div>');
      setText(n, `${meta.seconds} s${meta.turns ? ` · ${meta.turns} steps` : ''}${meta.costUsd ? ` · $${meta.costUsd.toFixed(3)}` : ''}`);
      this.reply?.appendChild(n);
    }
    this.reply = null;
    this.setBusy(false);
    this.scroll();
  }
}

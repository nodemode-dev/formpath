import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { api, socketTo, type TerminalInfo } from '../io/api';
import { ChatPane } from './chat-pane';
import { el, isMac, q, setDisabled, setHidden, setText } from './dom';
import { icon } from './icons';

const KEY = 'formpath.terminal';
const MIN_H = 120;
const keys = isMac ? 'Opt+Shift+Cmd+' : 'Alt+Shift+Ctrl+';

interface Tab {
  id: string;
  term: Terminal;
  fit: FitAddon;
  host: HTMLElement;
  tab: HTMLElement;
  socket: WebSocket | null;
  kind: string;
}

function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function saved(): { open: boolean; h: number } {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as { open?: boolean; h?: number };
    return { open: s.open === true, h: typeof s.h === 'number' ? s.h : 280 };
  } catch { return { open: false, h: 280 }; }
}

function keep(open: boolean, h: number): void {
  try { localStorage.setItem(KEY, JSON.stringify({ open, h })); } catch { return; }
}

function isToggle(e: KeyboardEvent): boolean {
  return (isMac ? e.metaKey : e.ctrlKey) && e.altKey && e.shiftKey && e.code === 'KeyT';
}

export class TerminalDock {
  readonly root = el(`<section class="ft-dock" aria-label="Terminal">
<div class="ft-dock-grip" role="separator" aria-orientation="horizontal" aria-label="Resize the terminal"></div>
<div class="ft-dock-head">
<div class="ft-dock-tabs" role="tablist" aria-label="Terminals"></div>
<span class="ft-dock-spacer"></span>
<button type="button" class="cv-icon-btn ft-dock-new" title="New Terminal" aria-label="New Terminal">${icon('plus', 15)}</button>
<button type="button" class="cv-icon-btn ft-dock-chat" title="Chat with Claude about the document (${keys}H)" aria-label="Chat">${icon('agentChat', 15)}</button>
<button type="button" class="cv-icon-btn ft-dock-claude" title="Claude Code (${keys}C)" aria-label="Claude Code">${icon('agent', 15)}</button>
<button type="button" class="cv-icon-btn ft-dock-restart" title="Restart this tab" aria-label="Restart this tab">${icon('refresh', 15)}</button>
<button type="button" class="cv-icon-btn ft-dock-hide" title="Hide Terminal (${keys}T); programs keep running" aria-label="Hide Terminal">${icon('chevronDown', 15)}</button>
</div>
<div class="ft-dock-stage"><p class="ft-dock-empty cv-note" hidden>No terminal is open. Start a shell with the plus button, Claude Code with the agent button, or Chat with the speech bubble.</p></div>
<form class="ft-dock-ask" autocomplete="off">
<span class="ft-dock-ask-mark">${icon('agent', 15)}</span>
<input class="cv-input ft-dock-ask-input" type="text" spellcheck="false" placeholder="Ask Claude Code to work on the open document" aria-label="Ask Claude Code">
<button type="submit" class="cv-icon-btn" title="Send to Claude Code" aria-label="Send to Claude Code">${icon('send', 14)}</button>
</form>
</section>`);
  onChange: () => void = () => undefined;
  onFail: (err: unknown) => void = () => undefined;
  context: () => string = () => '';
  note: () => string = () => '';
  private readonly tabsEl = q(this.root, '.ft-dock-tabs');
  private readonly stage = q(this.root, '.ft-dock-stage');
  private readonly empty = q(this.root, '.ft-dock-empty');
  private readonly ask = q<HTMLInputElement>(this.root, '.ft-dock-ask-input');
  private readonly restartBtn = q<HTMLButtonElement>(this.root, '.ft-dock-restart');
  private readonly tabs = new Map<string, Tab>();
  private active: string | null = null;
  private started = false;
  private pending: Promise<void> | null = null;
  private chat: ChatPane | null = null;
  private chatTab: HTMLElement | null = null;

  constructor() {
    const html = document.documentElement;
    q(this.root, '.ft-dock-new').addEventListener('click', () => void this.open());
    q(this.root, '.ft-dock-claude').addEventListener('click', () => void this.claude());
    q(this.root, '.ft-dock-chat').addEventListener('click', () => void this.showChat());
    q(this.root, '.ft-dock-hide').addEventListener('click', () => this.toggle(false));
    this.restartBtn.addEventListener('click', () => void this.restart());
    q(this.root, '.ft-dock-ask').addEventListener('submit', (e) => { e.preventDefault(); void this.send(); });
    this.root.addEventListener('keydown', (e) => { if (!isToggle(e)) e.stopPropagation(); });
    document.addEventListener('keydown', (e) => {
      if (!isToggle(e) || e.repeat) return;
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    }, true);
    new ResizeObserver(() => this.fitActive()).observe(this.stage);
    document.addEventListener('nm:ui-settings-changed', () => { for (const t of this.tabs.values()) t.term.options.theme = this.theme(); });
    this.grip(q(this.root, '.ft-dock-grip'), html);
    if (this.isOpen()) void this.ensure();
  }

  isOpen(): boolean { return document.documentElement.getAttribute('data-ft-dock') === 'open'; }

  toggle(on = !this.isOpen()): void {
    if (on === this.isOpen()) { if (on) void this.ensure(); return; }
    document.documentElement.setAttribute('data-ft-dock', on ? 'open' : 'closed');
    keep(on, this.height());
    this.onChange();
    window.dispatchEvent(new Event('resize'));
    if (on) void this.ensure();
  }

  async newTerminal(): Promise<void> {
    if (!this.isOpen()) { this.toggle(true); await this.pending; return; }
    await this.open();
  }

  async claude(prompt?: string, resume?: string): Promise<void> {
    this.reveal();
    const size = this.size();
    try {
      const info = await api.claudeOpen({ prompt: prompt || undefined, cols: size.cols, rows: size.rows, resume: resume || undefined });
      if (this.tabs.has(info.id)) this.select(info.id);
      else this.mount(info, true);
    } catch (err) { this.onFail(err); }
  }

  async showChat(): Promise<void> {
    this.reveal();
    if (!this.chat) {
      const chat = new ChatPane();
      chat.onFail = (err) => this.onFail(err);
      chat.onHandoff = (session) => void this.claude(undefined, session);
      this.chat = chat;
      this.stage.appendChild(chat.root);
    }
    if (!this.chatTab) {
      const tab = el(`<button type="button" class="ft-dock-tab is-chat" role="tab" aria-selected="false">${icon('agentChat', 13)}<span class="ft-dock-tab-title">Chat</span><span class="ft-dock-tab-x" role="button" aria-label="Close the Chat tab">${icon('close', 11)}</span></button>`);
      tab.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.ft-dock-tab-x')) this.closeChat();
        else this.select('chat');
      });
      this.tabsEl.prepend(tab);
      this.chatTab = tab;
    }
    setHidden(this.empty, true);
    this.select('chat');
    await this.chat.load();
  }

  focus(): void {
    if (this.active === 'chat') this.ask.focus();
    else if (this.active) this.tabs.get(this.active)?.term.focus();
  }

  private reveal(): void {
    if (this.isOpen()) return;
    document.documentElement.setAttribute('data-ft-dock', 'open');
    keep(true, this.height());
    this.onChange();
    window.dispatchEvent(new Event('resize'));
  }

  private height(): number {
    const h = Number(document.documentElement.getAttribute('data-ft-dock-h'));
    return Number.isFinite(h) && h >= MIN_H ? h : saved().h;
  }

  private grip(grip: HTMLElement, html: HTMLElement): void {
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      const bottom = this.root.getBoundingClientRect().bottom;
      const move = (ev: PointerEvent): void => {
        const h = Math.round(Math.min(window.innerHeight * 0.7, Math.max(MIN_H, bottom - ev.clientY)));
        html.setAttribute('data-ft-dock-h', String(h));
        html.style.setProperty('--ft-dock-size', `${h}px`);
      };
      const up = (): void => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        grip.removeEventListener('pointercancel', up);
        keep(this.isOpen(), this.height());
        window.dispatchEvent(new Event('resize'));
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      grip.addEventListener('pointercancel', up);
    });
  }

  private async list(): Promise<TerminalInfo[]> {
    try { return await api.terminals(); } catch (err) { this.onFail(err); return []; }
  }

  private ensure(): Promise<void> {
    this.pending ??= this.boot().finally(() => { this.pending = null; });
    return this.pending;
  }

  private async boot(): Promise<void> {
    if (!this.started) {
      this.started = true;
      for (const t of await this.list()) if (!this.tabs.has(t.id)) this.mount(t, false);
    }
    if (!this.tabs.size && !this.chatTab) await this.open();
    else if (!this.active) this.select([...this.tabs.keys()][0] ?? 'chat');
    this.fitActive();
    this.focus();
  }

  private syncAsk(): void {
    this.ask.placeholder = this.active === 'chat' ? 'Ask Claude about the open document (Enter to send)' : 'Ask Claude Code to work on the open document';
  }

  private async send(): Promise<void> {
    const text = this.ask.value.trim();
    if (!text) return;
    if (this.active === 'chat' && this.chat?.isBusy()) return;
    const extra = this.context();
    this.ask.value = '';
    if (this.active === 'chat' && this.chat) await this.chat.send(text, extra, this.note());
    else await this.claude(extra ? `${text} (${extra})` : text);
  }

  private size(): { cols: number; rows: number } {
    const t = this.active ? this.tabs.get(this.active) : null;
    return t ? { cols: t.term.cols, rows: t.term.rows } : { cols: 100, rows: 20 };
  }

  private theme() {
    return {
      background: token('--bg-primary', '#111111'),
      foreground: token('--text-primary', '#f7f7f7'),
      cursor: token('--accent-color', '#f97316'),
      cursorAccent: token('--bg-primary', '#111111'),
      selectionBackground: token('--accent-color-dim', '#f9731633'),
    };
  }

  private async open(): Promise<void> {
    this.reveal();
    try { this.mount(await api.openTerminal(100, 20), true); } catch (err) { this.onFail(err); }
  }

  private mount(info: TerminalInfo, show: boolean): void {
    const kind = info.kind ?? 'shell';
    const term = new Terminal({
      fontFamily: token('--font-mono', 'monospace'), fontSize: 12, lineHeight: 1.2, cursorBlink: true,
      scrollback: 5000, theme: this.theme(), overviewRuler: { width: 0 },
    });
    term.attachCustomKeyEventHandler((e) => !isToggle(e));
    const fit = new FitAddon();
    term.loadAddon(fit);
    const host = el('<div class="ft-term" hidden></div>');
    const tab = el(`<button type="button" class="ft-dock-tab${kind === 'claude' ? ' is-claude' : ''}" role="tab" aria-selected="false">${icon(kind === 'claude' ? 'agent' : 'terminal', 13)}<span class="ft-dock-tab-title"></span><span class="ft-dock-tab-x" role="button" aria-label="Close this tab">${icon('close', 11)}</span></button>`);
    setText(q(tab, '.ft-dock-tab-title'), info.title);
    tab.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.ft-dock-tab-x')) void this.close(info.id);
      else this.select(info.id);
    });
    this.stage.appendChild(host);
    this.tabsEl.appendChild(tab);
    const t: Tab = { id: info.id, term, fit, host, tab, socket: null, kind };
    this.tabs.set(info.id, t);
    setHidden(this.empty, true);
    term.open(host);
    if (show || !this.active) this.select(info.id);
    this.connect(t);
  }

  private connect(t: Tab): void {
    const socket = socketTo(`/terminal/${encodeURIComponent(t.id)}/stream`);
    socket.binaryType = 'arraybuffer';
    t.socket = socket;
    socket.addEventListener('open', () => this.sendSize(t));
    socket.addEventListener('message', (msg) => {
      if (typeof msg.data === 'string') { t.term.write(msg.data); return; }
      try {
        const ctl = JSON.parse(new TextDecoder().decode(msg.data as ArrayBuffer)) as { type?: string };
        if (ctl.type === 'exit') t.term.write(`\r\n\x1b[2m[${t.kind === 'claude' ? 'Claude Code' : 'shell'} exited · Restart runs it again]\x1b[0m\r\n`);
      } catch { return; }
    });
    t.term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'input', data }));
    });
  }

  private sendSize(t: Tab): void {
    if (t.socket?.readyState === WebSocket.OPEN) t.socket.send(JSON.stringify({ type: 'resize', cols: t.term.cols, rows: t.term.rows }));
  }

  private fitActive(): void {
    const t = this.active ? this.tabs.get(this.active) : null;
    if (!t || t.host.hidden || this.stage.clientHeight < 20) return;
    const before = `${t.term.cols}x${t.term.rows}`;
    t.fit.fit();
    if (`${t.term.cols}x${t.term.rows}` !== before) this.sendSize(t);
  }

  private select(id: string): void {
    this.active = id;
    for (const [tid, t] of this.tabs) {
      const on = tid === id;
      setHidden(t.host, !on);
      t.tab.classList.toggle('is-on', on);
      t.tab.setAttribute('aria-selected', String(on));
    }
    if (this.chat) setHidden(this.chat.root, id !== 'chat');
    if (this.chatTab) { this.chatTab.classList.toggle('is-on', id === 'chat'); this.chatTab.setAttribute('aria-selected', String(id === 'chat')); }
    this.syncAsk();
    setDisabled(this.restartBtn, id === 'chat');
    this.fitActive();
    this.focus();
  }

  private closeChat(): void {
    this.chatTab?.remove();
    this.chatTab = null;
    if (this.chat) setHidden(this.chat.root, true);
    if (this.active === 'chat') {
      this.active = null;
      const next = [...this.tabs.keys()].pop();
      if (next) this.select(next);
      else setHidden(this.empty, false);
    }
    this.syncAsk();
  }

  private async restart(): Promise<void> {
    const t = this.active ? this.tabs.get(this.active) : null;
    if (!t) return;
    try {
      await api.restartTerminal(t.id);
      this.sendSize(t);
      t.term.focus();
    } catch (err) { this.onFail(err); }
  }

  private async close(id: string): Promise<void> {
    const t = this.tabs.get(id);
    if (!t) return;
    t.socket?.close();
    t.term.dispose();
    t.host.remove();
    t.tab.remove();
    this.tabs.delete(id);
    try { await api.closeTerminal(id); } catch { this.tabs.delete(id); }
    if (this.active === id) {
      this.active = null;
      const next = [...this.tabs.keys()].pop() ?? (this.chatTab ? 'chat' : undefined);
      if (next) this.select(next);
      else setDisabled(this.restartBtn, true);
    }
    setHidden(this.empty, this.tabs.size > 0 || !!this.chatTab);
  }
}

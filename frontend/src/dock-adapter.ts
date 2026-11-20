import type { ConsentChoice, ConsentRequest, DockAdapter, DockChannel, DockOwnChat, DockTerminal, StoredChoice, StoredChoiceState } from './dock/adapter';
import { jsonLegacy } from './dock/state';
import { t } from './i18n';
import { api, ApiError, socketTo, type BridgeItem, type TerminalInfo } from './io/api';
import { keyHeaders } from './io/window-key';
import { DockChat } from './ui/dock-chat';
import { isMac } from './ui/dom';
import { loadPrefs, savePrefs } from './ui/prefs';

export const DOCK_KEY = 'formpath.agentDock';
export const DOCK_LEGACY = ['formpath.terminal'];
export const BLOCKED_KEY = 'formpath.agentsBlocked';
export const DOCK_RIGHT_MIN = 1100;
const chord = isMac ? 'Opt+Shift+Cmd+' : 'Alt+Shift+Ctrl+';

type Reply = (result: Record<string, boolean>) => Promise<void>;
const open = new Map<string, { request: ConsentRequest; reply: Reply }>();
const early: ConsentRequest[] = [];
let add: ((request: ConsentRequest) => void) | null = null;
let withdraw: (id: string) => void = () => undefined;
const storedBlocked = (): boolean => { try { return localStorage.getItem(BLOCKED_KEY) === '1'; } catch { return false; } };
let isBlocked = storedBlocked();

export const outsideAgents = {
  blocked: (): boolean => isBlocked,
  choice: (): StoredChoice => (isBlocked ? 'blocked' : loadPrefs().agentsAllowed ? 'allowed' : 'ask'),
  arrive(item: BridgeItem, reply: Reply): void {
    if (isBlocked) { void reply({ allowed: false }).catch(() => undefined); return; }
    if (open.has(item.id)) return;
    const a = item.arguments;
    const offers = (Array.isArray(a.answers) ? a.answers : ['deny', 'always']).filter((x): x is ConsentChoice => x === 'deny' || x === 'once' || x === 'always');
    const request: ConsentRequest = {
      id: item.id, agent: typeof a.client === 'string' ? a.client : '', what: typeof a.what === 'string' && a.what ? a.what : 'draw in and edit your documents',
      offers, always: 'all', escape: 'deny', notes: ['Each change is one undoable step.'],
      ...(typeof a.expiresAt === 'number' ? { expires: a.expiresAt } : {}),
    };
    open.set(item.id, { request, reply });
    if (add) add(request); else early.push(request);
  },
  gone(id: string): void {
    const at = early.findIndex((r) => r.id === id);
    if (at >= 0) early.splice(at, 1);
    if (open.delete(id)) withdraw(id);
  },
  subscribe(onAdd: (request: ConsentRequest) => void, onWithdraw: (id: string) => void): void {
    add = onAdd;
    withdraw = onWithdraw;
    for (const r of early.splice(0)) onAdd(r);
  },
  async answer(id: string, choice: ConsentChoice): Promise<void> {
    const entry = open.get(id);
    if (!entry) return;
    open.delete(id);
    if (choice === 'always') await outsideAgents.set('allowed');
    await entry.reply(choice === 'deny' ? { allowed: false } : choice === 'once' ? { allowed: true, once: true } : { allowed: true });
  },
  get: (): Promise<StoredChoiceState> => Promise.resolve({ value: outsideAgents.choice(), changedOutside: false }),
  set(value: StoredChoice): Promise<void> {
    isBlocked = value === 'blocked';
    try { if (isBlocked) localStorage.setItem(BLOCKED_KEY, '1'); else localStorage.removeItem(BLOCKED_KEY); } catch { isBlocked = value === 'blocked'; }
    if (isBlocked) for (const [id, entry] of [...open]) { void entry.reply({ allowed: false }).catch(() => undefined); outsideAgents.gone(id); }
    const on = value === 'allowed';
    if (loadPrefs().agentsAllowed !== on) savePrefs({ ...loadPrefs(), agentsAllowed: on });
    window.dispatchEvent(new CustomEvent('formpath:agents', { detail: on }));
    return Promise.resolve();
  },
};

function socketChannel(socket: WebSocket): DockChannel {
  let data = (_chunk: string | Uint8Array): void => undefined;
  let exit = (): void => undefined;
  let closed = (): void => undefined;
  socket.binaryType = 'arraybuffer';
  socket.addEventListener('message', (msg) => {
    if (typeof msg.data === 'string') { data(msg.data); return; }
    try { if ((JSON.parse(new TextDecoder().decode(msg.data as ArrayBuffer)) as { type?: string }).type === 'exit') exit(); } catch { return; }
  });
  socket.addEventListener('close', () => closed());
  const send = (text: string): void => {
    if (socket.readyState === WebSocket.OPEN) socket.send(text);
    else if (socket.readyState === WebSocket.CONNECTING) socket.addEventListener('open', () => socket.send(text), { once: true });
  };
  return {
    send: (chunk) => send(JSON.stringify({ type: 'input', data: chunk })),
    resize: (cols, rows) => send(JSON.stringify({ type: 'resize', cols, rows })),
    onData: (handler) => { data = handler; },
    onExit: (handler) => { exit = handler; },
    onClose: (handler) => { closed = handler; },
    close: () => socket.close(),
  };
}

const record = (info: TerminalInfo): DockTerminal<'antigravity'> => ({ id: info.id, title: info.title, alive: info.alive, kind: info.kind, ...(info.cwd ? { tip: info.cwd } : {}) });

export interface DockDeps {
  context(): string;
  note(): string;
  fail(err: unknown): void;
  claude(prompt?: string, resume?: string): void;
  openSettings(): void;
  homeShown(): boolean;
}

export function formpathDock(deps: DockDeps): DockAdapter<'antigravity'> {
  return {
    words: {
      app: 'formpath', noun: 'document', example: 'make the title a warm gradient and add a soft drop shadow', start: './formpath boot',
      lead: "Ask Claude in the line below to draw, restyle, arrange or export the open document. It works through formpath's own tools, every change appears in the window as it happens, and each one can be undone.",
    },
    strings: {
      chatAbout: `Chat with Claude about the document (${chord}H)`,
    },
    placement: {
      mode: 'own',
      storage: { key: DOCK_KEY, legacy: jsonLegacy(DOCK_LEGACY, true) },
      sizes: { minHeight: 120, maxHeightShare: 0.7, defaultHeight: 280, minWidth: 320, maxWidthShare: 0.4, defaultWidth: 420 },
      canDockRight: () => window.innerWidth >= DOCK_RIGHT_MIN,
    },
    isDockChord: (e) => (isMac ? e.metaKey : e.ctrlKey) && e.altKey && e.shiftKey && e.code === 'KeyT',
    chordLabel: () => `${chord}T`,
    tabs: () => ({ builtin: ['chat', 'shell', 'claude', 'codex', 'cursor', 'antigravity'] }),
    classes: { iconButton: 'cv-icon-btn', button: 'cv-btn', primaryButton: 'cv-btn-primary', input: 'cv-input', select: 'cv-input', note: 'cv-note' },
    t: (_key, english) => t(english),
    onTheme: (handler) => { document.addEventListener('nm:ui-settings-changed', handler); },
    keyHeaders,
    errors: {
      message: (err) => (err instanceof ApiError ? err.message : null),
      kind: (err) => {
        if (err instanceof TypeError) return 'unreachable';
        if (!(err instanceof ApiError)) return null;
        if (err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504) return 'unreachable';
        if (err.status === 403) return 'refused';
        if ((err.status === 404 || err.status === 405) && /^(Not Found|Method Not Allowed)$/i.test(err.message)) return 'oldEngine';
        return err.status === 409 && /not installed|was not found\. Looked in|but does not start/i.test(err.message) ? 'notInstalled' : null;
      },
    },
    firstRun: () => !deps.homeShown(),
    terminal: {
      list: async () => (await api.terminals()).map(record),
      open: async (kind, o) => record(kind === 'shell' ? await api.openTerminal(o.cols, o.rows)
        : kind === 'claude' ? await api.claudeOpen({ prompt: o.prompt ? `${o.prompt} (${deps.context()})` : o.prompt, resume: o.resume, cols: o.cols, rows: o.rows })
          : await api.openAgent(kind, o.cols, o.rows)),
      restart: async (id) => { await api.restartTerminal(id); },
      close: (id) => api.closeTerminal(id),
      channel: async (id) => socketChannel(await socketTo(`/terminal/${encodeURIComponent(id)}/stream`)),
      scrollback: 5000,
    },
    agentStatus: async () => {
      const now = await api.agentPrograms();
      const agy = now?.antigravity;
      return now && agy && agy.finding !== 'runs' && typeof agy.said === 'string' ? { ...now, antigravity: { ...agy, note: agy.said } } : now;
    },
    chat: {
      pane: (host): DockOwnChat => {
        const chat = new DockChat({ context: deps.context, note: deps.note, claude: deps.claude });
        chat.onFail = deps.fail;
        host.appendChild(chat.root);
        return { send: (text) => chat.send(text), shown: () => chat.shown(), hidden: () => chat.hidden(), closed: () => chat.closed(), busy: () => chat.isBusy() };
      },
      ask: 'line',
    },
    consent: { subscribe: (onAdd, onWithdraw) => outsideAgents.subscribe(onAdd, onWithdraw), answer: (id, choice) => outsideAgents.answer(id, choice) },
    storedChoice: { get: () => outsideAgents.get(), set: (value) => outsideAgents.set(value) },
    openSettings: deps.openSettings,
  };
}

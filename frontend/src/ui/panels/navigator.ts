import { docArtBounds, renderDocument } from '../../engine/render';
import { emptyRect, isEmptyRect, unionRect } from '../../engine/geometry';
import { firstFill, firstStroke, describePaint } from '../../engine/paint';
import type { Engine, Pt } from '../../engine';
import type { Commands } from '../commands';
import { el, patchList, q, setClass, setText, setTitle } from '../dom';
import { icon } from '../icons';
import { askForm } from '../form-dialog';

const UNIT: Record<string, number> = { pt: 1, px: 1, mm: 72 / 25.4, cm: 72 / 2.54, in: 72, pc: 12 };

export class NavigatorPanel {
  readonly body = el('<div class="cv-kit-page cv-nav"><div class="cv-nav-card"><canvas class="cv-nav-preview"></canvas></div><div class="cv-nav-zoom"><input class="cv-slider" type="range" min="-5" max="9.3" step="0.01" aria-label="Zoom"><span class="cv-nav-pct"></span></div></div>');
  private readonly canvas: HTMLCanvasElement;
  private frame = 0;
  private map: { k: number; ox: number; oy: number } | null = null;

  constructor(private readonly engine: Engine) {
    this.canvas = q<HTMLCanvasElement>(this.body, 'canvas');
    const zoom = q<HTMLInputElement>(this.body, 'input');
    zoom.addEventListener('input', () => engine.zoomTo(2 ** Number(zoom.value)));
    const go = (e: PointerEvent): void => {
      const p = engine.current, m = this.map;
      if (!p || !m) return;
      const r = this.canvas.getBoundingClientRect(), x = (e.clientX - r.left - m.ox) / m.k, y = (e.clientY - r.top - m.oy) / m.k, v = p.viewport;
      v.panX = v.centerX - x * v.zoom; v.panY = v.height / 2 - y * v.zoom; v.fitted = false;
      engine.emit('viewport', null);
    };
    this.canvas.addEventListener('pointerdown', (e) => { this.canvas.setPointerCapture(e.pointerId); go(e); });
    this.canvas.addEventListener('pointermove', (e) => { if (this.canvas.hasPointerCapture(e.pointerId)) go(e); });
    for (const k of ['render', 'viewport', 'active', 'projects'] as const) engine.on(k, () => this.queue());
    new ResizeObserver(() => this.queue()).observe(this.canvas);
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.draw(); }); }

  private draw(): void {
    const p = this.engine.current, c = this.canvas, dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    const zoom = q<HTMLInputElement>(this.body, 'input');
    if (!p) { this.map = null; setText(q(this.body, '.cv-nav-pct'), ''); return; }
    if (document.activeElement !== zoom) zoom.value = String(Math.log2(p.viewport.zoom));
    setText(q(this.body, '.cv-nav-pct'), `${Math.round(p.viewport.zoom * 100)}%`);
    let b = p.doc.artboards.reduce((r, a) => unionRect(r, { x: a.x, y: a.y, w: a.w, h: a.h }), emptyRect());
    const art = docArtBounds(p.doc);
    if (!isEmptyRect(art)) b = unionRect(b, art);
    if (isEmptyRect(b)) return;
    const k = Math.min((w / dpr - 12) / b.w, (h / dpr - 12) / b.h), ox = (w / dpr - b.w * k) / 2 - b.x * k, oy = (h / dpr - b.h * k) / 2 - b.y * k;
    this.map = { k, ox, oy };
    g.setTransform(k * dpr, 0, 0, k * dpr, ox * dpr, oy * dpr);
    g.fillStyle = '#fff';
    for (const a of p.doc.artboards) g.fillRect(a.x, a.y, a.w, a.h);
    try { renderDocument(g, { doc: p.doc, scale: k, outline: false, assets: (key) => p.bitmaps.get(key) ?? null }); } catch { }
    const v = p.viewport, tl: Pt = v.toDoc(0, 0), br: Pt = v.toDoc(v.width, v.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent-color') || '#f97316';
    g.lineWidth = 1.5;
    g.strokeRect(tl.x * k + ox, tl.y * k + oy, (br.x - tl.x) * k, (br.y - tl.y) * k);
  }
}

export class InfoPanel {
  readonly body = el('<div class="cv-kit-page cv-info-body"></div>');
  private frame = 0;
  private at: Pt | null = null;
  private readonly rows = new Map<string, HTMLElement>();

  constructor(private readonly engine: Engine) {
    for (const k of ['X', 'Y', 'W', 'H', 'Fill', 'Stroke', 'Objects']) {
      const r = el('<div class="cv-info-row"><span class="cv-info-key"></span><span class="cv-info-val"></span></div>');
      setText(q(r, '.cv-info-key'), k);
      this.rows.set(k, q(r, '.cv-info-val'));
      this.body.appendChild(r);
    }
    for (const k of ['selection', 'doc', 'active'] as const) engine.on(k, () => this.queue());
    this.queue();
  }

  setPointer(p: Pt | null): void { this.at = p; this.queue(); }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const e = this.engine, p = e.current, b = e.selectionBounds(), u = UNIT[p?.doc.units ?? 'pt'] ?? 1, ab = p?.doc.artboards[p.activeArtboard] ?? { x: 0, y: 0 };
    const f = (v: number): string => `${Math.round(v * 100) / 100} ${p?.doc.units ?? 'pt'}`;
    setText(this.rows.get('X') as HTMLElement, b ? f((b.x - ab.x) / u) : this.at ? f((this.at.x - ab.x) / u) : '');
    setText(this.rows.get('Y') as HTMLElement, b ? f((b.y - ab.y) / u) : this.at ? f((this.at.y - ab.y) / u) : '');
    setText(this.rows.get('W') as HTMLElement, b ? f(b.w / u) : '');
    setText(this.rows.get('H') as HTMLElement, b ? f(b.h / u) : '');
    const n = e.selected()[0], fl = n ? firstFill(n.ap) : null, st = n ? firstStroke(n.ap) : null;
    setText(this.rows.get('Fill') as HTMLElement, fl ? describePaint(fl.paint, p?.doc) : n?.kind === 'text' ? describePaint(n.spans[0]?.style.fill ?? { type: 'none' }, p?.doc) : '');
    setText(this.rows.get('Stroke') as HTMLElement, st ? `${describePaint(st.paint, p?.doc)}, ${st.width} pt` : '');
    setText(this.rows.get('Objects') as HTMLElement, p ? String(e.selected().length) : '');
  }
}

export class HistoryPanel {
  readonly body = el('<div class="cv-kit-page cv-histp"><div class="cv-history-list" role="listbox" aria-label="History"></div></div>');
  private readonly rows: HTMLElement;
  private frame = 0;

  constructor(private readonly engine: Engine) {
    this.rows = q(this.body, '.cv-history-list');
    this.rows.addEventListener('click', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-history-row'); if (r) engine.jumpHistory(Number(r.dataset.index)); });
    for (const ev of ['history', 'projects', 'active'] as const) engine.on(ev, () => this.queue());
    this.sync();
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const { names, current } = this.engine.historySteps;
    const list = names.map((name, i) => ({ key: `${i}:${name}`, name, index: i }));
    patchList(this.rows, list, {
      key: (r) => r.key,
      create: (r) => { const row = el(`<div class="cv-history-row" role="option"><span class="cv-history-icon">${icon(r.index === 0 ? 'newFile' : 'history', 12)}</span><span class="cv-history-name"></span></div>`); this.fill(row, r, current); return row; },
      update: (row, r) => this.fill(row, r, current),
    });
    const at = this.rows.querySelector<HTMLElement>('.cv-history-row.is-current');
    if (at) { const top = at.offsetTop - this.rows.offsetTop, bottom = top + at.offsetHeight; if (top < this.rows.scrollTop) this.rows.scrollTop = top; else if (bottom > this.rows.scrollTop + this.rows.clientHeight) this.rows.scrollTop = bottom - this.rows.clientHeight; }
  }

  private fill(row: HTMLElement, r: { name: string; index: number }, current: number): void {
    row.dataset.index = String(r.index);
    setText(q(row, '.cv-history-name'), r.name);
    setClass(row, 'is-current', r.index === current);
    setClass(row, 'is-undone', r.index > current);
    row.setAttribute('aria-selected', String(r.index === current));
  }
}

export interface Action { id: string; name: string; steps: Array<{ id: string; label: string }> }
const ACTIONS_KEY = 'formpth.actions';

export class ActionsPanel {
  readonly body = el('<div class="cv-kit-page cv-actp"><div class="cv-actp-list" role="listbox" aria-label="Actions"></div></div>');
  private readonly list: HTMLElement;
  private actions: Action[] = [];
  private picked: string | null = null;
  private recording: string | null = null;
  private readonly recBtn: HTMLButtonElement;

  constructor(private readonly commands: Commands, private readonly notify: (t: string) => void) {
    try { const v = JSON.parse(localStorage.getItem(ACTIONS_KEY) ?? '[]'); if (Array.isArray(v)) this.actions = v.filter((a) => a && typeof a.id === 'string' && Array.isArray(a.steps)); } catch { }
    if (!this.actions.length) this.actions = [{ id: 'a-default', name: 'Outline and expand', steps: [{ id: 'outline-stroke', label: 'Outline Stroke' }, { id: 'expand-appearance', label: 'Expand Appearance' }] }];
    this.list = q(this.body, '.cv-actp-list');
    const foot = el('<div class="cv-panel-foot"></div>');
    const mk = (name: string, label: string, run: () => void): HTMLButtonElement => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', run); foot.appendChild(b); return b; };
    mk('close', 'Stop Recording', () => { this.recording = null; this.sync(); });
    this.recBtn = mk('success', 'Begin Recording into the chosen action', () => { if (!this.picked) return; this.recording = this.picked; this.sync(); this.notify('Recording: run commands from the menus and they are added to the action.'); });
    mk('play', 'Play the chosen action', () => this.play());
    mk('add', 'New Action', () => void (async () => { const v = await askForm('New Action', [{ kind: 'text', key: 'name', label: 'Name', value: `Action ${this.actions.length + 1}` }], { ok: 'Record' }); if (!v) return; const a: Action = { id: `a${Date.now().toString(36)}`, name: String(v.name) || 'Action', steps: [] }; this.actions.push(a); this.picked = a.id; this.recording = a.id; this.save(); this.sync(); })());
    mk('delete', 'Delete the chosen action', () => { this.actions = this.actions.filter((a) => a.id !== this.picked); this.picked = null; this.save(); this.sync(); });
    this.list.addEventListener('click', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-actp-row'); if (r?.dataset.action) { this.picked = r.dataset.action; this.sync(); } });
    this.list.addEventListener('dblclick', () => this.play());
    this.body.appendChild(foot);
    commands.onRun = (c) => {
      if (!this.recording || /^(undo|redo|zoom|fit|actual|panel-|toggle-|screen-|help|about|settings|shortcuts|play-action)/.test(c.id)) return;
      const a = this.actions.find((x) => x.id === this.recording);
      if (!a) return;
      a.steps.push({ id: c.id, label: commands.label(c).replace(/\.\.\.$/, '') });
      this.save(); this.sync();
    };
    this.sync();
  }

  play(id = this.picked): void {
    const a = this.actions.find((x) => x.id === id);
    if (!a) return;
    const was = this.recording;
    this.recording = null;
    let n = 0;
    for (const s of a.steps) if (this.commands.run(s.id)) n++;
    this.recording = was;
    this.notify(`Played ${a.name}: ${n} of ${a.steps.length} steps ran.`);
  }

  list_(): Action[] { return this.actions; }

  private save(): void { try { localStorage.setItem(ACTIONS_KEY, JSON.stringify(this.actions)); } catch { } }

  private sync(): void {
    const rows = this.actions.flatMap((a) => [{ key: a.id, label: a.name, step: false, a }, ...a.steps.map((s, i) => ({ key: `${a.id}:${i}`, label: s.label, step: true, a }))]);
    patchList(this.list, rows, {
      key: (r) => r.key,
      create: (r) => { const n = el('<div class="cv-actp-row" role="option"><span class="cv-actp-label"></span></div>'); this.fill(n, r); return n; },
      update: (n, r) => this.fill(n, r),
    });
    setClass(this.recBtn, 'is-active', !!this.recording);
  }

  private fill(n: HTMLElement, r: { key: string; label: string; step: boolean; a: Action }): void {
    n.dataset.action = r.a.id;
    setText(q(n, '.cv-actp-label'), r.label);
    setClass(n, 'is-step', r.step);
    setClass(n, 'is-picked', !r.step && r.a.id === this.picked);
    setClass(n, 'is-recording', !r.step && r.a.id === this.recording);
    setTitle(n, r.step ? '' : `${r.a.steps.length} steps · double-click to play`);
  }
}

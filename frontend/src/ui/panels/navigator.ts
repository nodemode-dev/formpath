import { docArtBounds, renderDocument } from '../../engine/render';
import { emptyRect, isEmptyRect, unionRect } from '../../engine/geometry';
import { firstFill, firstStroke, describePaint } from '../../engine/paint';
import type { Engine, Pt } from '../../engine';
import { el, patchList, q, setClass, setText } from '../dom';
import { icon } from '../icons';

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

  constructor(private readonly engine: Engine, options?: () => void) {
    this.rows = q(this.body, '.cv-history-list');
    this.rows.addEventListener('click', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-history-row'); if (r) engine.jumpHistory(Number(r.dataset.index)); });
    const foot = el('<div class="cv-panel-foot"></div>');
    const mk = (ic: string, label: string, run: () => void): void => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(ic, 16)}</button>`); b.addEventListener('click', run); foot.appendChild(b); };
    mk('newFile', 'New Document from the current state', () => { engine.newDocumentFromState(); });
    if (options) mk('settings', 'History Options (undo steps kept)', options);
    this.body.appendChild(foot);
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


import { geomBounds } from '../engine/bounds';
import { findNode, layerOf, topObjects } from '../engine/doc';
import { apply, flatIndex, hasIn, hasOut, tracePath, transformPath } from '../engine/geometry';
import { cachedPath, renderDocument, renderNode, type RenderContext } from '../engine/render';
import { collectTargets, snapPoint, snapRect, type SnapLine, type SnapTargets } from '../engine/snap';
import { layoutText } from '../engine/text';
import { threadChains } from '../engine/flow';
import { cssColor } from '../engine/paint';
import { UNIT_PT, type Doc, type Engine, type Mat, type PathData, type Pt, type Rect, type TextNode, type VNode } from '../engine';
import type { Project } from '../engine/project';
import { getTool, type SnapAt, type Tool, type ToolContext, type ToolPointer, type ViewInfo } from '../extensions/registry';
import { isMac, q, setHidden } from './dom';
import { paint, type StagePaint } from './palette';

const RULER = 18;

export interface TypeRequest { id?: string; x?: number; y?: number; box?: { w: number; h: number }; path?: string; caret?: number }
interface GuideDraft { vertical: boolean; pos: number; id: string | null }

export class Stage {
  readonly ctx: ToolContext;
  private readonly scene: HTMLCanvasElement;
  private readonly overlay: HTMLCanvasElement;
  private readonly rulerH: HTMLCanvasElement;
  private readonly rulerV: HTMLCanvasElement;
  private readonly sctx: CanvasRenderingContext2D;
  private readonly octx: CanvasRenderingContext2D;
  private readonly welcome: HTMLElement;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private rect: DOMRect | null = null;
  private frame = 0;
  private wantScene = false;
  private wantOverlay = false;
  private dragId: number | null = null;
  private panLast: Pt | null = null;
  private space = false;
  private cursor = '';
  private hover: ToolPointer | null = null;
  private checker: { key: string; pattern: CanvasPattern } | null = null;
  private targets: { doc: Doc; key: string; t: SnapTargets } | null = null;
  private draft: GuideDraft | null = null;
  private loading = new Set<string>();
  private typeHandler: ((r: TypeRequest) => void) | null = null;
  private lastTool: Tool | undefined;
  onPointerDoc: ((p: Pt | null) => void) | null = null;

  static prefs: { zoomWheel: boolean; gridColor: string; guideColor: string; snapTol: number; gridInBack: boolean; cell: number } = { zoomWheel: false, gridColor: '', guideColor: '', snapTol: 4, gridInBack: true, cell: 8 };

  constructor(private readonly host: HTMLElement, private readonly engine: Engine) {
    this.scene = q<HTMLCanvasElement>(host, '.cv-scene');
    this.overlay = q<HTMLCanvasElement>(host, '.cv-overlay-canvas');
    this.rulerH = q<HTMLCanvasElement>(host, '.cv-ruler-h');
    this.rulerV = q<HTMLCanvasElement>(host, '.cv-ruler-v');
    for (const [r, vertical] of [[this.rulerH, false], [this.rulerV, true]] as const) this.bindRuler(r, vertical);
    this.welcome = q(host, '.cv-welcome');
    const s = this.scene.getContext('2d');
    const o = this.overlay.getContext('2d');
    if (!s || !o) throw new Error('2D canvas is unavailable');
    this.sctx = s;
    this.octx = o;
    for (const c of [this.scene, this.overlay, this.rulerH, this.rulerV]) c.addEventListener('contextrestored', () => this.queue(true, true));
    this.ctx = {
      engine,
      view: () => this.viewInfo(),
      paint: () => paint(),
      antsPhase: () => 0,
      snap: (p, exclude, opts) => this.snap(p, exclude, opts),
      snapRect: (r, exclude) => this.snapBox(r, exclude),
      invalidateTargets: () => { this.targets = null; },
      redraw: () => this.queue(false, true),
      typeAt: (detail) => this.typeHandler?.(detail),
    };
    new ResizeObserver(() => this.resize()).observe(host);
    window.addEventListener('resize', () => this.resize());
    engine.on('render', () => this.queue(true, true));
    for (const k of ['viewport', 'active', 'projects'] as const) engine.on(k, () => { this.turn(); this.queue(true, true); });
    for (const k of ['overlay', 'options', 'selection'] as const) engine.on(k, () => this.queue(false, true));
    engine.on('doc', () => { this.targets = null; });
    engine.on('projects', () => { this.syncWelcome(); this.updateCursor(); });
    engine.on('tool', () => { this.switchTool(); this.queue(false, true); this.updateCursor(); });
    this.bindTouch();
    this.bindPointer();
    this.syncWelcome();
    this.resize();
  }

  onType(fn: (r: TypeRequest) => void): void { this.typeHandler = fn; }

  private tool(): Tool | undefined { return getTool(this.engine.tool); }

  private switchTool(): void {
    const next = this.tool();
    if (next === this.lastTool) return;
    if (this.dragId !== null) { this.lastTool?.cancel?.(this.ctx); this.dragId = null; }
    this.lastTool?.deactivate?.(this.ctx);
    this.lastTool = next;
    next?.activate?.(this.ctx);
    this.engine.clearOverlay();
  }

  private viewInfo(): ViewInfo {
    const v = this.engine.current?.viewport;
    const zoom = v?.zoom ?? 1, px = v?.panX ?? 0, py = v?.panY ?? 0;
    return {
      zoom, dpr: this.dpr, width: this.cssW, height: this.cssH,
      toScreen: (p) => ({ x: p.x * zoom + px, y: p.y * zoom + py }),
      toDoc: (p) => ({ x: (p.x - px) / zoom, y: (p.y - py) / zoom }),
    };
  }

  private snap(p: Pt, exclude: Set<string> = new Set(), opts: { from?: Pt } = {}): SnapAt {
    const pr = this.engine.current, v = this.engine.view;
    if (!pr || (!v.smartGuides && !v.snapGrid && !v.snapPoint)) { this.engine.clearOverlay(); return { p, lines: [], label: null }; }
    const base = this.engine.dragOrigin ?? pr.doc, key = [...exclude].sort().join(',');
    if (!this.targets || this.targets.doc !== base || this.targets.key !== key) this.targets = { doc: base, key, t: collectTargets(base, exclude) };
    const tol = Stage.prefs.snapTol / pr.viewport.zoom;
    const r = snapPoint(p, this.targets.t, { tol, smart: v.smartGuides, point: v.snapPoint, grid: { on: v.snapGrid, spacing: pr.doc.grid.spacing, sub: pr.doc.grid.subdivisions } });
    let out: SnapAt = { p: r.p, lines: r.lines, label: r.label };
    if (opts.from && v.smartGuides && r.hit !== 'spot') {
      const f = opts.from;
      let best: { q: Pt; d: number; deg: number } | null = null;
      for (const deg of [0, 45, 90, 135]) {
        const a = (deg * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
        const t = (p.x - f.x) * ux + (p.y - f.y) * uy, qx = f.x + ux * t, qy = f.y + uy * t, d = Math.hypot(p.x - qx, p.y - qy);
        if (d <= tol && (!best || d < best.d)) best = { q: { x: qx, y: qy }, d, deg };
      }
      if (best) out = { p: best.q, lines: [{ x1: f.x, y1: f.y, x2: best.q.x, y2: best.q.y }], label: `${best.deg}°` };
    }
    if (out.lines.length || out.label) this.engine.setOverlay({ lines: out.lines, label: out.label, at: out.p });
    else this.engine.clearOverlay();
    return out;
  }

  private snapBox(r: Rect, exclude: Set<string>): { dx: number; dy: number } {
    const pr = this.engine.current, v = this.engine.view;
    if (!pr || (!v.smartGuides && !v.snapGrid)) return { dx: 0, dy: 0 };
    const base = this.engine.dragOrigin ?? pr.doc, key = [...exclude].sort().join(',');
    if (!this.targets || this.targets.doc !== base || this.targets.key !== key) this.targets = { doc: base, key, t: collectTargets(base, exclude) };
    const s = snapRect(r, this.targets.t, { tol: Stage.prefs.snapTol / pr.viewport.zoom, smart: v.smartGuides, point: false, grid: { on: v.snapGrid, spacing: pr.doc.grid.spacing, sub: pr.doc.grid.subdivisions } });
    if (s.lines.length) this.engine.setOverlay({ lines: s.lines, label: null, at: null });
    return { dx: s.dx, dy: s.dy };
  }

  private resize(): void {
    const r = this.host.getBoundingClientRect();
    this.rect = r;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === this.cssW && h === this.cssH && dpr === this.dpr) return;
    this.cssW = w;
    this.cssH = h;
    if (dpr !== this.dpr) this.checker = null;
    this.dpr = dpr;
    for (const c of [this.scene, this.overlay]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    this.rulerH.width = Math.round(w * dpr); this.rulerH.height = Math.round(RULER * dpr);
    this.rulerV.width = Math.round(RULER * dpr); this.rulerV.height = Math.round(h * dpr);
    this.engine.setViewSize(w, h);
    this.renderScene();
    this.renderOverlay();
  }

  restyle(): void { this.checker = null; this.queue(true, true); }

  private queue(scene: boolean, overlay: boolean): void {
    this.wantScene ||= scene;
    this.wantOverlay ||= overlay;
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.wantScene) this.renderScene();
      if (this.wantOverlay) this.renderOverlay();
    });
  }

  private syncWelcome(): void { setHidden(this.welcome, this.engine.projects.length > 0); }

  private checkerPattern(pal: StagePaint): CanvasPattern | null {
    const key = `${this.dpr}|${pal.checkerA}|${pal.checkerB}|${Stage.prefs.cell}`;
    if (this.checker?.key === key) return this.checker.pattern;
    const cell = Math.max(1, Math.round(Stage.prefs.cell * this.dpr));
    const tile = document.createElement('canvas');
    tile.width = cell * 2; tile.height = cell * 2;
    const c = tile.getContext('2d') as CanvasRenderingContext2D;
    c.fillStyle = pal.checkerA;
    c.fillRect(0, 0, cell * 2, cell * 2);
    c.fillStyle = pal.checkerB;
    c.fillRect(cell, 0, cell, cell);
    c.fillRect(0, cell, cell, cell);
    const pattern = this.sctx.createPattern(tile, 'repeat');
    if (!pattern) return null;
    this.checker = { key, pattern };
    return pattern;
  }

  private asset(p: Project, key: string): CanvasImageSource | null {
    const b = p.bitmaps.get(key);
    if (b) return b;
    const blob = p.assets.get(key);
    if (blob && !this.loading.has(key) && typeof createImageBitmap === 'function') {
      this.loading.add(key);
      createImageBitmap(blob).then((bmp) => { p.bitmaps.set(key, bmp); this.queue(true, false); }).catch(() => undefined).finally(() => this.loading.delete(key));
    }
    return null;
  }

  renderContext(p: Project, scale: number): RenderContext {
    return { doc: p.doc, scale, outline: this.engine.view.outline, assets: (k) => this.asset(p, k), pixelRatio: this.dpr, outlineColor: paint().rulerText };
  }

  private renderScene(): void {
    this.wantScene = false;
    const g = this.sctx, W = this.scene.width, H = this.scene.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const p = this.engine.current;
    if (!p) { g.clearRect(0, 0, W, H); return; }
    const pal = paint(), v = p.viewport, d = this.dpr, z = v.zoom * d, vw = this.engine.view;
    g.fillStyle = pal.pasteboard;
    g.fillRect(0, 0, W, H);
    const view: Mat = [z, 0, 0, z, v.panX * d, v.panY * d];
    for (const a of p.doc.artboards) {
      const x = Math.round(a.x * z + view[4]), y = Math.round(a.y * z + view[5]), w = Math.round((a.x + a.w) * z + view[4]) - x, h = Math.round((a.y + a.h) * z + view[5]) - y;
      if (vw.transparencyGrid) { const pt = this.checkerPattern(pal); g.fillStyle = pt ?? pal.artboard; }
      else g.fillStyle = a.bg ? cssColor(a.bg) : pal.artboard;
      g.fillRect(x, y, w, h);
    }
    if (vw.grid && Stage.prefs.gridInBack) this.drawGrid(g, p, pal, view);
    g.save();
    g.setTransform(...view);
    try { renderDocument(g, this.renderContext(p, v.zoom)); }
    catch (err) { console.error(err); }
    g.restore();
    if (p.isolation) {
      const n = findNode(p.doc, p.isolation);
      g.fillStyle = pal.pasteboard;
      g.globalAlpha = 0.55;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
      if (n) { g.save(); g.setTransform(...view); renderNode(g, n, this.renderContext(p, v.zoom)); g.restore(); }
    }
    if (vw.grid && !Stage.prefs.gridInBack) this.drawGrid(g, p, pal, view);
    if (vw.artboards) {
      g.lineWidth = 1;
      p.doc.artboards.forEach((a, i) => {
        const x = Math.round(a.x * z + view[4]) - 0.5, y = Math.round(a.y * z + view[5]) - 0.5, x2 = Math.round((a.x + a.w) * z + view[4]) + 0.5, y2 = Math.round((a.y + a.h) * z + view[5]) + 0.5;
        g.strokeStyle = pal.artboardEdge;
        g.globalAlpha = i === p.activeArtboard ? 0.9 : 0.35;
        g.strokeRect(x, y, x2 - x, y2 - y);
      });
      g.globalAlpha = 1;
    }
  }

  private drawGrid(g: CanvasRenderingContext2D, p: Project, pal: StagePaint, view: Mat): void {
    const major = Math.max(1, p.doc.grid.spacing), sub = major / Math.max(1, p.doc.grid.subdivisions), z = view[0];
    const W = this.scene.width, H = this.scene.height;
    const x0 = -view[4] / z, y0 = -view[5] / z, x1 = (W - view[4]) / z, y1 = (H - view[5]) / z;
    g.save();
    g.lineWidth = 1;
    g.strokeStyle = Stage.prefs.gridColor || pal.grid;
    for (const [step, alpha] of [[sub, 0.3], [major, 0.75]] as const) {
      if (step * z < 5 * this.dpr) continue;
      g.globalAlpha = alpha;
      g.beginPath();
      for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { const sx = Math.round(x * z + view[4]) + 0.5; g.moveTo(sx, 0); g.lineTo(sx, H); }
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) { const sy = Math.round(y * z + view[5]) + 0.5; g.moveTo(0, sy); g.lineTo(W, sy); }
      g.stroke();
    }
    g.restore();
  }

  static unturn(x: number, y: number, w: number, h: number, deg: number): Pt {
    if (!deg) return { x, y };
    const a = (-deg * Math.PI) / 180, cx = w / 2, cy = h / 2, dx = x - cx, dy = y - cy;
    return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
  }

  private turn(): void {
    const deg = this.engine.current?.viewport.rotation ?? 0, t = deg ? `rotate(${deg}deg)` : '';
    for (const c of [this.scene, this.overlay]) if (c.style.transform !== t) c.style.transform = t;
    this.host.classList.toggle('is-turned', !!deg);
  }

  static rulerStep(zoom: number): number {
    for (let k = -2; k < 8; k++) for (const m of [1, 2, 5]) { const s = m * 10 ** k; if (s * zoom >= 60) return s; }
    return 1e8;
  }

  private renderRulers(): void {
    const show = this.engine.view.rulers && !!this.engine.current;
    setHidden(this.rulerH, !show);
    setHidden(this.rulerV, !show);
    if (!show) return;
    const p = this.engine.current as Project, v = p.viewport, pal = paint(), d = this.dpr;
    const u = UNIT_PT[p.doc.units] ?? 1, ab = p.doc.artboards[p.activeArtboard] ?? { x: 0, y: 0 };
    const sel = this.engine.selectionBounds(false);
    for (const [c, horiz] of [[this.rulerH, true], [this.rulerV, false]] as const) {
      const zk = v.zoom * u, step = Stage.rulerStep(zk), minor = step * zk >= 150 ? step / 10 : step / 5;
      const g = c.getContext('2d');
      if (!g) continue;
      const len = horiz ? this.cssW : this.cssH, pan = (horiz ? v.panX : v.panY) + (horiz ? ab.x : ab.y) * v.zoom;
      g.setTransform(d, 0, 0, d, 0, 0);
      g.fillStyle = pal.rulerBg;
      g.fillRect(0, 0, horiz ? len : RULER, horiz ? RULER : len);
      if (sel) {
        const a = (horiz ? sel.x : sel.y) * v.zoom + (horiz ? v.panX : v.panY), b = a + (horiz ? sel.w : sel.h) * v.zoom;
        g.fillStyle = pal.accent;
        g.globalAlpha = 0.22;
        if (horiz) g.fillRect(a, 0, b - a, RULER); else g.fillRect(0, a, RULER, b - a);
        g.globalAlpha = 1;
      }
      g.strokeStyle = pal.rulerLine;
      g.fillStyle = pal.rulerText;
      g.font = '9px Inter, system-ui, sans-serif';
      g.lineWidth = 1;
      g.beginPath();
      if (horiz) { g.moveTo(0, RULER - 0.5); g.lineTo(len, RULER - 0.5); } else { g.moveTo(RULER - 0.5, 0); g.lineTo(RULER - 0.5, len); }
      const first = Math.floor(-pan / zk / minor) * minor;
      for (let t = first; t * zk + pan <= len; t += minor) {
        const s = Math.round(t * zk + pan) + 0.5, isMajor = Math.abs(t / step - Math.round(t / step)) < 1e-6, tick = isMajor ? RULER : RULER / 3;
        if (horiz) { g.moveTo(s, RULER - tick); g.lineTo(s, RULER); } else { g.moveTo(RULER - tick, s); g.lineTo(RULER, s); }
        if (isMajor) {
          const label = String(Math.round(t * 100) / 100);
          if (horiz) g.fillText(label, s + 2, 9);
          else { g.save(); g.translate(9, s + 2); g.rotate(-Math.PI / 2); g.textAlign = 'right'; g.fillText(label, 0, 0); g.restore(); }
        }
      }
      g.stroke();
      const hp = this.hover?.doc;
      if (hp) {
        const s = Math.round((horiz ? hp.x : hp.y) * v.zoom + (horiz ? v.panX : v.panY)) + 0.5;
        g.strokeStyle = pal.accent;
        g.beginPath();
        if (horiz) { g.moveTo(s, 0); g.lineTo(s, RULER); } else { g.moveTo(0, s); g.lineTo(RULER, s); }
        g.stroke();
      }
    }
  }

  private renderOverlay(): void {
    this.wantOverlay = false;
    const g = this.octx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.overlay.width, this.overlay.height);
    this.renderRulers();
    const p = this.engine.current;
    if (!p) return;
    const pal = paint(), d = this.dpr;
    g.setTransform(d, 0, 0, d, 0, 0);
    this.drawGuides(g, p, pal);
    this.drawArtboardNames(g, p, pal);
    try { this.drawSelection(g, p, pal); this.drawTextPorts(g, p, pal); } catch (err) { console.error(err); }
    this.drawSmart(g, p, pal);
    try { this.tool()?.overlay?.(this.ctx, g); } catch (err) { console.error(err); }
  }

  private drawArtboardNames(g: CanvasRenderingContext2D, p: Project, pal: StagePaint): void {
    if (!this.engine.view.artboards || p.doc.artboards.length < 2 && this.engine.tool !== 'artboard') return;
    const v = p.viewport;
    g.save();
    g.font = '11px Inter, system-ui, sans-serif';
    g.textBaseline = 'bottom';
    p.doc.artboards.forEach((a, i) => {
      const s = v.toScreen(a.x, a.y);
      g.fillStyle = i === p.activeArtboard ? pal.rulerText : pal.rulerLine;
      g.fillText(`${i + 1} · ${a.name}`, s.x, s.y - 4);
    });
    g.restore();
  }

  private drawGuides(g: CanvasRenderingContext2D, p: Project, pal: StagePaint): void {
    const vw = this.engine.view, v = p.viewport, draft = this.draft;
    if (!vw.guides && !draft) return;
    g.save();
    g.lineWidth = 1;
    g.strokeStyle = Stage.prefs.guideColor || pal.guide;
    g.beginPath();
    const list = vw.guides ? p.doc.guides.filter((x) => !draft || x.id !== draft.id) : [];
    for (const x of [...list, ...(draft ? [draft] : [])]) {
      if (x.vertical) { const sx = Math.round(v.panX + x.pos * v.zoom) + 0.5; g.moveTo(sx, 0); g.lineTo(sx, this.cssH); }
      else { const sy = Math.round(v.panY + x.pos * v.zoom) + 0.5; g.moveTo(0, sy); g.lineTo(this.cssW, sy); }
    }
    g.stroke();
    g.restore();
  }

  private drawSmart(g: CanvasRenderingContext2D, p: Project, pal: StagePaint): void {
    const o = this.engine.overlay, v = p.viewport;
    if (!o.lines.length && !o.label) return;
    g.save();
    g.strokeStyle = pal.smart;
    g.lineWidth = 1;
    g.beginPath();
    for (const l of o.lines as SnapLine[]) {
      const a = v.toScreen(l.x1, l.y1), b = v.toScreen(l.x2, l.y2);
      g.moveTo(Math.round(a.x) + 0.5, Math.round(a.y) + 0.5); g.lineTo(Math.round(b.x) + 0.5, Math.round(b.y) + 0.5);
    }
    g.stroke();
    if (o.label && o.at) {
      const s = v.toScreen(o.at.x, o.at.y);
      g.font = '600 10px Inter, system-ui, sans-serif';
      const w = Math.ceil(g.measureText(o.label).width) + 10, x = Math.round(s.x) - w - 6, y = Math.round(s.y) - 21;
      g.fillStyle = pal.smart;
      g.beginPath();
      g.roundRect(x, y, w, 15, 7.5);
      g.fill();
      g.fillStyle = '#ffffff';
      g.textBaseline = 'middle';
      g.fillText(o.label, x + 5, y + 8);
    }
    g.restore();
  }

  private drawTextPorts(g: CanvasRenderingContext2D, p: Project, pal: StagePaint): void {
    if (!p.selection.size || !this.engine.view.edges) return;
    const doc = p.doc, v = p.viewport;
    const sel = topObjects(doc, p.selection).map((id) => findNode(doc, id)).filter((n): n is TextNode => n?.kind === 'text' && n.mode === 'area' && !!n.frame);
    if (!sel.length) return;
    const chains = threadChains(doc), shown = new Map<string, TextNode>();
    for (const t of sel) { const c = chains.find((ch) => ch.some((x) => x.id === t.id)); for (const x of c ?? [t]) shown.set(x.id, x); }
    const port = (n: TextNode, out: boolean): Pt => { const f = n.frame as Rect, q = apply(n.xf, out ? f.x + f.w : f.x, out ? f.y + f.h : f.y), s = v.toScreen(q.x, q.y); return { x: Math.round(s.x + (out ? -6 : 6)) + 0.5, y: Math.round(s.y + (out ? -6 : 6)) + 0.5 }; };
    const pointed = new Set([...shown.values()].map((n) => n.next).filter((x): x is string => !!x));
    g.save();
    g.lineWidth = 1;
    if (this.engine.view.threads) {
      for (const n of shown.values()) {
        const nx = n.next ? shown.get(n.next) : null;
        if (!nx) continue;
        const a = port(n, true), b = port(nx, false);
        g.strokeStyle = layerOf(doc, n.id)?.color || pal.layer;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
    }
    for (const n of shown.values()) {
      const color = layerOf(doc, n.id)?.color || pal.layer, over = !n.next && layoutText(n).overflow >= 0;
      for (const out of [false, true]) {
        const c = port(n, out);
        g.fillStyle = pal.handle; g.strokeStyle = out && over ? pal.danger : color;
        g.fillRect(c.x - 4, c.y - 4, 8, 8); g.strokeRect(c.x - 4, c.y - 4, 8, 8);
        g.beginPath();
        if (out && over) { g.moveTo(c.x - 2.5, c.y); g.lineTo(c.x + 2.5, c.y); g.moveTo(c.x, c.y - 2.5); g.lineTo(c.x, c.y + 2.5); g.stroke(); }
        else if (out ? !!n.next : pointed.has(n.id)) { g.fillStyle = color; g.moveTo(c.x - 2, c.y - 2.5); g.lineTo(c.x + 2.5, c.y); g.lineTo(c.x - 2, c.y + 2.5); g.closePath(); g.fill(); }
      }
    }
    g.restore();
  }

  private drawSelection(g: CanvasRenderingContext2D, p: Project, pal: StagePaint): void {
    if (!p.selection.size) return;
    const doc = p.doc, v = p.viewport, vw = this.engine.view;
    const ids = topObjects(doc, p.selection);
    if (vw.edges) {
      let anchorBudget = 6000;
      for (const id of ids) {
        const n = findNode(doc, id);
        if (!n) continue;
        const color = layerOf(doc, id)?.color || pal.layer;
        g.save();
        g.setTransform(v.zoom * this.dpr, 0, 0, v.zoom * this.dpr, v.panX * this.dpr, v.panY * this.dpr);
        g.lineWidth = 1 / v.zoom;
        g.strokeStyle = color;
        this.traceEdges(g, n);
        g.restore();
        anchorBudget = this.drawAnchors(g, p, n, color, pal, anchorBudget);
      }
    }
    const t = this.engine.tool;
    if (vw.boundingBox && (t === 'selection' || t === 'freeTransform' || t === 'scale') && !p.anchors.size) {
      const b = this.engine.selectionBounds(false);
      if (b) {
        const color = layerOf(doc, ids[ids.length - 1])?.color || pal.layer;
        drawBox(g, v.toScreen(b.x, b.y), v.toScreen(b.x + b.w, b.y + b.h), color, pal.handle);
      }
    }
  }

  private traceEdges(g: CanvasRenderingContext2D, n: VNode): void {
    switch (n.kind) {
      case 'path': g.stroke(cachedPath(n.d)); break;
      case 'compound': for (const c of n.children) g.stroke(cachedPath(c.d)); break;
      case 'group': case 'layer': case 'blend': case 'repeat': for (const c of n.children) if (!c.hidden) this.traceEdges(g, c); break;
      case 'envelope': g.strokeRect(n.frame.x, n.frame.y, n.frame.w, n.frame.h); break;
      case 'mesh': { const b = geomBounds(this.engine.doc as Doc, n); g.strokeRect(b.x, b.y, b.w, b.h); break; }
      case 'text': {
        if (n.mode === 'area' && n.framePath) g.stroke(cachedPath(transformPath(n.framePath, n.xf)));
        else if (n.mode === 'area' && n.frame) { const f = n.frame, c = [[f.x, f.y], [f.x + f.w, f.y], [f.x + f.w, f.y + f.h], [f.x, f.y + f.h]].map(([x, y]) => apply(n.xf, x, y)); g.beginPath(); c.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); g.closePath(); g.stroke(); }
        else if (n.mode === 'path' && n.path) g.stroke(cachedPath(n.path));
        const lay = layoutText(n), m = n.xf;
        g.beginPath();
        for (const l of lay.lines) {
          if (n.mode === 'path') continue;
          const a = apply(m, l.x, l.y), b = apply(m, l.x + Math.max(l.width, 1), l.y);
          g.moveTo(a.x, a.y); g.lineTo(b.x, b.y);
        }
        g.stroke();
        break;
      }
      case 'image': case 'symbol': {
        const r = n.kind === 'image' ? { x: 0, y: 0, w: n.w, h: n.h } : null;
        if (r) { g.save(); g.transform(...n.xf); g.lineWidth /= Math.max(1e-6, Math.hypot(n.xf[0], n.xf[1])); g.strokeRect(r.x, r.y, r.w, r.h); g.moveTo(0, 0); g.lineTo(r.w, r.h); g.moveTo(r.w, 0); g.lineTo(0, r.h); g.stroke(); g.restore(); }
        else { const b = geomBounds(this.engine.doc as Doc, n); g.strokeRect(b.x, b.y, b.w, b.h); }
        break;
      }
    }
  }

  private drawAnchors(g: CanvasRenderingContext2D, p: Project, n: VNode, color: string, pal: StagePaint, budget: number): number {
    const paths: Array<{ id: string; d: PathData }> = [];
    const collect = (x: VNode): void => {
      if (x.kind === 'path') paths.push({ id: x.id, d: x.d });
      else if (x.kind === 'compound') for (const c of x.children) paths.push({ id: c.id, d: c.d });
      else if (x.kind === 'group' || x.kind === 'blend') { for (const c of x.children) if (!c.hidden) collect(c); }
      else if (x.kind === 'text' && x.mode === 'path' && x.path) paths.push({ id: x.id, d: x.path });
    };
    collect(n);
    const v = p.viewport;
    g.save();
    g.lineWidth = 1;
    for (const { id, d } of paths) {
      const set = p.anchors.get(id) ?? p.anchors.get(n.id) ?? null, direct = !!set;
      for (let s = 0; s < d.length; s++) {
        const pts = d[s].pts;
        for (let i = 0; i < pts.length; i++) {
          if (budget-- <= 0) { g.restore(); return 0; }
          const a = pts[i], idx = flatIndex(d, s, i), on = !direct || set.has(idx) || set.has(-1);
          const sa = v.toScreen(a.x, a.y);
          if (direct && on) {
            g.strokeStyle = color;
            g.beginPath();
            if (hasIn(a)) { const h = v.toScreen(a.ix, a.iy); g.moveTo(sa.x, sa.y); g.lineTo(h.x, h.y); }
            if (hasOut(a)) { const h = v.toScreen(a.ox, a.oy); g.moveTo(sa.x, sa.y); g.lineTo(h.x, h.y); }
            g.stroke();
            g.fillStyle = color;
            for (const [hx, hy, has] of [[a.ix, a.iy, hasIn(a)], [a.ox, a.oy, hasOut(a)]] as const) {
              if (!has) continue;
              const h = v.toScreen(hx, hy);
              g.beginPath(); g.arc(h.x, h.y, 2.5, 0, Math.PI * 2); g.fill();
            }
          }
          const r = direct ? 3 : 2.5;
          g.fillStyle = on ? color : pal.handle;
          g.strokeStyle = color;
          g.fillRect(Math.round(sa.x - r), Math.round(sa.y - r), r * 2, r * 2);
          g.strokeRect(Math.round(sa.x - r) + 0.5, Math.round(sa.y - r) + 0.5, r * 2 - 1, r * 2 - 1);
        }
      }
    }
    g.restore();
    return budget;
  }

  private pointer(e: MouseEvent, clicks = 0): ToolPointer {
    const r = this.rect ?? this.host.getBoundingClientRect();
    const v = this.engine.current?.viewport;
    const screen = Stage.unturn(e.clientX - r.left, e.clientY - r.top, r.width, r.height, v?.rotation ?? 0);
    const pen = 'pointerType' in e && (e as PointerEvent).pointerType === 'pen';
    const doc = v ? v.toDoc(screen.x, screen.y) : screen;
    return { doc, raw: doc, screen, button: e.button, shift: e.shiftKey, alt: e.altKey, mod: isMac ? e.metaKey : e.ctrlKey, clicks, pressure: pen ? Math.min(1, Math.max(0, (e as PointerEvent).pressure)) : 1 };
  }

  private bindRuler(r: HTMLCanvasElement, vertical: boolean): void {
    let id: number | null = null;
    const at = (e: PointerEvent): { doc: Pt; inside: boolean } => {
      const b = this.rect ?? this.host.getBoundingClientRect(), sx = e.clientX - b.left, sy = e.clientY - b.top, v = this.engine.current?.viewport;
      const doc = v ? v.toDoc(sx, sy) : { x: sx, y: sy };
      return { doc, inside: sx >= 0 && sy >= 0 && sx <= b.width && sy <= b.height && (vertical ? sx > RULER : sy > RULER) };
    };
    r.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !this.engine.current || this.engine.view.guidesLocked) return;
      e.preventDefault();
      r.setPointerCapture(e.pointerId);
      id = e.pointerId;
      const p = at(e).doc;
      this.draft = { vertical, pos: vertical ? p.x : p.y, id: null };
      this.queue(false, true);
    });
    r.addEventListener('pointermove', (e) => {
      if (id !== e.pointerId || !this.draft) return;
      const p = this.snapGuide(at(e).doc);
      this.draft.pos = vertical ? p.x : p.y;
      this.queue(false, true);
    });
    const end = (e: PointerEvent, cancel: boolean): void => {
      if (id !== e.pointerId) return;
      id = null;
      const d = this.draft, where = at(e);
      this.draft = null;
      if (!cancel && d && where.inside) { if (!this.engine.view.guides) this.engine.setView({ guides: true }); this.engine.addGuide(vertical, d.pos); }
      else this.queue(false, true);
    };
    r.addEventListener('pointerup', (e) => end(e, false));
    r.addEventListener('pointercancel', (e) => end(e, true));
  }

  private snapGuide(p: Pt): Pt {
    const pr = this.engine.current;
    if (!pr || !this.engine.view.snapPoint) return p;
    return this.snap(p).p;
  }

  private guideAt(screen: Pt): string | null {
    const p = this.engine.current;
    if (!p || !this.engine.view.guides || this.engine.view.guidesLocked) return null;
    const v = p.viewport;
    for (let i = p.doc.guides.length - 1; i >= 0; i--) {
      const x = p.doc.guides[i];
      const s = x.vertical ? x.pos * v.zoom + v.panX : x.pos * v.zoom + v.panY;
      if (Math.abs((x.vertical ? screen.x : screen.y) - s) <= 3) return x.id;
    }
    return null;
  }

  docPoint(clientX: number, clientY: number): Pt | null {
    const r = this.rect ?? this.host.getBoundingClientRect();
    const v = this.engine.current?.viewport;
    if (!v || clientX < r.left || clientY < r.top || clientX > r.right || clientY > r.bottom) return null;
    return v.toDoc(clientX - r.left, clientY - r.top);
  }

  private setCursor(c: string): void {
    if (c === this.cursor) return;
    this.cursor = c;
    this.overlay.style.cursor = c;
  }

  private updateCursor(p: ToolPointer | null = this.hover): void {
    if (!this.engine.current) this.setCursor('default');
    else if (this.panLast) this.setCursor('grabbing');
    else if (this.space) this.setCursor('grab');
    else if (p && this.dragId === null && this.guideAt(p.screen) && (this.engine.tool === 'selection' || this.engine.tool === 'direct')) this.setCursor(this.engine.current.doc.guides.find((x) => x.id === this.guideAt(p.screen))?.vertical ? 'ew-resize' : 'ns-resize');
    else this.setCursor(this.tool()?.cursor?.(this.ctx, p) ?? 'default');
  }

  setSpace(on: boolean): void {
    if (this.space === on) return;
    this.space = on;
    this.updateCursor();
  }

  get busy(): boolean { return this.dragId !== null; }

  toolKeydown(e: KeyboardEvent): boolean { return this.tool()?.keydown?.(this.ctx, e) ?? false; }

  cancelTool(): void { this.tool()?.cancel?.(this.ctx); this.engine.clearOverlay(); }

  private bindTouch(): void {
    const o = this.overlay, touches = new Map<number, { x: number; y: number; x0: number; y0: number; t: number }>();
    let g: { d0: number; a0: number; mx: number; my: number; z0: number; r0: number; turning: boolean; t0: number; moved: boolean; fingers: number } | null = null;
    const box = (): DOMRect => this.rect ?? this.host.getBoundingClientRect();
    const local = (e: PointerEvent): Pt => { const r = box(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const pair = (): { d: number; ang: number; mx: number; my: number } => {
      const [a, b] = [...touches.values()];
      return { d: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    };
    const baseline = (): void => {
      if (!g || touches.size !== 2) return;
      const v = this.engine.current?.viewport, q2 = pair();
      Object.assign(g, { d0: q2.d, a0: q2.ang, mx: q2.mx, my: q2.my, z0: v?.zoom ?? 1, r0: v?.rotation ?? 0, turning: false });
    };
    o.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      const p = local(e);
      touches.set(e.pointerId, { ...p, x0: p.x, y0: p.y, t: performance.now() });
      if (touches.size < 2 && !g) return;
      e.stopImmediatePropagation(); e.preventDefault();
      if (!g) {
        if (this.dragId !== null) {
          const id = this.dragId;
          this.dragId = null; this.panLast = null; this.tool()?.cancel?.(this.ctx);
          if (o.hasPointerCapture(id)) o.releasePointerCapture(id);
        }
        const all = [...touches.values()];
        g = { d0: 1, a0: 0, mx: 0, my: 0, z0: 1, r0: 0, turning: false, t0: Math.min(...all.map((f) => f.t)), moved: all.some((f) => Math.hypot(f.x - f.x0, f.y - f.y0) > 10), fingers: touches.size };
        baseline();
      } else { g.fingers = Math.max(g.fingers, touches.size); baseline(); }
      o.setPointerCapture(e.pointerId);
    }, true);
    const step = (e: PointerEvent): void => {
      const t = touches.get(e.pointerId);
      if (!t || !g) return;
      const p = local(e);
      t.x = p.x; t.y = p.y;
      if (Math.hypot(t.x - t.x0, t.y - t.y0) > 10) g.moved = true;
      const v = this.engine.current?.viewport;
      if (touches.size !== 2 || !v) return;
      const q2 = pair(), r = box();
      const dx = q2.mx - g.mx, dy = q2.my - g.my, ra = (-v.rotation * Math.PI) / 180;
      g.mx = q2.mx; g.my = q2.my;
      this.engine.pan(dx * Math.cos(ra) - dy * Math.sin(ra), dx * Math.sin(ra) + dy * Math.cos(ra));
      this.engine.zoomTo(g.z0 * (q2.d / Math.max(1, g.d0)), Stage.unturn(q2.mx, q2.my, r.width, r.height, this.engine.current?.viewport.rotation ?? 0));
      const turn = ((q2.ang - g.a0) * 180) / Math.PI, wrapped = ((turn + 540) % 360) - 180;
      if (!g.turning && Math.abs(wrapped) > 10) g.turning = true;
      if (g.turning) this.engine.setViewRotation(g.r0 + wrapped);
    };
    o.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
      if (!g) { const t = touches.get(e.pointerId), p = local(e); if (t) { t.x = p.x; t.y = p.y; } return; }
      e.stopImmediatePropagation();
      step(e);
    }, true);
    const lift = (e: PointerEvent): void => {
      if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
      if (g && e.type === 'pointerup') step(e);
      touches.delete(e.pointerId);
      if (!g) return;
      e.stopImmediatePropagation();
      if (o.hasPointerCapture(e.pointerId)) o.releasePointerCapture(e.pointerId);
      if (touches.size === 0) {
        if (!g.moved && performance.now() - g.t0 < 350 && e.type === 'pointerup') { if (g.fingers === 2) this.engine.undo(); else if (g.fingers === 3) this.engine.redo(); }
        g = null;
      } else baseline();
    };
    o.addEventListener('pointerup', lift, true);
    o.addEventListener('pointercancel', lift, true);
  }

  private bindPointer(): void {
    const o = this.overlay;
    o.addEventListener('pointerdown', (e) => {
      if (this.dragId !== null || !this.engine.current) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body && !active.closest('.cv-text-editor')) active.blur();
      e.preventDefault();
      const p = this.pointer(e, e.detail);
      if (e.button === 1 || (e.button === 0 && this.space)) {
        o.setPointerCapture(e.pointerId);
        this.dragId = e.pointerId;
        this.panLast = p.screen;
        this.updateCursor(p);
        return;
      }
      if (e.button !== 0) return;
      o.setPointerCapture(e.pointerId);
      this.dragId = e.pointerId;
      const t = this.engine.tool;
      const gid = t === 'selection' || t === 'direct' ? this.guideAt(p.screen) : null;
      if (gid && !this.engine.hit(p.doc)) {
        const gd = this.engine.current.doc.guides.find((x) => x.id === gid);
        if (gd) { this.draft = { vertical: gd.vertical, pos: gd.pos, id: gid }; this.queue(false, true); return; }
      }
      try { this.tool()?.down?.(this.ctx, p); } catch (err) { console.error(err); this.engine.notice(String(err), 'error'); }
      this.updateCursor(p);
    });
    o.addEventListener('pointermove', (e) => {
      const p0 = this.pointer(e);
      this.onPointerDoc?.(this.engine.current ? p0.doc : null);
      if (this.dragId === e.pointerId) {
        if (this.panLast) {
          this.engine.pan(p0.screen.x - this.panLast.x, p0.screen.y - this.panLast.y);
          this.panLast = p0.screen;
          return;
        }
        if (this.draft && this.draft.id) { const q2 = this.snapGuide(p0.doc); this.draft.pos = this.draft.vertical ? q2.x : q2.y; this.queue(false, true); return; }
        const t = this.tool();
        if (!t?.move) return;
        const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
        try { for (const ev of events.length > 1 ? events : [e]) t.move(this.ctx, this.pointer(ev)); } catch (err) { console.error(err); }
        return;
      }
      if (this.dragId !== null) return;
      this.hover = p0;
      try { this.tool()?.hover?.(this.ctx, p0); } catch (err) { console.error(err); }
      this.updateCursor(p0);
      if (this.engine.view.rulers) this.queue(false, true);
    });
    const finish = (e: PointerEvent, cancel: boolean): void => {
      if (this.dragId !== e.pointerId) return;
      this.dragId = null;
      if (o.hasPointerCapture(e.pointerId)) o.releasePointerCapture(e.pointerId);
      const p = this.pointer(e);
      if (this.panLast) { this.panLast = null; this.updateCursor(p); return; }
      const gd = this.draft;
      if (gd && gd.id) {
        this.draft = null;
        this.engine.clearOverlay();
        const off = p.screen.x < 0 || p.screen.y < 0 || p.screen.x > this.cssW || p.screen.y > this.cssH;
        const onRuler = this.engine.view.rulers && (gd.vertical ? p.screen.x < RULER : p.screen.y < RULER);
        if (cancel) this.queue(false, true);
        else if (off || onRuler) this.engine.removeGuide(gd.id);
        else this.engine.moveGuide(gd.id, gd.pos);
        return;
      }
      const t = this.tool();
      try { if (cancel) t?.cancel?.(this.ctx); else t?.up?.(this.ctx, p); } catch (err) { console.error(err); this.engine.notice(String(err), 'error'); }
      this.engine.clearOverlay();
      this.updateCursor(p);
    };
    o.addEventListener('pointerup', (e) => finish(e, false));
    o.addEventListener('pointercancel', (e) => finish(e, true));
    o.addEventListener('lostpointercapture', (e) => finish(e, true));
    o.addEventListener('dblclick', (e) => {
      if (!this.engine.current) return;
      try { this.tool()?.dblclick?.(this.ctx, this.pointer(e, 2)); } catch (err) { console.error(err); }
    });
    o.addEventListener('pointerleave', () => {
      if (this.dragId !== null) return;
      this.hover = null;
      this.onPointerDoc?.(null);
      this.tool()?.hover?.(this.ctx, null);
      this.queue(false, true);
    });
    o.addEventListener('wheel', (e) => {
      e.preventDefault();
      const v = this.engine.current?.viewport;
      if (!v) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.cssH : 1;
      if ((e.ctrlKey || e.metaKey || e.altKey) !== Stage.prefs.zoomWheel) {
        this.engine.zoomTo(v.zoom * Math.exp(-e.deltaY * unit * 0.0025), this.pointer(e).screen);
        return;
      }
      const horizontal = e.shiftKey && !e.deltaX;
      const px = -(horizontal ? e.deltaY : e.deltaX) * unit, py = -(horizontal ? 0 : e.deltaY) * unit, ra = (-v.rotation * Math.PI) / 180;
      this.engine.pan(px * Math.cos(ra) - py * Math.sin(ra), px * Math.sin(ra) + py * Math.cos(ra));
    }, { passive: false });
    let pinch: { z0: number } | null = null;
    const gesture = (e: Event): { scale: number; clientX: number; clientY: number } => e as unknown as { scale: number; clientX: number; clientY: number };
    o.addEventListener('gesturestart', (e) => { e.preventDefault(); pinch = { z0: this.engine.current?.viewport.zoom ?? 1 }; });
    o.addEventListener('gesturechange', (e) => {
      e.preventDefault();
      const g = gesture(e);
      if (!pinch || !this.engine.current || !(g.scale > 0)) return;
      const r = o.getBoundingClientRect();
      this.engine.zoomTo(pinch.z0 * g.scale, { x: g.clientX - r.left, y: g.clientY - r.top });
    });
    o.addEventListener('gestureend', (e) => { e.preventDefault(); pinch = null; });
    o.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}

export function drawBox(g: CanvasRenderingContext2D, a: Pt, b: Pt, color: string, fill: string): void {
  const x0 = Math.round(Math.min(a.x, b.x)) + 0.5, y0 = Math.round(Math.min(a.y, b.y)) + 0.5, x1 = Math.round(Math.max(a.x, b.x)) + 0.5, y1 = Math.round(Math.max(a.y, b.y)) + 0.5;
  g.save();
  g.lineWidth = 1;
  g.strokeStyle = color;
  g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  g.fillStyle = fill;
  for (const [x, y] of boxHandles({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 })) { g.fillRect(x - 3, y - 3, 6, 6); g.strokeRect(x - 3, y - 3, 6, 6); }
  g.restore();
}

export function boxHandles(r: Rect): Array<[number, number]> {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, x1 = r.x + r.w, y1 = r.y + r.h;
  return [[r.x, r.y], [cx, r.y], [x1, r.y], [x1, cy], [x1, y1], [cx, y1], [r.x, y1], [r.x, cy]];
}

export function traceDoc(g: CanvasRenderingContext2D, d: PathData): void { tracePath(g, d); }

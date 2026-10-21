import { brushGeometry } from '../../engine/effects';
import { geomBounds } from '../../engine/bounds';
import { anchor, toPath2D } from '../../engine/geometry';
import { cssColor, parseColor, rgb, solid, stroke as makeStroke } from '../../engine/paint';
import type { BrushDef, Doc, Engine, PathData } from '../../engine';
import { newDoc } from '../../engine/doc';
import type { BrushLibrary } from '../../engine/brush-libraries';
import type { SymbolLibrary } from '../../engine/symbol-libraries';
import type { LibSwatch, SwatchLibrary } from '../../engine/swatch-libraries';
import { el, patchList, q, setClass, setDisabled, setStyleVar, setText, setTitle } from '../dom';
import { icon } from '../icons';
import { paintCss } from '../rail';
import { selectCtl } from './kit';
import { swatchPaint } from './color';

const USER_SW = 'formpath.userSwatchLibraries', USER_BR = 'formpath.userBrushLibraries';
const read = <T>(key: string): T[] => { try { const v: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(v) ? (v as T[]) : []; } catch { return []; } };
const write = (key: string, v: unknown): boolean => { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch { return false; } };

export const userSwatchLibraries = (): SwatchLibrary[] => read<SwatchLibrary>(USER_SW).filter((l) => l && typeof l.id === 'string' && Array.isArray(l.groups)).map((l) => ({ ...l, user: true }));
export const userBrushLibraries = (): BrushLibrary[] => read<BrushLibrary>(USER_BR).filter((l) => l && typeof l.id === 'string' && Array.isArray(l.brushes)).map((l) => ({ ...l, user: true }));
export function keepUserSwatchLibrary(lib: SwatchLibrary): boolean { return write(USER_SW, [...userSwatchLibraries().filter((l) => l.id !== lib.id), { ...lib, user: true }]); }
export function keepUserBrushLibrary(lib: BrushLibrary): boolean { return write(USER_BR, [...userBrushLibraries().filter((l) => l.id !== lib.id), { ...lib, user: true }]); }
const USER_SY = 'formpath.userSymbolLibraries';
export const userSymbolLibraries = (): SymbolLibrary[] => read<SymbolLibrary>(USER_SY).filter((l) => l && typeof l.id === 'string' && Array.isArray(l.symbols)).map((l) => ({ ...l, user: true }));
export function keepUserSymbolLibrary(lib: SymbolLibrary): boolean { return write(USER_SY, [...userSymbolLibraries().filter((l) => l.id !== lib.id), { ...lib, user: true }]); }

const swatchTitle = (s: LibSwatch): string => `${s.name}${s.spot ? ' · spot' : s.global ? ' · global process' : s.paint.type === 'color' ? ' · process' : s.paint.type === 'gradient' ? ' · gradient' : ' · pattern'}`;

function patternCss(s: LibSwatch): string {
  const p = s.pattern;
  if (!p) return 'transparent';
  const f = (p.art.kind === 'group' ? p.art.children : [p.art]).find((c) => c.ap.items.some((i) => i.kind === 'fill' && i.paint.type === 'color'));
  const it = f?.ap.items.find((i) => i.kind === 'fill');
  const col = it && it.paint.type === 'color' ? cssColor(it.paint.color) : '#000000';
  return `repeating-linear-gradient(45deg, ${col} 0 2px, #ffffff 2px 5px)`;
}

export class SwatchLibraryPanel {
  readonly body = el('<div class="cv-kit-page cv-libp"></div>');
  private readonly grid = el('<div class="cv-swatch-grid cv-swatchp-grid cv-libp-grid" role="listbox" aria-label="Library swatches"></div>');
  private readonly pick;
  private readonly note = el('<p class="cv-note cv-libp-note"></p>');
  private readonly addAll: HTMLButtonElement;
  private readonly closeBtn: HTMLButtonElement;
  private opened: SwatchLibrary[] = [];
  private cur: SwatchLibrary | null = null;

  constructor(private readonly engine: Engine, private readonly menu: (anchor: HTMLElement) => void) {
    this.pick = selectCtl('', [['', 'No library open']], (id) => { const l = this.opened.find((x) => x.id === id); if (l) { this.cur = l; this.sync(); } });
    const head = el('<div class="cv-kit-row cv-libp-head"></div>');
    head.appendChild(this.pick.el);
    const foot = el('<div class="cv-panel-foot"></div>');
    const mk = (name: string, label: string, run: (b: HTMLButtonElement) => void): HTMLButtonElement => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', () => run(b)); foot.appendChild(b); return b; };
    mk('library', 'Swatch Libraries menu', (b) => this.menu(b));
    this.addAll = mk('add', 'Add every swatch of this library to the Swatches panel', () => { if (this.cur) { const ids = this.engine.addLibrarySwatches(this.cur); this.engine.notice(`Added ${ids.length} swatches from ${this.cur.name}.`); } });
    this.closeBtn = mk('close', 'Close this library', () => this.closeCurrent());
    this.grid.addEventListener('click', (ev) => {
      const lib = this.cur;
      if (!lib) return;
      const h = (ev.target as HTMLElement).closest<HTMLElement>('.cv-sw-group');
      if (h) { const g = lib.groups[Number(h.dataset.g)]; if (g) { const ids = engine.addLibrarySwatches({ ...lib, groups: [g] }); engine.notice(`Added ${g.name || lib.name} (${ids.length} swatches) to the Swatches panel.`); } return; }
      const t = (ev.target as HTMLElement).closest<HTMLElement>('.cv-sw-tile');
      if (!t) return;
      const [gi, si] = (t.dataset.at ?? '').split(':').map(Number), g = lib.groups[gi], s = g?.swatches[si];
      if (!g || !s) return;
      if (!engine.doc) { engine.notice('Open a document to use library swatches.'); return; }
      const [id] = engine.addLibrarySwatches({ ...lib, groups: [{ ...g, swatches: [s] }] });
      const sw = engine.doc.swatches.find((x) => x.id === id);
      if (sw) engine.setActivePaint(swatchPaint(sw));
    });
    this.body.append(head, this.grid, this.note, foot);
    engine.on('projects', () => this.sync());
    this.sync();
  }

  show(lib: SwatchLibrary): void {
    this.opened = [...this.opened.filter((l) => l.id !== lib.id), lib];
    this.cur = lib;
    this.sync();
  }
  get current(): SwatchLibrary | null { return this.cur; }
  get openLibraries(): SwatchLibrary[] { return this.opened; }

  private closeCurrent(): void {
    if (!this.cur) return;
    const i = this.opened.findIndex((l) => l.id === this.cur?.id);
    this.opened = this.opened.filter((l) => l.id !== this.cur?.id);
    this.cur = this.opened[Math.max(0, i - 1)] ?? null;
    this.sync();
  }

  private sync(): void {
    const lib = this.cur;
    this.pick.setChoices(this.opened.length ? this.opened.map((l) => [l.id, `${l.user ? 'User Defined · ' : l.folder ? `${l.folder} · ` : ''}${l.name}`] as const) : [['', 'No library open']]);
    this.pick.set(lib?.id ?? '');
    setDisabled(this.addAll, !lib || !this.engine.doc);
    setDisabled(this.closeBtn, !lib);
    const count = lib ? lib.groups.reduce((n, g) => n + g.swatches.length, 0) : 0;
    setText(this.note, lib ? `${count} swatches. Click one to add it to the document’s swatches and paint with it; click a group to add the whole group.` : 'Open a library from Window > Swatch Libraries or the menu below. Libraries are read-only; their swatches join the document when you use them.');
    const rows: Array<{ k: string; gi: number; si: number; s?: LibSwatch; name?: string }> = [];
    if (lib) lib.groups.forEach((g, gi) => { if (g.name) rows.push({ k: `${lib.id}|g${gi}`, gi, si: -1, name: g.name }); g.swatches.forEach((s, si) => rows.push({ k: `${lib.id}|${gi}:${si}`, gi, si, s })); });
    patchList(this.grid, rows, {
      key: (r) => r.k,
      create: (r) => {
        if (!r.s) { const h = el(`<div class="cv-sw-group" role="option">${icon('folder', 14)}<span class="cv-sw-group-name"></span></div>`); h.dataset.g = String(r.gi); setText(q(h, '.cv-sw-group-name'), r.name ?? ''); setTitle(h, `${r.name} · click to add the group to the Swatches panel`); return h; }
        const b = el('<button class="cv-sw-tile" type="button" role="option"></button>');
        b.dataset.at = `${r.gi}:${r.si}`;
        setStyleVar(b, '--paint', r.s.paint.type === 'pattern' ? patternCss(r.s) : paintCss(r.s.paint));
        setTitle(b, swatchTitle(r.s));
        setClass(b, 'is-spot', !!r.s.spot);
        setClass(b, 'is-global', !!r.s.global && !r.s.spot);
        return b;
      },
      update: () => undefined,
    });
  }
}

export class BrushLibraryPanel {
  readonly body = el('<div class="cv-kit-page cv-libp cv-brushlibp"></div>');
  private readonly list = el('<div class="cv-brushp-list" role="listbox" aria-label="Library brushes"></div>');
  private readonly pick;
  private readonly note = el('<p class="cv-note cv-libp-note"></p>');
  private readonly addAll: HTMLButtonElement;
  private readonly closeBtn: HTMLButtonElement;
  private opened: BrushLibrary[] = [];
  private cur: BrushLibrary | null = null;
  private stub: Doc | null = null;

  constructor(private readonly engine: Engine, private readonly menu: (anchor: HTMLElement) => void) {
    this.pick = selectCtl('', [['', 'No library open']], (id) => { const l = this.opened.find((x) => x.id === id); if (l) { this.cur = l; this.sync(); } });
    const head = el('<div class="cv-kit-row cv-libp-head"></div>');
    head.appendChild(this.pick.el);
    const foot = el('<div class="cv-panel-foot"></div>');
    const mk = (name: string, label: string, run: (b: HTMLButtonElement) => void): HTMLButtonElement => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', () => run(b)); foot.appendChild(b); return b; };
    mk('library', 'Brush Libraries menu', (b) => this.menu(b));
    this.addAll = mk('add', 'Add every brush of this library to the Brushes panel', () => { if (this.cur) { const ids = this.engine.addLibraryBrushes(this.cur.brushes.map((b, i) => ({ ...b, id: `l${i}` }))); this.engine.notice(`Added ${ids.length} brushes from ${this.cur.name}.`); } });
    this.closeBtn = mk('close', 'Close this library', () => { const i = this.opened.findIndex((l) => l.id === this.cur?.id); this.opened = this.opened.filter((l) => l.id !== this.cur?.id); this.cur = this.opened[Math.max(0, i - 1)] ?? null; this.sync(); });
    this.list.addEventListener('click', (ev) => {
      const r = (ev.target as HTMLElement).closest<HTMLElement>('.cv-brushp-row'), lib = this.cur;
      const b = lib && r ? lib.brushes[Number(r.dataset.i)] : null;
      if (!b) return;
      if (!engine.doc) { engine.notice('Open a document to use library brushes.'); return; }
      const [id] = engine.addLibraryBrushes([{ ...b, id: 'l' }]);
      if (!id) return;
      engine.currentBrush = id;
      if (engine.hasSelection) engine.applyBrush(id); else engine.emit('options', null);
    });
    this.body.append(head, this.list, this.note, foot);
    engine.on('projects', () => this.sync());
    this.sync();
  }

  show(lib: BrushLibrary): void { this.opened = [...this.opened.filter((l) => l.id !== lib.id), lib]; this.cur = lib; this.sync(); }
  get current(): BrushLibrary | null { return this.cur; }

  private sync(): void {
    const lib = this.cur;
    this.pick.setChoices(this.opened.length ? this.opened.map((l) => [l.id, `${l.user ? 'User Defined · ' : ''}${l.name}`] as const) : [['', 'No library open']]);
    this.pick.set(lib?.id ?? '');
    setDisabled(this.addAll, !lib || !this.engine.doc);
    setDisabled(this.closeBtn, !lib);
    setText(this.note, lib ? `${lib.brushes.length} brushes. Click one to add it to the Brushes panel and apply it to the selection.` : 'Open a library from Window > Brush Libraries or the menu below.');
    const rows = lib ? lib.brushes.map((b, i) => ({ k: `${lib.id}|${i}`, i, b })) : [];
    patchList(this.list, rows, {
      key: (r) => r.k,
      create: (r) => {
        const n = el('<button class="cv-brushp-row" type="button" role="option"><canvas class="cv-brushp-preview" width="120" height="24"></canvas><span class="cv-brushp-name"></span><span class="cv-brushp-kind"></span></button>');
        n.dataset.i = String(r.i);
        setText(q(n, '.cv-brushp-name'), r.b.name);
        setText(q(n, '.cv-brushp-kind'), r.b.brush.type);
        setTitle(n, `${r.b.name} (${r.b.brush.type} brush)`);
        this.preview(q<HTMLCanvasElement>(n, 'canvas'), { ...r.b, id: 'preview' });
        return n;
      },
      update: () => undefined,
    });
  }

  private preview(c: HTMLCanvasElement, b: BrushDef): void {
    const g = c.getContext('2d'), doc = this.engine.doc ?? (this.stub ??= newDoc(10, 10));
    if (!g) return;
    const ink = (getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') || '#cccccc').trim(), col = parseColor(ink) ?? rgb(204, 204, 204);
    const d: PathData = [{ closed: false, pts: [anchor(8, 14, 8, 14, 40, 0), anchor(112, 10, 80, 24, 112, 10)] }];
    const art = b.brush.type === 'calligraphic' || b.brush.type === 'bristle' ? null : geomBounds(doc, b.brush.art);
    const h = art && Number.isFinite(art.h) && art.h > 0 ? art.h : 10;
    const width = b.brush.type === 'calligraphic' ? 1 : b.brush.type === 'bristle' ? Math.min(1, 14 / Math.max(1, b.brush.size)) : Math.min(2, 8 / h);
    for (const piece of brushGeometry({ ...doc, brushes: [b] }, d, { ...makeStroke(solid(col), width), brush: b.id }) ?? []) {
      const p = piece.paint ?? solid(col);
      g.fillStyle = p.type === 'color' ? cssColor(p.color) : ink;
      g.globalAlpha = piece.opacity ?? 1;
      g.fill(toPath2D(piece.d), 'nonzero');
    }
    g.globalAlpha = 1;
  }
}

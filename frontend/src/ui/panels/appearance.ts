import { nodeLabel } from '../../engine/doc';
import { effectDef } from '../../engine/effects';
import { basicAppearance, emptyAppearance, fill, NONE, solid, stroke, BLACK, WHITE } from '../../engine/paint';
import { renderNode } from '../../engine/render';
import type { Appearance, Color, Effect, Engine, GraphicStyle, Paint, VNode } from '../../engine';
import { STYLE_LIBRARIES } from '../../engine/style-libraries';
import { el, patchList, q, setClass, setDisabled, setHidden, setStyleVar, setText, setTitle } from '../dom';
import { icon } from '../icons';
import { askForm } from '../form-dialog';
import { paintCss } from '../rail';
import { selectCtl } from './kit';
import { effectDialog, type EffectSlot } from './preview-edit';

type RowKind = 'stroke' | 'fill' | 'effect' | 'item-effect' | 'contents' | 'opacity';
type Row = { key: string; kind: RowKind; index: number; item: number; label: string; paint?: Paint; visible: boolean };

const fxLabel = (e: Effect): string => effectDef(e.id)?.label ?? e.id;
const moveIn = <T>(list: T[], i: number, j: number): T[] | null => { if (j < 0 || j >= list.length) return null; const out = list.slice(); [out[i], out[j]] = [out[j], out[i]]; return out; };

export class AppearancePanel {
  readonly body = el('<div class="cv-kit-page cv-appp"></div>');
  private readonly head = el('<div class="cv-appp-head"><span class="cv-appp-kind"></span><span class="cv-appp-name"></span></div>');
  private readonly list = el('<div class="cv-appp-list" role="listbox" aria-label="Appearance"></div>');
  private picked: string | null = null;
  private pickedFor: string | null = null;
  private frame = 0;

  constructor(private readonly engine: Engine, private readonly pickColor: (c: Color) => Promise<Color | null>, private readonly effectsMenu: (anchor: HTMLElement) => void) {
    const foot = el('<div class="cv-panel-foot cv-appp-foot"></div>');
    const mk = (name: string, label: string, run: (b: HTMLButtonElement) => void): HTMLButtonElement => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', () => run(b)); foot.appendChild(b); return b; };
    mk('pStroke', 'Add New Stroke', () => this.edit('Add New Stroke', (ap) => ({ ...ap, items: [...ap.items, stroke(engine.strokePaint.type === 'none' ? solid(BLACK) : engine.strokePaint, 1)] })));
    mk('fill', 'Add New Fill', () => this.edit('Add New Fill', (ap) => ({ ...ap, items: [...ap.items, fill(engine.fillPaint.type === 'none' ? solid(WHITE) : engine.fillPaint)] })));
    mk('effects', 'Add New Effect to the selected fill or stroke, or to the object', (b) => this.effectsMenu(b));
    mk('close', 'Clear Appearance', () => this.edit('Clear Appearance', () => emptyAppearance()));
    mk('refresh', 'Reduce to Basic Appearance', () => this.edit('Reduce to Basic Appearance', (ap) => { const f = ap.items.find((i) => i.kind === 'fill'), s = ap.items.find((i) => i.kind === 'stroke'); return basicAppearance(f?.paint ?? NONE, s?.paint ?? NONE, s && s.kind === 'stroke' ? s.width : 1); }));
    mk('duplicate', 'Duplicate Selected Item', () => this.onPicked('Duplicate Item', (r, ap) => this.duplicate(r, ap)));
    mk('delete', 'Delete Selected Item', () => this.onPicked('Delete Item', (r, ap) => this.remove(r, ap)));
    mk('chevronUp', 'Move Item Up', () => this.onPicked('Move Item', (r, ap) => this.shift(r, ap, 1)));
    mk('chevronDown', 'Move Item Down', () => this.onPicked('Move Item', (r, ap) => this.shift(r, ap, -1)));
    this.list.addEventListener('click', (e) => {
      const t = e.target as HTMLElement, rowEl = t.closest<HTMLElement>('.cv-appp-row');
      if (!rowEl) return;
      const r = this.rows().find((x) => x.key === rowEl.dataset.key), n = this.target();
      if (!r || !n) return;
      if (t.closest('.cv-appp-eye')) { this.toggle(r); return; }
      if (t.closest('.cv-appp-chip') && r.paint) { void this.recolor(r); return; }
      if (t.closest('.cv-appp-label') && (r.kind === 'effect' || r.kind === 'item-effect')) {
        const list = r.kind === 'effect' ? n.ap.effects : n.ap.items[r.item]?.effects, id = list?.[r.index]?.id;
        this.pick(r.key, n);
        if (id) void effectDialog(engine, id, { node: n.id, index: r.index, ...(r.kind === 'item-effect' ? { item: r.item } : {}) });
        return;
      }
      if (t.closest('.cv-appp-label') && r.kind === 'stroke' && r.key === this.picked) { void this.weight(r); return; }
      if (r.kind === 'contents' || r.kind === 'opacity') return;
      this.pick(r.key, n);
      this.sync();
    });
    this.body.append(this.head, this.list, foot);
    for (const k of ['selection', 'doc', 'active'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  effectSlot(): EffectSlot | undefined {
    const n = this.target();
    if (!n) return undefined;
    const r = this.rows().find((x) => x.key === this.picked), layer = n.kind === 'layer';
    if (r && (r.kind === 'fill' || r.kind === 'stroke' || r.kind === 'item-effect') && (layer || this.engine.selected().length <= 1)) return { node: n.id, index: -1, item: r.item };
    return layer ? { node: n.id, index: -1 } : undefined;
  }

  private pick(key: string, n: VNode): void { this.picked = key; this.pickedFor = n.id; }

  private duplicate(r: Row, ap: Appearance): Appearance {
    if (r.kind === 'effect') return { ...ap, effects: [...ap.effects.slice(0, r.index + 1), { ...ap.effects[r.index] }, ...ap.effects.slice(r.index + 1)] };
    if (r.kind === 'item-effect') return { ...ap, items: ap.items.map((it, i) => (i === r.item ? { ...it, effects: [...it.effects.slice(0, r.index + 1), { ...it.effects[r.index] }, ...it.effects.slice(r.index + 1)] } : it)) };
    this.picked = `i${r.index + 1}`;
    return { ...ap, items: [...ap.items.slice(0, r.index + 1), { ...ap.items[r.index] }, ...ap.items.slice(r.index + 1)] };
  }

  private remove(r: Row, ap: Appearance): Appearance {
    if (r.kind === 'effect') return { ...ap, effects: ap.effects.filter((_, i) => i !== r.index) };
    if (r.kind === 'item-effect') { this.picked = `i${r.item}`; return { ...ap, items: ap.items.map((it, i) => (i === r.item ? { ...it, effects: it.effects.filter((_, k) => k !== r.index) } : it)) }; }
    this.picked = null;
    return { ...ap, items: ap.items.filter((_, i) => i !== r.index) };
  }

  private shift(r: Row, ap: Appearance, dir: 1 | -1): Appearance {
    if (r.kind === 'effect') { const fx = moveIn(ap.effects, r.index, r.index - dir); if (!fx) return ap; this.picked = `e${r.index - dir}`; return { ...ap, effects: fx }; }
    if (r.kind === 'item-effect') {
      const it = ap.items[r.item], fx = it ? moveIn(it.effects, r.index, r.index - dir) : null;
      if (!fx) return ap;
      this.picked = `i${r.item}e${r.index - dir}`;
      return { ...ap, items: ap.items.map((x, i) => (i === r.item ? { ...x, effects: fx } : x)) };
    }
    const items = moveIn(ap.items, r.index, r.index + dir);
    if (!items) return ap;
    this.picked = `i${r.index + dir}`;
    return { ...ap, items };
  }

  private target(): VNode | null { return this.engine.appearanceTarget(); }

  private ids(): string[] | undefined { const n = this.target(); return n?.kind === 'layer' ? [n.id] : undefined; }

  private edit(name: string, fn: (ap: Appearance) => Appearance): void { if (this.target()) this.engine.editAppearance(name, fn, this.ids()); }

  private onPicked(name: string, fn: (r: Row, ap: Appearance) => Appearance): void {
    const r = this.rows().find((x) => x.key === this.picked);
    if (r && r.kind !== 'opacity' && r.kind !== 'contents') this.edit(name, (ap) => fn(r, ap));
  }

  private toggle(r: Row): void {
    if (r.kind === 'opacity' || r.kind === 'contents') return;
    this.edit('Appearance Visibility', (ap) => {
      if (r.kind === 'effect') return { ...ap, effects: ap.effects.map((e, i) => (i === r.index ? { ...e, visible: !e.visible } : e)) };
      if (r.kind === 'item-effect') return { ...ap, items: ap.items.map((it, i) => (i === r.item ? { ...it, effects: it.effects.map((e, k) => (k === r.index ? { ...e, visible: !e.visible } : e)) } : it)) };
      return { ...ap, items: ap.items.map((it, i) => (i === r.index ? { ...it, visible: !it.visible } : it)) };
    });
  }

  private async recolor(r: Row): Promise<void> {
    const p = r.paint;
    const c = await this.pickColor(p?.type === 'color' ? p.color : BLACK);
    if (c) this.edit('Appearance Color', (ap) => ({ ...ap, items: ap.items.map((it, i) => (i === r.index ? { ...it, paint: solid(c) } : it)) }));
  }

  private async weight(r: Row): Promise<void> {
    const n = this.target(), it = n?.ap.items[r.index];
    if (!it || it.kind !== 'stroke') return;
    const v = await askForm('Stroke Weight', [{ kind: 'number', key: 'w', label: 'Weight', value: it.width, min: 0, max: 1000, unit: 'pt' }]);
    if (v) this.edit('Stroke Weight', (ap) => ({ ...ap, items: ap.items.map((x, i) => (i === r.index && x.kind === 'stroke' ? { ...x, width: Number(v.w) } : x)) }));
  }

  private rows(): Row[] {
    const n = this.target();
    if (!n) return [];
    const out: Row[] = [];
    for (let i = n.ap.items.length - 1; i >= 0; i--) {
      const it = n.ap.items[i];
      out.push({ key: `i${i}`, kind: it.kind, index: i, item: i, label: it.kind === 'stroke' ? `Stroke  ${Math.round(it.width * 100) / 100} pt${it.dash.length ? ' dashed' : ''}${it.brush ? ' brush' : ''}` : 'Fill', paint: it.paint, visible: it.visible });
      it.effects.forEach((e, k) => out.push({ key: `i${i}e${k}`, kind: 'item-effect', index: k, item: i, label: fxLabel(e), visible: e.visible }));
    }
    if (n.kind === 'group' || n.kind === 'layer') out.push({ key: 'c', kind: 'contents', index: 0, item: -1, label: 'Contents', visible: true });
    n.ap.effects.forEach((e, i) => out.push({ key: `e${i}`, kind: 'effect', index: i, item: -1, label: fxLabel(e), visible: e.visible }));
    out.push({ key: 'o', kind: 'opacity', index: 0, item: -1, label: `Opacity  ${Math.round(n.opacity * 100)}%${n.blend !== 'normal' ? ` ${n.blend}` : ''}`, visible: true });
    return out;
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const n = this.target(), count = this.engine.selected().length, layer = n?.kind === 'layer';
    if (!n || n.id !== this.pickedFor) { this.picked = null; this.pickedFor = n?.id ?? null; }
    const linked = this.engine.graphicStyleOf(n), style = linked ? this.engine.doc?.styles.find((s) => s.id === linked)?.name ?? '' : '';
    setText(q(this.head, '.cv-appp-kind'), n ? (layer ? 'Layer' : count > 1 ? 'Mixed Objects' : n.kind === 'path' ? 'Path' : n.kind === 'text' ? 'Type' : nodeLabel(n)) : 'No Selection');
    setText(q(this.head, '.cv-appp-name'), n && (layer || count === 1) ? [layer ? nodeLabel(n) : n.name ?? '', style].filter(Boolean).join(' · ') : '');
    patchList<Row>(this.list, this.rows(), {
      key: (r) => r.key,
      create: (r) => { const row = el(`<div class="cv-appp-row" role="option"><button class="cv-appp-eye" type="button" aria-label="Toggle visibility">${icon('eye', 14)}</button><span class="cv-appp-label"></span><button class="cv-appp-chip" type="button" aria-label="Color"></button></div>`); this.fill(row, r); return row; },
      update: (row, r) => this.fill(row, r),
    });
  }

  private fill(row: HTMLElement, r: Row): void {
    setText(q(row, '.cv-appp-label'), r.label);
    setClass(row, 'is-off', !r.visible);
    setClass(row, 'is-effect', r.kind === 'effect' || r.kind === 'item-effect');
    setClass(row, 'is-nested', r.kind === 'item-effect');
    setClass(row, 'is-fixed', r.kind === 'contents' || r.kind === 'opacity');
    setClass(row, 'is-picked', r.key === this.picked);
    row.setAttribute('aria-selected', String(r.key === this.picked));
    const chip = q(row, '.cv-appp-chip');
    setHidden(chip, !r.paint);
    if (r.paint) setStyleVar(chip, '--paint', paintCss(r.paint, this.engine));
    setTitle(row, r.kind === 'effect' || r.kind === 'item-effect' ? 'Click the name to edit the effect' : r.kind === 'stroke' ? 'Click to target this stroke for new effects; click its name again to change the weight, the chip to change the color' : r.kind === 'fill' ? 'Click to target this fill for new effects; the chip changes the color' : r.kind === 'contents' ? 'The objects inside; the fills and strokes above draw over them' : '');
  }
}

export class GraphicStylesPanel {
  readonly body = el('<div class="cv-kit-page cv-stylesp"></div>');
  private readonly grid = el('<div class="cv-stylesp-grid" role="listbox" aria-label="Graphic Styles"></div>');
  private readonly source;
  private readonly docOnly: HTMLButtonElement[] = [];
  private lib = '';
  private frame = 0;
  private picked: string | null = null;

  constructor(private readonly engine: Engine) {
    this.source = selectCtl('Library', [['', 'Document'], ...STYLE_LIBRARIES.map((l) => [l.id, l.name] as const)], (v) => this.showLibrary(v));
    const foot = el('<div class="cv-panel-foot"></div>');
    const mk = (name: string, label: string, run: () => void, docOnly = false): void => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', run); foot.appendChild(b); if (docOnly) this.docOnly.push(b); };
    mk('unlink', 'Break Link to Graphic Style', () => engine.breakGraphicStyleLink(this.ids()));
    mk('refresh', 'Redefine Graphic Style with the selection\'s appearance', () => this.redefine(), true);
    mk('add', 'New Graphic Style from the selection', () => void (async () => { const n = engine.appearanceTarget(); if (!n) { engine.notice('Select an object whose look to keep as a graphic style.'); return; } const v = await askForm('New Graphic Style', [{ kind: 'text', key: 'name', label: 'Name', value: `Graphic Style ${(engine.doc?.styles.length ?? 0) + 1}` }], { ok: 'Add' }); if (v) { this.picked = engine.addGraphicStyle(String(v.name), n.id) || this.picked; this.showLibrary(''); } })());
    mk('delete', 'Delete Graphic Style', () => { if (this.picked && this.picked !== engine.doc?.styles[0]?.id) engine.edit('Delete Graphic Style', (d) => ({ ...d, styles: d.styles.filter((s) => s.id !== this.picked) })); }, true);
    this.grid.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('.cv-stylesp-tile'), key = t?.dataset.key;
      if (!key) return;
      const lib = STYLE_LIBRARIES.find((l) => l.id === this.lib);
      if (lib) { const s = lib.styles[Number(key.split(':')[1])]; if (s) this.picked = engine.useLibraryStyle(lib.id, s.name, this.ids()) || this.picked; return; }
      this.picked = key;
      engine.applyGraphicStyle(key, this.ids());
      this.sync();
    });
    this.body.append(this.source.el, this.grid, foot);
    for (const k of ['doc', 'active', 'projects', 'selection'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  showLibrary(id: string): void {
    this.lib = STYLE_LIBRARIES.some((l) => l.id === id) ? id : '';
    this.source.set(this.lib);
    this.sync();
  }

  private ids(): string[] | undefined { const n = this.engine.appearanceTarget(); return n?.kind === 'layer' ? [n.id] : undefined; }

  private redefine(): void {
    const e = this.engine, n = e.appearanceTarget(), id = this.picked ?? e.graphicStyleOf(n);
    if (!n || !id) { e.notice('Pick the graphic style to redefine, select an object with the look it should take, then choose Redefine.'); return; }
    e.redefineGraphicStyle(id, n.id);
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const lib = STYLE_LIBRARIES.find((l) => l.id === this.lib), linked = lib ? null : this.engine.graphicStyleOf(this.engine.appearanceTarget());
    for (const b of this.docOnly) setDisabled(b, !!lib);
    setClass(this.grid, 'is-library', !!lib);
    const list: GraphicStyle[] = lib ? lib.styles.map((s, i) => ({ ...s, id: `${lib.id}:${i}` })) : this.engine.doc?.styles ?? [];
    patchList<GraphicStyle>(this.grid, list, {
      key: (s) => s.id,
      create: (s) => { const b = el('<button class="cv-stylesp-tile" type="button" role="option"><canvas width="96" height="96"></canvas></button>'); this.fill(b, s, true, linked, !!lib); return b; },
      update: (b, s) => this.fill(b, s, false, linked, !!lib),
    });
  }

  private fill(b: HTMLElement, s: GraphicStyle, fresh: boolean, linked: string | null, inLibrary: boolean): void {
    setTitle(b, inLibrary ? `${s.name} · click to add it to the document and apply it` : s.id === linked ? `${s.name} · linked to the selection` : s.name);
    b.setAttribute('aria-label', s.name);
    setClass(b, 'is-picked', !inLibrary && s.id === this.picked);
    setClass(b, 'is-linked', !inLibrary && s.id === linked);
    const key = JSON.stringify(s.ap) + s.opacity + s.blend;
    if (!fresh && b.dataset.sig === key) return;
    b.dataset.sig = key;
    const c = q<HTMLCanvasElement>(b, 'canvas'), g = c.getContext('2d'), doc = this.engine.doc;
    if (!g || !doc) return;
    g.clearRect(0, 0, 96, 96);
    const node: VNode = { id: `preview-${s.id}`, kind: 'path', rule: 'nonzero', d: [{ closed: true, pts: [{ x: 18, y: 18, ix: 18, iy: 18, ox: 18, oy: 18 }, { x: 78, y: 18, ix: 78, iy: 18, ox: 78, oy: 18 }, { x: 78, y: 78, ix: 78, iy: 78, ox: 78, oy: 78 }, { x: 18, y: 78, ix: 18, iy: 78, ox: 18, oy: 78 }] }], ap: s.ap, opacity: s.opacity, blend: s.blend };
    try { renderNode(g, node, { doc, scale: 1, outline: false, assets: () => null }); } catch { }
  }
}

import { nodeLabel } from '../../engine/doc';
import { effectDef } from '../../engine/effects';
import { basicAppearance, emptyAppearance, fill, NONE, solid, stroke, BLACK, WHITE } from '../../engine/paint';
import { renderNode } from '../../engine/render';
import type { Appearance, Color, Engine, GraphicStyle, Paint, VNode } from '../../engine';
import { el, patchList, q, setClass, setHidden, setStyleVar, setText, setTitle } from '../dom';
import { icon } from '../icons';
import { askForm } from '../form-dialog';
import { paintCss } from '../rail';
import { effectDialog } from './preview-edit';

type Row = { key: string; kind: 'stroke' | 'fill' | 'effect' | 'opacity'; index: number; label: string; paint?: Paint; visible: boolean };

export class AppearancePanel {
  readonly body = el('<div class="cv-kit-page cv-appp"></div>');
  private readonly head = el('<div class="cv-appp-head"><span class="cv-appp-kind"></span><span class="cv-appp-name"></span></div>');
  private readonly list = el('<div class="cv-appp-list" role="listbox" aria-label="Appearance"></div>');
  private picked: string | null = null;
  private frame = 0;

  constructor(private readonly engine: Engine, private readonly pickColor: (c: Color) => Promise<Color | null>, private readonly effectsMenu: (anchor: HTMLElement) => void) {
    const foot = el('<div class="cv-panel-foot cv-appp-foot"></div>');
    const mk = (name: string, label: string, run: (b: HTMLButtonElement) => void): HTMLButtonElement => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', () => run(b)); foot.appendChild(b); return b; };
    mk('pStroke', 'Add New Stroke', () => this.edit('Add New Stroke', (ap) => ({ ...ap, items: [...ap.items, stroke(engine.strokePaint.type === 'none' ? solid(BLACK) : engine.strokePaint, 1)] })));
    mk('fill', 'Add New Fill', () => this.edit('Add New Fill', (ap) => ({ ...ap, items: [...ap.items, fill(engine.fillPaint.type === 'none' ? solid(WHITE) : engine.fillPaint)] })));
    mk('effects', 'Add New Effect', (b) => this.effectsMenu(b));
    mk('close', 'Clear Appearance', () => this.edit('Clear Appearance', () => emptyAppearance()));
    mk('refresh', 'Reduce to Basic Appearance', () => this.edit('Reduce to Basic Appearance', (ap) => { const f = ap.items.find((i) => i.kind === 'fill'), s = ap.items.find((i) => i.kind === 'stroke'); return basicAppearance(f?.paint ?? NONE, s?.paint ?? NONE, s && s.kind === 'stroke' ? s.width : 1); }));
    mk('duplicate', 'Duplicate Selected Item', () => this.onPicked((r, ap) => (r.kind === 'effect' ? { ...ap, effects: [...ap.effects.slice(0, r.index + 1), { ...ap.effects[r.index] }, ...ap.effects.slice(r.index + 1)] } : { ...ap, items: [...ap.items.slice(0, r.index + 1), { ...ap.items[r.index] }, ...ap.items.slice(r.index + 1)] })));
    mk('delete', 'Delete Selected Item', () => this.onPicked((r, ap) => (r.kind === 'effect' ? { ...ap, effects: ap.effects.filter((_, i) => i !== r.index) } : { ...ap, items: ap.items.filter((_, i) => i !== r.index) })));
    mk('chevronUp', 'Move Item Up', () => this.onPicked((r, ap) => this.shift(r, ap, 1)));
    mk('chevronDown', 'Move Item Down', () => this.onPicked((r, ap) => this.shift(r, ap, -1)));
    this.list.addEventListener('click', (e) => {
      const rowEl = (e.target as HTMLElement).closest<HTMLElement>('.cv-appp-row');
      if (!rowEl) return;
      const r = this.rows().find((x) => x.key === rowEl.dataset.key);
      if (!r) return;
      if ((e.target as HTMLElement).closest('.cv-appp-eye')) { this.toggle(r); return; }
      if ((e.target as HTMLElement).closest('.cv-appp-chip') && r.paint) { void this.recolor(r); return; }
      if ((e.target as HTMLElement).closest('.cv-appp-label') && r.kind === 'effect') { const n = engine.selected()[0]; const id = n?.ap.effects[r.index]?.id; if (n && id) void effectDialog(engine, id, { node: n.id, index: r.index }); return; }
      if ((e.target as HTMLElement).closest('.cv-appp-label') && r.kind === 'stroke') { void this.weight(r); return; }
      this.picked = r.key;
      this.sync();
    });
    this.body.append(this.head, this.list, foot);
    for (const k of ['selection', 'doc', 'active'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private shift(r: Row, ap: Appearance, dir: 1 | -1): Appearance {
    if (r.kind === 'effect') { const fx = ap.effects.slice(), j = r.index - dir; if (j < 0 || j >= fx.length) return ap; [fx[r.index], fx[j]] = [fx[j], fx[r.index]]; this.picked = `e${j}`; return { ...ap, effects: fx }; }
    const items = ap.items.slice(), j = r.index + dir;
    if (j < 0 || j >= items.length) return ap;
    [items[r.index], items[j]] = [items[j], items[r.index]];
    this.picked = `i${j}`;
    return { ...ap, items };
  }

  private target(): VNode | null { const s = this.engine.selected(); return s.length === 1 ? s[0] : s[0] ?? null; }

  private edit(name: string, fn: (ap: Appearance) => Appearance): void { if (this.engine.hasSelection) this.engine.editAppearance(name, fn); }

  private onPicked(fn: (r: Row, ap: Appearance) => Appearance): void {
    const r = this.rows().find((x) => x.key === this.picked);
    if (r && r.kind !== 'opacity') this.edit('Appearance', (ap) => fn(r, ap));
  }

  private toggle(r: Row): void {
    if (r.kind === 'opacity') return;
    this.edit('Appearance Visibility', (ap) => (r.kind === 'effect' ? { ...ap, effects: ap.effects.map((e, i) => (i === r.index ? { ...e, visible: !e.visible } : e)) } : { ...ap, items: ap.items.map((it, i) => (i === r.index ? { ...it, visible: !it.visible } : it)) }));
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
    n.ap.items.forEach((it, i) => out.push({ key: `i${i}`, kind: it.kind, index: i, label: it.kind === 'stroke' ? `Stroke  ${Math.round(it.width * 100) / 100} pt${it.dash.length ? ' dashed' : ''}${it.brush ? ' brush' : ''}` : 'Fill', paint: it.paint, visible: it.visible }));
    out.reverse();
    n.ap.effects.forEach((e, i) => out.push({ key: `e${i}`, kind: 'effect', index: i, label: effectDef(e.id)?.label ?? e.id, visible: e.visible }));
    out.push({ key: 'o', kind: 'opacity', index: 0, label: `Opacity  ${Math.round(n.opacity * 100)}%${n.blend !== 'normal' ? ` ${n.blend}` : ''}`, visible: true });
    return out;
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const n = this.target(), count = this.engine.selected().length;
    setText(q(this.head, '.cv-appp-kind'), n ? (count > 1 ? 'Mixed Objects' : n.kind === 'path' ? 'Path' : n.kind === 'text' ? 'Type' : nodeLabel(n)) : 'No Selection');
    setText(q(this.head, '.cv-appp-name'), n && count === 1 && n.name ? n.name : '');
    patchList<Row>(this.list, this.rows(), {
      key: (r) => r.key,
      create: (r) => { const row = el(`<div class="cv-appp-row" role="option"><button class="cv-appp-eye" type="button" aria-label="Toggle visibility">${icon('eye', 14)}</button><span class="cv-appp-label"></span><button class="cv-appp-chip" type="button" aria-label="Color"></button></div>`); this.fill(row, r); return row; },
      update: (row, r) => this.fill(row, r),
    });
  }

  private fill(row: HTMLElement, r: Row): void {
    setText(q(row, '.cv-appp-label'), r.label);
    setClass(row, 'is-off', !r.visible);
    setClass(row, 'is-effect', r.kind === 'effect');
    setClass(row, 'is-picked', r.key === this.picked);
    const chip = q(row, '.cv-appp-chip');
    setHidden(chip, !r.paint);
    if (r.paint) setStyleVar(chip, '--paint', paintCss(r.paint, this.engine));
    setTitle(row, r.kind === 'effect' ? 'Click the name to edit the effect' : r.kind === 'stroke' ? 'Click the name to change the weight, the chip to change the color' : '');
  }
}

export class GraphicStylesPanel {
  readonly body = el('<div class="cv-kit-page cv-stylesp"></div>');
  private readonly grid = el('<div class="cv-stylesp-grid" role="listbox" aria-label="Graphic Styles"></div>');
  private frame = 0;
  private picked: string | null = null;

  constructor(private readonly engine: Engine) {
    const foot = el('<div class="cv-panel-foot"></div>');
    const mk = (name: string, label: string, run: () => void): void => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', run); foot.appendChild(b); };
    mk('unlink', 'Break Link to Graphic Style', () => engine.applyToSelection('Break Link to Graphic Style', (n) => ({ ...n, style: undefined })));
    mk('add', 'New Graphic Style from the selection', () => void (async () => { const v = await askForm('New Graphic Style', [{ kind: 'text', key: 'name', label: 'Name', value: `Graphic Style ${(engine.doc?.styles.length ?? 0) + 1}` }], { ok: 'Add' }); if (v) engine.addGraphicStyle(String(v.name)); })());
    mk('delete', 'Delete Graphic Style', () => { if (this.picked && this.picked !== engine.doc?.styles[0]?.id) engine.edit('Delete Graphic Style', (d) => ({ ...d, styles: d.styles.filter((s) => s.id !== this.picked) })); });
    this.grid.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('.cv-stylesp-tile');
      if (!t?.dataset.key) return;
      this.picked = t.dataset.key;
      engine.applyGraphicStyle(t.dataset.key);
      this.sync();
    });
    this.body.append(this.grid, foot);
    for (const k of ['doc', 'active', 'projects'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    patchList<GraphicStyle>(this.grid, this.engine.doc?.styles ?? [], {
      key: (s) => s.id,
      create: (s) => { const b = el('<button class="cv-stylesp-tile" type="button" role="option"><canvas width="96" height="96"></canvas></button>'); this.fill(b, s, true); return b; },
      update: (b, s) => this.fill(b, s, false),
    });
  }

  private fill(b: HTMLElement, s: GraphicStyle, fresh: boolean): void {
    setTitle(b, s.name);
    b.setAttribute('aria-label', s.name);
    setClass(b, 'is-picked', s.id === this.picked);
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

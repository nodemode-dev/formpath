import { nodeLabel } from '../engine/doc';
import { firstFill, firstStroke } from '../engine/paint';
import type { Engine, Rect, ShapeMode, Units } from '../engine';
import { PanelGroup } from './panel-group';
import type { AlignAction } from '../engine/ops/objects';
import type { PathfinderOp } from '../engine/ops/paths';
import { el, q, setClass, setDisabled, setHidden, setHtml, setStyleVar, setText } from './dom';
import { icon } from './icons';
import { paintCss } from './rail';
import { check, iconButton, numField, row, section, seg, selectCtl, slider } from './panels/kit';
import { ShapeFields } from './shape-fields';

const UNIT: Record<string, number> = { pt: 1, px: 1, mm: 72 / 25.4, cm: 72 / 2.54, in: 72, pc: 12 };
export const refPoint = { x: 0.5, y: 0.5 };

function unit(e: Engine): { k: number; name: string } { const u = e.doc?.units ?? 'pt'; return { k: UNIT[u] ?? 1, name: u }; }

function refGrid(onPick: () => void): HTMLElement {
  const g = el('<div class="cv-refpt" role="group" aria-label="Reference point"></div>');
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const b = el<HTMLButtonElement>(`<button type="button" aria-label="Reference point ${['top', 'middle', 'bottom'][j]} ${['left', 'center', 'right'][i]}"></button>`);
    b.dataset.x = String(i / 2); b.dataset.y = String(j / 2);
    b.addEventListener('click', () => { refPoint.x = i / 2; refPoint.y = j / 2; onPick(); });
    g.appendChild(b);
  }
  return g;
}

function syncRef(g: HTMLElement): void { for (const b of Array.from(g.children) as HTMLElement[]) setClass(b, 'is-on', Number(b.dataset.x) === refPoint.x && Number(b.dataset.y) === refPoint.y); }

class TransformFields {
  readonly el = el('<div class="cv-xform"></div>');
  private readonly x; private readonly y; private readonly w; private readonly h; private readonly rot; private readonly shear;
  private readonly grid: HTMLElement;
  private readonly link: HTMLButtonElement;
  private linked = false;

  constructor(private readonly engine: Engine, full: boolean) {
    const at = (b: Rect): { x: number; y: number } => ({ x: b.x + b.w * refPoint.x, y: b.y + b.h * refPoint.y });
    const ab = (): { x: number; y: number } => { const p = engine.current; const a = p?.doc.artboards[p.activeArtboard]; return a ?? { x: 0, y: 0 }; };
    const apply = (r: Partial<Rect>): void => { engine.setBounds(r); };
    this.x = numField('X', '', (v) => { const b = engine.selectionBounds(false); if (b) apply({ x: v * unit(engine).k + ab().x - b.w * refPoint.x }); });
    this.y = numField('Y', '', (v) => { const b = engine.selectionBounds(false); if (b) apply({ y: v * unit(engine).k + ab().y - b.h * refPoint.y }); });
    this.w = numField('W', '', (v) => this.resize(v * unit(engine).k, null), { min: 0 });
    this.h = numField('H', '', (v) => this.resize(null, v * unit(engine).k), { min: 0 });
    this.rot = numField('', '°', (v) => { const b = engine.selectionBounds(false); if (b && v) { engine.rotateBy(v, at(b)); this.rot.set(0); } }, { title: 'Rotate' });
    this.shear = numField('', '°', (v) => { const b = engine.selectionBounds(false); if (b && v) { engine.shear(v, 'horizontal', at(b)); this.shear.set(0); } }, { title: 'Shear' });
    q(this.rot.el, '.cv-pf-label').innerHTML = icon('vRotate', 14);
    q(this.shear.el, '.cv-pf-label').innerHTML = icon('vShear', 14);
    this.grid = refGrid(() => { syncRef(this.grid); this.sync(); });
    this.link = el<HTMLButtonElement>(`<button class="cv-link-btn" type="button" title="Constrain width and height proportions" aria-label="Constrain proportions">${icon('link', 14)}</button>`);
    this.link.addEventListener('click', () => { this.linked = !this.linked; setClass(this.link, 'is-on', this.linked); });
    const grid = el('<div class="cv-props-grid"></div>');
    grid.append(this.x.el, this.w.el, this.y.el, this.h.el);
    const top = el('<div class="cv-props-transform"></div>');
    top.append(this.grid, grid, this.link);
    this.el.append(top, row(this.rot.el, this.shear.el));
    if (full) {
      const flips = row(iconButton('flipH', 'Flip Horizontal', () => { const b = engine.selectionBounds(false); if (b) engine.reflect('horizontal', at(b)); }), iconButton('flipV', 'Flip Vertical', () => { const b = engine.selectionBounds(false); if (b) engine.reflect('vertical', at(b)); }));
      const strokes = check('Scale Strokes & Effects', (v) => engine.setView({ scaleStrokes: v }));
      const pats = check('Transform Patterns', (v) => engine.setView({ transformPatterns: v }));
      const corners = check('Use Preview Bounds', (v) => engine.setView({ previewBounds: v }));
      this.el.append(flips, strokes.el, pats.el, corners.el);
      engine.on('options', () => { strokes.set(engine.view.scaleStrokes); pats.set(engine.view.transformPatterns); corners.set(engine.view.previewBounds); });
      strokes.set(engine.view.scaleStrokes); pats.set(engine.view.transformPatterns); corners.set(engine.view.previewBounds);
    }
    syncRef(this.grid);
  }

  private resize(w: number | null, h: number | null): void {
    const e = this.engine, b = e.selectionBounds(false);
    if (!b) return;
    let nw = w ?? b.w, nh = h ?? b.h;
    if (this.linked && b.w > 0 && b.h > 0) { if (w !== null) nh = b.h * (nw / b.w); else if (h !== null) nw = b.w * (nh / b.h); }
    e.setBounds({ x: b.x + (b.w - nw) * refPoint.x, y: b.y + (b.h - nh) * refPoint.y, w: nw, h: nh });
  }

  sync(): void {
    const e = this.engine, b = e.selectionBounds(false), u = unit(e), p = e.current, a = p?.doc.artboards[p.activeArtboard] ?? { x: 0, y: 0 };
    const r = (v: number): number => Math.round(v * 100) / 100;
    this.x.set(b ? r((b.x + b.w * refPoint.x - a.x) / u.k) : null);
    this.y.set(b ? r((b.y + b.h * refPoint.y - a.y) / u.k) : null);
    this.w.set(b ? r(b.w / u.k) : null);
    this.h.set(b ? r(b.h / u.k) : null);
    this.rot.set(b ? 0 : null);
    this.shear.set(b ? 0 : null);
    for (const f of [this.x, this.y, this.w, this.h, this.rot, this.shear]) { f.enable(!!b); setText(q(f.el, '.cv-unit'), f === this.rot || f === this.shear ? '°' : u.name); }
    syncRef(this.grid);
  }
}

export class PropertiesPanel {
  readonly body = el('<div class="cv-kit-page cv-propsp"></div>');
  private readonly head = el('<div class="cv-props-head"><span class="cv-props-tile"></span><span class="cv-props-name"></span></div>');
  private readonly xform: TransformFields;
  private readonly selBox = el('<div class="cv-propsp-sel"></div>');
  private readonly docBox = el('<div class="cv-propsp-doc"></div>');
  private readonly stack = el('<div class="cv-propsp-stack"></div>');
  private floor = 0;
  private readonly docCtls: Array<{ enable(on: boolean): void }> = [];
  private readonly docButtons: HTMLButtonElement[] = [];
  private readonly quick = el('<div class="cv-propsp-quick"></div>');
  private readonly fillChip: HTMLButtonElement;
  private readonly strokeChip: HTMLButtonElement;
  private readonly weight;
  private readonly opacity;
  private readonly units;
  private readonly boards;
  private readonly flags: Array<{ c: ReturnType<typeof check>; key: keyof Engine['view'] }> = [];
  private frame = 0;
  private quickKey = '';
  private readonly shape: ShapeFields;
  private readonly shapeHead = section('Shape');

  constructor(private readonly engine: Engine, private readonly run: (cmd: string) => void) {
    this.xform = new TransformFields(engine, false);
    this.shape = new ShapeFields(engine);
    const app = el(`<div class="cv-propsp-app"><div class="cv-propsp-paint"><span class="cv-pf-label">Fill</span><button class="cv-fs-mini cv-propsp-fill" type="button" aria-label="Fill color"></button></div><div class="cv-propsp-paint"><span class="cv-pf-label">Stroke</span><button class="cv-fs-mini cv-fs-mini-stroke cv-propsp-stroke" type="button" aria-label="Stroke color"></button></div></div>`);
    this.fillChip = q<HTMLButtonElement>(app, '.cv-propsp-fill');
    this.strokeChip = q<HTMLButtonElement>(app, '.cv-propsp-stroke');
    this.fillChip.addEventListener('click', () => { engine.setActiveSlot('fill'); this.fillChip.dispatchEvent(new CustomEvent('cv-pick-color', { bubbles: true, detail: 'fill' })); });
    this.strokeChip.addEventListener('click', () => { engine.setActiveSlot('stroke'); this.strokeChip.dispatchEvent(new CustomEvent('cv-pick-color', { bubbles: true, detail: 'stroke' })); });
    this.weight = numField('', 'pt', (v) => engine.setStroke({ width: v }), { min: 0, max: 1000, step: 0.5 });
    q(app, '.cv-propsp-paint:last-child').appendChild(this.weight.el);
    this.opacity = slider(engine, 'Opacity', 0, 100, (v) => engine.setObjectProps({ opacity: v / 100 }), { unit: '%' });
    this.selBox.append(section('Transform'), this.xform.el, section('Appearance'), app, this.opacity.el, section('Quick Actions'), this.quick, this.shapeHead, this.shape.el);
    this.units = selectCtl('Units', [['pt', 'Points'], ['px', 'Pixels'], ['in', 'Inches'], ['mm', 'Millimeters'], ['cm', 'Centimeters'], ['pc', 'Picas']], (v) => engine.documentSetup({ units: v as Units }));
    this.boards = selectCtl('Artboard', [], (v) => { engine.setActiveArtboard(Number(v)); engine.fit(); });
    const flagsBox = el('<div class="cv-propsp-flags"></div>');
    for (const [key, label] of [['rulers', 'Rulers'], ['grid', 'Grid'], ['guides', 'Guides'], ['smartGuides', 'Smart Guides'], ['snapGrid', 'Snap to Grid'], ['snapPoint', 'Snap to Point'], ['outline', 'Outline View'], ['transparencyGrid', 'Transparency Grid']] as const) {
      const c = check(label, (v) => engine.setView({ [key]: v } as Partial<Engine['view']>));
      this.flags.push({ c, key });
      this.docCtls.push(c);
      flagsBox.appendChild(c.el);
    }
    const docActions = el('<div class="cv-propsp-buttons"></div>');
    for (const [label, cmd] of [['Document Setup', 'document-setup'], ['Edit Artboards', 'tool-artboard'], ['Preferences', 'settings']] as const) { const b = el<HTMLButtonElement>('<button class="cv-btn" type="button"></button>'); setText(b, label); b.addEventListener('click', () => run(cmd)); docActions.appendChild(b); if (cmd !== 'settings') this.docButtons.push(b); }
    this.docBox.append(section('Document'), this.units.el, this.boards.el, section('Rulers & Grids'), flagsBox, section('Quick Actions'), docActions);
    this.docCtls.push(this.units, this.boards);
    this.stack.append(this.selBox, this.docBox);
    this.body.append(this.head, this.stack);
    const ro = new ResizeObserver(() => {
      const h = Math.max(this.selBox.offsetHeight, this.docBox.offsetHeight);
      if (h > this.floor) { this.floor = h; setStyleVar(this.stack, '--cv-props-floor', `${h}px`); }
    });
    ro.observe(this.selBox);
    ro.observe(this.docBox);
    for (const k of ['selection', 'doc', 'active', 'options', 'colors', 'projects', 'tool'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private actionsFor(): Array<[string, string]> {
    const s = this.engine.selected(), n = s[0];
    if (!n) return [];
    const out: Array<[string, string]> = [];
    if (s.length > 1) out.push(['Group', 'group'], ['Make Clipping Mask', 'make-clip'], ['Unite', 'pf-unite'], ['Minus Front', 'pf-minus_front'], ['Intersect', 'pf-intersect'], ['Exclude', 'pf-exclude'], ['Make Blend', 'blend-make'], ['Make Compound Path', 'compound-make']);
    else if (n.kind === 'group' && n.compoundShape) out.push(['Expand', 'compound-shape-expand'], ['Release', 'compound-shape-release'], ['Isolate Group', 'isolate']);
    else if (n.kind === 'group' && n.livePaint) out.push(['Gap Options', 'live-paint-gap'], ['Expand', 'live-paint-expand'], ['Release', 'live-paint-release']);
    else if (n.kind === 'group' && n.intertwine) out.push(['Edit Intertwine', 'intertwine-edit'], ['Expand', 'expand-object'], ['Release', 'intertwine-release']);
    else if (n.kind === 'group' && n.shaper) out.push(['Edit Faces', 'tool-shaper'], ['Expand', 'shaper-expand'], ['Ungroup', 'ungroup']);
    else if (n.kind === 'group' && n.graph) out.push(['Graph Data', 'graph-data'], ['Graph Type', 'graph-type'], ['Ungroup', 'ungroup']);
    else if (n.kind === 'group' && n.trace) out.push(['Trace Image Options', 'panel-image-trace'], ['Expand', 'trace-expand'], ['Release', 'trace-release']);
    else if (n.kind === 'group') out.push(['Ungroup', 'ungroup'], ['Isolate Group', 'isolate'], ...(n.clip ? [['Release Clipping Mask', 'release-clip'] as [string, string]] : []));
    else if (n.kind === 'text') out.push(['Create Outlines', 'create-outlines'], ['Edit Text', 'edit-text'], [n.mode === 'area' ? 'Convert to Point Type' : 'Convert to Area Type', 'toggle-area-type']);
    else if (n.kind === 'image') out.push(['Trace Image', 'image-trace'], ['Embed', 'embed-image']);
    else if (n.kind === 'path') out.push(['Offset Path', 'offset-path'], ['Outline Stroke', 'outline-stroke'], ['Simplify', 'simplify'], ...(n.live ? [['Expand Shape', 'expand-shape'] as [string, string]] : []));
    else if (n.kind === 'compound') out.push(['Release Compound Path', 'compound-release']);
    else if (n.kind === 'blend' || n.kind === 'repeat' || n.kind === 'envelope') out.push(['Expand', 'expand-object'], ['Release', 'release-live'], ...(n.kind === 'blend' ? [['Blend Options', 'blend-options'] as [string, string]] : []), ...(n.kind === 'envelope' ? [['Edit Contents', 'envelope-edit-contents'], ['Envelope Options', 'envelope-options']] as Array<[string, string]> : []));
    else if (n.kind === 'symbol') out.push(['Break Link', 'break-symbol']);
    out.push(['Arrange', 'bring-to-front'], ['Recolor', 'recolor'], ['Expand Appearance', 'expand-appearance']);
    return out;
  }

  private readonly widest: Array<[string, string]> = [['Group', 'group'], ['Make Clipping Mask', 'make-clip'], ['Unite', 'pf-unite'], ['Minus Front', 'pf-minus_front'], ['Intersect', 'pf-intersect'], ['Exclude', 'pf-exclude'], ['Make Blend', 'blend-make'], ['Make Compound Path', 'compound-make'], ['Arrange', 'bring-to-front'], ['Recolor', 'recolor'], ['Expand Appearance', 'expand-appearance']];

  private fillQuick(acts: Array<[string, string]>): void {
    const key = acts.map((a) => a[1]).join(',');
    if (key === this.quickKey) return;
    this.quickKey = key;
    this.quick.textContent = '';
    for (const [label, cmd] of acts) { const b = el<HTMLButtonElement>('<button class="cv-btn cv-quick-btn" type="button"></button>'); setText(b, label); b.addEventListener('click', () => this.run(cmd)); this.quick.appendChild(b); }
  }

  private sync(): void {
    const e = this.engine, sel = e.selected(), n = sel[0], has = sel.length > 0, p = e.current;
    setClass(this.selBox, 'is-off', !has);
    setClass(this.docBox, 'is-off', has);
    if (this.selBox.inert !== !has) this.selBox.inert = !has;
    if (this.docBox.inert !== has) this.docBox.inert = has;
    for (const c of this.docCtls) c.enable(!!p);
    for (const b of this.docButtons) setDisabled(b, !p);
    const tile = q(this.head, '.cv-props-tile');
    setHtml(tile, icon(!p ? 'newFile' : !has ? 'pArtboards' : sel.length > 1 ? 'layers' : n.kind === 'text' ? 'vType' : n.kind === 'group' ? 'folder' : n.kind === 'image' ? 'image' : n.kind === 'symbol' ? 'pSymbols' : 'vPen', 18), !p ? 'none' : !has ? 'doc' : sel.length > 1 ? 'many' : n.kind);
    setText(q(this.head, '.cv-props-name'), !p ? 'No Document' : !has ? 'Document' : sel.length > 1 ? `${sel.length} Objects` : nodeLabel(n));
    if (has) {
      this.xform.sync();
      setHidden(this.shapeHead, !this.shape.sync());
      const f = n.kind === 'text' ? n.spans[0]?.style.fill : firstFill(n.ap)?.paint, s = n.kind === 'text' ? n.spans[0]?.style.stroke : firstStroke(n.ap)?.paint;
      setStyleVar(this.fillChip, '--paint', paintCss(f ?? { type: 'none' }, e));
      setStyleVar(this.strokeChip, '--paint', paintCss(s ?? { type: 'none' }, e));
      const st = n.kind === 'text' ? null : firstStroke(n.ap);
      this.weight.set(n.kind === 'text' ? n.spans[0]?.style.strokeWidth ?? 0 : st?.width ?? 0);
      this.opacity.set(Math.round(n.opacity * 100));
      this.fillQuick(this.actionsFor());
    } else {
      setHidden(this.shapeHead, false);
      this.shape.reserve();
      this.fillQuick(this.widest);
    }
    if (!has && p) {
      this.units.set(p.doc.units);
      this.boards.setChoices(p.doc.artboards.map((a, i) => [String(i), `${i + 1} ${a.name}`] as const));
      this.boards.set(String(p.activeArtboard));
      for (const f of this.flags) f.c.set(!!e.view[f.key]);
    }
  }
}

export class TransformPanel {
  readonly body = el('<div class="cv-kit-page cv-xformp"></div>');
  private readonly fields: TransformFields;
  private frame = 0;
  constructor(engine: Engine) {
    this.fields = new TransformFields(engine, true);
    this.body.appendChild(this.fields.el);
    for (const k of ['selection', 'doc', 'active', 'options'] as const) engine.on(k, () => { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.fields.sync(); }); });
    this.fields.sync();
  }
}

export class AlignPanel {
  readonly body = el('<div class="cv-kit-page cv-alignp"></div>');
  private to: 'selection' | 'artboard' | 'key' = 'selection';
  private readonly toCtl;
  private readonly spacing;

  constructor(private readonly engine: Engine) {
    const btn = (name: string, label: string, action: AlignAction): HTMLButtonElement => iconButton(name, label, () => this.align(action), 18);
    const objects = row(btn('alignLeftEdge', 'Horizontal Align Left', 'left'), btn('alignHcenterEdge', 'Horizontal Align Center', 'horizontal_center'), btn('alignRightEdge', 'Horizontal Align Right', 'right'), btn('alignTopEdge', 'Vertical Align Top', 'top'), btn('alignVcenterEdge', 'Vertical Align Center', 'vertical_center'), btn('alignBottomEdge', 'Vertical Align Bottom', 'bottom'));
    const dist = row(btn('alignTopEdge', 'Vertical Distribute Top', 'distribute_top'), btn('alignVcenterEdge', 'Vertical Distribute Center', 'distribute_vertical_center'), btn('alignBottomEdge', 'Vertical Distribute Bottom', 'distribute_bottom'), btn('alignLeftEdge', 'Horizontal Distribute Left', 'distribute_left'), btn('alignHcenterEdge', 'Horizontal Distribute Center', 'distribute_horizontal_center'), btn('alignRightEdge', 'Horizontal Distribute Right', 'distribute_right'));
    this.spacing = numField('Spacing', 'pt', () => undefined, { min: -10000, max: 10000, title: 'Leave empty to space evenly' });
    const spaceRow = row(btn('distributeV', 'Vertical Distribute Space', 'distribute_vertical_space'), btn('distributeH', 'Horizontal Distribute Space', 'distribute_horizontal_space'), this.spacing.el);
    this.toCtl = seg([{ id: 'selection', label: 'Selection' }, { id: 'key', label: 'Key Object' }, { id: 'artboard', label: 'Artboard' }], (id) => { this.to = id as typeof this.to; this.toCtl.set(id); });
    this.toCtl.set('selection');
    this.body.append(section('Align Objects'), objects, section('Distribute Objects'), dist, section('Distribute Spacing'), spaceRow, section('Align To'), this.toCtl.el);
    this.spacing.set(null);
  }

  private align(a: AlignAction): void {
    const e = this.engine, ids = e.targetIds();
    const raw = (this.spacing.el.querySelector('input') as HTMLInputElement).value.trim(), sp = raw === '' ? null : parseFloat(raw);
    e.align(a, this.to, this.to === 'key' ? ids[ids.length - 1] ?? null : null, Number.isFinite(sp as number) ? sp : null);
  }
}

export class PathfinderPanel {
  readonly body = el('<div class="cv-kit-page cv-pfp"></div>');
  private frame = 0;
  constructor(engine: Engine) {
    const b = (name: string, label: string, op: PathfinderOp): HTMLButtonElement => iconButton(name, label, () => engine.pathfinder(op), 20);
    const m = (name: string, label: string, op: PathfinderOp, sm: ShapeMode): HTMLButtonElement => {
      const btn = iconButton(name, label, (ev) => { if (!engine.shapeMode(sm)) engine.pathfinder(op, undefined, ev.altKey); }, 20);
      btn.title = `${label} (Alt-click makes a compound shape)`;
      return btn;
    };
    const modes = row(m('pfUnite', 'Unite', 'unite', 'add'), m('pfMinusFront', 'Minus Front', 'minus_front', 'subtract'), m('pfIntersect', 'Intersect', 'intersect', 'intersect'), m('pfExclude', 'Exclude', 'exclude', 'exclude'));
    const expand = el<HTMLButtonElement>('<button class="cv-btn" type="button">Expand</button>');
    expand.addEventListener('click', () => engine.expandCompoundShape());
    modes.appendChild(expand);
    const finders = row(b('pfDivide', 'Divide', 'divide'), b('pfTrim', 'Trim', 'trim'), b('pfMerge', 'Merge', 'merge'), b('pfCrop', 'Crop', 'crop'), b('pfOutline', 'Outline', 'outline'), b('pfMinusBack', 'Minus Back', 'minus_back'));
    const more = iconButton('dots', 'Pathfinder panel menu', () => PanelGroup.menuHost?.(more, ['compound-shape-make', 'compound-shape-release', 'compound-shape-expand', '-', 'pf-options']), 16);
    const head = el('<div class="cv-kit-section cv-pfp-head"></div>');
    const title = el('<span></span>');
    setText(title, 'Shape Modes');
    head.append(title, more);
    this.body.append(head, modes, section('Pathfinders'), finders);
    const sync = (): void => { this.frame = 0; setDisabled(expand, engine.compoundShapeTargets().length === 0); };
    for (const k of ['selection', 'doc', 'active'] as const) engine.on(k, () => { if (!this.frame) this.frame = requestAnimationFrame(sync); });
    sync();
  }
}

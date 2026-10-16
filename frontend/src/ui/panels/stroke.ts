import { ARROWHEADS, brushGeometry, CUSTOM_WIDTH_PROFILES, WIDTH_PROFILES } from '../../engine/effects';
import { customProfileNames, deleteWidthProfile, isCustomProfile, onWidthProfiles, resetWidthProfiles, saveWidthProfile } from '../../io/width-profiles';
import { geomBounds } from '../../engine/bounds';
import { anchor, toPath2D } from '../../engine/geometry';
import { cssColor, firstStroke, parseColor, rgb, solid, stroke as makeStroke } from '../../engine/paint';
import { BLEND_MODES, type BlendMode, type BrushDef, type Engine, type PathData, type StrokeItem } from '../../engine';
import { BRISTLE_SHAPES } from '../../engine/types';
import { askForm, type Field } from '../form-dialog';
import { el, patchList, q, setChecked, setClass, setDisabled, setHidden, setText, setTitle } from '../dom';
import { icon } from '../icons';
import { check, numField, row, section, seg, selectCtl, slider, type Ctl } from './kit';

function currentStroke(e: Engine): StrokeItem {
  for (const n of e.selected()) {
    if (n.kind === 'text') { const st = n.spans[0]?.style; if (st) return makeStroke(st.stroke, st.strokeWidth); }
    const s = firstStroke(n.ap);
    if (s) return s;
  }
  return makeStroke(e.strokePaint, e.strokeWidth);
}

const label = (s: string): string => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export class StrokePanel {
  readonly body = el('<div class="cv-kit-page cv-strokep"></div>');
  private frame = 0;
  private readonly weight;
  private readonly cap;
  private readonly join;
  private readonly miter;
  private readonly align;
  private readonly dashed;
  private readonly dashes: Array<ReturnType<typeof numField>> = [];
  private readonly corners;
  private readonly startArrow;
  private readonly endArrow;
  private readonly startScale;
  private readonly endScale;
  private readonly arrowAlign;
  private readonly profile;
  private readonly profBtns: Record<'along' | 'across' | 'add' | 'del' | 'reset', HTMLButtonElement>;
  private readonly dashBox = el('<div class="cv-strokep-dash"></div>');

  constructor(private readonly engine: Engine) {
    const set = (patch: Partial<StrokeItem>): void => engine.setStroke(patch);
    this.weight = numField('Weight', 'pt', (v) => set({ width: v }), { min: 0, max: 1000, step: 0.5 });
    this.cap = seg([{ id: 'butt', label: 'Butt Cap', icon: 'capButt' }, { id: 'round', label: 'Round Cap', icon: 'capRound' }, { id: 'square', label: 'Projecting Cap', icon: 'capSquare' }], (id) => set({ cap: id as StrokeItem['cap'] }));
    this.join = seg([{ id: 'miter', label: 'Miter Join', icon: 'joinMiter' }, { id: 'round', label: 'Round Join', icon: 'joinRound' }, { id: 'bevel', label: 'Bevel Join', icon: 'joinBevel' }], (id) => set({ join: id as StrokeItem['join'] }));
    this.miter = numField('Limit', '×', (v) => set({ miter: v }), { min: 1, max: 500 });
    this.align = seg([{ id: 'center', label: 'Align Stroke to Center', icon: 'alignCenterStroke' }, { id: 'inside', label: 'Align Stroke to Inside', icon: 'alignInsideStroke' }, { id: 'outside', label: 'Align Stroke to Outside', icon: 'alignOutsideStroke' }], (id) => set({ align: id as StrokeItem['align'] }));
    this.dashed = check('Dashed Line', (on) => set({ dash: on ? [12, 6] : [] }));
    for (let i = 0; i < 6; i++) {
      const f = numField(i % 2 ? 'gap' : 'dash', '', () => this.applyDashes(), { min: 0, max: 1000 });
      this.dashes.push(f);
      this.dashBox.appendChild(f.el);
    }
    this.corners = check('Align dashes to corners and path ends', (on) => set({ dashCorners: on }));
    const heads = ARROWHEADS.map((a) => [a, label(a)] as const);
    this.startArrow = selectCtl('Start', heads, (v) => set({ startArrow: v }));
    this.endArrow = selectCtl('End', heads, (v) => set({ endArrow: v }));
    this.startScale = numField('Scale', '%', (v) => set({ arrowScale: [v, currentStroke(engine).arrowScale[1]] }), { min: 1, max: 1000 });
    this.endScale = numField('Scale', '%', (v) => set({ arrowScale: [currentStroke(engine).arrowScale[0], v] }), { min: 1, max: 1000 });
    this.arrowAlign = seg([{ id: 'extend', label: 'Extend arrow tip beyond end of path' }, { id: 'tip', label: 'Place arrow tip at end of path' }], (id) => set({ arrowAlign: id as 'extend' | 'tip' }));
    this.profile = selectCtl('Profile', this.profileChoices(), (v) => { if (v !== '__custom') engine.setWidthProfile(v); });
    const pbtn = (name: string, title: string, run: () => void): HTMLButtonElement => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${title}" aria-label="${title}">${icon(name, 16)}</button>`); b.addEventListener('click', run); return b; };
    this.profBtns = {
      along: pbtn('flipH', 'Flip Along', () => { engine.flipWidthProfile(true, false); }),
      across: pbtn('flipV', 'Flip Across', () => { engine.flipWidthProfile(false, true); }),
      add: pbtn('add', 'Add to Profiles', () => void this.saveProfile()),
      del: pbtn('delete', 'Delete Profile', () => this.removeProfile()),
      reset: pbtn('refresh', 'Reset Profiles', () => void this.resetProfiles()),
    };
    onWidthProfiles(() => this.queue());
    this.body.append(
      row(this.weight.el, this.miter.el),
      section('Cap'), this.cap.el,
      section('Corner'), this.join.el,
      section('Align Stroke'), this.align.el,
      this.dashed.el, this.dashBox, this.corners.el,
      section('Arrowheads'), row(this.startArrow.el, this.startScale.el), row(this.endArrow.el, this.endScale.el), this.arrowAlign.el,
      this.profile.el, row(...Object.values(this.profBtns)),
    );
    for (const k of ['selection', 'doc', 'colors', 'active'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private profileChoices(): Array<readonly [string, string]> {
    return [...Object.keys(WIDTH_PROFILES).map((k) => [k, label(k)] as const), ...customProfileNames().map((k) => [k, k] as const), ['__custom', 'Custom width points'] as const];
  }

  private async saveProfile(): Promise<void> {
    const s = currentStroke(this.engine);
    if (!s.profile?.length) { this.engine.notice('Choose a profile or use the Width tool first: the stroke has no width points to save.'); return; }
    const v = await askForm('Add to Profiles', [{ kind: 'text', key: 'name', label: 'Name', value: `Profile ${customProfileNames().length + 1}` }], { ok: 'Add' });
    if (!v) return;
    const key = saveWidthProfile(String(v.name), s.profile);
    if (key) this.engine.notice(`Added ${key} to the profiles.`);
    else this.engine.notice('Choose a name that is not one of the built-in profiles.', 'error');
  }

  private removeProfile(): void {
    const s = currentStroke(this.engine), name = Object.entries(CUSTOM_WIDTH_PROFILES).find(([, v]) => JSON.stringify(v) === JSON.stringify(s.profile))?.[0];
    if (!name || !deleteWidthProfile(name)) this.engine.notice('Only profiles you added can be deleted. Select one in the Profile menu first.');
  }

  private async resetProfiles(): Promise<void> {
    if (!customProfileNames().length) { this.engine.notice('There are no added profiles to remove.'); return; }
    const v = await askForm('Reset Profiles', [{ kind: 'note', text: 'This removes every profile you added and keeps the built-in ones. Strokes keep their width points.' }], { ok: 'Reset' });
    if (v) resetWidthProfiles();
  }

  private applyDashes(): void {
    const vals = this.dashes.map((f) => parseFloat(q<HTMLInputElement>(f.el, 'input').value)).map((v) => (Number.isFinite(v) ? v : NaN));
    const out: number[] = [];
    for (let i = 0; i < vals.length; i += 2) { if (!Number.isFinite(vals[i])) break; out.push(vals[i], Number.isFinite(vals[i + 1]) ? vals[i + 1] : vals[i]); }
    this.engine.setStroke({ dash: out.length ? out : [12, 6] });
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const s = currentStroke(this.engine);
    this.weight.set(s.width);
    this.cap.set(s.cap);
    this.join.set(s.join);
    this.miter.set(s.miter);
    this.align.set(s.align);
    this.dashed.set(s.dash.length > 0);
    setHidden(this.dashBox, !s.dash.length);
    setHidden(this.corners.el, !s.dash.length);
    this.dashes.forEach((f, i) => f.set(i < s.dash.length ? s.dash[i] : null));
    this.corners.set(s.dashCorners);
    this.startArrow.set(s.startArrow);
    this.endArrow.set(s.endArrow);
    this.startScale.set(s.arrowScale[0]);
    this.endScale.set(s.arrowScale[1]);
    this.arrowAlign.set(s.arrowAlign);
    this.profile.setChoices(this.profileChoices());
    const sig = JSON.stringify(s.profile);
    const prof = s.profile ? [...Object.entries(WIDTH_PROFILES), ...Object.entries(CUSTOM_WIDTH_PROFILES)].find(([, v]) => JSON.stringify(v) === sig)?.[0] ?? '__custom' : 'uniform';
    this.profile.set(prof);
    const has = !!s.profile?.length;
    setDisabled(this.profBtns.along, !has);
    setDisabled(this.profBtns.across, !has);
    setDisabled(this.profBtns.add, !has);
    setDisabled(this.profBtns.del, !isCustomProfile(prof));
    setDisabled(this.profBtns.reset, !customProfileNames().length);
  }
}

export class TransparencyPanel {
  readonly body = el('<div class="cv-kit-page cv-transp"></div>');
  private frame = 0;
  private readonly blend;
  private readonly opacity;
  private readonly makeBtn: HTMLButtonElement;
  private readonly clip;
  private readonly invert;
  private readonly disable;
  private readonly link;
  private readonly isolate;
  private readonly knockout;
  private readonly koShape;
  private readonly maskRow = el('<div class="cv-transp-mask"></div>');

  constructor(private readonly engine: Engine) {
    this.blend = selectCtl('Mode', BLEND_MODES.map((b) => [b.id, b.label] as const), (v) => engine.setObjectProps({ blend: v as BlendMode }));
    this.opacity = slider(engine, 'Opacity', 0, 100, (v) => engine.setObjectProps({ opacity: v / 100 }), { unit: '%' });
    this.makeBtn = el<HTMLButtonElement>('<button class="cv-btn" type="button">Make Mask</button>');
    this.makeBtn.addEventListener('click', () => { if (engine.selected().some((n) => n.mask)) engine.releaseOpacityMask(); else engine.makeOpacityMask(); });
    this.clip = check('Clip', (on) => engine.setOpacityMask({ clip: on }));
    this.invert = check('Invert Mask', (on) => engine.setOpacityMask({ invert: on }));
    this.disable = check('Disable', (on) => engine.setOpacityMask({ disabled: on }));
    this.link = check('Link', (on) => engine.setOpacityMask({ linked: on }));
    this.isolate = check('Isolate Blending', (on) => engine.setObjectProps({ isolate: on }));
    this.knockout = triCheck('Knockout Group', (v) => engine.setObjectProps({ knockout: v }));
    this.koShape = check('Opacity and Mask Define Knockout Shape', (on) => engine.setObjectProps({ knockoutShape: on }));
    this.maskRow.append(this.clip.el, this.invert.el, this.disable.el, this.link.el);
    this.body.append(this.blend.el, this.opacity.el, row(this.makeBtn), this.maskRow, this.isolate.el, this.knockout.el, this.koShape.el);
    for (const k of ['selection', 'doc', 'active'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const n = this.engine.selected()[0], has = !!n;
    this.blend.set(n?.blend ?? 'normal');
    this.opacity.set(Math.round((n?.opacity ?? 1) * 100));
    for (const c of [this.blend, this.opacity, this.isolate, this.knockout, this.koShape]) c.enable(has);
    setText(this.makeBtn, n?.mask ? 'Release' : 'Make Mask');
    this.makeBtn.disabled = !has;
    setHidden(this.maskRow, !n?.mask);
    this.clip.set(!!n?.mask?.clip);
    this.invert.set(!!n?.mask?.invert);
    this.disable.set(!!n?.mask?.disabled);
    this.link.set(n?.mask ? n.mask.linked : true);
    this.isolate.set(!!n?.isolate);
    this.knockout.set(n?.knockout ?? false);
    this.koShape.set(!!n?.knockoutShape);
  }
}

function triCheck(label: string, change: (v: boolean | 'inherit') => void): Ctl<boolean | 'inherit'> {
  const n = el('<label class="cv-check"><input type="checkbox"><span></span></label>');
  setText(q(n, 'span'), label);
  const c = q<HTMLInputElement>(n, 'input');
  let cur: boolean | 'inherit' = false;
  const show = (v: boolean | 'inherit'): void => {
    cur = v;
    setChecked(c, v === true);
    if (c.indeterminate !== (v === 'inherit')) c.indeterminate = v === 'inherit';
    setTitle(n, v === 'inherit' ? `${label}: inherit from the enclosing group` : `${label}: ${v ? 'on' : 'off'}`);
  };
  c.addEventListener('change', () => { const next = cur === false ? true : cur === true ? 'inherit' : false; show(next); change(next); });
  return { el: n, set: show, enable: (on) => setDisabled(c, !on) };
}

export class BrushesPanel {
  readonly body = el('<div class="cv-kit-page cv-brushp"></div>');
  private readonly list = el('<div class="cv-brushp-list" role="listbox" aria-label="Brushes"></div>');
  private frame = 0;

  constructor(private readonly engine: Engine, private readonly libMenu: (anchor: HTMLElement) => void = () => undefined) {
    const foot = el('<div class="cv-panel-foot"></div>');
    const mk = (name: string, label: string, run: (b: HTMLButtonElement) => void): void => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', () => run(b)); foot.appendChild(b); };
    mk('library', 'Brush Libraries menu', (b) => this.libMenu(b));
    mk('close', 'Remove Brush Stroke', () => engine.applyBrush(null));
    mk('settings', 'Options of Selected Brush', () => void this.options());
    mk('add', 'New Brush', () => void this.create());
    mk('delete', 'Delete Brush', () => { const id = engine.currentBrush; if (id) engine.deleteBrush(id); });
    this.list.addEventListener('dblclick', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-brushp-row'); if (r?.dataset.key) { engine.currentBrush = r.dataset.key; void this.options(); } });
    this.list.addEventListener('click', (e) => {
      const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-brushp-row');
      if (!r?.dataset.key) return;
      engine.currentBrush = r.dataset.key;
      if (engine.hasSelection) engine.applyBrush(r.dataset.key); else engine.emit('options', null);
      this.sync();
    });
    this.body.append(this.list, foot);
    for (const k of ['doc', 'active', 'options', 'selection'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const brushes = this.engine.doc?.brushes ?? [];
    patchList<BrushDef>(this.list, brushes, {
      key: (b) => b.id,
      create: (b) => { const n = el(`<button class="cv-brushp-row" type="button" role="option"><canvas class="cv-brushp-preview" width="120" height="24"></canvas><span class="cv-brushp-name"></span><span class="cv-brushp-kind"></span></button>`); this.fill(n, b); this.preview(n, b); return n; },
      update: (n, b) => { this.fill(n, b); this.preview(n, b); },
    });
  }

  private async create(): Promise<void> {
    const e = this.engine;
    const v = await askForm('New Brush', [
      { kind: 'select', key: 'kind', label: 'Type', value: e.hasSelection ? 'art' : 'calligraphic', choices: [['calligraphic', 'Calligraphic Brush'], ['scatter', 'Scatter Brush'], ['art', 'Art Brush'], ['bristle', 'Bristle Brush'], ['pattern', 'Pattern Brush']] },
      { kind: 'text', key: 'name', label: 'Name', value: `Brush ${(e.doc?.brushes.length ?? 0) + 1}` },
      { kind: 'note', text: 'Scatter, art and pattern brushes are made from the selected artwork; its strokes become filled shapes. A pattern brush takes its corner, start and end tiles from pattern swatches.' },
    ], { ok: 'Next' });
    if (!v) return;
    const kind = String(v.kind) as BrushDef['brush']['type'], o = await this.ask(kind, null);
    if (!o) return;
    const { colorize, ...rest } = o;
    const id = e.newBrush(String(v.name), kind, rest, (colorize as BrushDef['colorize']) ?? 'none');
    if (id && e.hasSelection && kind === 'calligraphic') e.notice('The brush is in the Brushes panel; select a path and click it to apply.');
  }

  private async options(): Promise<void> {
    const b = this.engine.doc?.brushes.find((x) => x.id === this.engine.currentBrush);
    if (!b) { this.engine.notice('Click a brush in the Brushes panel first.'); return; }
    const o = await this.ask(b.brush.type, b);
    if (!o) return;
    const { colorize, name, ...rest } = o;
    this.engine.editBrush(b.id, { name: typeof name === 'string' && name.trim() ? name.trim() : undefined, colorize: colorize as BrushDef['colorize'], brush: rest });
  }

  private ask(kind: BrushDef['brush']['type'], b: BrushDef | null): Promise<Record<string, number | string | boolean> | null> {
    const cur = (b?.brush ?? {}) as Record<string, unknown>, n = (k: string, d: number): number => (typeof cur[k] === 'number' ? cur[k] as number : d);
    const title = `${kind[0].toUpperCase()}${kind.slice(1)} Brush Options`;
    const colorize = { kind: 'select' as const, key: 'colorize', label: 'Colorization', value: b?.colorize ?? 'none', choices: [['none', 'None'], ['tints', 'Tints'], ['tints_shades', 'Tints and Shades'], ['hue_shift', 'Hue Shift']] as Array<readonly [string, string]> };
    const name = b ? [{ kind: 'text' as const, key: 'name', label: 'Name', value: b.name }] : [];
    const guides = Array.isArray(cur.guides) ? cur.guides as [number, number] : null;
    const pats = (this.engine.doc?.patterns ?? []).map((p) => [p.name, p.name] as const);
    const tileField = (key: 'outer' | 'inner' | 'start' | 'end', label: string): Field => ({ kind: 'select', key, label, value: b && cur[key] ? 'keep' : 'none', choices: [['none', 'None'], ...(b && cur[key] ? [['keep', 'Current tile'] as const] : []), ...(b ? [['side', 'Same as side tile'] as const] : []), ...pats] });
    const fields: Field[] =
      kind === 'calligraphic' ? [...name, { kind: 'number', key: 'angle', label: 'Angle', value: n('angle', 0), min: -180, max: 180, unit: '°' }, { kind: 'number', key: 'roundness', label: 'Roundness', value: n('roundness', 100), min: 1, max: 100, unit: '%' }, { kind: 'number', key: 'size', label: 'Size', value: n('size', 3), min: 0.1, max: 1296, unit: 'pt' }, { kind: 'note', text: 'Drawn with a pen tablet, the Paintbrush varies the size with pressure.' }]
      : kind === 'scatter' ? [...name, { kind: 'number', key: 'size', label: 'Size', value: n('size', 100), min: 1, max: 1000, unit: '%' }, { kind: 'number', key: 'spacing', label: 'Spacing', value: n('spacing', 100), min: 1, max: 1000, unit: '%' }, { kind: 'number', key: 'scatter', label: 'Scatter', value: n('scatter', 0), min: -1000, max: 1000, unit: '%' }, { kind: 'number', key: 'rotation', label: 'Rotation', value: n('rotation', 0), min: -360, max: 360, unit: '°' }, { kind: 'check', key: 'relative', label: 'Rotation relative to path', value: cur.relative === true }, colorize]
      : kind === 'art' ? [...name, { kind: 'number', key: 'width', label: 'Width', value: n('width', 100), min: 1, max: 1000, unit: '%' },
        { kind: 'select', key: 'scaleMode', label: 'Brush scale', value: cur.stretch === false ? 'proportional' : guides ? 'guides' : 'stretch', choices: [['proportional', 'Scale proportionately'], ['stretch', 'Stretch to fit stroke length'], ['guides', 'Stretch between guides']] },
        { kind: 'number', key: 'guide1', label: 'Start guide', value: Math.round((guides?.[0] ?? 0.25) * 100), min: 0, max: 100, unit: '%' },
        { kind: 'number', key: 'guide2', label: 'End guide', value: Math.round((guides?.[1] ?? 0.75) * 100), min: 0, max: 100, unit: '%' },
        { kind: 'note', text: 'Between guides, only the art between the start and end guide (a share of the art’s length) stretches; the ends keep their shape.' },
        { kind: 'check', key: 'flipAlong', label: 'Flip along', value: cur.flipAlong === true }, { kind: 'check', key: 'flip', label: 'Flip across', value: cur.flip === true }, colorize]
      : kind === 'bristle' ? [...name,
        { kind: 'select', key: 'shape', label: 'Shape', value: typeof cur.shape === 'string' ? cur.shape : 'round_point', choices: BRISTLE_SHAPES },
        { kind: 'number', key: 'size', label: 'Size', value: n('size', 7), min: 0.5, max: 72, unit: 'pt' },
        { kind: 'number', key: 'length', label: 'Bristle length', value: n('length', 100), min: 25, max: 300, unit: '%' },
        { kind: 'number', key: 'density', label: 'Bristle density', value: n('density', 50), min: 1, max: 100, unit: '%' },
        { kind: 'number', key: 'thickness', label: 'Bristle thickness', value: n('thickness', 50), min: 1, max: 100, unit: '%' },
        { kind: 'number', key: 'opacity', label: 'Paint opacity', value: n('opacity', 75), min: 1, max: 100, unit: '%' },
        { kind: 'number', key: 'stiffness', label: 'Stiffness', value: n('stiffness', 50), min: 1, max: 100, unit: '%' },
        { kind: 'note', text: 'Each stroke is drawn as many thin, semi-transparent bristle paths; with a pen tablet the spread follows pressure. Expand turns them into paths.' }]
      : [...name, { kind: 'number', key: 'spacing', label: 'Spacing', value: n('spacing', 0), min: 0, max: 1000, unit: '%' }, { kind: 'select', key: 'fit', label: 'Fit', value: typeof cur.fit === 'string' ? cur.fit : 'stretch', choices: [['stretch', 'Stretch to fit'], ['space', 'Add space to fit'], ['approximate', 'Approximate path']] },
        tileField('outer', 'Outer corner tile'), tileField('inner', 'Inner corner tile'), tileField('start', 'Start tile'), tileField('end', 'End tile'),
        { kind: 'check', key: 'flipAlong', label: 'Flip along', value: cur.flipAlong === true }, { kind: 'check', key: 'flip', label: 'Flip across', value: cur.flip === true }, colorize];
    return askForm(title, fields, { ok: b ? 'OK' : 'Create' });
  }

  private fill(n: HTMLElement, b: BrushDef): void {
    setText(q(n, '.cv-brushp-name'), b.name);
    setText(q(n, '.cv-brushp-kind'), b.brush.type);
    setTitle(n, `${b.name} (${b.brush.type} brush)`);
    setClass(n, 'is-on', this.engine.currentBrush === b.id);
  }

  private preview(n: HTMLElement, b: BrushDef): void {
    const sig = JSON.stringify(b.brush) + b.colorize;
    if (n.dataset.sig === sig) return;
    n.dataset.sig = sig;
    const c = q<HTMLCanvasElement>(n, 'canvas'), g = c.getContext('2d'), doc = this.engine.doc;
    if (!g || !doc) return;
    g.clearRect(0, 0, c.width, c.height);
    const ink = (getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') || '#cccccc').trim(), col = parseColor(ink) ?? rgb(204, 204, 204);
    const d: PathData = [{ closed: false, pts: [anchor(8, 14, 8, 14, 40, 0), anchor(112, 10, 80, 24, 112, 10)] }];
    const art = b.brush.type === 'calligraphic' || b.brush.type === 'bristle' ? null : geomBounds(doc, b.brush.art);
    const h = art && Number.isFinite(art.h) && art.h > 0 ? art.h : 10;
    const width = b.brush.type === 'calligraphic' ? 1 : b.brush.type === 'bristle' ? Math.min(1, 14 / Math.max(1, b.brush.size)) : b.brush.type === 'scatter' ? Math.min(2, 9 / h) : b.brush.type === 'art' ? Math.min(2, 9 / h) : Math.min(2, 7 / h);
    const pieces = brushGeometry({ ...doc, brushes: [b] }, d, { ...makeStroke(solid(col), width), brush: b.id }) ?? [];
    for (const piece of pieces) {
      const p = piece.paint ?? solid(col);
      g.fillStyle = p.type === 'color' ? cssColor(p.color) : ink;
      g.globalAlpha = piece.opacity ?? 1;
      g.fill(toPath2D(piece.d), 'nonzero');
    }
    g.globalAlpha = 1;
  }
}

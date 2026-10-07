import { ARROWHEADS, WIDTH_PROFILES } from '../../engine/effects';
import { firstStroke, stroke as makeStroke } from '../../engine/paint';
import { BLEND_MODES, type BlendMode, type BrushDef, type Engine, type StrokeItem } from '../../engine';
import { el, patchList, q, setClass, setHidden, setText, setTitle } from '../dom';
import { icon } from '../icons';
import { check, numField, row, section, seg, selectCtl, slider } from './kit';

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
    this.profile = selectCtl('Profile', Object.keys(WIDTH_PROFILES).map((k) => [k, label(k)] as const), (v) => engine.setWidthProfile(v));
    this.body.append(
      row(this.weight.el, this.miter.el),
      section('Cap'), this.cap.el,
      section('Corner'), this.join.el,
      section('Align Stroke'), this.align.el,
      this.dashed.el, this.dashBox, this.corners.el,
      section('Arrowheads'), row(this.startArrow.el, this.startScale.el), row(this.endArrow.el, this.endScale.el), this.arrowAlign.el,
      this.profile.el,
    );
    for (const k of ['selection', 'doc', 'colors', 'active'] as const) engine.on(k, () => this.queue());
    this.sync();
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
    const prof = s.profile ? Object.entries(WIDTH_PROFILES).find(([, v]) => JSON.stringify(v) === JSON.stringify(s.profile))?.[0] ?? '' : 'uniform';
    if (prof) this.profile.set(prof);
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
  private readonly isolate;
  private readonly knockout;
  private readonly maskRow = el('<div class="cv-transp-mask"></div>');

  constructor(private readonly engine: Engine) {
    this.blend = selectCtl('Mode', BLEND_MODES.map((b) => [b.id, b.label] as const), (v) => engine.setObjectProps({ blend: v as BlendMode }));
    this.opacity = slider(engine, 'Opacity', 0, 100, (v) => engine.setObjectProps({ opacity: v / 100 }), { unit: '%' });
    this.makeBtn = el<HTMLButtonElement>('<button class="cv-btn" type="button">Make Mask</button>');
    this.makeBtn.addEventListener('click', () => { if (engine.selected().some((n) => n.mask)) engine.releaseOpacityMask(); else engine.makeOpacityMask(); });
    this.clip = check('Clip', (on) => engine.setOpacityMask({ clip: on }));
    this.invert = check('Invert Mask', (on) => engine.setOpacityMask({ invert: on }));
    this.isolate = check('Isolate Blending', (on) => engine.setObjectProps({ isolate: on }));
    this.knockout = check('Knockout Group', (on) => engine.setObjectProps({ knockout: on }));
    this.maskRow.append(this.clip.el, this.invert.el);
    this.body.append(this.blend.el, this.opacity.el, row(this.makeBtn), this.maskRow, this.isolate.el, this.knockout.el);
    for (const k of ['selection', 'doc', 'active'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const n = this.engine.selected()[0], has = !!n;
    this.blend.set(n?.blend ?? 'normal');
    this.opacity.set(Math.round((n?.opacity ?? 1) * 100));
    for (const c of [this.blend, this.opacity, this.isolate, this.knockout]) c.enable(has);
    setText(this.makeBtn, n?.mask ? 'Release' : 'Make Mask');
    this.makeBtn.disabled = !has;
    setHidden(this.maskRow, !n?.mask);
    this.clip.set(!!n?.mask?.clip);
    this.invert.set(!!n?.mask?.invert);
    this.isolate.set(!!n?.isolate);
    this.knockout.set(!!n?.knockout);
  }
}

export class BrushesPanel {
  readonly body = el('<div class="cv-kit-page cv-brushp"></div>');
  private readonly list = el('<div class="cv-brushp-list" role="listbox" aria-label="Brushes"></div>');
  private frame = 0;

  constructor(private readonly engine: Engine) {
    const foot = el('<div class="cv-panel-foot"></div>');
    const remove = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="Remove Brush Stroke" aria-label="Remove Brush Stroke">${icon('close', 16)}</button>`);
    remove.addEventListener('click', () => engine.applyBrush(null));
    foot.appendChild(remove);
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
      update: (n, b) => this.fill(n, b),
    });
  }

  private fill(n: HTMLElement, b: BrushDef): void {
    setText(q(n, '.cv-brushp-name'), b.name);
    setText(q(n, '.cv-brushp-kind'), b.brush.type);
    setTitle(n, `${b.name} (${b.brush.type} brush)`);
    setClass(n, 'is-on', this.engine.currentBrush === b.id);
  }

  private preview(n: HTMLElement, b: BrushDef): void {
    const c = q<HTMLCanvasElement>(n, 'canvas'), g = c.getContext('2d');
    if (!g) return;
    g.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') || '#ccc';
    g.fillStyle = g.strokeStyle;
    g.lineCap = 'round';
    const t = b.brush.type;
    if (t === 'calligraphic') { g.lineWidth = 4; g.beginPath(); g.moveTo(6, 16); g.bezierCurveTo(40, 2, 80, 22, 114, 8); g.stroke(); }
    else if (t === 'scatter') { for (let x = 10; x < 115; x += 14) { g.beginPath(); g.arc(x, 12 + Math.sin(x / 9) * 5, 3, 0, Math.PI * 2); g.fill(); } }
    else if (t === 'art') { g.beginPath(); g.moveTo(6, 12); g.quadraticCurveTo(60, -2, 114, 12); g.quadraticCurveTo(60, 26, 6, 12); g.fill(); }
    else { g.lineWidth = 2; g.setLineDash([8, 4, 2, 4]); g.beginPath(); g.moveTo(6, 12); g.lineTo(114, 12); g.stroke(); }
  }
}

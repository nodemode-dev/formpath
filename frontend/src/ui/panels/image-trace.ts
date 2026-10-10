import type { Engine, GroupNode, ImageNode, TraceView } from '../../engine';
import { DEFAULT_TRACE, TRACE_PALETTES, TRACE_PRESETS, TRACE_VIEWS, type TraceOpts } from '../../io/trace';
import { el, setDisabled, setHidden, setText } from '../dom';
import { check, empty, page, row, section, seg, selectCtl, slider } from './kit';

type Opts = TraceOpts & { preset: string };
const PRESETS: ReadonlyArray<readonly [string, string]> = [...Object.keys(TRACE_PRESETS).map((k) => [k, k] as const), ['Custom', 'Custom']];

export class ImageTracePanel {
  readonly body = page('cv-tracep');
  private readonly idle = empty('Select a placed image to trace it, or a tracing object to change its options.');
  private readonly form = el('<div class="cv-tracep-form"></div>');
  private readonly preset;
  private readonly view;
  private readonly mode;
  private readonly colors;
  private readonly threshold;
  private readonly paths;
  private readonly ignoreWhite;
  private readonly smooth;
  private readonly palette;
  private readonly corners;
  private readonly noise;
  private readonly method;
  private readonly fills;
  private readonly strokes;
  private readonly strokeWidth;
  private readonly snap;
  private readonly createRow: HTMLElement;
  private readonly preview;
  private readonly traceBtn = el<HTMLButtonElement>('<button class="cv-btn cv-btn-primary" type="button">Trace</button>');
  private readonly expandBtn = el<HTMLButtonElement>('<button class="cv-btn" type="button">Expand</button>');
  private readonly releaseBtn = el<HTMLButtonElement>('<button class="cv-btn" type="button">Release</button>');
  private readonly status = el('<p class="cv-patp-status"></p>');
  private opts: Opts = { ...DEFAULT_TRACE, preset: '6 Colors' };
  private live = true;
  private busy = false;
  private runs = 0;
  private timer = 0;
  private frame = 0;
  private shownFor = '';

  constructor(private readonly engine: Engine, private readonly trace: (id: string, a: Record<string, unknown>) => Promise<string | null>) {
    this.preset = selectCtl('Preset', PRESETS, (v) => { if (v === 'Custom') return; this.opts = { ...this.opts, ...DEFAULT_TRACE, ...TRACE_PRESETS[v], preset: v }; this.changed({ preset: v }); });
    this.view = selectCtl('View', TRACE_VIEWS, (v) => { const t = this.target(); if (t && 'trace' in t) engine.setTraceView(v as TraceView, [t.id]); });
    const set = (patch: Partial<Opts>): void => { this.opts = { ...this.opts, ...patch, preset: 'Custom' }; this.changed(); };
    this.mode = selectCtl('Mode', [['color', 'Color'], ['gray', 'Grayscale'], ['bw', 'Black and White']], (id) => set({ mode: id as TraceOpts['mode'] }));
    this.palette = selectCtl('Palette', TRACE_PALETTES, (id) => set({ palette: id as TraceOpts['palette'] }));
    this.colors = slider(engine, 'Colors', 2, 64, (v) => set({ colors: Math.round(v) }));
    this.threshold = slider(engine, 'Threshold', 1, 255, (v) => set({ threshold: Math.round(v) }));
    this.paths = slider(engine, 'Paths', 0, 100, (v) => set({ detail: v / 100 }), { unit: '%' });
    this.corners = slider(engine, 'Corners', 0, 100, (v) => set({ corners: v / 100 }), { unit: '%' });
    this.noise = slider(engine, 'Noise', 1, 200, (v) => set({ noise: Math.round(v) }), { unit: 'px' });
    this.method = seg([{ id: 'abutting', label: 'Abutting' }, { id: 'overlapping', label: 'Overlapping' }], (id) => set({ method: id as TraceOpts['method'] }), 'cv-seg-small');
    this.fills = check('Fills', (v) => set({ fills: v }));
    this.strokes = check('Strokes', (v) => set({ strokes: v }));
    this.strokeWidth = slider(engine, 'Stroke', 1, 100, (v) => set({ strokeWidth: Math.round(v) }), { unit: 'px' });
    this.ignoreWhite = check('Ignore White', (v) => set({ ignoreWhite: v }));
    this.smooth = check('Smooth Curves', (v) => set({ smooth: v }));
    this.snap = check('Snap Curves to Lines', (v) => set({ snapLines: v }));
    this.preview = check('Preview', (v) => { this.live = v; if (v) this.changed(); });
    this.traceBtn.addEventListener('click', () => void this.run());
    this.expandBtn.addEventListener('click', () => { const t = this.target(); if (t) engine.expandTrace([t.id]); });
    this.releaseBtn.addEventListener('click', () => { const t = this.target(); if (t) engine.releaseTrace([t.id]); });
    this.createRow = row(this.fills.el, this.strokes.el);
    this.form.append(
      row(this.preset.el), row(this.view.el),
      section('Options'), row(this.mode.el), row(this.palette.el), this.colors.el, this.threshold.el,
      section('Advanced'), this.paths.el, this.corners.el, this.noise.el, row(this.method.el), this.createRow, this.strokeWidth.el,
      row(this.ignoreWhite.el), row(this.smooth.el), row(this.snap.el),
      this.status,
      row(this.preview.el), row(this.traceBtn, this.expandBtn, this.releaseBtn),
    );
    this.body.append(this.idle, this.form);
    for (const k of ['selection', 'doc', 'active', 'projects', 'busy'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private target(): ImageNode | GroupNode | null {
    for (const n of this.engine.selected()) { if (n.kind === 'image') return n; if (n.kind === 'group' && n.trace) return n; }
    return null;
  }

  private args(extra: Record<string, unknown> = {}): Record<string, unknown> {
    const o = this.opts;
    if (extra.preset) return extra;
    return { mode: o.mode, palette: o.palette, colors: o.colors, threshold: o.threshold, paths: Math.round(o.detail * 100), corners: Math.round(o.corners * 100), noise: o.noise, method: o.method, fills: o.fills, strokes: o.strokes, stroke_width: o.strokeWidth, ignore_white: o.ignoreWhite, smooth: o.smooth, snap_lines: o.snapLines };
  }

  private changed(extra: Record<string, unknown> = {}): void {
    this.sync();
    const t = this.target();
    if (!t || t.kind !== 'group' || !this.live) return;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.run(extra), 280);
  }

  private async run(extra: Record<string, unknown> = {}): Promise<void> {
    const t = this.target();
    if (!t) return;
    this.runs++;
    this.busy = true;
    this.sync();
    const a = this.args(extra);
    if (a.mode === 'bw') delete a.colors; else delete a.threshold;
    try { await this.trace(t.id, a); } finally { if (--this.runs === 0) this.busy = false; this.queue(); }
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const t = this.target();
    setHidden(this.idle, !!t);
    setHidden(this.form, !t);
    if (!t) { this.shownFor = ''; return; }
    const live = t.kind === 'group' ? t.trace ?? null : null;
    const key = live ? `${t.id}:${JSON.stringify(live.opts)}` : t.id;
    if (live && key !== this.shownFor) this.opts = { ...DEFAULT_TRACE, ...(live.opts as Partial<Opts>), preset: String(live.opts.preset ?? 'Custom') };
    this.shownFor = key;
    const o = this.opts;
    this.preset.set(PRESETS.some(([k]) => k === o.preset) ? o.preset : 'Custom');
    this.view.set(live?.view ?? 'result');
    this.view.enable(!!live);
    this.mode.set(o.mode);
    const bw = o.mode === 'bw';
    setHidden(this.palette.el.parentElement as HTMLElement, bw);
    setHidden(this.colors.el, bw);
    setHidden(this.threshold.el, !bw);
    this.palette.set(o.palette);
    this.colors.enable(o.palette === 'limited');
    this.colors.set(o.colors); this.threshold.set(o.threshold); this.paths.set(Math.round(o.detail * 100));
    this.corners.set(Math.round(o.corners * 100)); this.noise.set(o.noise); this.method.set(o.method);
    this.fills.set(o.fills); this.strokes.set(o.strokes); this.strokes.enable(bw); this.strokeWidth.set(o.strokeWidth); this.strokeWidth.enable(bw && o.strokes);
    this.ignoreWhite.set(o.ignoreWhite); this.smooth.set(o.smooth); this.snap.set(o.snapLines); this.preview.set(this.live);
    setText(this.traceBtn, live ? 'Trace Again' : 'Trace');
    setDisabled(this.traceBtn, false);
    setDisabled(this.expandBtn, !live || this.busy);
    setDisabled(this.releaseBtn, !live || this.busy);
    const paths = live ? (t as GroupNode).children.length : 0;
    const at = live && typeof live.opts.traced === 'string' && live.opts.traced !== `${live.src.w}x${live.src.h}` ? ` (traced at ${String(live.opts.traced).replace('x', ' x ')} px)` : '', found = live && typeof live.opts.found === 'number' ? `, ${live.opts.found} colors` : '';
    setText(this.status, this.busy ? 'Tracing...' : live ? `${paths} ${paths === 1 ? 'path' : 'paths'}${found} from a ${live.src.w} x ${live.src.h} px image${at}. Expand turns the result into ordinary paths; Release brings back the image.` : 'Trace keeps the image inside a tracing object so the options stay editable.');
  }
}

import type { Engine, GroupNode, ImageNode, TraceView } from '../../engine';
import { DEFAULT_TRACE, TRACE_PRESETS, TRACE_VIEWS, type TraceOpts } from '../../io/trace';
import { el, setDisabled, setHidden, setText } from '../dom';
import { check, empty, page, row, section, selectCtl, slider } from './kit';

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
  private readonly preview;
  private readonly traceBtn = el<HTMLButtonElement>('<button class="cv-btn cv-btn-primary" type="button">Trace</button>');
  private readonly expandBtn = el<HTMLButtonElement>('<button class="cv-btn" type="button">Expand</button>');
  private readonly releaseBtn = el<HTMLButtonElement>('<button class="cv-btn" type="button">Release</button>');
  private readonly status = el('<p class="cv-patp-status"></p>');
  private opts: Opts = { ...DEFAULT_TRACE, preset: '6 Colors' };
  private live = true;
  private busy = false;
  private timer = 0;
  private frame = 0;
  private shownFor = '';

  constructor(private readonly engine: Engine, private readonly trace: (id: string, a: Record<string, unknown>) => Promise<string | null>) {
    this.preset = selectCtl('Preset', PRESETS, (v) => { if (v === 'Custom') return; this.opts = { ...this.opts, ...DEFAULT_TRACE, ...TRACE_PRESETS[v], preset: v }; this.changed({ preset: v }); });
    this.view = selectCtl('View', TRACE_VIEWS, (v) => { const t = this.target(); if (t && 'trace' in t) engine.setTraceView(v as TraceView, [t.id]); });
    this.mode = selectCtl('Mode', [['color', 'Color'], ['gray', 'Grayscale'], ['bw', 'Black and White']], (id) => { this.opts = { ...this.opts, mode: id as TraceOpts['mode'], preset: 'Custom' }; this.changed(); });
    this.colors = slider(engine, 'Colors', 2, 64, (v) => { this.opts = { ...this.opts, colors: Math.round(v), preset: 'Custom' }; this.changed(); });
    this.threshold = slider(engine, 'Threshold', 1, 255, (v) => { this.opts = { ...this.opts, threshold: Math.round(v), preset: 'Custom' }; this.changed(); });
    this.paths = slider(engine, 'Paths', 0, 100, (v) => { this.opts = { ...this.opts, detail: v / 100, preset: 'Custom' }; this.changed(); }, { unit: '%' });
    this.ignoreWhite = check('Ignore White', (v) => { this.opts = { ...this.opts, ignoreWhite: v, preset: 'Custom' }; this.changed(); });
    this.smooth = check('Smooth Curves', (v) => { this.opts = { ...this.opts, smooth: v, preset: 'Custom' }; this.changed(); });
    this.preview = check('Preview', (v) => { this.live = v; if (v) this.changed(); });
    this.traceBtn.addEventListener('click', () => void this.run());
    this.expandBtn.addEventListener('click', () => { const t = this.target(); if (t) engine.expandTrace([t.id]); });
    this.releaseBtn.addEventListener('click', () => { const t = this.target(); if (t) engine.releaseTrace([t.id]); });
    this.form.append(
      row(this.preset.el), row(this.view.el),
      section('Options'), row(this.mode.el), this.colors.el, this.threshold.el, this.paths.el, row(this.ignoreWhite.el), row(this.smooth.el),
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
    return { mode: o.mode, colors: o.colors, threshold: o.threshold, paths: Math.round(o.detail * 100), ignore_white: o.ignoreWhite, smooth: o.smooth };
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
    if (!t || this.busy) return;
    this.busy = true;
    this.sync();
    const a = this.args(extra);
    if (a.mode === 'bw') delete a.colors; else delete a.threshold;
    try { await this.trace(t.id, a); } finally { this.busy = false; this.queue(); }
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
    setHidden(this.colors.el, o.mode === 'bw');
    setHidden(this.threshold.el, o.mode !== 'bw');
    this.colors.set(o.colors); this.threshold.set(o.threshold); this.paths.set(Math.round(o.detail * 100));
    this.ignoreWhite.set(o.ignoreWhite); this.smooth.set(o.smooth); this.preview.set(this.live);
    setText(this.traceBtn, live ? 'Trace Again' : 'Trace');
    setDisabled(this.traceBtn, this.busy);
    setDisabled(this.expandBtn, !live || this.busy);
    setDisabled(this.releaseBtn, !live || this.busy);
    const paths = live ? (t as GroupNode).children.length : 0;
    setText(this.status, this.busy ? 'Tracing...' : live ? `${paths} ${paths === 1 ? 'path' : 'paths'} from a ${live.src.w} x ${live.src.h} px image. Expand turns the result into ordinary paths; Release brings back the image.` : 'Trace keeps the image inside a tracing object so the options stay editable.');
  }
}

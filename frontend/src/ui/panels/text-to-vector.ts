import type { Engine } from '../../engine';
import type { VNode } from '../../engine';
import { placeVector, textToVectorVariations, VECTOR_TYPES, type Variation } from '../../io/generative';
import { reportText } from '../../io/gen-repair';
import { el, setClass, setDisabled, setText } from '../dom';
import { GenOptionsUi } from './gen-options';
import { ModelPanel, paintPreview, textArea, tiles } from './generative';
import { page, row, section, seg } from './kit';

export class TextToVectorPanel extends ModelPanel {
  readonly body = page('cv-genp cv-t2vp');
  private readonly target = el('<p class="cv-genp-target"></p>');
  private readonly prompt = textArea('Prompt', 'Describe the art, such as a red fox in a snowy pine forest');
  private readonly type;
  private readonly opts;
  private readonly report = el('<p class="cv-genp-note" role="status"></p>');
  private readonly count;
  private readonly go = el<HTMLButtonElement>('<button class="cv-btn cv-btn-primary" type="button">Generate</button>');
  private readonly place = el<HTMLButtonElement>('<button class="cv-btn" type="button">Place</button>');
  private readonly grid;
  private o = { type: 'subject', variations: 3 };
  private results: Variation[] = [];
  private picked = -1;
  private busy = false;
  private note = '';
  private frame = 0;

  constructor(engine: Engine) {
    super(engine);
    this.type = seg(VECTOR_TYPES.map(([id, label]) => ({ id, label })), (id) => { this.o.type = id; this.type.set(id); }, 'cv-seg-small');
    this.opts = new GenOptionsUi(engine, () => this.state.vision, () => this.queue(), 5);
    this.count = seg([{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }], (id) => { this.o.variations = Number(id); this.count.set(id); }, 'cv-seg-small');
    this.grid = tiles(3, 'cv-genp-grid-3');
    this.grid.items.forEach((t, i) => t.b.addEventListener('click', () => { this.picked = i; this.sync(); }));
    this.go.addEventListener('click', () => void this.generate());
    this.place.addEventListener('click', () => this.placePicked());
    const field = (label: string, ctl: HTMLElement): HTMLElement => { const f = el(`<div class="cv-genp-field"><span class="cv-pf-label">${label}</span></div>`); f.appendChild(ctl); return f; };
    this.body.append(this.status, this.target, this.prompt, field('Type', this.type.el), this.opts.el, field('Variations', this.count.el), row(this.go, this.place), this.report, section('Variations'), this.grid.grid);
    this.type.set('subject'); this.count.set('3');
    for (const k of ['selection', 'doc', 'active'] as const) engine.on(k, () => this.queue());
    this.body.addEventListener('pointerenter', () => void this.refresh());
    void this.refresh(true);
  }

  private queue(): void { if (this.frame) return; this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  async generate(): Promise<void> {
    await this.refresh(true);
    if (!this.state.ready) { this.note = this.state.message; this.sync(); return; }
    if (!this.engine.current) { this.note = 'Open a document first.'; this.sync(); return; }
    this.busy = true; this.results = []; this.picked = -1; this.note = `Asking ${this.state.model} for ${this.o.variations} variation${this.o.variations === 1 ? '' : 's'}.`;
    this.sync();
    try {
      this.results = await textToVectorVariations({ ...this.opts.values(), prompt: this.prompt.value, type: this.o.type, detail: this.opts.values().detail ?? 5, variations: this.o.variations });
      const ok = this.results.filter((r) => r.art).length;
      this.picked = this.results.findIndex((r) => r.art);
      this.note = ok ? `${ok} variation${ok === 1 ? '' : 's'} ready. Pick one and Place.` : `The model gave no usable art: ${this.results.find((r) => r.error)?.error ?? 'unknown error'}`;
    } catch (err) { this.note = err instanceof Error ? err.message : String(err); }
    this.busy = false;
    this.sync();
    for (let i = 0; i < this.grid.items.length; i++) { const r = this.results[i], cur = this.engine.current; if (r?.art && cur) await paintPreview(this.grid.items[i].cv, cur, r.art as VNode); }
  }

  private placePicked(): void {
    const r = this.results[this.picked];
    if (!r?.art) return;
    const id = placeVector(this.engine, r.art);
    this.note = id ? 'Placed as editable groups and paths, fitted to the selection or the artboard. Undo removes it.' : 'Nothing to place into; open a document and try again.';
    this.sync();
  }

  protected sync(): void {
    const sel = this.engine.selected()[0];
    setText(this.status, this.note || this.state.message);
    setClass(this.status, 'is-warn', !this.state.ready);
    setText(this.target, sel ? `Places the art inside ${sel.name ?? 'the selected object'}.` : 'Places the art at the centre of the artboard.');
    setDisabled(this.go, this.busy);
    setClass(this.go, 'is-busy', this.busy);
    setDisabled(this.place, this.busy || !this.results[this.picked]?.art);
    this.grid.items.forEach((t, i) => { const r = this.results[i]; setDisabled(t.b, !r?.art); setClass(t.b, 'is-picked', i === this.picked); setClass(t.b, 'is-busy', this.busy); setText(t.note, r?.error ? 'No art' : ''); });
    const pr = this.results[this.picked];
    setText(this.report, pr?.report ? (reportText(pr.report) || 'The SVG needed no repairs.') : this.results.find((r) => r.error)?.error ?? '');
    this.opts.sync();
  }
}

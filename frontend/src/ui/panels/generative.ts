import type { Engine, Project, Rect, VNode } from '../../engine';
import { geomBounds } from '../../engine/bounds';
import { clipToShape, artParts, modelState, PATTERN_LAYOUTS, patternVariations, shapeFillVariations, strengthMode, type ModelState, type PatternLayout, type PatternVariation, type Variation } from '../../io/generative';
import { reportText } from '../../io/gen-repair';
import { GenOptionsUi } from './gen-options';
import { rankFonts, recognize, retypeNode, sourceFromImage, sourceFromOutlines, type FontMatch, type RetypeSource } from '../../io/retype';
import { api } from '../../io/api';
import { renderRegion } from '../../io/raster';
import { el, patchList, q, setClass, setDisabled, setHidden, setText } from '../dom';
import { check, page, row, section, seg, selectCtl, slider } from './kit';

export async function paintPreview(cv: HTMLCanvasElement, p: Project, node: VNode, tile: Rect | null = null): Promise<void> {
  const g = cv.getContext('2d');
  if (!g) return;
  const W = cv.width, H = cv.height;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  const b = tile ?? geomBounds(p.doc, node);
  if (!(b.w > 0 && b.h > 0)) return;
  if (tile) {
    const s = Math.min(W, H) / 2 / tile.w;
    const c = await renderRegion(p, { region: tile, scale: s * 2, transparent: true, only: [node] });
    const pat = g.createPattern(c, 'repeat');
    if (!pat) return;
    pat.setTransform(new DOMMatrix([0.5, 0, 0, 0.5, 0, 0]));
    g.fillStyle = pat;
    g.fillRect(0, 0, W, H);
    return;
  }
  const s = Math.min((W - 8) / b.w, (H - 8) / b.h);
  const c = await renderRegion(p, { region: b, scale: s, transparent: true, only: [node] });
  g.drawImage(c, (W - c.width) / 2, (H - c.height) / 2);
}

export function textArea(label: string, placeholder: string): HTMLTextAreaElement {
  const t = el<HTMLTextAreaElement>('<textarea class="cv-input cv-genp-prompt" rows="3"></textarea>');
  t.setAttribute('aria-label', label);
  t.placeholder = placeholder;
  t.addEventListener('keydown', (e) => e.stopPropagation());
  return t;
}

export function tiles(count: number, cls: string): { grid: HTMLElement; items: Array<{ b: HTMLButtonElement; cv: HTMLCanvasElement; note: HTMLElement }> } {
  const grid = el(`<div class="cv-genp-grid ${cls}"></div>`);
  const items = Array.from({ length: count }, (_, i) => {
    const b = el<HTMLButtonElement>(`<button class="cv-genp-tile" type="button" aria-label="Variation ${i + 1}" disabled><canvas width="160" height="160"></canvas><span class="cv-genp-tile-note"></span></button>`);
    grid.appendChild(b);
    return { b, cv: q<HTMLCanvasElement>(b, 'canvas'), note: q(b, '.cv-genp-tile-note') };
  });
  return { grid, items };
}

export abstract class ModelPanel {
  protected state: ModelState = { ready: false, vision: false, model: '', message: 'Checking the language model.' };
  private checked = 0;
  protected readonly status = el('<p class="cv-patp-status cv-genp-status" role="status"></p>');
  constructor(protected readonly engine: Engine) {}
  protected async refresh(force = false): Promise<void> {
    if (!force && Date.now() - this.checked < 4000) return;
    this.checked = Date.now();
    this.state = await modelState();
    this.sync();
  }
  protected abstract sync(): void;
}

export class ShapeFillPanel extends ModelPanel {
  readonly body = page('cv-genp cv-shapefillp');
  private readonly target = el('<p class="cv-genp-target"></p>');
  private readonly prompt = textArea('Prompt', 'Optional: describe the art, such as tropical leaves and birds');
  private readonly strength;
  private readonly strengthNote = el('<p class="cv-genp-target"></p>');
  private readonly opts;
  private readonly report = el('<p class="cv-genp-note" role="status"></p>');
  private readonly count;
  private readonly go = el<HTMLButtonElement>('<button class="cv-btn cv-btn-primary" type="button">Generate</button>');
  private readonly apply = el<HTMLButtonElement>('<button class="cv-btn" type="button">Apply</button>');
  private readonly grid;
  private o = { strength: 50, variations: 3 };
  private results: Variation[] = [];
  private picked = -1;
  private busy = false;
  private targetId: string | null = null;
  private note = '';
  private frame = 0;

  constructor(engine: Engine) {
    super(engine);
    this.strength = slider(engine, 'Shape Strength', 0, 100, (v) => { this.o.strength = Math.round(v); this.strength.set(this.o.strength); this.queue(); });
    this.opts = new GenOptionsUi(engine, () => this.state.vision, () => this.queue(), 5);
    this.count = seg([{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }], (id) => { this.o.variations = Number(id); this.count.set(id); }, 'cv-seg-small');
    this.grid = tiles(3, 'cv-genp-grid-3');
    this.grid.items.forEach((t, i) => t.b.addEventListener('click', () => { this.picked = i; this.sync(); }));
    this.go.addEventListener('click', () => void this.generate());
    this.apply.addEventListener('click', () => this.applyPicked());
    const countRow = el('<div class="cv-genp-field"><span class="cv-pf-label">Variations</span></div>');
    countRow.appendChild(this.count.el);
    this.body.append(this.status, this.target, this.prompt, this.strength.el, this.strengthNote, this.opts.el, countRow, row(this.go, this.apply), this.report, section('Variations'), this.grid.grid);
    this.strength.set(this.o.strength); this.count.set('3');
    for (const k of ['selection', 'doc', 'active'] as const) engine.on(k, () => this.queue());
    this.body.addEventListener('pointerenter', () => void this.refresh());
    void this.refresh(true);
  }

  private queue(): void { if (this.frame) return; this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private shape(): VNode | null { const n = this.engine.selected().find((x) => (x.kind === 'path' && x.d.some((s) => s.closed)) || x.kind === 'compound'); return n ?? null; }

  async generate(): Promise<void> {
    await this.refresh(true);
    const n = this.shape(), p = this.engine.current;
    if (!this.state.ready) { this.note = this.state.message; this.sync(); return; }
    if (!n || !p) { this.note = 'Select a closed path or compound path to fill.'; this.sync(); return; }
    this.busy = true; this.targetId = n.id; this.results = []; this.picked = -1; this.note = `Asking ${this.state.model} for ${this.o.variations} variation${this.o.variations === 1 ? '' : 's'}.`;
    this.sync();
    const d = n.kind === 'path' ? n.d : n.kind === 'compound' ? n.children.flatMap((c) => c.d) : [];
    const fill = n.ap.items.find((i) => i.kind === 'fill' && i.paint.type === 'color');
    try {
      this.results = await shapeFillVariations({ d, rule: n.kind === 'path' || n.kind === 'compound' ? n.rule : 'nonzero', color: fill && fill.paint.type === 'color' ? fill.paint.color : null }, { ...this.opts.values(), prompt: this.prompt.value, strength: this.o.strength, detail: this.opts.values().detail ?? 5, variations: this.o.variations });
      const ok = this.results.filter((r) => r.art).length;
      this.picked = this.results.findIndex((r) => r.art);
      this.note = ok ? `${ok} variation${ok === 1 ? '' : 's'} ready. Pick one and Apply.` : `The model gave no usable art: ${this.results.find((r) => r.error)?.error ?? 'unknown error'}`;
    } catch (err) { this.note = err instanceof Error ? err.message : String(err); }
    this.busy = false;
    this.sync();
    for (let i = 0; i < this.grid.items.length; i++) { const r = this.results[i], cur = this.engine.current; if (r?.art && cur && n) await paintPreview(this.grid.items[i].cv, cur, clipToShape(r.art, n)); }
  }

  private applyPicked(): void {
    const r = this.results[this.picked];
    if (!r?.art || !this.targetId) return;
    const art = artParts(r.art);
    const id = this.engine.replaceWithClip(this.targetId, art, 'Generative Shape Fill', 'Generative Shape Fill');
    this.note = id ? 'Applied: the art is clipped to the shape and every path stays editable. Release the clipping mask to edit the shape.' : 'The shape is gone; select a shape and generate again.';
    if (id) { this.results = []; this.picked = -1; this.targetId = null; for (const t of this.grid.items) { const g = t.cv.getContext('2d'); g?.clearRect(0, 0, t.cv.width, t.cv.height); } }
    this.sync();
  }

  protected sync(): void {
    const n = this.shape();
    setText(this.status, this.note || this.state.message);
    setClass(this.status, 'is-warn', !this.state.ready);
    setText(this.target, n ? `Fills ${n.name ?? (n.kind === 'compound' ? 'the compound path' : 'the selected path')}.` : 'Select a closed path or compound path to fill.');
    setDisabled(this.go, this.busy || !this.state.ready || !n);
    setClass(this.go, 'is-busy', this.busy);
    setDisabled(this.apply, this.busy || !this.results[this.picked]?.art);
    this.grid.items.forEach((t, i) => { const r = this.results[i]; setDisabled(t.b, !r?.art); setClass(t.b, 'is-picked', i === this.picked); setClass(t.b, 'is-busy', this.busy && i < this.o.variations); setText(t.note, r?.error ? 'No art' : ''); setHidden(t.b, i >= Math.max(this.o.variations, this.results.length)); });
    setText(this.strengthNote, `${strengthMode(this.o.strength)}: ${this.o.strength >= 67 ? 'the model fits the silhouette and the art is then clipped to the shape.' : this.o.strength >= 34 ? 'the model follows the outline loosely and the art is clipped.' : 'the model composes freely and the shape only crops it.'}`);
    const pr = this.results[this.picked];
    setText(this.report, pr?.report ? (reportText(pr.report) || 'The SVG needed no repairs.') : this.results.find((r) => r.error)?.error ?? '');
    this.opts.sync();
  }
}

export class PatternGenPanel extends ModelPanel {
  readonly body = page('cv-genp cv-patgenp');
  private readonly prompt = textArea('Prompt', 'Describe the pattern, such as lemons and leaves on blue');
  private readonly opts;
  private readonly density;
  private readonly tileSize;
  private readonly layout;
  private readonly hSpace;
  private readonly vSpace;
  private readonly seamless;
  private readonly report = el('<p class="cv-genp-note" role="status"></p>');
  private readonly count;
  private readonly fillSel;
  private readonly go = el<HTMLButtonElement>('<button class="cv-btn cv-btn-primary" type="button">Generate</button>');
  private readonly save = el<HTMLButtonElement>('<button class="cv-btn" type="button">Save to Swatches</button>');
  private readonly grid;
  private o = { density: 3, variations: 4, fill: false, tile: 96, layout: 'grid' as PatternLayout, hs: 0, vs: 0, seamless: true };
  private results: PatternVariation[] = [];
  private picked = new Set<number>();
  private busy = false;
  private note = '';
  private frame = 0;

  constructor(engine: Engine) {
    super(engine);
    this.opts = new GenOptionsUi(engine, () => this.state.vision, () => this.queue(), 4);
    this.density = slider(engine, 'Density', 1, 5, (v) => { this.o.density = Math.round(v); this.density.set(this.o.density); });
    this.tileSize = slider(engine, 'Tile Size', 24, 400, (v) => { this.o.tile = Math.round(v); this.tileSize.set(this.o.tile); }, { unit: 'pt' });
    this.layout = selectCtl('Layout', PATTERN_LAYOUTS, (id) => { this.o.layout = id as PatternLayout; this.layout.set(id); });
    this.hSpace = slider(engine, 'H Spacing', -50, 100, (v) => { this.o.hs = Math.round(v); this.hSpace.set(this.o.hs); }, { unit: 'pt' });
    this.vSpace = slider(engine, 'V Spacing', -50, 100, (v) => { this.o.vs = Math.round(v); this.vSpace.set(this.o.vs); }, { unit: 'pt' });
    this.seamless = check('Seamless: repeat art that crosses the tile edge', (v) => { this.o.seamless = v; });
    this.count = seg([{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }, { id: '4', label: '4' }], (id) => { this.o.variations = Number(id); this.count.set(id); }, 'cv-seg-small');
    this.fillSel = check('Fill the selection with the first', (v) => { this.o.fill = v; });
    this.grid = tiles(4, 'cv-genp-grid-4');
    this.grid.items.forEach((t, i) => t.b.addEventListener('click', () => { if (this.picked.has(i)) this.picked.delete(i); else this.picked.add(i); this.sync(); }));
    this.go.addEventListener('click', () => void this.generate());
    this.save.addEventListener('click', () => this.saveSwatches());
    const countRow = el('<div class="cv-genp-field"><span class="cv-pf-label">Variations</span></div>');
    countRow.appendChild(this.count.el);
    this.body.append(this.status, this.prompt, this.opts.el, this.density.el, section('Pattern options'), this.tileSize.el, this.layout.el, this.hSpace.el, this.vSpace.el, row(this.seamless.el), countRow, row(this.fillSel.el), row(this.go, this.save), this.report, section('Variations'), this.grid.grid);
    this.density.set(3); this.tileSize.set(96); this.layout.set('grid'); this.hSpace.set(0); this.vSpace.set(0); this.seamless.set(true); this.count.set('4'); this.fillSel.set(false);
    for (const k of ['selection', 'doc', 'active'] as const) engine.on(k, () => this.queue());
    this.body.addEventListener('pointerenter', () => void this.refresh());
    void this.refresh(true);
  }

  private queue(): void { if (this.frame) return; this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  async generate(): Promise<void> {
    await this.refresh(true);
    if (!this.state.ready) { this.note = this.state.message; this.sync(); return; }
    if (!this.engine.current) { this.note = 'Open a document first.'; this.sync(); return; }
    this.busy = true; this.results = []; this.picked.clear(); this.note = `Asking ${this.state.model} for ${this.o.variations} pattern${this.o.variations === 1 ? '' : 's'}.`;
    this.sync();
    try {
      this.results = await patternVariations({ ...this.opts.values(), prompt: this.prompt.value, colors: [], density: this.o.density, variations: this.o.variations, tile: this.o.tile, seamless: this.o.seamless, layout: this.o.layout, hs: this.o.hs, vs: this.o.vs, project: this.engine.current });
      this.results.forEach((r, i) => { if (r.art) this.picked.add(i); });
      const ok = this.picked.size;
      this.note = ok ? `${ok} pattern${ok === 1 ? '' : 's'} ready. Click a tile to leave it out, then Save to Swatches.` : `The model gave no usable tile: ${this.results.find((r) => r.error)?.error ?? 'unknown error'}`;
    } catch (err) { this.note = err instanceof Error ? err.message : String(err); }
    this.busy = false;
    this.sync();
    for (let i = 0; i < this.grid.items.length; i++) { const r = this.results[i], cur = this.engine.current; if (r?.art && cur) await paintPreview(this.grid.items[i].cv, cur, r.art, r.tile); }
  }

  private saveSwatches(): void {
    const base = (this.prompt.value.trim() || 'Generated Pattern').replace(/\s+/g, ' ').slice(0, 32);
    const list = [...this.picked].sort().flatMap((i, k) => { const r = this.results[i]; return r?.art ? [{ name: `${base} ${k + 1}`, tile: r.tile, art: r.art, type: r.layout?.type, hs: r.layout?.hs, vs: r.layout?.vs }] : []; });
    const fillIds = this.o.fill ? this.engine.selectedIds() : [];
    const ids = this.engine.addPatternSwatches(list, fillIds);
    this.note = ids.length ? `Saved ${ids.length} pattern swatch${ids.length === 1 ? '' : 'es'}${fillIds.length ? ' and filled the selection' : ''}. Double-click a pattern swatch to edit its tile.` : 'Nothing to save.';
    if (ids.length) this.picked.clear();
    this.sync();
  }

  protected sync(): void {
    setText(this.status, this.note || this.state.message);
    setClass(this.status, 'is-warn', !this.state.ready);
    this.opts.sync();
    setDisabled(this.go, this.busy || !this.state.ready);
    setClass(this.go, 'is-busy', this.busy);
    setDisabled(this.save, this.busy || ![...this.picked].some((i) => this.results[i]?.art));
    this.grid.items.forEach((t, i) => { const r = this.results[i]; setDisabled(t.b, !r?.art); setClass(t.b, 'is-picked', this.picked.has(i)); setClass(t.b, 'is-busy', this.busy && i < this.o.variations); setText(t.note, r?.error ? 'No tile' : ''); });
    const last = [...this.picked].sort().map((i) => this.results[i]).find((r) => r?.report) ?? this.results.find((r) => r.report);
    setText(this.report, last?.report ? (reportText(last.report) || 'The SVG needed no repairs.') : this.results.find((r) => r.error)?.error ?? '');
  }
}

export class RetypePanel extends ModelPanel {
  readonly body = page('cv-genp cv-retypep');
  private readonly source = el('<p class="cv-genp-target"></p>');
  private readonly text = el<HTMLInputElement>('<input class="cv-input" type="text" spellcheck="false" aria-label="Text" placeholder="The text, if you know it (optional)">');
  private readonly keep;
  private readonly go = el<HTMLButtonElement>('<button class="cv-btn cv-btn-primary" type="button">Find Fonts</button>');
  private readonly apply = el<HTMLButtonElement>('<button class="cv-btn" type="button">Apply</button>');
  private readonly read = el('<p class="cv-genp-read"></p>');
  private readonly list = el('<div class="cv-retypep-list" role="listbox" aria-label="Matching fonts"></div>');
  private matches: FontMatch[] = [];
  private found = '';
  private src: RetypeSource | null = null;
  private picked = -1;
  private busy = false;
  private progress = '';
  private note = '';
  private keepImage = true;
  private frame = 0;
  private abort: AbortController | null = null;

  constructor(engine: Engine, private readonly ensureFace: (family: string, style: string) => Promise<void>) {
    super(engine);
    this.keep = check('Keep the image under the live text', (v) => { this.keepImage = v; });
    this.text.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') void this.find(); });
    this.go.addEventListener('click', () => void this.find());
    this.apply.addEventListener('click', () => void this.applyPicked());
    this.list.addEventListener('click', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-retypep-row'); if (r?.dataset.key) { this.picked = this.matches.findIndex((m) => `${m.family}|${m.style}` === r.dataset.key); this.sync(); } });
    this.list.addEventListener('dblclick', (e) => { if ((e.target as HTMLElement).closest('.cv-retypep-row')) void this.applyPicked(); });
    this.body.append(this.status, this.source, this.text, row(this.keep.el), row(this.go, this.apply), this.read, section('Matching fonts'), this.list);
    this.keep.set(true);
    for (const k of ['selection', 'doc', 'active'] as const) engine.on(k, () => this.queue());
    this.body.addEventListener('pointerenter', () => void this.refresh());
    void this.refresh(true);
  }

  private queue(): void { if (this.frame) return; this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private pick(): { kind: 'image' | 'outlines'; nodes: VNode[]; region: Rect | null } | null {
    const sel = this.engine.selected(), doc = this.engine.doc;
    const img = sel.find((n) => n.kind === 'image');
    if (img && doc) { const rect = sel.find((n) => n.kind === 'path'); return { kind: 'image', nodes: [img], region: rect ? geomBounds(doc, rect) : null }; }
    const outl = sel.filter((n) => n.kind === 'path' || n.kind === 'compound' || (n.kind === 'group' && !n.clip));
    return outl.length ? { kind: 'outlines', nodes: outl, region: null } : null;
  }

  async find(): Promise<void> {
    const p = this.engine.current, s = this.pick();
    await this.refresh(true);
    if (!p || !s) { this.note = 'Select outlined type, or a placed image (add a rectangle over it to choose the region).'; this.sync(); return; }
    this.abort?.abort();
    const ctl = new AbortController();
    this.abort = ctl;
    this.busy = true; this.matches = []; this.picked = -1; this.found = ''; this.note = 'Reading the letter shapes.'; this.progress = '';
    this.sync();
    try {
      const src = s.kind === 'image' ? await sourceFromImage(p, s.nodes[0], s.region) : await sourceFromOutlines(p, s.nodes);
      this.src = src;
      let known: { text: string; description: string } | null = this.text.value.trim() ? { text: this.text.value.trim(), description: '' } : null;
      if (!known && this.state.ready && this.state.vision) {
        this.note = `Asking ${this.state.model} to read the text.`; this.sync();
        try { known = await recognize(src, async (prompt, image) => (await api.llmGenerate('', prompt, { image, temperature: 0, maxTokens: 400 })).text); } catch (err) { this.note = `The model could not read it (${err instanceof Error ? err.message : String(err)}); matching shapes instead.`; }
      }
      if (!known && src.kind === 'image') throw new Error(this.state.ready && this.state.vision ? 'The model could not read text in the image. Type the text above and try again.' : 'Reading text in an image needs a model that reads images (Preferences > Plugins). Type the text above instead, and Retype matches its shapes.');
      const r = await rankFonts(src, known, (done, total) => { const pc = Math.round((done / Math.max(1, total)) * 100); if (`${pc}` !== this.progress) { this.progress = `${pc}`; this.note = `Comparing installed fonts: ${pc}%.`; this.queue(); } }, ctl.signal);
      if (ctl.signal.aborted) return;
      this.matches = r.matches; this.found = r.text; this.picked = r.matches.length ? 0 : -1;
      this.note = r.matches.length ? `Best match: ${r.matches[0].family} ${r.matches[0].style}. Pick a font and Apply to make live text.` : 'No installed font matched.';
      if (!this.text.value.trim()) this.text.value = r.text.split('\n')[0];
    } catch (err) { if (!(err instanceof DOMException && err.name === 'AbortError')) this.note = err instanceof Error ? err.message : String(err); }
    if (this.abort === ctl) { this.busy = false; this.abort = null; }
    this.sync();
  }

  private async applyPicked(): Promise<void> {
    const m = this.matches[this.picked], src = this.src;
    if (!m || !src) return;
    const text = this.text.value.trim() && !this.found.includes('\n') ? this.text.value.trim() : this.found;
    await this.ensureFace(m.family, m.style);
    const node = await retypeNode(src, m, text);
    const id = this.engine.replaceWithText(src.ids, node, src.kind === 'image' && this.keepImage);
    this.note = id ? `Set as live ${m.family} ${m.style}.` : 'The source is gone; select it again.';
    if (id) { this.matches = []; this.src = null; this.picked = -1; }
    this.sync();
  }

  private row(m: FontMatch): HTMLElement {
    const r = el('<button class="cv-retypep-row" type="button" role="option"><span class="cv-retypep-name"></span><span class="cv-retypep-score"></span></button>');
    r.dataset.key = `${m.family}|${m.style}`;
    this.fill(r, m);
    return r;
  }
  private fill(r: HTMLElement, m: FontMatch): void {
    setText(q(r, '.cv-retypep-name'), `${m.family} ${m.style}`);
    setText(q(r, '.cv-retypep-score'), `${Math.round(m.score * 100)}%`);
    setClass(r, 'is-picked', this.matches[this.picked] === m);
    r.setAttribute('aria-selected', String(this.matches[this.picked] === m));
  }

  protected sync(): void {
    const s = this.pick();
    setText(this.status, this.note || (this.state.ready ? (this.state.vision ? `${this.state.message} It reads the text, then installed fonts are compared by shape.` : `${this.state.message} It does not read images, so Retype matches outlined type by shape; for images, type the text.`) : `${this.state.message} Without one, Retype still matches outlined type by shape.`));
    setText(this.source, s ? (s.kind === 'image' ? `Reads ${s.region ? 'the marked region of ' : ''}the selected image.` : `Reads ${s.nodes.length} outlined object${s.nodes.length === 1 ? '' : 's'}.`) : 'Select outlined type or a placed image.');
    setHidden(this.keep.el, s?.kind !== 'image');
    setDisabled(this.go, this.busy || !s);
    setClass(this.go, 'is-busy', this.busy);
    setDisabled(this.apply, this.busy || !this.matches[this.picked]);
    setText(this.read, this.found ? `Read: ${this.found.replace(/\n/g, ' / ')}` : '');
    patchList(this.list, this.matches, { key: (m) => `${m.family}|${m.style}`, create: (m) => this.row(m), update: (n, m) => this.fill(n, m) });
  }
}

import { findNode } from '../../engine/doc';
import { HARMONY_RULES, harmonyColors, type HarmonyRule } from '../../engine/harmony';
import { collectColors, fitRowsToPalette, oklab, recolorDoc, reduceRows, rowReference, rowsFn, samplePalette, type RecolorRow } from '../../engine/ops/recolor';
import { cssColor, hex, hsbToRgb, rgb, rgbToHsb, toCmyk, toRgb } from '../../engine/paint';
import { libraryColors, SWATCH_LIBRARIES, type SwatchLibrary } from '../../engine/swatch-libraries';
import type { Color, Doc, Engine, Pt, VNode } from '../../engine';
import { generativePalettes, modelState, RECOLOR_SAMPLES } from '../../io/generative';
import { Dialog } from '../dialogs';
import { el, patchList, q, setClass, setDisabled, setHidden, setStyleVar, setText, setTitle } from '../dom';
import { icon } from '../icons';
import { selectCtl, seg } from './kit';

interface Row extends RecolorRow { id: number }
const val = (n: HTMLElement): string => q<HTMLSelectElement>(n, 'select').value;
const SIZE = 240, R = 108;
const hsbOf = (c: Color): [number, number, number] => { const v = toRgb(c); return rgbToHsb(v.r, v.g, v.b); };
const fromHsb = (h: number, s: number, b: number, like: Color): Color => { const v = hsbToRgb(((h % 360) + 360) % 360, Math.max(0, Math.min(100, s)), Math.max(0, Math.min(100, b))), c = rgb(v.r, v.g, v.b); return like.kind === 'cmyk' ? toCmyk(c) : c; };

export interface RecolorDeps { pickColor(c: Color, live?: (c: Color) => void): Promise<Color | null>; stagePoint(x: number, y: number): Pt | null; userLibraries(): SwatchLibrary[]; generative(): boolean }

export class RecolorDialog extends Dialog {
  private readonly wheel = el<HTMLCanvasElement>(`<canvas class="cv-rc-wheel" width="${SIZE * 2}" height="${SIZE * 2}" aria-label="Color wheel: drag a marker to change hue and saturation"></canvas>`);
  private readonly list = el('<div class="cv-rc-list" role="listbox" aria-label="Current colors and their new colors"></div>');
  private readonly bright = el<HTMLInputElement>('<input type="range" min="0" max="100" step="1" aria-label="Brightness">');
  private readonly brightOut = el('<span class="cv-rc-num"></span>');
  private readonly linkBtn: HTMLButtonElement;
  private readonly mergeBtn: HTMLButtonElement;
  private readonly sepBtn: HTMLButtonElement;
  private readonly status = el('<p class="cv-note cv-rc-status"></p>');
  private readonly pickBtn: HTMLButtonElement;
  private readonly mode;
  private readonly preset;
  private readonly rule;
  private readonly count;
  private readonly lib;
  private readonly shape;
  private readonly gen = el('<div class="cv-rc-gen"></div>');
  private readonly genPrompt = el<HTMLInputElement>('<input class="cv-input cv-rc-gen-prompt" type="text" spellcheck="false" aria-label="AI Recolor prompt" placeholder="Describe the mood, such as sunset over the ocean">');
  private readonly genGo = el<HTMLButtonElement>('<button class="cv-btn cv-btn-primary" type="button">Generate</button>');
  private readonly genNote = el('<p class="cv-note cv-rc-gen-note" role="status"></p>');
  private readonly genStrips: HTMLButtonElement[] = [];
  private genPalettes: Color[][] = [];
  private genBusy = false;
  private genMessage = '';
  private rows: Row[] = [];
  private start: Row[] = [];
  private colors: Color[] = [];
  private ids: string[] = [];
  private nextId = 1;
  private base = 0;
  private active = 0;
  private sel = new Set<number>();
  private linked = true;
  private preserve = false;
  private segmented = false;
  private frame = 0;
  private settled = true;
  private resolve: ((ok: boolean) => void) | null = null;
  private wheelKey = '';
  private picking = false;

  constructor(private readonly engine: Engine, private readonly deps: RecolorDeps) {
    super('Recolor Art', 820);
    this.scrim.classList.add('cv-scrim-through', 'cv-rc-scrim');
    q(this.scrim, '.cv-dialog').classList.add('cv-rc-dialog');
    const left = el('<div class="cv-rc-left"></div>'), right = el('<div class="cv-rc-right"></div>');
    this.shape = seg([{ id: 'smooth', label: 'Smooth' }, { id: 'segmented', label: 'Segmented' }], (id) => { this.segmented = id === 'segmented'; this.shape.set(id); this.wheelKey = ''; this.queue(false); }, 'cv-seg-small');
    this.shape.set('smooth');
    const bRow = el('<label class="cv-rc-bright"><span>Brightness</span></label>');
    bRow.append(this.bright, this.brightOut);
    this.bright.addEventListener('input', () => this.setBrightness(Number(this.bright.value)));
    const tools = el('<div class="cv-rc-tools"></div>');
    const tb = (name: string, label: string, run: () => void): HTMLButtonElement => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', run); tools.appendChild(b); return b; };
    this.linkBtn = tb('link', 'Link harmony colors: dragging one marker turns them all', () => { this.linked = !this.linked; this.queue(false); });
    this.linkBtn.innerHTML = `<span class="cv-rc-ico-on">${icon('link', 16)}</span><span class="cv-rc-ico-off" hidden>${icon('unlink', 16)}</span>`;
    tb('refresh', 'Randomly change color order', () => this.randomOrder());
    tb('dice', 'Randomly change saturation and brightness', () => this.randomSB());
    this.pickBtn = tb('eyeDropper', 'Color Theme Picker: click an image or object on the canvas to take its colors', () => this.togglePick());
    left.append(this.wheel, this.shape.el, bRow, tools);
    this.preset = selectCtl('Preset', [['custom', 'Custom'], ['one', '1 color job'], ['two', '2 color job'], ['harmony', 'Color harmony']], (v) => this.applyPreset(v));
    this.rule = selectCtl('Harmony', HARMONY_RULES, () => { this.preset.set('harmony'); this.applyPreset('harmony'); });
    this.count = selectCtl('Colors', [['auto', 'Auto'], ...Array.from({ length: 12 }, (_, i) => [String(i + 1), String(i + 1)] as const)], (v) => this.reduce(v === 'auto' ? 0 : Number(v)));
    this.lib = selectCtl('Library', [['', 'None']], (v) => this.applyLibrary(v));
    this.mode = selectCtl('Recolor', [['exact', 'Exact'], ['tints', 'Preserve tints and shades']], (v) => { this.preserve = v === 'tints'; this.queue(true); });
    const actions = el('<div class="cv-rc-actions"></div>');
    const ab = (label: string, title: string, run: () => void): HTMLButtonElement => { const b = el<HTMLButtonElement>(`<button class="cv-btn" type="button" title="${title}"></button>`); setText(b, label); b.addEventListener('click', run); actions.appendChild(b); return b; };
    this.mergeBtn = ab('Merge', 'Merge the selected rows (Shift or Mod click rows) into one new color', () => this.merge());
    this.sepBtn = ab('Separate', 'Separate the selected row into one row per current color', () => this.separate());
    ab('Reset', 'Back to the artwork’s colors', () => { this.rows = this.start.map((r) => ({ ...r, from: [...r.from] })); this.base = 0; this.active = 0; this.sel.clear(); this.count.set('auto'); this.preset.set('custom'); this.lib.set(''); this.queue(true); });
    const head = el('<div class="cv-rc-headrow"><span>Current colors</span><span></span><span>New</span></div>');
    const samples = el('<div class="cv-rc-gen-samples"></div>'), strips = el('<div class="cv-rc-gen-strips"></div>');
    for (const s of RECOLOR_SAMPLES) { const b = el<HTMLButtonElement>('<button class="cv-rc-sample" type="button"></button>'); setText(b, s); b.addEventListener('click', () => { this.genPrompt.value = s; void this.generatePalettes(); }); samples.appendChild(b); }
    for (let i = 0; i < 4; i++) {
      const b = el<HTMLButtonElement>(`<button class="cv-rc-pal" type="button" disabled aria-label="Palette ${i + 1}"></button>`);
      for (let k = 0; k < 8; k++) b.appendChild(el('<span class="cv-rc-pal-sw is-empty"></span>'));
      b.addEventListener('click', () => this.applyGenerated(i));
      this.genStrips.push(b); strips.appendChild(b);
    }
    this.genPrompt.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') void this.generatePalettes(); });
    this.genGo.addEventListener('click', () => void this.generatePalettes());
    const genRow = el('<div class="cv-rc-gen-row"></div>');
    genRow.append(this.genPrompt, this.genGo);
    this.gen.append(el('<span class="cv-pf-label">AI Recolor</span>'), genRow, samples, strips, this.genNote);
    right.append(this.preset.el, this.rule.el, this.count.el, this.lib.el, this.mode.el, this.gen, actions, head, this.list, this.status);
    const grid = el('<div class="cv-rc"></div>');
    grid.append(left, right);
    this.body.appendChild(grid);
    this.button('Cancel', '', () => this.close());
    this.button('OK', 'primary', () => this.finish());
    this.bindWheel();
    this.bindList();
    this.onClose = () => {
      this.stopPick();
      cancelAnimationFrame(this.frame); this.frame = 0;
      if (!this.settled) { this.settled = true; if (this.engine.dragging) this.engine.cancelDrag(); const r = this.resolve; this.resolve = null; r?.(false); }
    };
  }

  private async generatePalettes(): Promise<void> {
    const st = await modelState();
    if (!st.ready) { this.genMessage = st.message; this.queue(false); return; }
    if (this.genBusy) return;
    this.genBusy = true; this.genPalettes = []; this.genMessage = `Asking ${st.model} for palettes.`;
    this.queue(false);
    try {
      this.genPalettes = await generativePalettes(this.genPrompt.value, 4);
      this.genMessage = `${this.genPalettes.length} palette${this.genPalettes.length === 1 ? '' : 's'} ready. Click one to recolor the artwork.`;
    } catch (err) { this.genMessage = err instanceof Error ? err.message : String(err); }
    this.genBusy = false;
    this.queue(false);
  }

  private applyGenerated(i: number): void {
    const pal = this.genPalettes[i];
    if (!pal || this.settled) return;
    this.rows = this.withIds(fitRowsToPalette(this.rows.map((r) => ({ ...r, to: r.from[0] })), pal));
    this.active = 0; this.base = 0; this.sel.clear(); this.preserve = true; this.mode.set('tints'); this.preset.set('custom');
    this.genMessage = `Applied palette ${i + 1}. OK keeps it, Cancel restores the artwork.`;
    this.queue(true);
  }

  run(opts: { colors?: number; group?: string; generative?: boolean } = {}): Promise<boolean> {
    if (!this.settled) return Promise.resolve(false);
    const e = this.engine, p = e.current;
    if (!p) return Promise.resolve(false);
    this.ids = e.targetIds();
    const nodes = this.ids.map((id) => findNode(p.doc, id)).filter((n): n is VNode => !!n);
    this.colors = collectColors(nodes);
    if (!this.colors.length) { e.notice('The selection has no colours to recolour.'); return Promise.resolve(false); }
    this.rows = this.colors.map((c) => ({ id: this.nextId++, from: [c], to: c, on: true }));
    this.start = this.rows.map((r) => ({ ...r, from: [...r.from] }));
    this.base = 0; this.active = 0; this.sel.clear(); this.preserve = false; this.linked = true;
    this.mode.set('exact'); this.preset.set('custom'); this.count.set('auto');
    this.lib.setChoices(this.libraryChoices());
    this.lib.set('');
    e.beginDrag('Recolor Art');
    this.settled = false;
    this.genPalettes = []; this.genMessage = '';
    setHidden(this.gen, !this.deps.generative());
    if (opts.generative && this.deps.generative()) window.setTimeout(() => this.genPrompt.focus(), 60);
    if (opts.colors) { this.count.set(String(opts.colors)); this.reduce(opts.colors); }
    if (opts.group) { this.lib.set(opts.group); this.applyLibrary(opts.group); }
    this.queue(true);
    return new Promise((res) => { this.resolve = res; this.open(); });
  }

  private libraryChoices(): Array<readonly [string, string]> {
    const out: Array<readonly [string, string]> = [['', 'None']];
    for (const g of this.engine.swatchGroups()) out.push([`doc:${g}`, `Document · ${g}`]);
    out.push(['doc:', 'Document swatches']);
    for (const l of [...SWATCH_LIBRARIES, ...this.deps.userLibraries()]) {
      if (!libraryColors(l).length) continue;
      out.push([`lib:${l.id}`, `${l.user ? 'User Defined' : l.folder ?? 'Library'} · ${l.name}`]);
      if (l.groups.length > 1) for (const g of l.groups) out.push([`lib:${l.id}:${g.name}`, `${l.name} · ${g.name}`]);
    }
    return out;
  }

  private palette(key: string): Color[] {
    const doc = this.engine.dragOrigin as Doc | null;
    if (key.startsWith('doc:')) { const g = key.slice(4); return (doc?.swatches ?? []).filter((s) => (g ? s.group === g : !s.name.startsWith('[')) && s.paint.type === 'color').map((s) => (s.paint as { color: Color }).color); }
    if (key.startsWith('lib:')) {
      const [, id, ...rest] = key.split(':'), g = rest.join(':');
      const l = [...SWATCH_LIBRARIES, ...this.deps.userLibraries()].find((x) => x.id === id);
      return l ? libraryColors(l, g || undefined) : [];
    }
    return [];
  }

  private applyLibrary(key: string): void {
    const pal = this.palette(key);
    if (!key) return;
    if (!pal.length) { this.engine.notice('That color group has no solid colors.'); return; }
    this.rows = this.withIds(fitRowsToPalette(this.rows, pal));
    this.active = 0; this.base = 0; this.sel.clear();
    this.queue(true);
  }

  private withIds(rows: RecolorRow[]): Row[] { return rows.map((r) => ({ ...r, id: this.nextId++ })); }

  private reduce(n: number): void {
    if (!n) { this.rows = this.start.map((r) => ({ ...r, from: [...r.from] })); }
    else { this.rows = this.withIds(reduceRows(this.colors, n)); this.preserve = true; this.mode.set('tints'); }
    this.active = 0; this.base = 0; this.sel.clear();
    this.queue(true);
  }

  private applyPreset(v: string): void {
    if (v === 'one' || v === 'two') {
      this.rows = this.withIds(reduceRows(this.colors, v === 'one' ? 1 : 2));
      const lk = val(this.lib.el), pal = lk ? this.palette(lk) : [];
      if (v === 'one') { const r = this.rows[0]; if (r) r.to = pal[0] ?? rowReference(this.colors); }
      else if (this.rows.length > 1) { this.rows[0].to = pal[0] ?? rgb(0, 0, 0); if (pal[1]) this.rows[1].to = pal[1]; }
      this.preserve = true; this.mode.set('tints'); this.count.set(String(this.rows.length));
    } else if (v === 'harmony') {
      if (this.rows.length > 5) this.rows = this.withIds(reduceRows(this.colors, 5));
      const b = this.rows[this.base] ?? this.rows[0];
      if (b) this.rows = this.withIds(fitRowsToPalette(this.rows, harmonyColors(b.to, (val(this.rule.el) || 'complementary') as HarmonyRule)));
    }
    this.active = 0; this.sel.clear();
    this.queue(true);
  }

  private randomOrder(): void {
    const on = this.rows.filter((r) => r.on), tos = on.map((r) => r.to);
    for (let i = tos.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tos[i], tos[j]] = [tos[j], tos[i]]; }
    on.forEach((r, i) => { r.to = tos[i]; });
    this.queue(true);
  }

  private randomSB(): void {
    for (const r of this.rows) { if (!r.on) continue; const [h, s, b] = hsbOf(r.to); r.to = fromHsb(h, s + (Math.random() * 2 - 1) * 30, b + (Math.random() * 2 - 1) * 30, r.to); }
    this.queue(true);
  }

  private merge(): void {
    const pick = [...this.sel].filter((i) => this.rows[i]).sort((a, b) => a - b);
    if (pick.length < 2) { setText(this.status, 'Shift or Mod click two or more rows, then Merge.'); return; }
    const keep = this.rows[pick[0]], from = pick.flatMap((i) => this.rows[i].from);
    this.rows = this.rows.filter((_, i) => !pick.includes(i) || i === pick[0]).map((r) => (r === keep ? { ...r, from } : r));
    this.active = this.rows.indexOf(this.rows.find((r) => r.id === keep.id) as Row);
    this.sel.clear();
    this.queue(true);
  }

  private separate(): void {
    const i = this.sel.size === 1 ? [...this.sel][0] : this.active, r = this.rows[i];
    if (!r || r.from.length < 2) { setText(this.status, 'Pick a row holding several current colors to separate it.'); return; }
    this.rows.splice(i, 1, ...r.from.map((c) => ({ id: this.nextId++, from: [c], to: c, on: r.on })));
    this.sel.clear();
    this.queue(true);
  }

  private setBrightness(v: number): void {
    const r = this.rows[this.active];
    if (!r) return;
    const [, , b0] = hsbOf(r.to), d = v - b0;
    for (const x of this.linked ? this.rows : [r]) { const [h, s, b] = hsbOf(x.to); x.to = fromHsb(h, s, x === r ? v : b + d, x.to); }
    this.queue(true);
  }

  private togglePick(): void { if (this.picking) this.stopPick(); else this.startPick(); }
  private readonly onPick = (ev: PointerEvent): void => {
    if (!this.picking || (ev.target as HTMLElement).closest('.cv-dialog')) return;
    const at = this.deps.stagePoint(ev.clientX, ev.clientY);
    ev.preventDefault(); ev.stopPropagation();
    this.stopPick();
    if (!at) return;
    const hit = this.engine.hit(at, 4), doc = this.engine.dragOrigin as Doc | null, n = hit && doc ? findNode(doc, hit.id) : null;
    if (!n) { setText(this.status, 'Nothing there to take colors from.'); return; }
    void this.themeFrom(n);
  };
  private readonly onPickKey = (ev: KeyboardEvent): void => { if (ev.key === 'Escape' && this.picking) { ev.stopPropagation(); this.stopPick(); } };
  private startPick(): void {
    this.picking = true;
    setClass(this.pickBtn, 'is-on', true);
    setClass(this.scrim, 'is-picking', true);
    setText(this.status, 'Click an image or object on the canvas to take its color theme. Escape cancels.');
    window.addEventListener('pointerdown', this.onPick, true);
    window.addEventListener('keydown', this.onPickKey, true);
  }
  private stopPick(): void {
    if (!this.picking) return;
    this.picking = false;
    setClass(this.pickBtn, 'is-on', false);
    setClass(this.scrim, 'is-picking', false);
    window.removeEventListener('pointerdown', this.onPick, true);
    window.removeEventListener('keydown', this.onPickKey, true);
  }

  private async themeFrom(n: VNode): Promise<void> {
    const want = Math.max(1, Math.min(8, this.rows.length));
    let pal: Color[] = [];
    if (n.kind === 'image') {
      const blob = this.engine.current?.assets.get(n.src);
      if (blob) {
        const bmp = await createImageBitmap(blob), c = document.createElement('canvas'), w = Math.max(1, Math.min(96, bmp.width)), h = Math.max(1, Math.round((bmp.height / bmp.width) * w));
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        if (g) { g.drawImage(bmp, 0, 0, w, h); pal = samplePalette(g.getImageData(0, 0, w, h).data, Math.max(want, 5)); }
        bmp.close();
      }
    } else pal = collectColors([n]);
    if (!pal.length) { setText(this.status, 'That object has no colors to take.'); return; }
    this.rows = this.withIds(fitRowsToPalette(this.rows, pal.slice(0, Math.max(want, 1))));
    this.queue(true);
    this.note = `Took ${Math.min(pal.length, want)} colors from ${n.name ?? (n.kind === 'image' ? 'the image' : 'the object')}.`;
  }

  private finish(): void {
    if (this.settled) return;
    this.stopPick();
    this.preview();
    this.settled = true;
    this.engine.commitDrag();
    const r = this.resolve; this.resolve = null;
    this.close();
    r?.(true);
  }

  private queue(art: boolean): void {
    if (art) this.dirtyArt = true;
    if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; if (this.dirtyArt) { this.dirtyArt = false; this.preview(); } this.sync(); });
  }
  private dirtyArt = false;
  private note = '';

  private preview(): void {
    const origin = this.engine.dragOrigin as Doc | null;
    if (!origin || this.settled) return;
    this.engine.dragTo(recolorDoc(origin, this.ids, rowsFn(this.rows, this.preserve)));
  }

  private pos(c: Color): Pt { const [h, s] = hsbOf(c), a = (h * Math.PI) / 180, r = (s / 100) * R; return { x: SIZE / 2 + Math.cos(a) * r, y: SIZE / 2 - Math.sin(a) * r }; }

  private bindWheel(): void {
    let drag: { i: number; h0: number; s0: number; tos: Color[] } | null = null;
    const local = (ev: PointerEvent): Pt => { const r = this.wheel.getBoundingClientRect(); return { x: ((ev.clientX - r.left) / r.width) * SIZE, y: ((ev.clientY - r.top) / r.height) * SIZE }; };
    this.wheel.addEventListener('pointerdown', (ev) => {
      const p = local(ev);
      let best = -1, bd = 12 * 12;
      this.rows.forEach((r, i) => { if (!r.on) return; const q2 = this.pos(r.to), d = (q2.x - p.x) ** 2 + (q2.y - p.y) ** 2; if (d < bd || (i === this.base && d < bd * 1.6)) { bd = d; best = i; } });
      if (best < 0) return;
      this.wheel.setPointerCapture(ev.pointerId);
      const [h0, s0] = hsbOf(this.rows[best].to);
      drag = { i: best, h0, s0, tos: this.rows.map((r) => r.to) };
      this.active = best;
      this.queue(false);
    });
    this.wheel.addEventListener('pointermove', (ev) => {
      if (!drag || !this.wheel.hasPointerCapture(ev.pointerId)) return;
      const p = local(ev), dx = p.x - SIZE / 2, dy = SIZE / 2 - p.y;
      const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360, s = Math.min(100, (Math.hypot(dx, dy) / R) * 100);
      const dh = h - drag.h0, ks = drag.s0 > 0.5 ? s / drag.s0 : 1;
      this.rows.forEach((r, i) => {
        if (i !== drag?.i && !this.linked) return;
        const [hh, ss, bb] = hsbOf(drag?.tos[i] ?? r.to);
        r.to = i === drag?.i ? fromHsb(h, s, bb, r.to) : fromHsb(hh + dh, drag && drag.s0 > 0.5 ? ss * ks : ss, bb, r.to);
      });
      this.queue(true);
    });
    const up = (): void => { drag = null; };
    this.wheel.addEventListener('pointerup', up);
    this.wheel.addEventListener('pointercancel', up);
  }

  private bindList(): void {
    this.list.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement, row = t.closest<HTMLElement>('.cv-rc-row');
      if (!row) return;
      const i = this.rows.findIndex((r) => String(r.id) === row.dataset.key);
      if (i < 0) return;
      if (t.closest('.cv-rc-on')) { this.rows[i].on = !this.rows[i].on; this.queue(true); return; }
      if (t.closest('.cv-rc-base')) { this.base = i; this.active = i; this.queue(false); return; }
      if (t.closest('.cv-rc-to')) { this.active = i; void this.editTo(i); return; }
      if (ev.shiftKey || ev.metaKey || ev.ctrlKey) { if (this.sel.has(i)) this.sel.delete(i); else this.sel.add(i); }
      else { this.sel = new Set([i]); }
      this.active = i;
      this.queue(false);
    });
  }

  private async editTo(i: number): Promise<void> {
    const r = this.rows[i];
    if (!r) return;
    const before = r.to;
    const c = await this.deps.pickColor(before, (live) => { r.to = live; this.queue(true); });
    r.to = c ?? before;
    this.queue(true);
  }

  private drawWheel(): void {
    const g = this.wheel.getContext('2d');
    if (!g) return;
    const act = this.rows[this.active], bv = act ? hsbOf(act.to)[2] : 100, key = `${this.segmented}|${Math.round(bv)}`;
    if (key !== this.wheelKey) {
      this.wheelKey = key;
      const S2 = SIZE * 2, c = S2 / 2, rad = R * 2;
      g.clearRect(0, 0, S2, S2);
      if (this.segmented) {
        const H = 12, RINGS = 4;
        for (let k = 0; k < RINGS; k++) for (let j = 0; j < H; j++) {
          const r0 = (k / RINGS) * rad, r1 = ((k + 1) / RINGS) * rad, a0 = -((j - 0.5) / H) * Math.PI * 2, a1 = -((j + 0.5) / H) * Math.PI * 2;
          const v = hsbToRgb((j / H) * 360, ((k + 1) / RINGS) * 100, bv);
          g.beginPath(); g.arc(c, c, r1, a0, a1, true); g.arc(c, c, r0, a1, a0, false); g.closePath();
          g.fillStyle = `rgb(${v.r},${v.g},${v.b})`; g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.stroke();
        }
      } else {
        const img = g.createImageData(S2, S2), d = img.data;
        for (let y = 0; y < S2; y++) for (let x = 0; x < S2; x++) {
          const dx = x - c, dy = c - y, rr = Math.hypot(dx, dy);
          if (rr > rad + 1) continue;
          const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360, v = hsbToRgb(h, Math.min(100, (rr / rad) * 100), bv), o = (y * S2 + x) * 4;
          d[o] = v.r; d[o + 1] = v.g; d[o + 2] = v.b; d[o + 3] = rr > rad ? Math.round((rad + 1 - rr) * 255) : 255;
        }
        g.putImageData(img, 0, 0);
      }
      this.wheelBase = g.getImageData(0, 0, SIZE * 2, SIZE * 2);
    } else if (this.wheelBase) g.putImageData(this.wheelBase, 0, 0);
    g.save();
    g.scale(2, 2);
    const ctr = SIZE / 2;
    this.rows.forEach((r, i) => {
      if (!r.on) return;
      const p = this.pos(r.to);
      if (this.linked) { g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(ctr, ctr); g.lineTo(p.x, p.y); g.stroke(); }
      const big = i === this.base;
      g.beginPath(); g.arc(p.x, p.y, big ? 8 : 5.5, 0, Math.PI * 2);
      g.fillStyle = cssColor(r.to); g.fill();
      g.lineWidth = i === this.active ? 2.5 : 1.5; g.strokeStyle = '#ffffff'; g.stroke();
      g.lineWidth = 0.75; g.strokeStyle = '#000000'; g.beginPath(); g.arc(p.x, p.y, (big ? 8 : 5.5) + 1.4, 0, Math.PI * 2); g.stroke();
    });
    g.restore();
  }
  private wheelBase: ImageData | null = null;

  private sync(): void {
    this.drawWheel();
    setText(this.genNote, this.genMessage || 'Uses the language model set for the Assistant.');
    setClass(this.genGo, 'is-busy', this.genBusy);
    this.genStrips.forEach((b, i) => {
      const pal = this.genPalettes[i];
      setDisabled(b, !pal || this.genBusy);
      Array.from(b.children).forEach((s, k) => { setStyleVar(s as HTMLElement, '--sw', pal?.[k] ? cssColor(pal[k]) : 'transparent'); setClass(s as HTMLElement, 'is-empty', !pal?.[k]); });
    });
    const act = this.rows[this.active];
    const b = act ? Math.round(hsbOf(act.to)[2]) : 100;
    if (document.activeElement !== this.bright) this.bright.value = String(b);
    setText(this.brightOut, `${b}%`);
    setClass(this.linkBtn, 'is-on', this.linked);
    setHidden(q(this.linkBtn, '.cv-rc-ico-on'), !this.linked);
    setHidden(q(this.linkBtn, '.cv-rc-ico-off'), this.linked);
    setTitle(this.linkBtn, this.linked ? 'Harmony colors are linked: dragging one marker turns them all. Click to unlink.' : 'Harmony colors are unlinked: each marker moves alone. Click to link.');
    setDisabled(this.mergeBtn, this.sel.size < 2);
    setDisabled(this.sepBtn, !(this.rows[this.sel.size === 1 ? [...this.sel][0] : this.active]?.from.length > 1));
    patchList(this.list, this.rows.map((r, i) => ({ r, i })), {
      key: ({ r }) => String(r.id),
      create: ({ r, i }) => {
        const n = el(`<div class="cv-rc-row" role="option"><button class="cv-rc-on" type="button" title="Recolor this row" aria-label="Recolor this row">${icon('check', 12)}</button><span class="cv-rc-from"></span><span class="cv-rc-arrow">${icon('chevronRight', 12)}</span><button class="cv-rc-to" type="button" title="New color: click to change" aria-label="New color"></button><button class="cv-rc-base" type="button" title="Make this the base color" aria-label="Base color">${icon('target', 12)}</button></div>`);
        this.fillRow(n, r, i);
        return n;
      },
      update: (n, { r, i }) => this.fillRow(n, r, i),
    });
    setText(this.status, this.picking ? 'Click an image or object on the canvas to take its color theme. Escape cancels.' : `${this.note ? `${this.note} ` : ''}${this.colors.length} current color${this.colors.length === 1 ? '' : 's'} in ${this.rows.length} row${this.rows.length === 1 ? '' : 's'}.`);
    this.note = '';
  }

  private fillRow(n: HTMLElement, r: Row, i: number): void {
    setClass(n, 'is-active', i === this.active);
    setClass(n, 'is-sel', this.sel.has(i));
    setClass(n, 'is-off', !r.on);
    setClass(q(n, '.cv-rc-base'), 'is-on', i === this.base);
    setStyleVar(q(n, '.cv-rc-to'), '--sw', cssColor(r.to));
    setTitle(q(n, '.cv-rc-to'), `New color ${hex(r.to).toUpperCase()}: click to change`);
    const from = q(n, '.cv-rc-from'), shown = [...r.from].sort((a, b) => oklab(b)[0] - oklab(a)[0]).slice(0, 12);
    patchList(from, shown.map((c, k) => ({ c, k })), {
      key: ({ k }) => String(k),
      create: ({ c }) => { const s = el('<span class="cv-rc-chip"></span>'); setStyleVar(s, '--sw', cssColor(c)); setTitle(s, hex(c).toUpperCase()); return s; },
      update: (s, { c }) => { setStyleVar(s, '--sw', cssColor(c)); setTitle(s, hex(c).toUpperCase()); },
    });
  }
}

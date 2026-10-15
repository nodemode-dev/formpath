import { cmyk, cssColor, defaultGradient, gradientAt, gray, hex, hsbToRgb, parseColor, resolvePaint, rgb, rgbToHsb, setGradientBlend, setGradientDither, solid, stop, toCmyk, toGray, toRgb, BLACK, WHITE, NONE } from '../../engine/paint';
import type { Color, Engine, Gradient, GradientStop, Paint, Swatch } from '../../engine';
import { el, patchList, q, setClass, setHidden, setStyleVar, setText, setTitle } from '../dom';
import { icon } from '../icons';
import { askForm } from '../form-dialog';
import { paintCss } from '../rail';
import { numField, selectCtl, seg, slider, type Ctl } from './kit';
import { FF } from '../../tools/paint';
import { toolHost } from '../../extensions/registry';
import { collectColors } from '../../engine/ops/recolor';

type Model = 'gray' | 'rgb' | 'hsb' | 'cmyk' | 'web';
const CH: Record<Model, Array<[string, number, number]>> = {
  gray: [['K', 0, 100]], rgb: [['R', 0, 255], ['G', 0, 255], ['B', 0, 255]], hsb: [['H', 0, 360], ['S', 0, 100], ['B', 0, 100]], cmyk: [['C', 0, 100], ['M', 0, 100], ['Y', 0, 100], ['K', 0, 100]], web: [['R', 0, 255], ['G', 0, 255], ['B', 0, 255]],
};

function activePaint(e: Engine): Paint { return e.activeSlot === 'fill' ? e.fillPaint : e.strokePaint; }

export class ColorPanel {
  readonly body = el('<div class="cv-kit-page cv-colorp"></div>');
  private model: Model = 'rgb';
  private last: Color = rgb(0, 0, 0);
  private readonly sliders: Array<Ctl<number> & { track: HTMLElement; key: string }> = [];
  private readonly box = el('<div class="cv-colorp-sliders"></div>');
  private readonly fillChip: HTMLButtonElement;
  private readonly strokeChip: HTMLButtonElement;
  private readonly hexInput: HTMLInputElement;
  private readonly modelSel: ReturnType<typeof selectCtl>;
  private readonly tint: Ctl<number>;
  private frame = 0;

  constructor(private readonly engine: Engine) {
    const head = el('<div class="cv-colorp-head"><div class="cv-colorp-fs"><button class="cv-fs-mini cv-fs-mini-fill" type="button" title="Fill" aria-label="Fill"></button><button class="cv-fs-mini cv-fs-mini-stroke" type="button" title="Stroke" aria-label="Stroke"></button></div></div>');
    this.fillChip = q<HTMLButtonElement>(head, '.cv-fs-mini-fill');
    this.strokeChip = q<HTMLButtonElement>(head, '.cv-fs-mini-stroke');
    this.fillChip.addEventListener('click', () => engine.setActiveSlot('fill'));
    this.strokeChip.addEventListener('click', () => engine.setActiveSlot('stroke'));
    this.modelSel = selectCtl('', [['gray', 'Grayscale'], ['rgb', 'RGB'], ['hsb', 'HSB'], ['cmyk', 'CMYK'], ['web', 'Web Safe RGB']], (v) => { this.model = v as Model; this.build(); this.sync(); });
    head.appendChild(this.modelSel.el);
    const hexBox = el('<label class="cv-props-field cv-colorp-hex"><span class="cv-pf-label">#</span><span class="cv-num"><input type="text" maxlength="7" aria-label="Hex color"></span></label>');
    this.hexInput = q<HTMLInputElement>(hexBox, 'input');
    this.hexInput.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') this.hexInput.blur(); });
    this.hexInput.addEventListener('change', () => { const c = parseColor(`#${this.hexInput.value.replace(/^#/, '')}`); if (c) this.apply(this.model === 'cmyk' ? toCmyk(c) : c); });
    head.appendChild(hexBox);
    this.tint = slider(engine, 'Tint', 0, 100, (v) => { const p = activePaint(engine); if (p.type === 'color' && p.swatch) engine.setActivePaint({ ...p, tint: v }); }, { unit: '%' });
    const spectrum = el<HTMLCanvasElement>('<canvas class="cv-colorp-spectrum" width="256" height="40" title="Click or drag to pick a color"></canvas>');
    const quick = el(`<div class="cv-colorp-quick"><button type="button" data-q="none" title="None" aria-label="None">${icon('paintNone', 14)}</button><button type="button" data-q="black" title="Black" aria-label="Black"></button><button type="button" data-q="white" title="White" aria-label="White"></button></div>`);
    quick.addEventListener('click', (ev) => {
      const k = (ev.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.q;
      if (k === 'none') engine.setActivePaint(NONE); else if (k === 'black') this.apply(BLACK); else if (k === 'white') this.apply(WHITE);
    });
    const foot = el('<div class="cv-colorp-foot"></div>');
    foot.append(quick, spectrum);
    this.paintSpectrum(spectrum);
    const pickAt = (ev: PointerEvent): void => {
      const r = spectrum.getBoundingClientRect(), x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), y = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));
      const c = y < 0.5 ? hsbToRgb(x * 359.9, y * 200, 100) : hsbToRgb(x * 359.9, 100, (1 - y) * 200);
      this.apply(this.model === 'cmyk' ? toCmyk(rgb(c.r, c.g, c.b)) : rgb(c.r, c.g, c.b));
    };
    spectrum.addEventListener('pointerdown', (ev) => { spectrum.setPointerCapture(ev.pointerId); engine.beginGesture(); pickAt(ev); });
    spectrum.addEventListener('pointermove', (ev) => { if (spectrum.hasPointerCapture(ev.pointerId)) pickAt(ev); });
    spectrum.addEventListener('pointerup', () => engine.endGesture());
    this.body.append(head, this.box, this.tint.el, foot);
    this.model = engine.doc?.colorMode === 'cmyk' ? 'cmyk' : 'rgb';
    this.build();
    for (const k of ['colors', 'selection', 'active', 'doc'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private paintSpectrum(c: HTMLCanvasElement): void {
    const g = c.getContext('2d');
    if (!g) return;
    for (let x = 0; x < 256; x++) {
      const grad = g.createLinearGradient(0, 0, 0, 40), h = (x / 256) * 359.9, top = hsbToRgb(h, 0, 100), mid = hsbToRgb(h, 100, 100);
      grad.addColorStop(0, `rgb(${top.r},${top.g},${top.b})`); grad.addColorStop(0.5, `rgb(${mid.r},${mid.g},${mid.b})`); grad.addColorStop(1, '#000');
      g.fillStyle = grad; g.fillRect(x, 0, 1, 40);
    }
  }

  private build(): void {
    this.box.textContent = '';
    this.sliders.length = 0;
    for (const [key, min, max] of CH[this.model]) {
      const s = slider(this.engine, key, min, max, () => this.fromSliders(), { unit: this.model === 'hsb' ? (key === 'H' ? '°' : '%') : this.model === 'cmyk' || this.model === 'gray' ? '%' : '' });
      s.el.classList.add('cv-colorp-ch');
      const track = q(s.el, '.cv-slider');
      this.sliders.push({ ...s, track, key });
      this.box.appendChild(s.el);
    }
    this.modelSel.set(this.model);
  }

  private values(): number[] { return this.sliders.map((s) => Number((q(s.el, 'input[type="range"]') as HTMLInputElement).value)); }

  private fromSliders(): void {
    const v = this.values();
    let c: Color;
    switch (this.model) {
      case 'gray': c = gray(v[0]); break;
      case 'hsb': { const r = hsbToRgb(v[0] % 360, v[1], v[2]); c = rgb(r.r, r.g, r.b); break; }
      case 'cmyk': c = cmyk(v[0], v[1], v[2], v[3]); break;
      case 'web': c = rgb(Math.round(v[0] / 51) * 51, Math.round(v[1] / 51) * 51, Math.round(v[2] / 51) * 51); break;
      default: c = rgb(v[0], v[1], v[2]);
    }
    this.apply(c);
  }

  private apply(c: Color): void { this.last = c; this.engine.setActivePaint(solid(c)); }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const e = this.engine, p0 = activePaint(e), p = e.doc ? resolvePaint(e.doc, p0) : p0;
    setStyleVar(this.fillChip, '--paint', paintCss(e.fillPaint, e));
    setStyleVar(this.strokeChip, '--paint', paintCss(e.strokePaint, e));
    setClass(this.fillChip, 'is-front', e.activeSlot === 'fill');
    setClass(this.strokeChip, 'is-front', e.activeSlot === 'stroke');
    const c = p.type === 'color' ? p.color : p.type === 'gradient' ? p.gradient.stops[0]?.color ?? this.last : this.last;
    if (p.type === 'color') this.last = c;
    const vals = this.channels(c);
    this.sliders.forEach((s, i) => { s.set(Math.round(vals[i] * 10) / 10); s.enable(p.type === 'color' || p.type === 'none'); });
    this.tracks(c);
    if (document.activeElement !== this.hexInput) this.hexInput.value = hex(c).slice(1);
    setHidden(this.tint.el, !(p0.type === 'color' && p0.swatch));
    if (p0.type === 'color') this.tint.set(p0.tint ?? 100);
  }

  private channels(c: Color): number[] {
    switch (this.model) {
      case 'gray': { const g = toGray(c); return [g.kind === 'gray' ? g.k : 0]; }
      case 'hsb': { const v = toRgb(c); return rgbToHsb(v.r, v.g, v.b); }
      case 'cmyk': { const k = toCmyk(c); return k.kind === 'cmyk' ? [k.c, k.m, k.y, k.k] : [0, 0, 0, 0]; }
      default: { const v = toRgb(c); return [v.r, v.g, v.b]; }
    }
  }

  private tracks(c: Color): void {
    const v = toRgb(c), [h, s, b] = rgbToHsb(v.r, v.g, v.b), k = toCmyk(c);
    const css = (cc: Color): string => cssColor(cc);
    this.sliders.forEach((sl) => {
      let a = '#000', z = '#fff', mid = '';
      switch (`${this.model}:${sl.key}`) {
        case 'rgb:R': case 'web:R': a = css(rgb(0, v.g, v.b)); z = css(rgb(255, v.g, v.b)); break;
        case 'rgb:G': case 'web:G': a = css(rgb(v.r, 0, v.b)); z = css(rgb(v.r, 255, v.b)); break;
        case 'rgb:B': case 'web:B': a = css(rgb(v.r, v.g, 0)); z = css(rgb(v.r, v.g, 255)); break;
        case 'hsb:H': mid = 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)'; break;
        case 'hsb:S': { const x = hsbToRgb(h, 0, b), y = hsbToRgb(h, 100, b); a = css(rgb(x.r, x.g, x.b)); z = css(rgb(y.r, y.g, y.b)); break; }
        case 'hsb:B': { const y = hsbToRgb(h, s, 100); a = '#000'; z = css(rgb(y.r, y.g, y.b)); break; }
        case 'gray:K': a = '#fff'; z = '#000'; break;
        default: if (k.kind === 'cmyk') { const base = { C: k.c, M: k.m, Y: k.y, K: k.k }; const at = (val: number): string => { const o = { ...base, [sl.key]: val }; return css(cmyk(o.C, o.M, o.Y, o.K)); }; a = at(0); z = at(100); }
      }
      setStyleVar(sl.track, '--track', mid || `linear-gradient(to right, ${a}, ${z})`);
    });
  }
}

export class SwatchesPanel {
  readonly body = el('<div class="cv-kit-page cv-swatchp"></div>');
  private readonly grid = el('<div class="cv-swatch-grid cv-swatchp-grid" role="listbox" aria-label="Swatches"></div>');
  private kind: 'all' | 'color' | 'gradient' | 'pattern' = 'all';
  private picked = new Set<string>();
  private pickedGroup: string | null = null;
  private frame = 0;

  pickedIds(): string[] { return [...this.picked]; }

  constructor(private readonly engine: Engine, private readonly pickColor: (c: Color) => Promise<Color | null>, private readonly libMenu: (anchor: HTMLElement) => void = () => undefined, private readonly info: () => void = () => undefined) {
    const head = el('<div class="cv-kit-row cv-swatchp-head"></div>');
    const kinds = seg([{ id: 'all', label: 'All' }, { id: 'color', label: 'Colors' }, { id: 'gradient', label: 'Gradients' }, { id: 'pattern', label: 'Patterns' }], (id) => { this.kind = id as typeof this.kind; kinds.set(id); this.sync(); }, 'cv-seg-small');
    kinds.set('all');
    head.appendChild(kinds.el);
    const foot = el('<div class="cv-panel-foot cv-swatchp-foot"></div>');
    const mk = (name: string, label: string, run: (b: HTMLButtonElement) => void): HTMLButtonElement => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', () => run(b)); foot.appendChild(b); return b; };
    mk('library', 'Swatch Libraries menu', (b) => this.libMenu(b));
    mk('sparkle', 'Add Used Colors', () => engine.addUsedColors());
    mk('info', 'Create Swatch Info', () => this.info());
    mk('folder', 'New Color Group from the selected swatches', () => void this.newGroup());
    mk('add', 'New Swatch from the active Fill or Stroke', () => void this.newSwatch());
    mk('delete', 'Delete Swatch or Color Group', () => {
      if (this.pickedGroup) { engine.ungroupSwatches(this.pickedGroup, true); this.pickedGroup = null; return; }
      if (this.picked.size) { engine.deleteSwatches([...this.picked]); this.picked.clear(); }
    });
    this.grid.addEventListener('click', (ev) => {
      const h = (ev.target as HTMLElement).closest<HTMLElement>('.cv-sw-group');
      if (h) { this.pickedGroup = h.dataset.group ?? null; this.picked = new Set((engine.doc?.swatches ?? []).filter((s) => s.group === this.pickedGroup).map((s) => s.id)); this.sync(); return; }
      const t = (ev.target as HTMLElement).closest<HTMLElement>('.cv-sw-tile');
      const sw = t ? engine.doc?.swatches.find((s) => s.id === t.dataset.key) : null;
      if (!sw) return;
      this.pickedGroup = null;
      if (ev.shiftKey || ev.metaKey || ev.ctrlKey) { if (this.picked.has(sw.id)) this.picked.delete(sw.id); else this.picked.add(sw.id); this.sync(); return; }
      this.picked = new Set([sw.id]);
      this.sync();
      if (sw.name === '[Registration]') { engine.setActivePaint({ type: 'color', color: cmyk(100, 100, 100, 100), swatch: sw.id, tint: 100 }); return; }
      engine.setActivePaint(swatchPaint(sw));
    });
    this.grid.addEventListener('dblclick', (ev) => {
      const h = (ev.target as HTMLElement).closest<HTMLElement>('.cv-sw-group');
      if (h?.dataset.group) { void this.renameGroup(h.dataset.group); return; }
      const t = (ev.target as HTMLElement).closest<HTMLElement>('.cv-sw-tile'); if (t?.dataset.key) void this.edit(t.dataset.key);
    });
    this.bindDrag();
    this.body.append(head, this.grid, foot);
    for (const k of ['doc', 'active', 'projects'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private bindDrag(): void {
    let dragging: string[] = [];
    const target = (ev: DragEvent): HTMLElement | null => (ev.target as HTMLElement).closest<HTMLElement>('.cv-sw-group, .cv-sw-tile') ?? (ev.target === this.grid ? this.grid : null);
    let over: HTMLElement | null = null;
    const mark = (n: HTMLElement | null): void => { if (over === n) return; if (over) setClass(over, 'is-drop', false); over = n; if (n) setClass(n, 'is-drop', true); };
    this.grid.addEventListener('dragstart', (ev) => {
      const t = (ev.target as HTMLElement).closest<HTMLElement>('.cv-sw-tile');
      if (!t?.dataset.key) return;
      dragging = this.picked.has(t.dataset.key) ? [...this.picked] : [t.dataset.key];
      ev.dataTransfer?.setData('text/plain', dragging.join(','));
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
    });
    this.grid.addEventListener('dragover', (ev) => { if (!dragging.length) return; ev.preventDefault(); const t = target(ev); mark(t && t.dataset.key && dragging.includes(t.dataset.key) ? null : t); });
    this.grid.addEventListener('dragleave', (ev) => { if (ev.target === this.grid) mark(null); });
    this.grid.addEventListener('drop', (ev) => {
      ev.preventDefault();
      const t = target(ev), ids = dragging;
      mark(null);
      dragging = [];
      if (!ids.length || !t) return;
      if (t.classList.contains('cv-sw-group')) { this.engine.moveSwatches(ids, t.dataset.group ?? null); return; }
      if (t === this.grid) { this.engine.moveSwatches(ids, null); return; }
      if (t.dataset.key && !ids.includes(t.dataset.key)) { const sw = this.engine.doc?.swatches.find((s) => s.id === t.dataset.key); this.engine.moveSwatches(ids, sw?.group ?? null, t.dataset.key); }
    });
    this.grid.addEventListener('dragend', () => { dragging = []; mark(null); });
  }

  private async newGroup(): Promise<void> {
    const e = this.engine, ids = [...this.picked];
    const sel = ids.length ? ids : [];
    const n = e.swatchGroups().length + 1;
    const v = await askForm('New Color Group', [
      { kind: 'text', key: 'name', label: 'Name', value: `Color Group ${n}` },
      { kind: 'select', key: 'from', label: 'Create from', value: sel.length ? 'swatches' : 'art', choices: [['swatches', 'Selected swatches'], ['art', 'Selected artwork']] },
    ], { ok: 'OK' });
    if (!v) return;
    const name = String(v.name).trim() || `Color Group ${n}`;
    if (v.from === 'art') {
      const cols = collectColors(e.selected()).slice(0, 40);
      if (!cols.length) { e.notice('Select artwork with solid colours to make a group from it.', 'error'); return; }
      e.beginGesture();
      cols.forEach((c) => e.addSwatch(hex(c).toUpperCase(), solid(c), false, false, name));
      e.endGesture();
      return;
    }
    if (e.groupSwatches(sel, name)) { this.pickedGroup = name; this.queue(); }
  }

  private async renameGroup(group: string): Promise<void> {
    const v = await askForm('Color Group Options', [{ kind: 'text', key: 'name', label: 'Name', value: group }, { kind: 'check', key: 'ungroup', label: 'Ungroup (keep the swatches)', value: false }]);
    if (!v) return;
    if (v.ungroup) { this.engine.ungroupSwatches(group); this.pickedGroup = null; return; }
    if (this.engine.renameSwatchGroup(group, String(v.name))) this.pickedGroup = String(v.name).trim();
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private async newSwatch(): Promise<void> {
    const e = this.engine, p = activePaint(e);
    if (p.type === 'none') return;
    if (p.type === 'color' && p.swatch && (p.tint ?? 100) < 100) { e.addTintSwatch(p.swatch, p.tint ?? 100); return; }
    const v = await askForm('New Swatch', [
      { kind: 'text', key: 'name', label: 'Name', value: p.type === 'color' ? hex(p.color).toUpperCase() : p.type === 'gradient' ? 'New Gradient' : 'New Pattern' },
      { kind: 'select', key: 'type', label: 'Color type', value: 'process', choices: [['process', 'Process color'], ['global', 'Global process color (edits update every object that uses it)'], ['spot', 'Spot color (its own plate in PDF)']] },
      ...(this.pickedGroup ? [{ kind: 'note' as const, text: `The swatch goes into ${this.pickedGroup}.` }] : []),
    ], { ok: 'Add' });
    if (!v) return;
    v.global = v.type === 'global';
    v.spot = v.type === 'spot';
    e.addSwatch(String(v.name) || 'Swatch', { ...p, ...(p.type === 'color' ? { swatch: undefined, tint: undefined } : {}) } as Paint, !!v.global || !!v.spot, !!v.spot, this.pickedGroup ?? undefined);
  }

  private async edit(id: string): Promise<void> {
    const e = this.engine, sw = e.doc?.swatches.find((s) => s.id === id);
    if (!sw || sw.name.startsWith('[')) return;
    if (sw.paint.type === 'pattern') { if (e.enterPatternEdit(sw.paint.pattern)) toolHost.run('panel-pattern-options'); return; }
    if (sw.paint.type === 'color' && sw.paint.swatch) {
      const parent = e.doc?.swatches.find((s) => s.id === (sw.paint as { swatch: string }).swatch);
      const t = await askForm('Tint Swatch Options', [{ kind: 'text', key: 'name', label: 'Name', value: sw.name }, { kind: 'number', key: 'tint', label: `Tint of ${parent?.name ?? 'its swatch'}`, value: sw.paint.tint ?? 100, min: 0, max: 100, unit: '%' }]);
      if (t) e.editSwatch(id, { name: String(t.name) || sw.name, paint: { ...sw.paint, tint: Math.round(Number(t.tint)) } });
      return;
    }
    const v = await askForm('Swatch Options', [
      { kind: 'text', key: 'name', label: 'Name', value: sw.name },
      ...(sw.paint.type === 'color' ? [{ kind: 'color' as const, key: 'color', label: 'Color', value: hex(sw.paint.color) }, { kind: 'select' as const, key: 'mode', label: 'Color mode', value: sw.paint.color.kind === 'cmyk' ? 'cmyk' : 'rgb', choices: [['rgb', 'RGB'], ['cmyk', 'CMYK']] as Array<readonly [string, string]> }] : []),
      { kind: 'select', key: 'type', label: 'Color type', value: sw.spot ? 'spot' : sw.global ? 'global' : 'process', choices: [['process', 'Process color'], ['global', 'Global process color'], ['spot', 'Spot color']] },
      { kind: 'note', text: 'Global and spot swatches stay linked: editing them recolours every use, and their tints follow. Spot colours print on their own plate in PDF.' },
    ]);
    if (!v) return;
    v.global = v.type !== 'process';
    v.spot = v.type === 'spot';
    let paint = sw.paint;
    if (sw.paint.type === 'color' && (v.color !== hex(sw.paint.color) || v.mode !== (sw.paint.color.kind === 'cmyk' ? 'cmyk' : 'rgb'))) {
      const parsed = v.color !== hex(sw.paint.color) ? parseColor(String(v.color)) : sw.paint.color;
      if (parsed) paint = { type: 'color', color: v.mode === 'cmyk' ? toCmyk(parsed) : parsed.kind === 'cmyk' ? rgb(toRgb(parsed).r, toRgb(parsed).g, toRgb(parsed).b) : parsed };
    }
    e.editSwatch(id, { name: String(v.name) || sw.name, paint, global: !!v.global, spot: !!v.spot });
  }

  private sync(): void {
    const doc = this.engine.doc;
    const all = doc?.swatches ?? [];
    const list = all.filter((s) => this.kind === 'all' || (this.kind === 'color' ? s.paint.type === 'color' || s.paint.type === 'none' : s.paint.type === this.kind));
    for (const id of [...this.picked]) if (!all.some((s) => s.id === id)) this.picked.delete(id);
    if (this.pickedGroup && !all.some((s) => s.group === this.pickedGroup)) this.pickedGroup = null;
    const rows: Array<{ k: string; s?: Swatch; g?: string }> = list.filter((s) => !s.group).map((s) => ({ k: s.id, s }));
    const groups: string[] = [];
    for (const s of all) if (s.group && !groups.includes(s.group)) groups.push(s.group);
    for (const g of groups) { rows.push({ k: `group:${g}`, g }); for (const s of list) if (s.group === g) rows.push({ k: s.id, s }); }
    patchList(this.grid, rows, {
      key: (r) => r.k,
      create: (r) => {
        if (r.g !== undefined) { const h = el(`<div class="cv-sw-group" role="option" draggable="false">${icon('folder', 14)}<span class="cv-sw-group-name"></span></div>`); this.head(h, r.g); return h; }
        const b = el('<button class="cv-sw-tile" type="button" role="option" draggable="true"></button>'); if (r.s) this.fill(b, r.s); return b;
      },
      update: (n, r) => { if (r.g !== undefined) this.head(n, r.g); else if (r.s) this.fill(n, r.s); },
    });
  }

  private head(h: HTMLElement, g: string): void {
    h.dataset.group = g;
    setText(q(h, '.cv-sw-group-name'), g);
    setTitle(h, `${g} · color group (double-click to rename or ungroup; drop swatches here to add them)`);
    setClass(h, 'is-picked', this.pickedGroup === g);
  }

  private fill(b: HTMLElement, s: Swatch): void {
    const tint = s.paint.type === 'color' && !!s.paint.swatch;
    setStyleVar(b, '--paint', s.name === '[Registration]' ? 'repeating-linear-gradient(45deg, #000 0 2px, #fff 2px 4px)' : paintCss(s.paint, this.engine));
    setTitle(b, `${s.name}${s.spot ? ' · spot' : s.global ? ' · global process' : s.paint.type === 'color' && !s.name.startsWith('[') ? ' · process' : ''}${tint ? ' · tint' : ''}`);
    setClass(b, 'is-global', s.global && !s.spot);
    setClass(b, 'is-spot', s.spot);
    setClass(b, 'is-tint', tint);
    setClass(b, 'is-picked', this.picked.has(s.id));
  }
}

export function swatchPaint(sw: Swatch): Paint {
  if ((sw.global || sw.spot) && sw.paint.type === 'color') return { type: 'color', color: sw.paint.color, swatch: sw.id, tint: 100 };
  if (sw.global && sw.paint.type === 'gradient') return { ...sw.paint, swatch: sw.id };
  return sw.paint;
}

export class GradientPanel {
  readonly body = el('<div class="cv-kit-page cv-gradp"></div>');
  private readonly bar = el('<div class="cv-gradp-bar"><div class="cv-gradp-ramp"></div><div class="cv-gradp-stops"></div></div>');
  private readonly kind: Ctl<string>;
  private readonly angle: Ctl<number | null>;
  private readonly aspect: Ctl<number | null>;
  private readonly loc: Ctl<number | null>;
  private readonly opacity: Ctl<number | null>;
  private readonly strokeMode: Ctl<string>;
  private readonly method: Ctl<string>;
  private readonly dither = el<HTMLInputElement>('<input type="checkbox" aria-label="Dither">');
  private readonly ditherRow = el('<label class="cv-kit-row cv-gradp-dither"><span>Dither</span></label>');
  private readonly chip: HTMLButtonElement;
  private readonly ffMode: Ctl<string>;
  private readonly ffChip: HTMLButtonElement;
  private readonly ffSpread: Ctl<number | null>;
  private readonly ffBox = el('<div class="cv-gradp-ff"></div>');
  private readonly linearBox = el('<div class="cv-gradp-lin"></div>');
  private sel = 0;
  private frame = 0;

  constructor(private readonly engine: Engine, private readonly pickColor: (c: Color) => Promise<Color | null>) {
    const swatch = el<HTMLButtonElement>('<button class="cv-gradp-preview" type="button" title="Apply a gradient to the active Fill or Stroke" aria-label="Apply gradient"></button>');
    swatch.addEventListener('click', () => { const g = this.gradient(); if (g?.kind === 'freeform') engine.setFreeform(g.mode ?? 'points'); else this.set(g ?? defaultGradient()); });
    this.kind = seg([{ id: 'linear', label: 'Linear' }, { id: 'radial', label: 'Radial' }, { id: 'freeform', label: 'Freeform' }], (id) => {
      if (id === 'freeform') {
        if (engine.activeSlot === 'stroke') { engine.notice('Freeform gradients fill objects; switch to Fill.'); return; }
        if (!engine.setFreeform(this.ffOwner()?.g.mode ?? 'points')) { engine.fillPaint = { type: 'gradient', gradient: { ...defaultGradient(), kind: 'freeform', points: [], mode: 'points' } }; engine.emit('colors', null); }
        return;
      }
      const g = this.gradient() ?? defaultGradient();
      const stops = g.kind === 'freeform' ? (g.points ?? []).slice(0, 4).map((p, i, a) => stop(a.length > 1 ? i / (a.length - 1) : 0, p.color)) : g.stops;
      this.set({ ...g, kind: id as 'linear' | 'radial', geom: null, points: undefined, mode: undefined, stops: stops.length > 1 ? stops : defaultGradient().stops });
    });
    this.ffMode = seg([{ id: 'points', label: 'Points' }, { id: 'lines', label: 'Lines' }], (id) => { const o = this.ffOwner(); if (o) engine.setFill({ type: 'gradient', gradient: { ...o.g, mode: id as 'points' } }, [o.id]); });
    this.ffChip = el<HTMLButtonElement>('<button class="cv-gradp-chip" type="button" title="Point color (click to change)" aria-label="Point color"></button>');
    this.ffChip.addEventListener('click', () => void (async () => { const o = this.ffOwner(), pt = o?.g.points?.[FF.sel]; if (!o || !pt) return; const c = await this.pickColor(pt.color); if (c) this.editPoint({ color: c }); })());
    this.ffSpread = numField('Spread', 'pt', (v) => this.editPoint({ spread: Math.max(2, v) }), { min: 2, max: 100000 });
    const ffDel = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="Delete Point" aria-label="Delete Point">${icon('delete', 16)}</button>`);
    ffDel.addEventListener('click', () => { const o = this.ffOwner(), pts = o?.g.points ?? []; if (!o || FF.sel < 0 || pts.length < 2) return; engine.setFill({ type: 'gradient', gradient: { ...o.g, points: pts.filter((_, i) => i !== FF.sel) } }, [o.id]); FF.sel = Math.min(FF.sel, pts.length - 2); this.queue(); });
    const ffRow = el('<div class="cv-kit-row cv-gradp-stoprow"></div>');
    ffRow.append(this.ffChip, this.ffSpread.el, ffDel);
    const ffNote = el('<p class="cv-note"></p>');
    setText(ffNote, 'With the Gradient tool, click inside the object to add a point, drag a point to move it, drag the square on its ring to spread it. Lines joins the points so color runs along them.');
    this.ffBox.append(this.ffMode.el, ffRow, ffNote);
    this.angle = numField('Angle', '°', (v) => { const g = this.gradient(); if (g) this.set({ ...g, angle: v, geom: null }); }, { min: -360, max: 360 });
    this.aspect = numField('Aspect', '%', (v) => { const g = this.gradient(); if (g) this.set({ ...g, aspect: v / 100 }); }, { min: 1, max: 1000 });
    this.strokeMode = seg([{ id: 'within', label: 'Within' }, { id: 'along', label: 'Along' }, { id: 'across', label: 'Across' }], (id) => { const g = this.gradient(); if (g) this.set({ ...g, strokeMode: id as 'within' }); });
    this.chip = el<HTMLButtonElement>('<button class="cv-gradp-chip" type="button" title="Stop color (click to change)" aria-label="Stop color"></button>');
    this.chip.addEventListener('click', () => void this.recolor());
    this.loc = numField('Location', '%', (v) => this.editStop({ offset: v / 100 }), { min: 0, max: 100 });
    this.opacity = numField('Opacity', '%', (v) => this.editStop({ opacity: v / 100 }), { min: 0, max: 100 });
    const reverse = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="Reverse Gradient" aria-label="Reverse Gradient">${icon('refresh', 16)}</button>`);
    reverse.addEventListener('click', () => { const g = this.gradient(); if (g) this.set({ ...g, stops: g.stops.map((s) => ({ ...s, offset: 1 - s.offset, mid: 1 - s.mid })) }); });
    const del = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="Delete Stop" aria-label="Delete Stop">${icon('delete', 16)}</button>`);
    del.addEventListener('click', () => { const g = this.gradient(); if (g && g.stops.length > 2) { const stops = this.sorted(g).filter((_, i) => i !== this.sel); this.sel = Math.max(0, this.sel - 1); this.set({ ...g, stops }); } });
    const top = el('<div class="cv-kit-row cv-gradp-top"></div>');
    top.append(swatch, this.kind.el, reverse);
    const stopRow = el('<div class="cv-kit-row cv-gradp-stoprow"></div>');
    stopRow.append(this.chip, this.loc.el, this.opacity.el, del);
    const geo = el('<div class="cv-kit-row"></div>');
    geo.append(this.angle.el, this.aspect.el);
    this.method = seg([{ id: 'linear', label: 'Classic' }, { id: 'perceptual', label: 'Perceptual' }], (id) => { const g = this.gradient(); if (g) this.set(setGradientBlend(g, id === 'perceptual' ? 'perceptual' : 'linear')); });
    this.dither.addEventListener('change', () => { const g = this.gradient(); if (g) this.set(setGradientDither(g, this.dither.checked)); });
    this.ditherRow.prepend(this.dither);
    this.linearBox.append(geo, this.bar, stopRow, this.strokeMode.el, this.method.el, this.ditherRow);
    this.body.append(top, this.linearBox, this.ffBox);
    this.bindBar();
    for (const k of ['colors', 'selection', 'active', 'doc', 'options'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private ffOwner(): { id: string; g: Gradient } | null {
    for (const n of this.engine.selected()) { const f = n.ap.items.find((i) => i.kind === 'fill'); if (f && f.paint.type === 'gradient' && f.paint.gradient.kind === 'freeform') return { id: n.id, g: f.paint.gradient }; }
    return null;
  }
  private editPoint(patch: Partial<NonNullable<Gradient['points']>[number]>): void {
    const o = this.ffOwner(), pts = o?.g.points ?? [];
    if (!o || !pts[FF.sel]) return;
    this.engine.setFill({ type: 'gradient', gradient: { ...o.g, points: pts.map((p, i) => (i === FF.sel ? { ...p, ...patch } : p)) } }, [o.id]);
  }

  private gradient(): Gradient | null { const p = activePaint(this.engine); return p.type === 'gradient' ? p.gradient : null; }
  private sorted(g: Gradient): GradientStop[] { return [...g.stops].sort((a, b) => a.offset - b.offset); }
  private set(g: Gradient): void { const p = activePaint(this.engine); this.engine.setActivePaint({ type: 'gradient', gradient: g, ...(p.type === 'gradient' && p.swatch ? { swatch: p.swatch } : {}) }); }

  private editStop(patch: Partial<GradientStop>): void {
    const g = this.gradient();
    if (!g) return;
    const stops = this.sorted(g).map((s, i) => (i === this.sel ? { ...s, ...patch } : s));
    this.set({ ...g, stops });
  }

  private async recolor(): Promise<void> {
    const g = this.gradient();
    if (!g) return;
    const s = this.sorted(g)[this.sel];
    if (!s) return;
    const c = await this.pickColor(s.color);
    if (c) this.editStop({ color: c });
  }

  private bindBar(): void {
    const ramp = q(this.bar, '.cv-gradp-ramp'), stopsEl = q(this.bar, '.cv-gradp-stops');
    let drag: { i: number; mid: boolean; off: boolean } | null = null;
    const at = (ev: PointerEvent): number => { const r = ramp.getBoundingClientRect(); return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)); };
    stopsEl.addEventListener('pointerdown', (ev) => {
      const g = this.gradient();
      if (!g) return;
      const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-i]');
      stopsEl.setPointerCapture(ev.pointerId);
      this.engine.beginGesture();
      if (t) { drag = { i: Number(t.dataset.i), mid: t.classList.contains('cv-gradp-mid'), off: false }; if (!drag.mid) { this.sel = drag.i; this.sync(); } return; }
      const x = at(ev), c = gradientAt(g, x), stops = [...this.sorted(g), stop(x, c.color, c.opacity)].sort((a, b) => a.offset - b.offset);
      this.sel = stops.findIndex((s) => s.offset === x);
      this.set({ ...g, stops });
      drag = { i: this.sel, mid: false, off: false };
    });
    stopsEl.addEventListener('pointermove', (ev) => {
      const g = this.gradient();
      if (!drag || !g || !stopsEl.hasPointerCapture(ev.pointerId)) return;
      const x = at(ev), sorted = this.sorted(g);
      if (drag.mid) {
        const a = sorted[drag.i], b = sorted[drag.i + 1];
        if (!a || !b) return;
        const mid = Math.max(0.05, Math.min(0.95, (x - a.offset) / Math.max(1e-6, b.offset - a.offset)));
        this.set({ ...g, stops: sorted.map((s, k) => (k === drag?.i ? { ...s, mid } : s)) });
        return;
      }
      const r = this.bar.getBoundingClientRect();
      drag.off = ev.clientY > r.bottom + 24 && sorted.length > 2;
      const moved = sorted.map((s, k) => (k === drag?.i ? { ...s, offset: x } : s));
      const order = moved.map((s, k) => ({ s, k })).sort((a, b) => a.s.offset - b.s.offset);
      drag.i = order.findIndex((o) => o.k === drag?.i);
      this.sel = drag.i;
      this.set({ ...g, stops: order.map((o) => o.s) });
    });
    const up = (): void => {
      const g = this.gradient();
      if (drag?.off && g) { const stops = this.sorted(g).filter((_, k) => k !== drag?.i); this.sel = 0; this.set({ ...g, stops }); }
      drag = null;
      this.engine.endGesture();
    };
    stopsEl.addEventListener('pointerup', up);
    stopsEl.addEventListener('pointercancel', up);
    stopsEl.addEventListener('dblclick', (ev) => { if ((ev.target as HTMLElement).closest('.cv-gradp-stop')) void this.recolor(); });
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const g = this.gradient(), e = this.engine;
    const shown = g ?? defaultGradient(), stops = this.sorted(shown);
    this.sel = Math.min(this.sel, stops.length - 1);
    setStyleVar(q(this.bar, '.cv-gradp-ramp'), '--ramp', `linear-gradient(to right, ${stops.map((s) => `${cssColor(s.color, s.opacity)} ${s.offset * 100}%`).join(', ')})`);
    setStyleVar(q(this.body, '.cv-gradp-preview'), '--paint', paintCss({ type: 'gradient', gradient: shown }, e));
    const host = q(this.bar, '.cv-gradp-stops');
    const items = [...stops.map((s, i) => ({ k: `s${i}`, i, s, mid: false })), ...stops.slice(0, -1).map((s, i) => ({ k: `m${i}`, i, s, mid: true }))];
    const place = (n: HTMLElement, x: (typeof items)[number]): void => {
      n.dataset.i = String(x.i);
      const left = x.mid ? stops[x.i].offset + (stops[x.i + 1].offset - stops[x.i].offset) * stops[x.i].mid : x.s.offset;
      setStyleVar(n, '--at', `${left * 100}%`);
      if (!x.mid) { setStyleVar(n, '--sw', cssColor(x.s.color)); setClass(n, 'is-sel', x.i === this.sel); }
    };
    patchList(host, items, {
      key: (x) => x.k,
      create: (x) => { const n = el(`<span class="${x.mid ? 'cv-gradp-mid' : 'cv-gradp-stop'}"></span>`); place(n, x); return n; },
      update: place,
    });
    const s = stops[this.sel];
    setStyleVar(this.chip, '--sw', s ? cssColor(s.color) : 'transparent');
    this.loc.set(s ? Math.round(s.offset * 1000) / 10 : null);
    this.opacity.set(s ? Math.round(s.opacity * 1000) / 10 : null);
    this.kind.set(shown.kind);
    this.angle.set(shown.angle);
    this.aspect.set(Math.round(shown.aspect * 100));
    setHidden(this.aspect.el, shown.kind !== 'radial');
    this.strokeMode.set(shown.strokeMode ?? 'within');
    this.method.set(shown.blend === 'perceptual' ? 'perceptual' : 'linear');
    if (this.dither.checked !== (shown.dither === true)) this.dither.checked = shown.dither === true;
    setHidden(this.strokeMode.el, e.activeSlot !== 'stroke');
    setClass(this.body, 'is-inactive', !g);
    setText(q(this.body, '.cv-gradp-preview'), '');
    const ff = shown.kind === 'freeform', owner = ff ? this.ffOwner() : null, pt = owner?.g.points?.[FF.sel];
    setHidden(this.linearBox, ff);
    setHidden(this.ffBox, !ff);
    this.ffMode.set(owner?.g.mode ?? shown.mode ?? 'points');
    setStyleVar(this.ffChip, '--sw', pt ? cssColor(pt.color) : 'transparent');
    this.ffSpread.set(pt ? Math.round(pt.spread * 10) / 10 : null);
    this.ffSpread.enable(!!pt);
  }
}

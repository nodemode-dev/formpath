import { allNodes, updateNodes } from '../../engine/doc';
import { DEFAULT_CHAR, fontHasFeature, plainText, styleAt } from '../../engine/text';
import { DEFAULT_HYPH, DEFAULT_JUST } from '../../engine/hyphen';
import type { AreaOptions, CharStyle, Engine, FirstBaseline, Justification, ListFormat, ListStyle, ParaStyle, PathAlign, PathEffect, TabAlign, TabStop, TextNode } from '../../engine';
import { el, patchList, q, setClass, setDisabled, setHidden, setHtml, setStyleVar, setText, setTitle, setValue } from '../dom';
import { icon } from '../icons';
import { askForm, type Field } from '../form-dialog';
import { previewEdit } from './preview-edit';
import { typing } from '../text-editor';
import { families, glyphAlternates, glyphList, isVariableFamily, stylesOf, ensureFace, variationOf, type VariationAxis, type VariationInfo } from '../../io/fonts';
import { typeDefaults } from '../../tools/type';
import { check, numField, row, section, seg, selectCtl, slider, type Ctl } from './kit';

function texts(e: Engine): TextNode[] { return e.selected().filter((n): n is TextNode => n.kind === 'text'); }

const OT_TOGGLES: ReadonlyArray<readonly [string, string]> = [['liga', 'Ligatures'], ['calt', 'Contextual'], ['dlig', 'Discretionary'], ['swsh', 'Swash'], ['salt', 'Alternates'], ['titl', 'Titling'], ['ordn', 'Ordinals'], ['frac', 'Fractions'], ['zero', 'Slashed Zero'], ['case', 'Case Forms']];
const FIGURES: ReadonlyArray<readonly [string, string]> = [['', 'Default Figure'], ['tnum+lnum', 'Tabular Lining'], ['pnum+onum', 'Proportional Oldstyle'], ['pnum+lnum', 'Proportional Lining'], ['tnum+onum', 'Tabular Oldstyle']];
const FIG_TAGS = new Set(['tnum', 'pnum', 'lnum', 'onum']);
const OT_POS: ReadonlyArray<readonly [string, string]> = [['', 'Default Position'], ['sups', 'Superior'], ['subs', 'Inferior'], ['numr', 'Numerator'], ['dnom', 'Denominator']];
const POS_TAGS = new Set(['sups', 'subs', 'numr', 'dnom']);
const SETS: ReadonlyArray<readonly [string, string]> = [['', 'No Stylistic Set'], ...Array.from({ length: 20 }, (_, i) => [`ss${String(i + 1).padStart(2, '0')}`, `Stylistic Set ${i + 1}`] as const)];
const BULLETS: ReadonlyArray<readonly [string, string]> = [['•', '•'], ['◦', '◦'], ['▪', '▪'], ['–', '–'], ['›', '›'], ['✓', '✓'], ['*', '*']];
const NUMBER_FORMATS: ReadonlyArray<readonly [string, string]> = [['1', '1, 2, 3'], ['01', '01, 02, 03'], ['a', 'a, b, c'], ['A', 'A, B, C'], ['i', 'i, ii, iii'], ['I', 'I, II, III']];

function paraTargets(e: Engine): TextNode[] { const n = typing.editor?.node(); return n ? [n] : texts(e); }

export async function hyphenationDialog(engine: Engine): Promise<void> {
  const list = paraTargets(engine), t = list[0];
  if (!t) { engine.notice('Select type or click into it first.'); return; }
  const h = { ...DEFAULT_HYPH, ...(t.para.hyph ?? {}) }, ids = list.map((x) => x.id);
  await previewEdit(engine, 'Hyphenation', [
    { kind: 'check', key: 'on', label: 'Hyphenation', value: !!t.para.hyphenate },
    { kind: 'number', key: 'minWord', label: 'Words longer than', value: h.minWord, min: 2, max: 25, unit: 'letters' },
    { kind: 'number', key: 'after', label: 'After first', value: h.after, min: 1, max: 15, unit: 'letters' },
    { kind: 'number', key: 'before', label: 'Before last', value: h.before, min: 1, max: 15, unit: 'letters' },
    { kind: 'number', key: 'limit', label: 'Hyphen limit (0 for none)', value: h.limit, min: 0, max: 25, unit: 'hyphens' },
    { kind: 'number', key: 'zone', label: 'Hyphenation zone', value: h.zone, min: 0, max: 720, unit: 'pt' },
    { kind: 'check', key: 'caps', label: 'Hyphenate capitalized words', value: h.caps },
  ], (origin, v) => updateNodes(origin, ids, (n) => (n.kind === 'text' ? { ...n, para: { ...n.para, hyphenate: !!v.on, hyph: { minWord: Math.round(Number(v.minWord)), after: Math.round(Number(v.after)), before: Math.round(Number(v.before)), limit: Math.round(Number(v.limit)), zone: Math.max(0, Number(v.zone)), caps: !!v.caps } } } : n)));
}

export async function justificationDialog(engine: Engine): Promise<void> {
  const list = paraTargets(engine), t = list[0];
  if (!t) { engine.notice('Select type or click into it first.'); return; }
  const j = { ...DEFAULT_JUST, ...(t.para.just ?? {}) }, ids = list.map((x) => x.id);
  const trio = (key: 'word' | 'letter' | 'glyph', label: string, lo: number, hi: number): Field[] => (['Min', 'Des', 'Max'] as const).map((s) => ({ kind: 'number', key: `${key}${s}`, label: `${label} ${s === 'Des' ? 'desired' : s.toLowerCase()}`, value: j[`${key}${s}`], min: lo, max: hi, unit: '%' }));
  await previewEdit(engine, 'Justification', [
    ...trio('word', 'Word spacing', 0, 1000), ...trio('letter', 'Letter spacing', -100, 500), ...trio('glyph', 'Glyph scaling', 50, 200),
    { kind: 'select', key: 'single', label: 'Single word justification', value: j.single, choices: [['justify', 'Full justify'], ['left', 'Align left'], ['center', 'Align center'], ['right', 'Align right']] },
  ], (origin, v) => {
    const n3 = (k: string): [number, number, number] => { const a = [Number(v[`${k}Min`]), Number(v[`${k}Des`]), Number(v[`${k}Max`])]; const d = Math.max(a[0], Math.min(a[2], a[1])); return [Math.min(a[0], d), d, Math.max(a[2], d)]; };
    const [wordMin, wordDes, wordMax] = n3('word'), [letterMin, letterDes, letterMax] = n3('letter'), [glyphMin, glyphDes, glyphMax] = n3('glyph');
    const just: Justification = { wordMin, wordDes, wordMax, letterMin, letterDes, letterMax, glyphMin, glyphDes, glyphMax, single: String(v.single) as Justification['single'] };
    return updateNodes(origin, ids, (n) => (n.kind === 'text' ? { ...n, para: { ...n.para, just } } : n));
  });
}

function currentStyle(e: Engine): CharStyle | null {
  const ed = typing.editor, n = ed?.node();
  if (n) return styleAt(n.spans, Math.max(0, Math.min(ed?.caret ?? 0, ed?.anchor ?? 0)));
  return texts(e)[0]?.spans[0]?.style ?? null;
}

function setChar(e: Engine, patch: Partial<CharStyle>): void {
  Object.assign(typeDefaults, Object.fromEntries(Object.entries(patch).filter(([k]) => k === 'font' || k === 'style' || k === 'size')));
  if (patch.font || patch.style) void ensureFace(patch.font ?? currentStyle(e)?.font ?? 'Inter', patch.style ?? currentStyle(e)?.style ?? 'Regular');
  const ed = typing.editor, n = ed?.node();
  if (n) { e.setCharStyle(patch, [n.id], ed?.range() ?? undefined); return; }
  if (texts(e).length) e.setCharStyle(patch);
  else e.emit('options', null);
}

export class CharacterPanel {
  readonly body = el('<div class="cv-kit-page cv-charp"></div>');
  private frame = 0;
  private readonly font;
  private readonly style;
  private readonly size;
  private readonly leading;
  private readonly kerning;
  private readonly tracking;
  private readonly hscale;
  private readonly vscale;
  private readonly baseline;
  private readonly caps;
  private readonly position;
  private readonly underline;
  private readonly strike;
  private readonly upright;
  private readonly ot;
  private readonly figures;
  private readonly otPos;
  private readonly sset;
  private readonly rotate;
  private readonly varOnly;
  private readonly axesBox = el('<div class="cv-charp-axes" hidden></div>');
  private readonly axesList = el('<div class="cv-charp-axes-list"></div>');
  private readonly axisCtl = new Map<string, Ctl<number>>();
  private varInfo: VariationInfo | null = null;
  private varKey = '';
  private onlyVariable = false;

  constructor(private readonly engine: Engine) {
    const set = (p: Partial<CharStyle>): void => setChar(engine, p);
    this.rotate = numField('Rotation', '°', (v) => set({ rotate: v ? v : undefined }), { min: -360, max: 360, title: 'Character rotation, counter-clockwise' });
    this.varOnly = check('Variable fonts only', (v) => { this.onlyVariable = v; this.queue(); });
    const swap = (drop: (f: string) => boolean, add: string[]): void => set({ features: [...(currentStyle(engine)?.features ?? []).filter((f) => !drop(f)), ...add] });
    this.ot = OT_TOGGLES.map(([tag, label]) => ({ tag, ctl: check(label, (on) => swap((f) => f === tag, on ? [tag] : [])) }));
    this.figures = selectCtl('Figures', FIGURES, (v) => swap((f) => FIG_TAGS.has(f), v ? v.split('+') : []));
    this.otPos = selectCtl('Position', OT_POS, (v) => swap((f) => POS_TAGS.has(f), v ? [v] : []));
    this.sset = selectCtl('Sets', SETS, (v) => swap((f) => /^ss\d\d$/.test(f), v ? [v] : []));
    this.font = selectCtl('', [], (v) => set({ font: v, style: stylesOf(v).includes(currentStyle(engine)?.style ?? 'Regular') ? currentStyle(engine)?.style ?? 'Regular' : stylesOf(v)[0] ?? 'Regular' }));
    this.style = selectCtl('', [], (v) => { const inst = this.varInfo?.instances.find((i) => i.name === v); set({ style: v, axes: inst ? { ...inst.coords } : undefined }); });
    this.size = numField('Size', 'pt', (v) => set({ size: v }), { min: 0.1, max: 1296 });
    this.leading = numField('Leading', 'pt', (v) => set({ leading: v }), { min: 0, max: 5000, title: 'Leading; leave at auto for 120% of the size' });
    this.kerning = selectCtl('Kerning', [['auto', 'Auto'], ['optical', 'Optical'], ['none', 'None']], (v) => set({ kerning: v as CharStyle['kerning'] }));
    this.tracking = numField('Tracking', '‰', (v) => set({ tracking: v }), { min: -1000, max: 10000, step: 10 });
    this.hscale = numField('H Scale', '%', (v) => set({ hscale: v }), { min: 1, max: 10000 });
    this.vscale = numField('V Scale', '%', (v) => set({ vscale: v }), { min: 1, max: 10000 });
    this.baseline = numField('Baseline', 'pt', (v) => set({ baseline: v }), { min: -1000, max: 1000 });
    this.caps = seg([{ id: 'none', label: 'Normal' }, { id: 'all', label: 'All Caps' }, { id: 'small', label: 'Small Caps' }], (id) => set({ caps: id as CharStyle['caps'] }));
    this.position = seg([{ id: 'normal', label: 'Normal' }, { id: 'super', label: 'Superscript' }, { id: 'sub', label: 'Subscript' }], (id) => set({ position: id as CharStyle['position'] }));
    this.underline = check('Underline', (v) => set({ underline: v }));
    this.strike = check('Strikethrough', (v) => set({ strike: v }));
    this.upright = check('Upright Latin in vertical type', (v) => set({ upright: v || undefined }));
    this.body.append(this.font.el, this.varOnly.el, this.style.el, row(this.size.el, this.leading.el), row(this.kerning.el, this.tracking.el), row(this.hscale.el, this.vscale.el), row(this.baseline.el, this.rotate.el), section('Case'), this.caps.el, section('Position'), this.position.el, row(this.underline.el, this.strike.el), this.upright.el, section('OpenType'), this.figures.el, this.otPos.el, this.sset.el);
    for (let i = 0; i < this.ot.length; i += 2) this.body.append(row(...this.ot.slice(i, i + 2).map((o) => o.ctl.el)));
    this.axesBox.append(section('Variable Font'), this.axesList);
    this.body.append(this.axesBox);
    for (const k of ['selection', 'doc', 'active', 'options'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const st = currentStyle(this.engine), fam = st?.font ?? typeDefaults.font, sty = st?.style ?? typeDefaults.style;
    this.font.setChoices(families().filter((f) => !this.onlyVariable || f === fam || isVariableFamily(f)).map((f) => [f, isVariableFamily(f) ? `${f} (Variable)` : f] as const));
    this.font.set(fam);
    this.varOnly.set(this.onlyVariable);
    this.style.setChoices(stylesOf(fam).map((s) => [s, s] as const));
    this.style.set(sty);
    this.rotate.set(st?.rotate ?? 0);
    const vk = `${fam}|${sty}`;
    if (vk !== this.varKey) {
      this.varKey = vk;
      this.varInfo = null;
      void variationOf(fam, sty).then((info) => { if (this.varKey === vk) { this.varInfo = info; this.queue(); } });
    }
    const axes = this.varInfo?.axes ?? [], akey = (a: VariationAxis): string => `${a.tag}:${a.min}:${a.max}`;
    setHidden(this.axesBox, !axes.length);
    patchList(this.axesList, axes, {
      key: akey,
      create: (a) => {
        const c = slider(this.engine, a.name, a.min, a.max, (v) => setChar(this.engine, { axes: { ...(currentStyle(this.engine)?.axes ?? {}), [a.tag]: v } }), { step: a.max - a.min > 20 ? 1 : 0.1 });
        c.set(st?.axes?.[a.tag] ?? a.def);
        this.axisCtl.set(akey(a), c);
        return c.el;
      },
      update: (_n, a) => { this.axisCtl.get(akey(a))?.set(st?.axes?.[a.tag] ?? a.def); },
    });
    this.size.set(st?.size ?? typeDefaults.size);
    this.leading.set(st ? st.leading ?? Math.round(st.size * 1.2 * 100) / 100 : null);
    this.kerning.set(st?.kerning ?? 'auto');
    this.tracking.set(st?.tracking ?? 0);
    this.hscale.set(st?.hscale ?? 100);
    this.vscale.set(st?.vscale ?? 100);
    this.baseline.set(st?.baseline ?? 0);
    this.caps.set(st?.caps ?? 'none');
    this.position.set(st?.position ?? 'normal');
    this.underline.set(!!st?.underline);
    this.strike.set(!!st?.strike);
    this.upright.set(!!st?.upright);
    this.upright.enable(texts(this.engine).some((t) => !!t.vertical) || !!typing.editor?.node()?.vertical);
    const f = new Set(st?.features ?? []), probe: CharStyle = st ?? { ...DEFAULT_CHAR, font: fam, style: typeDefaults.style };
    const has = (t: string): boolean => f.has(t) || fontHasFeature(probe, t);
    for (const o of this.ot) { o.ctl.set(f.has(o.tag)); o.ctl.enable(has(o.tag)); }
    this.figures.set(FIGURES.find(([v]) => v && v.split('+').every((t) => f.has(t)))?.[0] ?? '');
    this.figures.enable([...FIG_TAGS].some(has));
    this.otPos.set([...POS_TAGS].find((t) => f.has(t)) ?? '');
    this.otPos.enable([...POS_TAGS].some(has));
    this.sset.set([...f].find((t) => /^ss\d\d$/.test(t)) ?? '');
    this.sset.enable(SETS.some(([t]) => !!t && has(t)));
  }
}

export class ParagraphPanel {
  readonly body = el('<div class="cv-kit-page cv-parap"></div>');
  private frame = 0;
  private readonly align;
  private readonly left;
  private readonly right;
  private readonly first;
  private readonly before;
  private readonly after;
  private readonly hyph;
  private readonly cols;
  private readonly gutter;
  private readonly inset;
  private readonly areaBox = el('<div class="cv-parap-area"></div>');
  private readonly listKind;
  private readonly bullet;
  private readonly numFmt;
  private readonly numStart;

  constructor(private readonly engine: Engine) {
    const set = (p: Partial<ParaStyle>): void => { const n = typing.editor?.node(); engine.setParaStyle(p, n ? [n.id] : undefined); };
    const curList = (): ListStyle | undefined => (typing.editor?.node() ?? texts(engine)[0])?.para.list;
    const setList = (patch: Partial<ListStyle>): void => { const l = curList(); if (l) set({ list: { ...l, ...patch } }); };
    this.align = seg([{ id: 'left', label: 'Align left', icon: 'alignLeft' }, { id: 'center', label: 'Align center', icon: 'alignCenter' }, { id: 'right', label: 'Align right', icon: 'alignRight' }, { id: 'justify', label: 'Justify with last line aligned left', icon: 'alignJustify' }, { id: 'justify_center', label: 'Justify with last line centered', icon: 'vJustifyCenter' }, { id: 'justify_right', label: 'Justify with last line aligned right', icon: 'vJustifyRight' }, { id: 'justify_all', label: 'Justify all lines', icon: 'vJustifyAll' }], (id) => set({ align: id as ParaStyle['align'] }));
    this.listKind = selectCtl('List', [['', 'None'], ['bullet', 'Bullets'], ['number', 'Numbers']], (v) => { const l = curList(); set({ list: v ? { kind: v as ListStyle['kind'], bullet: l?.bullet ?? '•', format: l?.format ?? '1', start: l?.start ?? 1, sep: l?.sep ?? '.' } : undefined }); });
    this.bullet = selectCtl('Bullet', BULLETS, (v) => setList({ bullet: v }));
    this.numFmt = selectCtl('Format', NUMBER_FORMATS, (v) => setList({ format: v as ListFormat }));
    this.numStart = numField('Start at', '', (v) => setList({ start: Math.round(v) }), { min: 0, max: 9999 });
    this.left = numField('Left', 'pt', (v) => set({ indentLeft: v }), { min: -1000, max: 1000 });
    this.right = numField('Right', 'pt', (v) => set({ indentRight: v }), { min: -1000, max: 1000 });
    this.first = numField('First', 'pt', (v) => set({ indentFirst: v }), { min: -1000, max: 1000 });
    this.before = numField('Before', 'pt', (v) => set({ spaceBefore: v }), { min: 0, max: 1000 });
    this.after = numField('After', 'pt', (v) => set({ spaceAfter: v }), { min: 0, max: 1000 });
    this.hyph = check('Hyphenate', (v) => set({ hyphenate: v }));
    const area = (patch: Partial<NonNullable<TextNode['area']>>): void => { for (const t of texts(engine)) if (t.mode === 'area') engine.setTextNode(t.id, { area: { ...(t.area ?? { columns: 1, rows: 1, gutter: 12, inset: 0, firstBaseline: 'ascent' }), ...patch } }, 'Area Type Options'); };
    this.cols = numField('Columns', '', (v) => area({ columns: Math.max(1, Math.round(v)) }), { min: 1, max: 20 });
    this.gutter = numField('Gutter', 'pt', (v) => area({ gutter: v }), { min: 0, max: 1000 });
    this.inset = numField('Inset', 'pt', (v) => area({ inset: v }), { min: 0, max: 1000 });
    this.areaBox.append(section('Area Type'), row(this.cols.el, this.gutter.el), this.inset.el);
    const btn = (label: string, title: string, run: () => void): HTMLButtonElement => { const b = el<HTMLButtonElement>('<button type="button" class="cv-btn cv-parap-btn"></button>'); setText(b, label); setTitle(b, title); b.addEventListener('click', run); return b; };
    const opts = row(btn('Hyphenation', 'Hyphenation settings', () => void hyphenationDialog(engine)), btn('Justification', 'Word spacing, letter spacing and glyph scaling', () => void justificationDialog(engine)));
    this.body.append(this.align.el, section('Indents'), row(this.left.el, this.right.el), this.first.el, section('Space'), row(this.before.el, this.after.el), this.hyph.el, opts, section('Bullets and Numbering'), this.listKind.el, row(this.bullet.el, this.numFmt.el), this.numStart.el, this.areaBox);
    for (const k of ['selection', 'doc', 'active'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const t = typing.editor?.node() ?? texts(this.engine)[0], p = t?.para;
    this.align.set(p?.align ?? 'left');
    this.left.set(p?.indentLeft ?? 0); this.right.set(p?.indentRight ?? 0); this.first.set(p?.indentFirst ?? 0);
    this.before.set(p?.spaceBefore ?? 0); this.after.set(p?.spaceAfter ?? 0); this.hyph.set(!!p?.hyphenate);
    const l = p?.list;
    this.listKind.set(l?.kind ?? ''); this.bullet.set(l?.bullet ?? '•'); this.numFmt.set(l?.format ?? '1'); this.numStart.set(l?.start ?? 1);
    this.bullet.enable(l?.kind === 'bullet'); this.numFmt.enable(l?.kind === 'number'); this.numStart.enable(l?.kind === 'number');
    this.areaBox.hidden = t?.mode !== 'area';
    this.cols.set(t?.area?.columns ?? 1); this.gutter.set(t?.area?.gutter ?? 12); this.inset.set(t?.area?.inset ?? 0);
  }
}

const TAB_ICONS: Record<TabAlign, string> = { left: 'vTabLeft', center: 'vTabCenter', right: 'vTabRight', decimal: 'vTabDecimal' };
const TAB_ALIGNS: readonly TabAlign[] = ['left', 'center', 'right', 'decimal'];

export class TabsPanel {
  readonly body = el('<div class="cv-kit-page cv-tabsp"><div class="cv-tabsp-ruler" role="group" aria-label="Tab ruler"><div class="cv-tabsp-stops"></div></div><div class="cv-tabsp-scale"><span>0</span><span class="cv-tabsp-span"></span></div></div>');
  private frame = 0;
  private picked = -1;
  private alignNew: TabAlign = 'left';
  private span = 288;
  private readonly ruler: HTMLElement;
  private readonly stopsEl: HTMLElement;
  private readonly align;
  private readonly pos;
  private readonly leader: HTMLInputElement;
  private readonly dec: HTMLInputElement;
  private readonly del: HTMLButtonElement;
  private readonly clear: HTMLButtonElement;

  constructor(private readonly engine: Engine) {
    this.ruler = q(this.body, '.cv-tabsp-ruler');
    this.stopsEl = q(this.body, '.cv-tabsp-stops');
    setTitle(this.ruler, 'Click to add a tab stop; drag a stop to move it, or drag it down off the ruler to remove it.');
    this.align = seg(TAB_ALIGNS.map((a) => ({ id: a, label: `${a === 'decimal' ? 'Decimal' : a[0].toUpperCase() + a.slice(1)}-justified tab`, icon: TAB_ICONS[a] })), (id) => { this.alignNew = id as TabAlign; if (this.picked >= 0) this.patchStop(this.picked, { align: id as TabAlign }); else this.queue(); });
    this.pos = numField('X', 'pt', (v) => { if (this.picked >= 0) this.patchStop(this.picked, { pos: v }); }, { min: 0, max: 10000 });
    const text = (label: string, title: string, max: number, change: (v: string) => void): { el: HTMLElement; input: HTMLInputElement } => {
      const n = el(`<label class="cv-props-field"><span class="cv-pf-label"></span><span class="cv-num"><input type="text" maxlength="${max}" spellcheck="false"></span></label>`);
      setText(q(n, '.cv-pf-label'), label); n.title = title;
      const input = q<HTMLInputElement>(n, 'input');
      input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') input.blur(); });
      input.addEventListener('change', () => change(input.value));
      return { el: n, input };
    };
    const lead = text('Leader', 'Characters repeated to fill the space before the stop', 4, (v) => { if (this.picked >= 0) this.patchStop(this.picked, { leader: v || undefined }); });
    const dec = text('Align On', 'The character a decimal tab lines up', 1, (v) => { if (this.picked >= 0) this.patchStop(this.picked, { char: v || undefined }); });
    this.leader = lead.input; this.dec = dec.input;
    const btn = (label: string, run: () => void): HTMLButtonElement => { const b = el<HTMLButtonElement>('<button type="button" class="cv-btn cv-parap-btn"></button>'); setText(b, label); b.addEventListener('click', run); return b; };
    this.del = btn('Delete Stop', () => { const t = this.target(); if (t && this.picked >= 0) { this.setTabs((t.para.tabs ?? []).filter((_, k) => k !== this.picked)); this.picked = -1; } });
    this.clear = btn('Clear All', () => { this.picked = -1; this.setTabs(undefined); });
    this.body.prepend(this.align.el);
    this.body.append(row(this.pos.el, lead.el), row(dec.el), row(this.del, this.clear));
    this.ruler.addEventListener('pointerdown', (e) => this.down(e));
    for (const k of ['selection', 'doc', 'active'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private target(): TextNode | null { return typing.editor?.node() ?? texts(this.engine)[0] ?? null; }
  private ids(): string[] { const n = typing.editor?.node(); return n ? [n.id] : texts(this.engine).map((t) => t.id); }
  private setTabs(tabs: TabStop[] | undefined): void { const n = typing.editor?.node(); this.engine.setParaStyle({ tabs: tabs?.length ? tabs : undefined }, n ? [n.id] : undefined); }
  private patchStop(i: number, patch: Partial<TabStop>): void { const t = this.target(); if (t?.para.tabs?.[i]) this.setTabs(t.para.tabs.map((s, k) => (k === i ? { ...s, ...patch } : s))); }

  private down(e: PointerEvent): void {
    const t = this.target();
    if (!t || e.button !== 0) return;
    e.preventDefault();
    const r = this.ruler.getBoundingClientRect(), at = (cx: number): number => Math.max(0, Math.round(((cx - r.left) / Math.max(1, r.width)) * this.span));
    const hit = (e.target as HTMLElement).closest<HTMLElement>('.cv-tabsp-stop'), tabs = t.para.tabs ?? [];
    if (!hit) { this.picked = tabs.length; this.setTabs([...tabs, { pos: at(e.clientX), align: this.alignNew }]); return; }
    const i = Number(hit.dataset.i), ids = this.ids();
    this.picked = i;
    this.queue();
    this.engine.beginDrag('Tabs');
    const origin = this.engine.dragOrigin;
    if (!origin) return;
    let gone = false;
    this.ruler.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent): void => {
      gone = ev.clientY - r.bottom > 24;
      const next = gone ? tabs.filter((_, k) => k !== i) : tabs.map((s, k) => (k === i ? { ...s, pos: at(ev.clientX) } : s));
      this.engine.dragTo(updateNodes(origin, ids, (n) => (n.kind === 'text' ? { ...n, para: { ...n.para, tabs: next.length ? next : undefined } } : n)));
      this.queue();
    };
    const up = (): void => {
      this.ruler.removeEventListener('pointermove', move); this.ruler.removeEventListener('pointerup', up); this.ruler.removeEventListener('pointercancel', up);
      if (gone) this.picked = -1;
      this.engine.commitDrag();
    };
    this.ruler.addEventListener('pointermove', move); this.ruler.addEventListener('pointerup', up); this.ruler.addEventListener('pointercancel', up);
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const t = this.target(), tabs = t?.para.tabs ?? [];
    if (this.picked >= tabs.length) this.picked = -1;
    this.span = Math.max(72, Math.round(t?.mode === 'area' && t.frame ? t.frame.w : 288));
    setText(q(this.body, '.cv-tabsp-span'), `${this.span} pt`);
    setStyleVar(this.ruler, '--cv-tab-tick', `${(36 / this.span) * 100}%`);
    setClass(this.ruler, 'is-off', !t);
    patchList(this.stopsEl, tabs.map((s, i) => ({ s, i })), {
      key: (x) => `s${x.i}`,
      create: (x) => { const b = el<HTMLButtonElement>('<button type="button" class="cv-tabsp-stop" tabindex="-1"></button>'); b.dataset.i = String(x.i); this.paintStop(b, x.s, x.i); return b; },
      update: (b, x) => this.paintStop(b, x.s, x.i),
    });
    const s = this.picked >= 0 ? tabs[this.picked] : null;
    this.align.set(s?.align ?? this.alignNew);
    this.align.enable(!!t);
    this.pos.set(s ? s.pos : null); this.pos.enable(!!s);
    setValue(this.leader, s?.leader ?? ''); setDisabled(this.leader, !s);
    setValue(this.dec, s?.char ?? (s?.align === 'decimal' ? '.' : '')); setDisabled(this.dec, s?.align !== 'decimal');
    setDisabled(this.del, !s); setDisabled(this.clear, !tabs.length);
  }

  private paintStop(b: HTMLElement, s: TabStop, i: number): void {
    setStyleVar(b, '--x', `${Math.min(100, (s.pos / this.span) * 100)}%`);
    setHtml(b, icon(TAB_ICONS[s.align], 14), s.align);
    setClass(b, 'is-on', i === this.picked);
    setTitle(b, `${s.align[0].toUpperCase() + s.align.slice(1)} tab at ${Math.round(s.pos * 10) / 10} pt`);
  }
}

export class GlyphsPanel {
  readonly body = el('<div class="cv-kit-page cv-glyphp"><p class="cv-props-none">Choose a font to see its glyphs; double-click a glyph to insert it at the text cursor. Select one character to see its alternates.</p><div class="cv-glyphp-alts" hidden><span class="cv-glyphp-alts-label"></span><div class="cv-glyphp-alts-row" role="listbox" aria-label="Alternates for the selected character"></div></div><div class="cv-glyphp-grid" role="listbox" aria-label="Glyphs"></div></div>');
  private readonly grid: HTMLElement;
  private readonly alts: HTMLElement;
  private readonly altRow: HTMLElement;
  private key = '';
  private altKey = '';
  private altFrame = 0;
  private frame = 0;

  caretMoved(): void { if (!this.altFrame) this.altFrame = requestAnimationFrame(() => { this.altFrame = 0; void this.syncAlts(); }); }

  private async syncAlts(): Promise<void> {
    const ed = typing.editor, n = ed?.node(), r = ed?.range() ?? null;
    const ch = n && r && r[1] - r[0] === 1 ? plainText(n).slice(r[0], r[1]) : '';
    const st = n && ch && r ? styleAt(n.spans, r[0]) : null;
    const key = st && r && n ? `${n.id}|${r[0]}|${ch}|${st.font}|${st.style}|${st.alt ?? ''}` : '';
    if (key === this.altKey) return;
    this.altKey = key;
    if (!st || !n || !r || !/\S/.test(ch)) { setHidden(this.alts, true); return; }
    const list = await glyphAlternates(st.font, st.style, ch);
    if (this.altKey !== key) return;
    if (list.length < 2) { setHidden(this.alts, true); return; }
    setText(q(this.alts, '.cv-glyphp-alts-label'), `Alternates for ${ch}`);
    const current = st.alt ?? list[0].gid, id = n.id, range: [number, number] = [r[0], r[1]];
    patchList(this.altRow, list, {
      key: (g) => `g${g.gid}`,
      create: (g) => {
        const b = el<HTMLButtonElement>(`<button class="cv-glyphp-alt" type="button" role="option"><svg viewBox="${-10} 0 ${Math.max(60, g.adv * 100 + 20)} 100" aria-hidden="true"><path fill="currentColor"/></svg></button>`);
        q(b, 'path').setAttribute('d', g.d);
        b.dataset.gid = String(g.gid);
        b.addEventListener('click', () => { const gid = Number(b.dataset.gid), base = list[0].gid; this.engine.setCharStyle({ alt: gid === base ? undefined : gid }, [id], range); this.altKey = ''; this.caretMoved(); });
        return b;
      },
      update: (b, g) => { setClass(b, 'is-on', g.gid === current); b.setAttribute('aria-selected', String(g.gid === current)); setTitle(b, g.gid === list[0].gid ? 'Default glyph' : `Alternate glyph ${g.gid}`); },
    });
    setHidden(this.alts, false);
  }

  constructor(private readonly engine: Engine) {
    this.grid = this.body.querySelector('.cv-glyphp-grid') as HTMLElement;
    this.alts = q(this.body, '.cv-glyphp-alts');
    this.altRow = q(this.alts, '.cv-glyphp-alts-row');
    this.grid.addEventListener('dblclick', (e) => {
      const g = (e.target as HTMLElement).closest<HTMLElement>('.cv-glyphp-cell')?.dataset.ch;
      if (!g) return;
      const ed = typing.editor;
      if (ed?.active) ed.replace(g);
      else engine.notice('Click into type with the Type tool first, then double-click a glyph to insert it.');
    });
    for (const k of ['selection', 'options', 'active'] as const) engine.on(k, () => this.queue());
    this.queue();
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; void this.sync(); }); }

  private async sync(): Promise<void> {
    const st = currentStyle(this.engine), fam = st?.font ?? typeDefaults.font, sty = st?.style ?? typeDefaults.style, key = `${fam}|${sty}`;
    if (key === this.key) return;
    this.key = key;
    const list = (await glyphList(fam, sty, 1200)).slice(0, 600);
    if (this.key !== key) return;
    this.grid.style.fontFamily = `"${fam}", Inter, sans-serif`;
    patchList(this.grid, list.map((ch) => ({ ch })), {
      key: (x) => `u${x.ch.codePointAt(0)}`,
      create: (x) => { const c = el('<button class="cv-glyphp-cell" type="button" role="option"></button>'); setText(c, x.ch); c.dataset.ch = x.ch; c.title = `U+${(x.ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`; return c; },
      update: () => undefined,
    });
    setClass(this.body, 'has-glyphs', list.length > 0);
  }
}

const BASELINES: ReadonlyArray<readonly [FirstBaseline, string]> = [['ascent', 'Ascent'], ['cap', 'Cap Height'], ['leading', 'Leading'], ['x', 'x Height'], ['em', 'Em Box Height'], ['fixed', 'Fixed'], ['legacy', 'Legacy']];

export async function areaTypeOptionsDialog(engine: Engine): Promise<void> {
  const list = texts(engine).filter((t) => t.mode === 'area');
  const t = list[0];
  if (!t) return;
  const a: AreaOptions = t.area ?? { columns: 1, rows: 1, gutter: 12, inset: 0, firstBaseline: 'ascent' }, rect = !t.framePath && !!t.frame, ids = list.map((x) => x.id);
  await previewEdit(engine, 'Area Type Options', [
    ...(rect ? [{ kind: 'number', key: 'w', label: 'Width', value: Math.round(t.frame?.w ?? 0), min: 1, unit: 'pt' } as const, { kind: 'number', key: 'h', label: 'Height', value: Math.round(t.frame?.h ?? 0), min: 1, unit: 'pt' } as const] : []),
    { kind: 'number', key: 'rows', label: 'Rows', value: a.rows ?? 1, min: 1, max: 100 },
    { kind: 'number', key: 'rowGutter', label: 'Row gutter', value: a.rowGutter ?? a.gutter ?? 12, min: 0, unit: 'pt' },
    { kind: 'number', key: 'columns', label: 'Columns', value: a.columns ?? 1, min: 1, max: 100 },
    { kind: 'number', key: 'gutter', label: 'Column gutter', value: a.gutter ?? 12, min: 0, unit: 'pt' },
    { kind: 'number', key: 'inset', label: 'Inset spacing', value: a.inset ?? 0, min: 0, unit: 'pt' },
    { kind: 'select', key: 'first', label: 'First baseline', value: a.firstBaseline ?? 'ascent', choices: BASELINES },
    { kind: 'number', key: 'min', label: 'Min', value: a.baselineMin ?? 0, min: 0, unit: 'pt' },
    { kind: 'select', key: 'flow', label: 'Text flow', value: a.flow ?? 'rows', choices: [['rows', 'By rows'], ['columns', 'By columns']] },
  ], (origin, v) => updateNodes(origin, ids, (n) => {
    if (n.kind !== 'text' || n.mode !== 'area') return n;
    const area: AreaOptions = { ...(n.area ?? a), rows: Math.max(1, Math.round(Number(v.rows))), rowGutter: Math.max(0, Number(v.rowGutter)), columns: Math.max(1, Math.round(Number(v.columns))), gutter: Math.max(0, Number(v.gutter)), inset: Math.max(0, Number(v.inset)), firstBaseline: String(v.first) as FirstBaseline, baselineMin: Math.max(0, Number(v.min)), flow: v.flow === 'columns' ? 'columns' : 'rows' };
    const fw = Number(v.w), fh = Number(v.h), f0 = n.frame;
    const frame = rect && f0 && n.id === t.id && v.w !== undefined ? { ...f0, w: fw === Math.round(f0.w) ? f0.w : Math.max(1, fw), h: fh === Math.round(f0.h) ? f0.h : Math.max(1, fh) } : f0;
    return { ...n, area, frame };
  }));
}

export async function pathTypeOptionsDialog(engine: Engine): Promise<void> {
  const list = texts(engine).filter((t) => t.mode === 'path');
  const t = list[0];
  if (!t) return;
  const ids = list.map((x) => x.id);
  await previewEdit(engine, 'Type on a Path Options', [
    { kind: 'select', key: 'effect', label: 'Effect', value: t.pathEffect ?? 'rainbow', choices: [['rainbow', 'Rainbow'], ['skew', 'Skew'], ['ribbon', '3D Ribbon'], ['stair', 'Stair Step'], ['gravity', 'Gravity']] },
    { kind: 'check', key: 'flip', label: 'Flip', value: !!t.pathFlip },
    { kind: 'select', key: 'align', label: 'Align to path', value: t.pathAlign ?? 'baseline', choices: [['ascender', 'Ascender'], ['descender', 'Descender'], ['center', 'Center'], ['baseline', 'Baseline']] },
    { kind: 'number', key: 'spacing', label: 'Spacing', value: t.pathSpacing ?? 0, min: 0, max: 1000, unit: 'pt' },
    { kind: 'number', key: 'start', label: 'Start', value: Math.round((t.pathStart ?? 0) * 1000) / 10, min: 0, max: 100, unit: '%' },
    { kind: 'number', key: 'end', label: 'End', value: Math.round((t.pathEnd ?? 1) * 1000) / 10, min: 0, max: 100, unit: '%' },
  ], (origin, v) => updateNodes(origin, ids, (n) => (n.kind === 'text' && n.mode === 'path' ? { ...n, pathEffect: String(v.effect) as PathEffect, pathFlip: v.flip ? true : undefined, pathAlign: String(v.align) as PathAlign, pathSpacing: Math.max(0, Number(v.spacing)), pathStart: Math.max(0, Math.min(1, Number(v.start) / 100)), pathEnd: Math.max(0, Math.min(1, Number(v.end) / 100)) } : n)));
}

export async function findReplaceDialog(engine: Engine): Promise<void> {
  const v = await askForm('Find and Replace', [{ kind: 'text', key: 'find', label: 'Find', value: '' }, { kind: 'text', key: 'replace', label: 'Replace with', value: '' }, { kind: 'check', key: 'case', label: 'Match case', value: false }], { ok: 'Replace All' });
  if (!v || !v.find) return;
  const doc = engine.doc;
  if (!doc) return;
  const flags = v.case ? 'g' : 'gi', re = new RegExp(String(v.find).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
  let count = 0;
  engine.beginGesture();
  for (const t of allNodes(doc)) {
    if (t.kind !== 'text') continue;
    const spans = t.spans.map((s) => ({ ...s, text: s.text.replace(re, () => { count++; return String(v.replace); }) }));
    if (spans.some((s, i) => s.text !== t.spans[i].text)) engine.setTextSpans(t.id, spans, 'Find and Replace');
  }
  engine.endGesture();
  engine.notice(count ? `Replaced ${count} occurrence${count === 1 ? '' : 's'}.` : 'No matches.');
}

import { allNodes } from '../../engine/doc';
import { DEFAULT_CHAR, fontHasFeature, styleAt } from '../../engine/text';
import type { CharStyle, Engine, ParaStyle, TextNode } from '../../engine';
import { el, patchList, setClass, setText } from '../dom';
import { askForm } from '../form-dialog';
import { typing } from '../text-editor';
import { families, glyphList, stylesOf, ensureFace } from '../../io/fonts';
import { typeDefaults } from '../../tools/type';
import { check, numField, row, section, seg, selectCtl } from './kit';

function texts(e: Engine): TextNode[] { return e.selected().filter((n): n is TextNode => n.kind === 'text'); }

const OT_TOGGLES: ReadonlyArray<readonly [string, string]> = [['liga', 'Ligatures'], ['dlig', 'Discretionary'], ['swsh', 'Swash'], ['salt', 'Alternates'], ['titl', 'Titling'], ['ordn', 'Ordinals'], ['frac', 'Fractions'], ['zero', 'Slashed Zero'], ['case', 'Case Forms']];
const FIGURES: ReadonlyArray<readonly [string, string]> = [['', 'Default Figure'], ['tnum+lnum', 'Tabular Lining'], ['pnum+onum', 'Proportional Oldstyle'], ['pnum+lnum', 'Proportional Lining'], ['tnum+onum', 'Tabular Oldstyle']];
const FIG_TAGS = new Set(['tnum', 'pnum', 'lnum', 'onum']);
const OT_POS: ReadonlyArray<readonly [string, string]> = [['', 'Default Position'], ['sups', 'Superior'], ['subs', 'Inferior'], ['numr', 'Numerator'], ['dnom', 'Denominator']];
const POS_TAGS = new Set(['sups', 'subs', 'numr', 'dnom']);
const SETS: ReadonlyArray<readonly [string, string]> = [['', 'No Stylistic Set'], ...Array.from({ length: 20 }, (_, i) => [`ss${String(i + 1).padStart(2, '0')}`, `Stylistic Set ${i + 1}`] as const)];

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
  private readonly ot;
  private readonly figures;
  private readonly otPos;
  private readonly sset;

  constructor(private readonly engine: Engine) {
    const set = (p: Partial<CharStyle>): void => setChar(engine, p);
    const swap = (drop: (f: string) => boolean, add: string[]): void => set({ features: [...(currentStyle(engine)?.features ?? []).filter((f) => !drop(f)), ...add] });
    this.ot = OT_TOGGLES.map(([tag, label]) => ({ tag, ctl: check(label, (on) => swap((f) => f === tag, on ? [tag] : [])) }));
    this.figures = selectCtl('Figures', FIGURES, (v) => swap((f) => FIG_TAGS.has(f), v ? v.split('+') : []));
    this.otPos = selectCtl('Position', OT_POS, (v) => swap((f) => POS_TAGS.has(f), v ? [v] : []));
    this.sset = selectCtl('Sets', SETS, (v) => swap((f) => /^ss\d\d$/.test(f), v ? [v] : []));
    this.font = selectCtl('', [], (v) => set({ font: v, style: stylesOf(v).includes(currentStyle(engine)?.style ?? 'Regular') ? currentStyle(engine)?.style ?? 'Regular' : stylesOf(v)[0] ?? 'Regular' }));
    this.style = selectCtl('', [], (v) => set({ style: v }));
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
    this.body.append(this.font.el, this.style.el, row(this.size.el, this.leading.el), row(this.kerning.el, this.tracking.el), row(this.hscale.el, this.vscale.el), this.baseline.el, section('Case'), this.caps.el, section('Position'), this.position.el, row(this.underline.el, this.strike.el), section('OpenType'), this.figures.el, this.otPos.el, this.sset.el);
    for (let i = 0; i < this.ot.length; i += 2) this.body.append(row(...this.ot.slice(i, i + 2).map((o) => o.ctl.el)));
    for (const k of ['selection', 'doc', 'active', 'options'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const st = currentStyle(this.engine), fam = st?.font ?? typeDefaults.font;
    this.font.setChoices(families().map((f) => [f, f] as const));
    this.font.set(fam);
    this.style.setChoices(stylesOf(fam).map((s) => [s, s] as const));
    this.style.set(st?.style ?? typeDefaults.style);
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

  constructor(private readonly engine: Engine) {
    const set = (p: Partial<ParaStyle>): void => { const n = typing.editor?.node(); engine.setParaStyle(p, n ? [n.id] : undefined); };
    this.align = seg([{ id: 'left', label: 'Align left', icon: 'alignLeft' }, { id: 'center', label: 'Align center', icon: 'alignCenter' }, { id: 'right', label: 'Align right', icon: 'alignRight' }, { id: 'justify', label: 'Justify with last line aligned left', icon: 'alignJustify' }, { id: 'justify_center', label: 'Justify with last line centered' }, { id: 'justify_all', label: 'Justify all lines' }], (id) => set({ align: id as ParaStyle['align'] }));
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
    this.body.append(this.align.el, section('Indents'), row(this.left.el, this.right.el), this.first.el, section('Space'), row(this.before.el, this.after.el), this.hyph.el, this.areaBox);
    for (const k of ['selection', 'doc', 'active'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const t = typing.editor?.node() ?? texts(this.engine)[0], p = t?.para;
    this.align.set(p?.align ?? 'left');
    this.left.set(p?.indentLeft ?? 0); this.right.set(p?.indentRight ?? 0); this.first.set(p?.indentFirst ?? 0);
    this.before.set(p?.spaceBefore ?? 0); this.after.set(p?.spaceAfter ?? 0); this.hyph.set(!!p?.hyphenate);
    this.areaBox.hidden = t?.mode !== 'area';
    this.cols.set(t?.area?.columns ?? 1); this.gutter.set(t?.area?.gutter ?? 12); this.inset.set(t?.area?.inset ?? 0);
  }
}

export class GlyphsPanel {
  readonly body = el('<div class="cv-kit-page cv-glyphp"><p class="cv-props-none">Choose a font to see its glyphs; double-click a glyph to insert it at the text cursor.</p><div class="cv-glyphp-grid" role="listbox" aria-label="Glyphs"></div></div>');
  private readonly grid: HTMLElement;
  private key = '';
  private frame = 0;

  constructor(private readonly engine: Engine) {
    this.grid = this.body.querySelector('.cv-glyphp-grid') as HTMLElement;
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

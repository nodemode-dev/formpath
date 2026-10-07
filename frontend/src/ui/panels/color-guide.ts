import { HARMONY_RULES, harmonyColors, variations, type HarmonyRule, type Variation } from '../../engine/harmony';
import { cssColor, hex, rgb, solid } from '../../engine/paint';
import type { Color, Engine } from '../../engine';
import { el, setStyleVar, setTitle } from '../dom';
import { icon } from '../icons';
import { seg, selectCtl } from './kit';

const ROWS = 5, STEPS = 3, COLS = STEPS * 2 + 1;

export class ColorGuidePanel {
  readonly body = el('<div class="cv-kit-page cv-guidep"></div>');
  private readonly base = el<HTMLButtonElement>('<button class="cv-guidep-base" type="button" title="Base color: the current color. Click to make the active color the base again." aria-label="Base color"></button>');
  private readonly strip = el('<div class="cv-guidep-strip" role="listbox" aria-label="Harmony colors"></div>');
  private readonly grid = el('<div class="cv-guidep-grid" role="listbox" aria-label="Color variations"></div>');
  private readonly rule;
  private readonly vary;
  private baseColor: Color = rgb(242, 101, 34);
  private ruleId: HarmonyRule = 'complementary';
  private kind: Variation = 'tints_shades';
  private frame = 0;
  private groups = 0;

  constructor(private readonly engine: Engine) {
    this.rule = selectCtl('', HARMONY_RULES, (v) => { this.ruleId = v as HarmonyRule; this.sync(); });
    this.vary = seg([{ id: 'tints_shades', label: 'Shades' }, { id: 'warm_cool', label: 'Warmth' }, { id: 'vivid_muted', label: 'Vividness' }], (id) => { this.kind = id as Variation; this.sync(); });
    for (let i = 0; i < ROWS; i++) this.strip.appendChild(this.cell(`h${i}`));
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const n = this.cell(`v${r}-${c}`); if (c === STEPS) n.classList.add('is-center'); this.grid.appendChild(n); }
    const top = el('<div class="cv-kit-row cv-guidep-top"></div>');
    top.append(this.base, this.rule.el);
    const save = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="Save the harmony colors as a swatch group" aria-label="Save color group to Swatches">${icon('add', 16)}</button>`);
    save.addEventListener('click', () => this.saveGroup());
    const foot = el('<div class="cv-panel-foot"></div>');
    foot.appendChild(save);
    this.body.append(top, this.strip, this.vary.el, this.grid, foot);
    this.base.addEventListener('click', () => { const c = this.active(); if (c) { this.baseColor = c; this.sync(); } });
    const pick = (ev: Event): void => { const n = (ev.target as HTMLElement).closest<HTMLElement>('.cv-guidep-cell'); const c = n?.dataset.hex; if (c) { const v = rgb(parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)); engine.setActivePaint(solid(v)); } };
    this.strip.addEventListener('click', pick);
    this.grid.addEventListener('click', pick);
    engine.on('colors', () => { const c = this.active(); if (c && hex(c) !== hex(this.baseColor) && !this.fromGuide(c)) { this.baseColor = c; this.queue(); } });
    this.sync();
  }

  private cell(key: string): HTMLButtonElement { const b = el<HTMLButtonElement>('<button class="cv-guidep-cell" type="button" role="option"></button>'); b.dataset.k = key; return b; }
  private active(): Color | null { const p = this.engine.activeSlot === 'fill' ? this.engine.fillPaint : this.engine.strokePaint; return p.type === 'color' ? p.color : null; }
  private shown: Set<string> = new Set();
  private fromGuide(c: Color): boolean { return this.shown.has(hex(c)); }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private colors(): Color[] { return harmonyColors(this.baseColor, this.ruleId); }

  private sync(): void {
    const h = this.colors();
    this.shown = new Set();
    setStyleVar(this.base, '--sw', cssColor(this.baseColor));
    this.rule.set(this.ruleId);
    this.vary.set(this.kind);
    const paint = (n: Element | null, c: Color): void => { if (!(n instanceof HTMLElement)) return; const x = hex(c); this.shown.add(x); setStyleVar(n, '--sw', x); n.dataset.hex = x; setTitle(n, x); };
    h.forEach((c, i) => paint(this.strip.children[i] ?? null, c));
    h.forEach((c, r) => variations(c, this.kind, STEPS).forEach((v, k) => paint(this.grid.children[r * COLS + k] ?? null, v)));
  }

  private saveGroup(): void {
    const e = this.engine;
    if (!e.doc) { e.notice('Open a document to save colors to its swatches.'); return; }
    const name = `Color Guide ${++this.groups}`;
    e.beginGesture();
    this.colors().forEach((c, i) => e.addSwatch(`${name} ${i + 1}`, solid(c), false, false, name));
    e.endGesture();
    e.notice(`${name} is in the Swatches panel.`);
  }
}

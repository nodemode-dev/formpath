import type { Engine } from '../../engine';
import type { PatternSession, PatternType } from '../../engine/pattern';
import { el, setHidden, setText, setValue } from '../dom';
import { check, empty, numField, page, row, section, seg, selectCtl, slider } from './kit';

const TYPES: ReadonlyArray<readonly [PatternType, string]> = [['grid', 'Grid'], ['brick_row', 'Brick by Row'], ['brick_col', 'Brick by Column'], ['hex_col', 'Hex by Column'], ['hex_row', 'Hex by Row']];
const BRICK: ReadonlyArray<readonly [string, string]> = [['0.5', '1/2'], ['0.3333', '1/3'], ['0.25', '1/4'], ['0.2', '1/5']];
const COPIES: ReadonlyArray<readonly [string, string]> = [['0', 'None'], ['3', '3 x 3'], ['5', '5 x 5'], ['7', '7 x 7']];

export class PatternOptionsPanel {
  readonly body = page('cv-patp');
  private readonly idle = el('<div class="cv-patp-idle"></div>');
  private readonly form = el('<div class="cv-patp-form"></div>');
  private readonly name = el<HTMLInputElement>('<input class="cv-input" type="text" spellcheck="false" aria-label="Pattern name">');
  private readonly type;
  private readonly brick;
  private readonly brickRow: HTMLElement;
  private readonly fit;
  private readonly w;
  private readonly h;
  private readonly hs;
  private readonly vs;
  private readonly overH;
  private readonly overV;
  private readonly copies;
  private readonly dim;
  private readonly edge;
  private readonly status = el('<p class="cv-patp-status"></p>');
  private frame = 0;

  constructor(private readonly engine: Engine, run: (cmd: string) => void) {
    const set = (patch: Partial<PatternSession>): void => engine.setPatternSession(patch);
    const btn = (label: string, cmd: string, cls = 'cv-btn'): HTMLButtonElement => { const b = el<HTMLButtonElement>(`<button class="${cls}" type="button">${label}</button>`); b.addEventListener('click', () => run(cmd)); return b; };
    this.idle.append(empty('Select artwork and choose Object > Pattern > Make, or double-click a pattern swatch, to edit a pattern here.'), row(btn('Make Pattern', 'make-pattern')));
    const nameField = el('<label class="cv-props-field is-wide"><span class="cv-pf-label">Name</span></label>');
    nameField.appendChild(this.name);
    this.name.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.name.blur(); });
    this.name.addEventListener('change', () => { const v = this.name.value.trim(); if (v) set({ name: v }); });
    this.type = selectCtl('Tile Type', TYPES, (v) => set({ type: v as PatternType }));
    this.brick = selectCtl('Brick Offset', BRICK, (v) => set({ brick: Number(v) }));
    this.brickRow = row(this.brick.el);
    this.fit = check('Size Tile to Art', (v) => set({ fit: v }));
    this.w = numField('W', 'pt', (v) => set({ w: v, fit: false }), { min: 1 });
    this.h = numField('H', 'pt', (v) => set({ h: v, fit: false }), { min: 1 });
    this.hs = numField('H Spacing', 'pt', (v) => set({ hs: v }));
    this.vs = numField('V Spacing', 'pt', (v) => set({ vs: v }));
    this.overH = seg([{ id: 'left', label: 'Left in Front' }, { id: 'right', label: 'Right in Front' }], (id) => { const s = engine.patternSession; if (s) set({ overlap: [id as 'left' | 'right', s.overlap[1]] }); }, 'cv-seg-small');
    this.overV = seg([{ id: 'top', label: 'Top in Front' }, { id: 'bottom', label: 'Bottom in Front' }], (id) => { const s = engine.patternSession; if (s) set({ overlap: [s.overlap[0], id as 'top' | 'bottom'] }); }, 'cv-seg-small');
    this.copies = selectCtl('Copies', COPIES, (v) => set({ copies: Number(v) as 0 | 3 | 5 | 7 }));
    this.dim = slider(engine, 'Dim Copies to', 0, 100, (v) => set({ dim: v / 100 }), { unit: '%' });
    this.edge = check('Show Tile Edge', (v) => set({ edge: v }));
    this.form.append(
      row(nameField), row(this.type.el), this.brickRow,
      section('Tile Size'), row(this.fit.el), row(this.w.el, this.h.el), row(this.hs.el, this.vs.el),
      section('Overlap'), row(this.overH.el), row(this.overV.el),
      section('Preview'), row(this.copies.el), this.dim.el, row(this.edge.el),
      this.status,
      row(btn('Done', 'pattern-done', 'cv-btn cv-btn-primary'), btn('Save a Copy', 'pattern-copy'), btn('Cancel', 'pattern-cancel')),
    );
    this.body.append(this.idle, this.form);
    for (const k of ['doc', 'active', 'projects', 'options', 'render'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const s = this.engine.patternSession, geo = s ? this.engine.patternGeometry() : null;
    setHidden(this.idle, !!s);
    setHidden(this.form, !s);
    if (!s) return;
    setValue(this.name, s.name);
    this.type.set(s.type);
    setHidden(this.brickRow, s.type !== 'brick_row' && s.type !== 'brick_col');
    this.brick.set(String(BRICK.find(([v]) => Math.abs(Number(v) - s.brick) < 0.01)?.[0] ?? '0.5'));
    this.fit.set(s.fit);
    this.w.set(geo ? geo.tile.w : s.w);
    this.h.set(geo ? geo.tile.h : s.h);
    this.hs.set(s.hs); this.vs.set(s.vs);
    this.hs.enable(s.fit); this.vs.enable(s.fit);
    this.overH.set(s.overlap[0]); this.overV.set(s.overlap[1]);
    this.copies.set(String(s.copies));
    this.dim.set(Math.round(s.dim * 100));
    this.edge.set(s.edge);
    setText(this.status, s.pattern ? 'Editing a pattern swatch. Done saves it; every object filled with it updates.' : 'Done adds the pattern to the Swatches panel. The original artwork is left as it was.');
  }
}

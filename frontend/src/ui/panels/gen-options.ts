import type { Color, Engine } from '../../engine';
import { hex, parseColor } from '../../engine/paint';
import { describeRef, GEN_EFFECTS, GEN_STYLES, GEN_TONES, MAX_PALETTE, resolvePalette, styleReference, type GenCommon, type StyleRef } from '../../io/gen-options';
import { el, patchList, setClass, setDisabled, setStyleVar, setText } from '../dom';
import { check, row, section, selectCtl, slider } from './kit';

const TONE_CHOICES: ReadonlyArray<readonly [string, string]> = [...GEN_TONES.map((t) => [t.id, t.label] as const), ['reference', 'Style reference colours'], ['custom', 'Custom palette']];

export class GenOptionsUi {
  readonly el: HTMLElement;
  private readonly detail;
  private readonly style;
  private readonly tone;
  private readonly use = el<HTMLButtonElement>('<button class="cv-btn" type="button">Use Selection</button>');
  private readonly clear = el<HTMLButtonElement>('<button class="cv-btn" type="button">Clear</button>');
  private readonly refNote = el('<p class="cv-genp-ref" role="status"></p>');
  private readonly picker = el('<div class="cv-gen-picker" role="group" aria-label="Document swatches"></div>');
  private readonly chips = el('<div class="cv-gen-chips" aria-hidden="true"></div>');
  private readonly fx = new Map<string, ReturnType<typeof check>>();
  private o = { detail: 5, style: 'auto', tone: 'auto', effects: new Set<string>(), picked: [] as string[] };
  private ref: StyleRef | null = null;
  private note = '';
  private busy = false;

  constructor(private readonly engine: Engine, private readonly vision: () => boolean, private readonly changed: () => void, detail = 5) {
    this.o.detail = detail;
    this.detail = slider(engine, 'Detail', 1, 10, (v) => { this.o.detail = Math.round(v); this.detail.set(this.o.detail); this.changed(); });
    this.style = selectCtl('Style', GEN_STYLES.map((s) => [s.id, s.label] as const), (id) => { this.o.style = id; this.changed(); });
    this.tone = selectCtl('Color and Tone', TONE_CHOICES, (id) => { this.o.tone = id; this.sync(); this.changed(); });
    for (const e of GEN_EFFECTS) {
      const c = check(e.label, (v) => { if (v) this.o.effects.add(e.id); else this.o.effects.delete(e.id); this.changed(); });
      this.fx.set(e.id, c);
    }
    for (let i = 0; i < MAX_PALETTE; i++) this.chips.appendChild(el('<span class="cv-genp-chip"></span>'));
    this.use.addEventListener('click', () => void this.capture());
    this.clear.addEventListener('click', () => { this.ref = null; this.note = ''; this.sync(); this.changed(); });
    this.picker.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.cv-gen-sw');
      if (!b?.dataset.hex) return;
      if (this.o.tone !== 'custom') { this.o.tone = 'custom'; this.o.picked = []; }
      const i = this.o.picked.indexOf(b.dataset.hex);
      if (i >= 0) this.o.picked.splice(i, 1); else if (this.o.picked.length < MAX_PALETTE) this.o.picked.push(b.dataset.hex);
      this.sync(); this.changed();
    });
    const fxRow = el('<div class="cv-gen-fx"></div>');
    for (const c of this.fx.values()) fxRow.appendChild(c.el);
    this.el = el('<div class="cv-gen-opts"></div>');
    this.el.append(this.detail.el, this.style.el, row(this.use, this.clear), this.refNote, section('Effects'), fxRow, this.tone.el, this.picker, this.chips);
    this.detail.set(this.o.detail); this.style.set('auto'); this.tone.set('auto');
    for (const c of this.fx.values()) c.set(false);
    this.sync();
  }

  palette(): Color[] {
    return resolvePalette(this.values());
  }

  values(): GenCommon {
    const custom = this.o.tone === 'custom';
    return {
      detail: this.o.detail, style: this.o.style, reference: this.ref, effects: [...this.o.effects], tone: custom ? 'custom' : this.o.tone,
      palette: custom ? this.o.picked.map((h) => parseColor(h)).filter((c): c is Color => !!c) : undefined,
    };
  }

  private async capture(): Promise<void> {
    const p = this.engine.current, sel = this.engine.selected();
    if (!p || !sel.length) { this.note = 'Select the artwork or the image to use as the reference first.'; this.sync(); return; }
    this.busy = true; this.note = 'Reading the reference.'; this.sync();
    try { this.ref = await styleReference(p, sel, this.vision()); this.note = ''; }
    catch (err) { this.note = err instanceof Error ? err.message : String(err); }
    this.busy = false;
    this.sync(); this.changed();
  }

  sync(): void {
    const sw = (this.engine.doc?.swatches ?? []).flatMap((s) => (s.paint.type === 'color' && !s.name.startsWith('[') ? [{ id: s.id, name: s.name, hex: hex(s.paint.color) }] : [])).slice(0, 60);
    patchList(this.picker, sw, {
      key: (s) => s.id,
      create: (s) => { const b = el<HTMLButtonElement>('<button class="cv-gen-sw" type="button"></button>'); this.fillSw(b, s); return b; },
      update: (n, s) => this.fillSw(n as HTMLButtonElement, s),
    });
    setClass(this.picker, 'is-off', this.o.tone !== 'custom');
    this.tone.set(this.o.tone);
    this.style.set(this.o.style);
    const pal = this.palette();
    Array.from(this.chips.children).forEach((c, i) => { setStyleVar(c as HTMLElement, '--chip', pal[i] ? hex(pal[i]) : 'transparent'); setClass(c as HTMLElement, 'is-empty', !pal[i]); });
    setText(this.refNote, this.note || (this.ref ? `Reference: ${describeRef(this.ref)}.` : 'No style reference. Select artwork or an image, then press Use Selection.'));
    setDisabled(this.use, this.busy);
    setDisabled(this.clear, this.busy || !this.ref);
  }

  private fillSw(b: HTMLButtonElement, s: { name: string; hex: string }): void {
    if (b.dataset.hex !== s.hex) { b.dataset.hex = s.hex; setStyleVar(b, '--chip', s.hex); }
    if (b.title !== s.name) { b.title = s.name; b.setAttribute('aria-label', s.name); }
    const on = this.o.tone === 'custom' && this.o.picked.includes(s.hex);
    setClass(b, 'is-picked', on);
    b.setAttribute('aria-pressed', String(on));
  }
}

import { hex, hsbToRgb, parseColor, rgb, rgbToHsb, toCmyk, toRgb, cmyk } from '../../engine/paint';
import type { Color } from '../../engine';
import { Dialog } from '../dialogs';
import { el, q, setStyleVar, setValue } from '../dom';

export class ColorPicker extends Dialog {
  private h = 0;
  private s = 0;
  private v = 0;
  private old: Color = rgb(0, 0, 0);
  private resolve: ((c: Color | null) => void) | null = null;
  private onLive: ((c: Color) => void) | null = null;
  private readonly sv: HTMLCanvasElement;
  private readonly hue: HTMLCanvasElement;
  private readonly fields: Record<string, HTMLInputElement> = {};
  private readonly swNew: HTMLElement;
  private readonly swOld: HTMLElement;
  private cmykMode = false;

  constructor() {
    super('Color Picker', 470);
    const page = el(`<div class="cv-picker">
      <canvas class="cv-pick-field" width="256" height="256"></canvas>
      <canvas class="cv-pick-strip" width="18" height="256"></canvas>
      <div class="cv-pick-side">
        <div class="cv-pick-swatches"><span class="cv-pick-swatch cv-pick-new" title="New"></span><span class="cv-pick-swatch cv-pick-old" title="Current"></span></div>
        <div class="cv-pick-grid">
          ${['H', 'S', 'B', 'R', 'G', 'B2', 'C', 'M', 'Y', 'K'].map((k) => `<label class="cv-pick-row"><span>${k === 'B2' ? 'B' : k}</span><span class="cv-num"><input data-k="${k}" type="number" step="1"><span class="cv-unit">${'HSBCMYK'.includes(k[0]) && k !== 'B2' ? (k === 'H' ? '°' : '%') : ''}</span></span></label>`).join('')}
          <label class="cv-pick-row cv-pick-hex"><span>#</span><span class="cv-num"><input data-k="hex" type="text" maxlength="7"></span></label>
        </div>
      </div></div>`);
    this.body.appendChild(page);
    this.sv = q<HTMLCanvasElement>(page, '.cv-pick-field');
    this.hue = q<HTMLCanvasElement>(page, '.cv-pick-strip');
    this.swNew = q(page, '.cv-pick-new');
    this.swOld = q(page, '.cv-pick-old');
    for (const i of Array.from(page.querySelectorAll<HTMLInputElement>('input[data-k]'))) this.fields[i.dataset.k as string] = i;
    this.swOld.addEventListener('click', () => this.setColor(this.old));
    this.drag(this.sv, (x, y) => { this.s = x; this.v = 1 - y; this.changed(); });
    this.drag(this.hue, (_x, y) => { this.h = y * 360; this.changed(); });
    for (const [k, input] of Object.entries(this.fields)) input.addEventListener('change', () => this.fromField(k));
    this.button('Cancel', '', () => this.close());
    this.button('OK', 'primary', () => { const r = this.resolve; this.resolve = null; this.close(); r?.(this.color()); });
    this.onClose = () => { if (this.resolve) { const r = this.resolve; this.resolve = null; if (this.onLive) this.onLive(this.old); r(null); } };
    this.paintHue();
  }

  pick(start: Color, live?: (c: Color) => void): Promise<Color | null> {
    this.old = start;
    this.cmykMode = start.kind === 'cmyk';
    this.onLive = live ?? null;
    this.setColor(start, false);
    setStyleVar(this.swOld, '--sw', hex(start));
    return new Promise((res) => { this.resolve = res; this.open(); });
  }

  private color(): Color {
    const c = hsbToRgb(this.h, this.s * 100, this.v * 100), out = rgb(c.r, c.g, c.b);
    return this.cmykMode ? toCmyk(out) : out;
  }

  private setColor(c: Color, live = true): void {
    const v = toRgb(c), [h, s, b] = rgbToHsb(v.r, v.g, v.b);
    this.h = h; this.s = s / 100; this.v = b / 100;
    this.sync();
    if (live) this.onLive?.(this.color());
  }

  private changed(): void { this.sync(); this.onLive?.(this.color()); }

  private fromField(k: string): void {
    const f = (n: string): number => Number(this.fields[n].value) || 0;
    if (k === 'hex') { const c = parseColor(this.fields.hex.value.startsWith('#') ? this.fields.hex.value : `#${this.fields.hex.value}`); if (c) this.setColor(c); return; }
    if ('HSB'.includes(k) && k.length === 1) { this.h = Math.max(0, Math.min(360, f('H'))); this.s = Math.max(0, Math.min(100, f('S'))) / 100; this.v = Math.max(0, Math.min(100, f('B'))) / 100; this.changed(); return; }
    if (k === 'R' || k === 'G' || k === 'B2') { this.setColor(rgb(f('R'), f('G'), f('B2'))); return; }
    this.cmykMode = true;
    this.setColor(cmyk(f('C'), f('M'), f('Y'), f('K')));
  }

  private sync(): void {
    const c = hsbToRgb(this.h, this.s * 100, this.v * 100), k = toCmyk(rgb(c.r, c.g, c.b));
    const vals: Record<string, string> = { H: String(Math.round(this.h)), S: String(Math.round(this.s * 100)), B: String(Math.round(this.v * 100)), R: String(c.r), G: String(c.g), B2: String(c.b), hex: hex(rgb(c.r, c.g, c.b)).slice(1) };
    if (k.kind === 'cmyk') Object.assign(vals, { C: String(Math.round(k.c)), M: String(Math.round(k.m)), Y: String(Math.round(k.y)), K: String(Math.round(k.k)) });
    for (const [key, v] of Object.entries(vals)) setValue(this.fields[key], v);
    setStyleVar(this.swNew, '--sw', hex(rgb(c.r, c.g, c.b)));
    this.paintSv();
  }

  private paintHue(): void {
    const g = this.hue.getContext('2d');
    if (!g) return;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    for (let i = 0; i <= 6; i++) { const c = hsbToRgb((i * 60) % 360, 100, 100); grad.addColorStop(i / 6, `rgb(${c.r},${c.g},${c.b})`); }
    g.fillStyle = grad; g.fillRect(0, 0, 18, 256);
  }

  private paintSv(): void {
    const g = this.sv.getContext('2d');
    if (!g) return;
    const c = hsbToRgb(this.h % 360, 100, 100);
    g.fillStyle = `rgb(${c.r},${c.g},${c.b})`; g.fillRect(0, 0, 256, 256);
    const w = g.createLinearGradient(0, 0, 256, 0); w.addColorStop(0, '#fff'); w.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = w; g.fillRect(0, 0, 256, 256);
    const b = g.createLinearGradient(0, 0, 0, 256); b.addColorStop(0, 'rgba(0,0,0,0)'); b.addColorStop(1, '#000'); g.fillStyle = b; g.fillRect(0, 0, 256, 256);
    const x = this.s * 256, y = (1 - this.v) * 256;
    g.strokeStyle = this.v > 0.5 ? '#000' : '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.stroke();
    const hg = this.hue.getContext('2d');
    if (hg) { this.paintHue(); const hy = (this.h / 360) * 256; hg.strokeStyle = '#fff'; hg.lineWidth = 2; hg.strokeRect(1, hy - 2, 16, 4); }
  }

  private drag(c: HTMLCanvasElement, f: (x: number, y: number) => void): void {
    const at = (e: PointerEvent): void => { const r = c.getBoundingClientRect(); f(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))); };
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); at(e); });
    c.addEventListener('pointermove', (e) => { if (c.hasPointerCapture(e.pointerId)) at(e); });
  }
}

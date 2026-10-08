import { visualBounds } from '../../engine/bounds';
import { EFFECTS, effectDefaults, type EffectDef } from '../../engine/effects';
import { emptyRect, isEmptyRect, unionRect } from '../../engine/geometry';
import { effect } from '../../engine/paint';
import { renderNode, type RenderContext } from '../../engine/render';
import type { Effect, Engine, Rect, VNode } from '../../engine';
import { Dialog } from '../dialogs';
import { el, q, setClass, setHidden, setText } from '../dom';
import { enhanceSelect } from '../dropdown';

type Params = Effect['params'];
interface Page { root: HTMLElement; read: () => Params; write: (p: Params) => void }

const CATEGORIES = ['Artistic', 'Blur', 'Brush Strokes', 'Distort', 'Pixelate', 'Sketch', 'Stylize', 'Texture', 'Video'];
const PW = 440, PH = 340, TW = 76, TH = 56;
const titleCase = (s: string): string => s.split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

export class EffectGallery extends Dialog {
  private readonly preview = el<HTMLCanvasElement>(`<canvas class="cv-fxg-canvas" width="${PW * 2}" height="${PH * 2}" aria-label="Preview"></canvas>`);
  private readonly list = el('<div class="cv-fxg-list" role="listbox" aria-label="Effects"></div>');
  private readonly side = el('<div class="cv-fxg-side"></div>');
  private readonly name = el('<div class="cv-fxg-name"></div>');
  private readonly tiles = new Map<string, HTMLButtonElement>();
  private readonly pages = new Map<string, Page>();
  private current = '';
  private values: Params = {};
  private nodes: VNode[] = [];
  private frame = 0;
  private dirty = false;
  private thumbs: string[] = [];
  private resolve: ((ok: boolean) => void) | null = null;
  private settled = true;

  constructor(private readonly engine: Engine) {
    super('Effect Gallery', 1040);
    q(this.scrim, '.cv-dialog').classList.add('cv-fxg-dialog');
    const grid = el('<div class="cv-fxg"></div>'), left = el('<div class="cv-fxg-view"></div>');
    left.appendChild(this.preview);
    this.side.appendChild(this.name);
    grid.append(left, this.list, this.side);
    this.body.appendChild(grid);
    for (const cat of CATEGORIES) {
      const defs = EFFECTS.filter((d) => d.family === 'photoshop' && d.menu === cat);
      if (!defs.length) continue;
      const head = el('<div class="cv-fxg-cat"></div>'), wrap = el('<div class="cv-fxg-tiles"></div>');
      setText(head, cat);
      for (const d of defs) {
        const b = el<HTMLButtonElement>(`<button class="cv-fxg-tile" type="button" role="option" aria-selected="false"><canvas width="${TW * 2}" height="${TH * 2}"></canvas><span></span></button>`);
        setText(q(b, 'span'), d.label);
        b.dataset.fx = d.id;
        b.addEventListener('click', () => this.pick(d.id));
        b.addEventListener('dblclick', () => { this.pick(d.id); this.finish(); });
        wrap.appendChild(b);
        this.tiles.set(d.id, b);
      }
      this.list.append(head, wrap);
    }
    this.button('Cancel', '', () => this.close());
    this.button('OK', 'primary', () => this.finish());
    this.onClose = () => {
      cancelAnimationFrame(this.frame); this.frame = 0; this.thumbs = []; this.nodes = [];
      if (!this.settled) { this.settled = true; const r = this.resolve; this.resolve = null; r?.(false); }
    };
  }

  private item: number | undefined;

  run(id?: string, slot?: { node: string; item?: number }): Promise<boolean> {
    if (!this.settled) return Promise.resolve(false);
    this.nodes = (slot ? [slot.node] : this.engine.targetIds()).map((x) => this.engine.nodeById(x)).filter((n): n is VNode => !!n);
    this.item = slot?.item;
    if (!this.nodes.length) { this.engine.notice('Select an object to open the Effect Gallery.'); return Promise.resolve(false); }
    const last = this.engine.lastEffect, start = id && this.tiles.has(id) ? id : last && this.tiles.has(last.id) ? last.id : 'gallery.colored_pencil';
    this.settled = false;
    this.pick(start, last?.id === start ? last.params : undefined);
    this.thumbs = [...this.tiles.keys()];
    return new Promise((res) => { this.resolve = res; this.open(this.tiles.get(start)); this.queue(); });
  }

  private pick(id: string, params?: Params): void {
    const def = EFFECTS.find((d) => d.id === id);
    if (!def) return;
    const prev = this.pages.get(this.current);
    if (prev) setHidden(prev.root, true);
    this.current = id;
    for (const [k, b] of this.tiles) { setClass(b, 'is-active', k === id); b.setAttribute('aria-selected', String(k === id)); }
    setText(this.name, def.label);
    let page = this.pages.get(id);
    if (!page) { page = this.page(def); this.pages.set(id, page); this.side.appendChild(page.root); }
    page.write({ ...effectDefaults(id), ...(params ?? {}) });
    setHidden(page.root, false);
    this.values = page.read();
    this.dirty = true;
    this.queue();
  }

  private page(def: EffectDef): Page {
    const root = el('<div class="cv-fxg-page" hidden></div>'), reads: Array<() => [string, number | string | boolean]> = [], writes: Array<(p: Params) => void> = [];
    const changed = (): void => { this.values = Object.fromEntries(reads.map((r) => r())); this.dirty = true; this.queue(); };
    if (!def.params.length) { const n = el('<p class="cv-note"></p>'); setText(n, 'This effect has no options.'); root.appendChild(n); }
    for (const prm of def.params) {
      const row = el('<label class="cv-field"><span></span></label>');
      setText(q(row, 'span'), prm.label);
      if (prm.kind === 'number') {
        const ctl = el(`<span class="cv-slider-ctl"><input type="range" min="${prm.min ?? 0}" max="${prm.max ?? 100}" step="${prm.step ?? 1}"><span class="cv-num"><input type="number" min="${prm.min ?? 0}" max="${prm.max ?? 100}" step="${prm.step ?? 1}"><span class="cv-unit"></span></span></span>`);
        const range = q<HTMLInputElement>(ctl, 'input[type="range"]'), box = q<HTMLInputElement>(ctl, 'input[type="number"]');
        setText(q(ctl, '.cv-unit'), prm.unit ?? '');
        const read = (): number => { let v = parseFloat(box.value); if (!Number.isFinite(v)) v = Number(prm.def); return Math.max(prm.min ?? -Infinity, Math.min(prm.max ?? Infinity, v)); };
        range.addEventListener('input', () => { box.value = range.value; changed(); });
        box.addEventListener('input', () => { range.value = String(read()); changed(); });
        row.appendChild(ctl);
        reads.push(() => [prm.key, read()]);
        writes.push((p) => { const v = String(p[prm.key] ?? prm.def); box.value = v; range.value = v; });
      } else if (prm.kind === 'select') {
        const s = el<HTMLSelectElement>('<select class="cv-select"></select>');
        for (const c of prm.choices ?? []) { const o = document.createElement('option'); o.value = c; o.textContent = titleCase(c); s.appendChild(o); }
        s.addEventListener('change', changed);
        row.appendChild(s);
        enhanceSelect(s);
        reads.push(() => [prm.key, s.value]);
        writes.push((p) => { const v = String(p[prm.key] ?? prm.def); if (s.value !== v) { s.value = v; s.dispatchEvent(new Event('change')); } });
      } else if (prm.kind === 'boolean') {
        const ck = el('<label class="cv-check"><input type="checkbox"><span></span></label>'), c = q<HTMLInputElement>(ck, 'input');
        setText(q(ck, 'span'), prm.label);
        c.addEventListener('change', changed);
        reads.push(() => [prm.key, c.checked]);
        writes.push((p) => { c.checked = !!(p[prm.key] ?? prm.def); });
        root.appendChild(ck);
        continue;
      } else {
        const c = el<HTMLInputElement>('<input class="cv-color" type="color">');
        c.addEventListener('input', changed);
        row.appendChild(c);
        reads.push(() => [prm.key, c.value]);
        writes.push((p) => { c.value = String(p[prm.key] ?? prm.def); });
      }
      root.appendChild(row);
    }
    return { root, read: () => Object.fromEntries(reads.map((r) => r())), write: (p) => { for (const w of writes) w(p); } };
  }

  private queue(): void { if (!this.frame && this.isOpen) this.frame = requestAnimationFrame(() => this.tick()); }

  private tick(): void {
    this.frame = 0;
    if (!this.isOpen) return;
    const p = this.engine.current;
    if (!p) return;
    let box: Rect = emptyRect();
    for (const n of this.nodes) box = unionRect(box, visualBounds(p.doc, n));
    if (this.dirty) { this.dirty = false; this.draw(this.preview, effect(this.current, this.values), box); }
    const t0 = performance.now();
    while (this.thumbs.length && performance.now() - t0 < 10) {
      const id = this.thumbs.shift() as string, b = this.tiles.get(id);
      if (b) this.draw(q<HTMLCanvasElement>(b, 'canvas'), effect(id, effectDefaults(id)), box);
    }
    if (this.thumbs.length || this.dirty) this.queue();
  }

  private draw(c: HTMLCanvasElement, fx: Effect, box: Rect): void {
    const p = this.engine.current, g = c.getContext('2d');
    if (!p || !g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    if (isEmptyRect(box)) return;
    const pad = c.width * 0.04, s = Math.min((c.width - pad * 2) / box.w, (c.height - pad * 2) / box.h);
    g.setTransform(s, 0, 0, s, (c.width - box.w * s) / 2 - box.x * s, (c.height - box.h * s) / 2 - box.y * s);
    const rc: RenderContext = { doc: p.doc, scale: s, outline: false, assets: (k) => p.bitmaps.get(k) ?? null };
    const k = this.item;
    for (const n of this.nodes) { try { renderNode(g, { ...n, ap: k !== undefined && n.ap.items[k] ? { ...n.ap, items: n.ap.items.map((it, i) => (i === k ? { ...it, effects: [...it.effects, fx] } : it)) } : { ...n.ap, effects: [...n.ap.effects, fx] } } as VNode, rc); } catch { continue; } }
  }

  private finish(): void {
    if (this.settled) return;
    this.settled = true;
    const ids = this.nodes.map((n) => n.id), id = this.current, params = { ...this.values }, r = this.resolve;
    this.resolve = null;
    this.close();
    const ok = this.engine.addEffect(id, params, ids, this.item);
    r?.(ok);
  }
}

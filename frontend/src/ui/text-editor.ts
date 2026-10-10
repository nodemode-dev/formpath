import { findNode } from '../engine/doc';
import { apply, invert, rectContains, inflate } from '../engine/geometry';
import { caretAt, deleteText, indexAt, insertText, layoutText, plainText, selectionQuads, stepLine } from '../engine/text';
import type { CharStyle, Engine, PathData, Pt, TextNode } from '../engine';
import type { ToolContext } from '../extensions/registry';
import { el } from './dom';
import type { TypeRequest } from './stage';

type Pending = { x: number; y: number; mode: 'point' | 'area' | 'path'; box?: { w: number; h: number }; path?: PathData; replace?: string; vertical: boolean };

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export class TextEditor {
  private readonly ta: HTMLTextAreaElement;
  id: string | null = null;
  private pending: Pending | null = null;
  caret = 0;
  anchor = 0;
  dragging = false;
  private on = true;
  private timer = 0;
  private composing = false;
  redraw: () => void = () => undefined;
  style: () => Partial<CharStyle> = () => ({});

  constructor(host: HTMLElement, private readonly engine: Engine) {
    this.ta = el<HTMLTextAreaElement>('<textarea class="cv-text-editor" aria-label="Type" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" tabindex="-1"></textarea>');
    host.appendChild(this.ta);
    this.ta.addEventListener('compositionstart', () => { this.composing = true; });
    this.ta.addEventListener('compositionend', () => { this.composing = false; this.flushInput(); });
    this.ta.addEventListener('input', () => { if (!this.composing) this.flushInput(); });
    this.ta.addEventListener('keydown', (e) => this.key(e));
    this.ta.addEventListener('copy', (e) => { const s = this.selectedText(); if (!s) return; e.preventDefault(); e.clipboardData?.setData('text/plain', s); });
    this.ta.addEventListener('cut', (e) => { const s = this.selectedText(); if (!s) return; e.preventDefault(); e.clipboardData?.setData('text/plain', s); this.replace(''); });
    this.ta.addEventListener('paste', (e) => { e.preventDefault(); const s = e.clipboardData?.getData('text/plain') ?? ''; if (s) this.replace(s.replace(/\r\n?/g, '\n')); });
    this.ta.addEventListener('blur', () => { if (this.active) window.setTimeout(() => { if (this.active && document.activeElement !== this.ta && !document.activeElement?.closest('.cv-dock, .cv-props-col, .cv-options, .cv-layers, .cv-dialog')) this.end(); }, 0); });
    engine.on('tool', () => { if (this.active && !/^(type|areaType|typePath|typeVertical|areaTypeVertical|typePathVertical)$/.test(engine.tool)) this.end(); });
    engine.on('active', () => { if (this.active) this.end(); });
    engine.on('history', () => { if (this.id && !this.node()) this.end(); else this.clamp(); });
  }

  get active(): boolean { return !!this.id || !!this.pending; }

  node(): TextNode | null { const n = this.id ? this.engine.nodeById(this.id) : null; return n?.kind === 'text' ? n : null; }

  range(): [number, number] | null { return this.id && this.caret !== this.anchor ? [Math.min(this.caret, this.anchor), Math.max(this.caret, this.anchor)] : null; }

  begin(r: TypeRequest & { mode?: 'point' | 'area' | 'path' }): void {
    this.end();
    const e = this.engine, doc = e.doc;
    if (!doc) return;
    if (r.id) {
      const n = findNode(doc, r.id);
      if (n?.kind !== 'text') return;
      this.id = n.id;
      e.select([n.id]);
      const at = typeof r.x === 'number' && typeof r.y === 'number' ? this.indexFor(n, { x: r.x, y: r.y }) : plainText(n).length;
      this.caret = this.anchor = r.caret ?? at;
    } else if (r.path) {
      const src = findNode(doc, r.path);
      const d = src && (src.kind === 'path' ? src.d : null);
      if (!d) return;
      const b = e.boundsOf(src), vertical = !!r.vertical;
      this.pending = r.mode === 'area' ? { x: b.x, y: b.y, mode: 'area', box: { w: b.w, h: b.h }, replace: r.path, path: d, vertical } : { x: d[0]?.pts[0]?.x ?? 0, y: d[0]?.pts[0]?.y ?? 0, mode: 'path', path: d, replace: r.path, vertical };
      this.caret = this.anchor = 0;
    } else if (typeof r.x === 'number' && typeof r.y === 'number') {
      const vertical = !!r.vertical;
      this.pending = r.box ? { x: r.x, y: r.y, mode: 'area', box: r.box, vertical } : { x: r.x, y: r.y, mode: 'point', vertical };
      this.caret = this.anchor = 0;
    } else return;
    this.focus();
    this.startBlink();
    this.redraw();
  }

  end(): void {
    if (!this.active) return;
    const id = this.id;
    this.id = null; this.pending = null; this.dragging = false;
    window.clearInterval(this.timer); this.timer = 0;
    if (document.activeElement === this.ta) this.ta.blur();
    if (id && this.engine.nodeById(id) && !this.engine.textOf(id)) this.engine.deleteSelection([id]);
    this.redraw();
  }

  private focus(): void { this.ta.value = ''; this.ta.focus({ preventScroll: true }); this.place(); }

  private startBlink(): void {
    window.clearInterval(this.timer);
    this.on = true;
    if (!REDUCED) this.timer = window.setInterval(() => { this.on = !this.on; this.redraw(); }, 530);
  }

  private indexFor(n: TextNode, p: Pt): number { return indexAt(n, n.mode === 'path' ? p : apply(invert(n.xf), p.x, p.y)); }

  contains(p: Pt, tol: number): boolean {
    const n = this.node();
    if (!n) return false;
    return rectContains(inflate(this.engine.boundsOf(n), tol), p);
  }

  caretTo(p: Pt, extend: boolean): void {
    const n = this.node();
    if (!n) return;
    this.caret = this.indexFor(n, p);
    if (!extend) this.anchor = this.caret;
    this.startBlink();
    this.redraw();
  }

  selectWord(p: Pt): void {
    const n = this.node();
    if (!n) return;
    const t = plainText(n), i = this.indexFor(n, p);
    let a = i, b = i;
    while (a > 0 && /\w/.test(t[a - 1])) a--;
    while (b < t.length && /\w/.test(t[b])) b++;
    this.anchor = a; this.caret = b;
    this.redraw();
  }

  selectAll(): void { const n = this.node(); if (!n) return; this.anchor = 0; this.caret = plainText(n).length; this.redraw(); }

  private selectedText(): string { const r = this.range(), n = this.node(); return r && n ? plainText(n).slice(r[0], r[1]) : ''; }

  private clamp(): void { const n = this.node(); if (!n) return; const len = plainText(n).length; this.caret = Math.min(this.caret, len); this.anchor = Math.min(this.anchor, len); this.redraw(); }

  private flushInput(): void {
    const v = this.ta.value;
    if (!v) return;
    this.ta.value = '';
    this.replace(v);
  }

  replace(s: string): void {
    const e = this.engine;
    if (this.pending) {
      if (!s) return;
      const pd = this.pending;
      this.pending = null;
      const style = this.style();
      const vertical = pd.vertical || undefined;
      if (pd.mode === 'path' || (pd.mode === 'area' && pd.replace)) {
        e.beginStep();
        const id = e.addText(s, pd.x, pd.y, pd.mode === 'path' ? { mode: 'path', path: pd.path, style, vertical } : { mode: 'area', width: pd.box?.w, height: pd.box?.h, framePath: pd.path, style, vertical });
        if (pd.replace) e.deleteSelection([pd.replace]);
        e.endStep();
        this.id = id;
        if (id) e.select([id]);
      } else this.id = e.addText(s, pd.x, pd.y, pd.mode === 'area' ? { mode: 'area', width: pd.box?.w, height: pd.box?.h, style, vertical } : { style, vertical });
      this.caret = this.anchor = s.length;
      this.place();
      this.redraw();
      return;
    }
    const n = this.node();
    if (!n || !this.id) return;
    const r = this.range();
    let spans = n.spans, at = this.caret;
    if (r) { spans = deleteText(spans, r[0], r[1]); at = r[0]; }
    if (s) spans = insertText(spans, at, s);
    e.setTextSpans(this.id, spans, 'Typing', true);
    this.caret = this.anchor = at + s.length;
    this.startBlink();
    this.place();
  }

  private move(to: number, extend: boolean): void {
    const n = this.node();
    if (!n) return;
    this.caret = Math.max(0, Math.min(plainText(n).length, to));
    if (!extend) this.anchor = this.caret;
    this.startBlink();
    this.place();
    this.redraw();
  }

  private lineStep(dir: 1 | -1): number {
    const n = this.node();
    if (!n || n.mode === 'path') return this.caret;
    return stepLine(n, this.caret, dir);
  }

  private arrow(key: string): { kind: 'char' | 'line'; dir: 1 | -1 } {
    const v = !!this.node()?.vertical;
    if (key === 'ArrowLeft') return v ? { kind: 'line', dir: 1 } : { kind: 'char', dir: -1 };
    if (key === 'ArrowRight') return v ? { kind: 'line', dir: -1 } : { kind: 'char', dir: 1 };
    if (key === 'ArrowUp') return v ? { kind: 'char', dir: -1 } : { kind: 'line', dir: -1 };
    return v ? { kind: 'char', dir: 1 } : { kind: 'line', dir: 1 };
  }

  private lineEdge(end: boolean): number {
    const n = this.node();
    if (!n) return this.caret;
    const lay = layoutText(n), l = lay.lines.find((x) => this.caret >= x.start && this.caret <= x.end);
    return l ? (end ? l.end : l.start) : end ? plainText(n).length : 0;
  }

  private key(e: KeyboardEvent): void {
    e.stopPropagation();
    const mod = /Mac/.test(navigator.platform) ? e.metaKey : e.ctrlKey, n = this.node();
    const text = n ? plainText(n) : '';
    switch (e.key) {
      case 'Escape': e.preventDefault(); { const id = this.id; this.end(); this.engine.setTool('selection'); if (id && this.engine.nodeById(id)) this.engine.select([id]); } return;
      case 'Enter': e.preventDefault(); if (n?.mode !== 'path') this.replace('\n'); return;
      case 'Tab': e.preventDefault(); this.replace('\t'); return;
      case 'Backspace': e.preventDefault(); if (this.range()) this.replace(''); else if (this.caret > 0) { this.anchor = mod || e.altKey ? wordStart(text, this.caret) : this.caret - 1; this.replace(''); } return;
      case 'Delete': e.preventDefault(); if (this.range()) this.replace(''); else if (this.caret < text.length) { this.anchor = this.caret + 1; this.replace(''); } return;
      case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': {
        e.preventDefault();
        const a = this.arrow(e.key);
        if (a.kind === 'line') { this.move(this.lineStep(a.dir), e.shiftKey); return; }
        if (a.dir < 0) this.move(e.altKey || mod ? wordStart(text, this.caret) : this.range() && !e.shiftKey ? Math.min(this.caret, this.anchor) : this.caret - 1, e.shiftKey);
        else this.move(e.altKey || mod ? wordEnd(text, this.caret) : this.range() && !e.shiftKey ? Math.max(this.caret, this.anchor) : this.caret + 1, e.shiftKey);
        return;
      }
      case 'Home': e.preventDefault(); this.move(this.lineEdge(false), e.shiftKey); return;
      case 'End': e.preventDefault(); this.move(this.lineEdge(true), e.shiftKey); return;
    }
    if (mod && e.code === 'KeyA') { e.preventDefault(); this.selectAll(); return; }
    if (mod && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) this.engine.redo(); else this.engine.undo(); return; }
  }

  private place(): void {
    const n = this.node(), v = this.engine.current?.viewport;
    if (!v) return;
    let at: Pt;
    if (n) { const c = caretAt(n, this.caret); at = v.toScreen(c.x, c.y); }
    else if (this.pending) at = v.toScreen(this.pending.x, this.pending.y);
    else return;
    const x = `${Math.round(at.x)}px`, y = `${Math.round(at.y)}px`;
    if (this.ta.style.left !== x) this.ta.style.left = x;
    if (this.ta.style.top !== y) this.ta.style.top = y;
  }

  overlay(ctx: ToolContext, g: CanvasRenderingContext2D): void {
    if (!this.active) return;
    const v = ctx.view(), accent = ctx.paint().accent;
    if (this.pending) {
      const pd = this.pending, s = v.toScreen({ x: pd.x, y: pd.y }), h = 12 * v.zoom;
      g.save();
      if (pd.mode === 'area' && pd.box) { const t = v.toScreen({ x: pd.x + pd.box.w, y: pd.y + pd.box.h }); g.strokeStyle = accent; g.strokeRect(Math.round(s.x) + 0.5, Math.round(s.y) + 0.5, Math.round(t.x - s.x), Math.round(t.y - s.y)); }
      if (this.on) {
        g.strokeStyle = accent; g.lineWidth = 1.5; g.beginPath();
        if (pd.vertical) { const x0 = pd.mode === 'area' && pd.box ? v.toScreen({ x: pd.x + pd.box.w, y: pd.y }).x - 2 : s.x + h / 2, y0 = pd.mode === 'area' ? s.y + 2 : s.y; g.moveTo(x0, y0); g.lineTo(x0 - h, y0); }
        else { const top = pd.mode === 'area' ? s.y + 2 : s.y - h * 0.8; g.moveTo(s.x + 2, top); g.lineTo(s.x + 2, top + h); }
        g.stroke();
      }
      g.restore();
      return;
    }
    const n = this.node();
    if (!n) return;
    const r = this.range();
    if (r) {
      g.save();
      g.fillStyle = accent;
      g.globalAlpha = 0.35;
      for (const quad of selectionQuads(n, r[0], r[1])) {
        const corners = quad.map((d) => v.toScreen(d));
        g.beginPath(); corners.forEach((c, i) => (i ? g.lineTo(c.x, c.y) : g.moveTo(c.x, c.y))); g.closePath(); g.fill();
      }
      g.restore();
    }
    if (this.on && !r) {
      const c = caretAt(n, this.caret), a = v.toScreen({ x: c.x, y: c.y }), len = c.h * v.zoom, ang = c.angle;
      g.save(); g.strokeStyle = accent; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(a.x - Math.sin(ang) * len, a.y + Math.cos(ang) * len); g.stroke(); g.restore();
    }
  }
}

function wordStart(t: string, i: number): number { let k = i; while (k > 0 && /\s/.test(t[k - 1])) k--; while (k > 0 && /\S/.test(t[k - 1])) k--; return k; }
function wordEnd(t: string, i: number): number { let k = i; while (k < t.length && /\s/.test(t[k])) k++; while (k < t.length && /\S/.test(t[k])) k++; return k; }

export const typing: { editor: TextEditor | null } = { editor: null };

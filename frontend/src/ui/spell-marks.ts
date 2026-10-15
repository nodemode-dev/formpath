import { allNodes } from '../engine/doc';
import { plainText, selectionQuads } from '../engine/text';
import type { Engine, Pt, TextNode } from '../engine';
import type { Project } from '../engine/project';
import { paint } from './palette';
import { misspelledRanges, resetSpellCache, type MisspelledRange } from './panels/spelling';

const DEBOUNCE = 350;
const MAX_CACHE = 400;

export class SpellMarks {
  private on = false;
  private readonly cache = new Map<string, MisspelledRange[]>();
  private readonly asked = new Set<string>();
  private timer = 0;

  constructor(private readonly engine: Engine, private readonly painters: Set<(g: CanvasRenderingContext2D, p: Project) => void>) {
    this.paintFn = this.paintFn.bind(this);
  }

  enabled(): boolean { return this.on; }

  set(on: boolean): void {
    if (on === this.on) return;
    this.on = on;
    if (on) this.painters.add(this.paintFn); else this.painters.delete(this.paintFn);
    this.engine.emit('overlay', null);
  }

  reset(): void {
    resetSpellCache();
    this.cache.clear();
    this.asked.clear();
    if (this.on) this.engine.emit('overlay', null);
  }

  private request(texts: string[]): void {
    for (const t of texts) this.asked.add(t);
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.flush(), DEBOUNCE);
  }

  private async flush(): Promise<void> {
    const todo = [...this.asked];
    this.asked.clear();
    let any = false;
    for (const t of todo) {
      if (this.cache.has(t)) continue;
      try { this.cache.set(t, await misspelledRanges(t)); any = true; } catch { this.cache.set(t, []); }
    }
    while (this.cache.size > MAX_CACHE) this.cache.delete(this.cache.keys().next().value as string);
    if (any && this.on) this.engine.emit('overlay', null);
  }

  private paintFn(g: CanvasRenderingContext2D, p: Project): void {
    const w = g.canvas.width / (window.devicePixelRatio || 1), h = g.canvas.height / (window.devicePixelRatio || 1);
    const v = p.viewport, want: string[] = [];
    g.save();
    g.strokeStyle = paint().danger;
    g.lineWidth = 1;
    g.beginPath();
    for (const n of allNodes(p.doc)) {
      if (n.kind !== 'text' || n.hidden) continue;
      const t = plainText(n as TextNode);
      if (!t.trim()) continue;
      const hit = this.cache.get(t);
      if (!hit) { if (!this.asked.has(t)) want.push(t); continue; }
      if (!hit.length) continue;
      for (const r of hit) this.underline(g, n as TextNode, r, v.toScreen.bind(v), w, h);
    }
    g.stroke();
    g.restore();
    if (want.length) this.request(want);
  }

  private underline(g: CanvasRenderingContext2D, n: TextNode, r: MisspelledRange, to: (x: number, y: number) => Pt, w: number, h: number): void {
    const runs: Array<{ a: Pt; b: Pt }> = [];
    for (const q of selectionQuads(n, r.start, r.end)) {
      const a = to(q[3].x, q[3].y), b = to(q[2].x, q[2].y), last = runs[runs.length - 1];
      if (last && Math.hypot(last.b.x - a.x, last.b.y - a.y) < 2) last.b = b; else runs.push({ a, b });
    }
    for (const { a, b } of runs) {
      if (Math.max(a.x, b.x) < 0 || Math.min(a.x, b.x) > w || Math.max(a.y, b.y) < 0 || Math.min(a.y, b.y) > h) continue;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 1) continue;
      const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len, nx = -uy, ny = ux, step = 2, amp = 1.2;
      g.moveTo(a.x + nx * 1.5, a.y + ny * 1.5);
      for (let s = step, k = 1; s <= len + step; s += step, k++) {
        const d = Math.min(s, len), o = (k % 2 ? 1 : -1) * amp + 1.5;
        g.lineTo(a.x + ux * d + nx * o, a.y + uy * d + ny * o);
      }
    }
  }
}

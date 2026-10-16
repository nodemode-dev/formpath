import { geomBounds } from '../engine/bounds';
import type { Engine, Pt, VNode } from '../engine';
import { rotator, setSceneDraft } from '../engine/threed';
import { deltaAngle, freeRotate, ringAngle, ringBases, ringPoint, roundDeg, snapDeg, wrapDeg, type Ring } from '../engine/threed-view';
import type { Stage } from './stage';

type Rot = [number, number, number];
interface Drag {
  mode: 'ring' | 'free';
  ring: Ring;
  id: number;
  start: Rot;
  cur: Rot;
  p0: Pt;
  last: Pt;
  tot: number;
  moved: boolean;
  node: string;
  pending: number;
}
interface Grip { c: Pt; r: number; rot: Rot; U: Pt[]; V: Pt[]; node: VNode }

const TILT = rotator(-24, 30, 0);
const SEG = 72;
const HIT = 7;

export class ThreeDWidget {
  private drag: Drag | null = null;
  private hot: Ring | 'free' | null = null;
  private restoreCursor: string | null = null;

  constructor(private readonly stage: Stage, private readonly engine: Engine, private readonly overlay: HTMLElement) {
    stage.painters.add((g) => this.draw(g));
    overlay.addEventListener('pointerdown', (e) => this.down(e), true);
    overlay.addEventListener('pointermove', (e) => this.move(e), true);
    overlay.addEventListener('pointerup', (e) => this.up(e, false), true);
    overlay.addEventListener('pointercancel', (e) => this.up(e, true), true);
    overlay.addEventListener('dblclick', (e) => this.reset(e), true);
  }

  private grip(): Grip | null {
    const p = this.engine.current;
    if (!p || p.selection.size !== 1 || (this.engine.tool !== 'selection' && this.engine.tool !== 'direct')) return null;
    const n = this.engine.selected()[0];
    if (!n || n.kind === 'layer') return null;
    const fx = n.ap.effects.find((e) => e.visible && e.id.startsWith('3d.'));
    if (!fx) return null;
    const v = this.stage.ctx.view(), b = geomBounds(p.doc, { ...n, ap: { ...n.ap, effects: n.ap.effects.filter((e) => !e.id.startsWith('3d.')) } });
    if (!(b.w > 0 || b.h > 0)) return null;
    const num = (k: string, d: number): number => { const x = fx.params[k]; return typeof x === 'number' ? x : d; };
    const rot: Rot = this.drag && this.drag.node === n.id ? this.drag.cur : [num('rx', -18), num('ry', -26), num('rz', fx.id === '3d.model' ? 0 : 8)];
    const c = v.toScreen({ x: b.x + b.w / 2, y: b.y + b.h / 2 }), r = Math.max(56, Math.min(190, Math.max(b.w, b.h) * v.zoom * 0.7));
    const bases = ringBases(rot[0], rot[1], rot[2]).map((q) => ({ u: TILT.fwd(q.u), v: TILT.fwd(q.v) })), proj = (a: number[]): Pt => ({ x: a[0] * r, y: a[1] * r });
    return { c, r, rot, U: bases.map((q) => proj(q.u)), V: bases.map((q) => proj(q.v)), node: n };
  }

  private hit(gr: Grip, e: MouseEvent): { kind: Ring | 'free'; t: number } | null {
    const r = this.overlay.getBoundingClientRect(), px = e.clientX - r.left - gr.c.x, py = e.clientY - r.top - gr.c.y;
    let best: { kind: Ring; t: number } | null = null, bd = HIT;
    for (let ring = 0 as Ring; ring < 3; ring = (ring + 1) as Ring) {
      for (let i = 0; i < SEG; i++) {
        const a = ringPoint(gr.U[ring], gr.V[ring], (i / SEG) * Math.PI * 2), b = ringPoint(gr.U[ring], gr.V[ring], ((i + 1) / SEG) * Math.PI * 2);
        const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2)), d = Math.hypot(px - a.x - dx * k, py - a.y - dy * k);
        if (d < bd) { bd = d; best = { kind: ring, t: ((i + k) / SEG) * Math.PI * 2 }; }
      }
    }
    if (best) return best;
    return Math.hypot(px, py) <= gr.r ? { kind: 'free', t: 0 } : null;
  }

  private down(e: PointerEvent): void {
    if (e.button !== 0 || e.altKey || this.drag) return;
    const gr = this.grip();
    if (!gr) return;
    const h = this.hit(gr, e);
    if (!h) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.overlay.setPointerCapture(e.pointerId);
    this.drag = { mode: h.kind === 'free' ? 'free' : 'ring', ring: h.kind === 'free' ? 0 : h.kind, id: e.pointerId, start: [...gr.rot], cur: [...gr.rot], p0: { x: e.clientX, y: e.clientY }, last: { x: e.clientX, y: e.clientY }, tot: 0, moved: false, node: gr.node.id, pending: 0 };
    this.hot = h.kind;
  }

  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d) {
      const gr = this.grip(), h = gr && !e.buttons ? this.hit(gr, e) : null, kind = h?.kind ?? null;
      if (kind !== null && this.restoreCursor === null) { this.restoreCursor = this.overlay.style.cursor; this.overlay.style.cursor = kind === 'free' ? 'move' : 'grab'; }
      else if (kind === null && this.restoreCursor !== null) { this.overlay.style.cursor = this.restoreCursor; this.restoreCursor = null; }
      if (kind !== this.hot) { this.hot = kind; this.stage.ctx.redraw(); }
      if (kind !== null) e.stopImmediatePropagation();
      return;
    }
    if (e.pointerId !== d.id) return;
    e.stopImmediatePropagation();
    const gr = this.grip();
    if (!gr) return;
    if (!d.moved && Math.hypot(e.clientX - d.p0.x, e.clientY - d.p0.y) < 3) return;
    if (!d.moved) { d.moved = true; this.engine.beginGesture(); setSceneDraft(true); }
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [], last = events.length ? events[events.length - 1] : e;
    if (d.mode === 'free') d.cur = freeRotate(d.start, last.clientX - d.p0.x, last.clientY - d.p0.y, e.shiftKey);
    else {
      const bx = this.overlay.getBoundingClientRect(), at = (x: number, y: number): Pt => ({ x: x - bx.left - gr.c.x, y: y - bx.top - gr.c.y });
      const a0 = ringAngle(gr.U[d.ring], gr.V[d.ring], at(d.last.x, d.last.y)), a1 = ringAngle(gr.U[d.ring], gr.V[d.ring], at(last.clientX, last.clientY));
      const dx = last.clientX - d.last.x, dy = last.clientY - d.last.y;
      d.tot += a0 !== null && a1 !== null ? (deltaAngle(a0, a1) * 180) / Math.PI : [dy, -dx, dx][d.ring] * 0.5;
      d.last = { x: last.clientX, y: last.clientY };
      let v = d.start[d.ring] + d.tot;
      if (e.shiftKey) v = snapDeg(v);
      d.cur = [...d.start];
      d.cur[d.ring] = roundDeg(wrapDeg(v));
    }
    if (!d.pending) d.pending = requestAnimationFrame(() => this.flush());
  }

  private flush(): void {
    const d = this.drag;
    if (!d) return;
    d.pending = 0;
    this.engine.set3d(null, { rx: d.cur[0], ry: d.cur[1], rz: d.cur[2] });
  }

  private up(e: PointerEvent, cancel: boolean): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    e.stopImmediatePropagation();
    this.drag = null;
    if (d.pending) cancelAnimationFrame(d.pending);
    if (this.overlay.hasPointerCapture(e.pointerId)) this.overlay.releasePointerCapture(e.pointerId);
    if (d.moved) {
      setSceneDraft(false);
      this.engine.set3d(null, cancel ? { rx: d.start[0], ry: d.start[1], rz: d.start[2] } : { rx: d.cur[0], ry: d.cur[1], rz: d.cur[2] });
      this.engine.endGesture();
    }
    this.hot = null;
    this.stage.ctx.redraw();
  }

  private reset(e: MouseEvent): void {
    const gr = this.grip();
    if (!gr || e.altKey || !this.hit(gr, e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.engine.set3d(null, { rx: 0, ry: 0, rz: 0 });
  }

  private draw(g: CanvasRenderingContext2D): void {
    const gr = this.grip();
    if (!gr) return;
    const pal = this.stage.ctx.paint(), cols = [pal.danger ?? '#e5484d', pal.smart, pal.accent], act = this.drag ? this.drag.ring : null;
    g.save();
    g.lineCap = 'round';
    g.globalAlpha = 0.5;
    g.strokeStyle = pal.handle;
    g.lineWidth = 1;
    g.setLineDash([3, 4]);
    g.beginPath(); g.arc(gr.c.x, gr.c.y, gr.r, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    for (let ring = 0 as Ring; ring < 3; ring = (ring + 1) as Ring) {
      const on = this.hot === ring || (this.drag?.mode === 'ring' && act === ring);
      g.strokeStyle = cols[ring];
      g.lineWidth = on ? 3 : 1.75;
      for (let pass = 0; pass < 2; pass++) {
        g.globalAlpha = pass === 0 ? 0.28 : on ? 1 : 0.85;
        g.beginPath();
        let pen = false;
        for (let i = 0; i <= SEG; i++) {
          const th = (i / SEG) * Math.PI * 2, q = ringPoint(gr.U[ring], gr.V[ring], th), z = ringDepth(gr, ring, th), front = z <= 0;
          if (front !== (pass === 1)) { pen = false; continue; }
          if (pen) g.lineTo(gr.c.x + q.x, gr.c.y + q.y); else { g.moveTo(gr.c.x + q.x, gr.c.y + q.y); pen = true; }
        }
        g.stroke();
      }
      const lab = ringPoint(gr.U[ring], gr.V[ring], 0);
      g.globalAlpha = 1;
      g.fillStyle = cols[ring];
      g.beginPath(); g.arc(gr.c.x + lab.x, gr.c.y + lab.y, 3.5, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
}

function ringDepth(gr: Grip, ring: Ring, th: number): number {
  const b = ringBases(gr.rot[0], gr.rot[1], gr.rot[2])[ring], u = TILT.fwd(b.u), v = TILT.fwd(b.v);
  return u[2] * Math.cos(th) + v[2] * Math.sin(th);
}

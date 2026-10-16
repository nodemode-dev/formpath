import type { Effect, Engine, VNode } from '../../engine';
import { emptyRect, pathBounds, unionRect } from '../../engine/geometry';
import { threeDFaces } from '../../engine/effects';
import { renderNode } from '../../engine/render';
import { lightSpecs, lightsToParam, setSceneDraft } from '../../engine/threed';
import { freeRotate, lightFromOffset, lightOffset } from '../../engine/threed-view';
import { el, setHidden } from '../dom';
import { paint } from '../palette';
import { t } from '../../i18n';

const W = 232, H = 156, RL = 58, GRAB = 9;
type Rot = [number, number, number];
interface Local { rot: Rot; lights: ReturnType<typeof lightSpecs> | null }

export class ThreeDPreview {
  readonly el = el('<div class="cv-3dp-view" hidden></div>');
  private readonly canvas = el<HTMLCanvasElement>(`<canvas class="cv-3dp-canvas" width="${W}" height="${H}" aria-label="${t('3D preview: drag to orbit, drag a light handle to move the light')}"></canvas>`);
  private readonly g: CanvasRenderingContext2D;
  private readonly dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  private node: VNode | null = null;
  private fx: Effect | null = null;
  private local: Local | null = null;
  private drag: { id: number; kind: 'orbit' | 'light'; light: number; p0: { x: number; y: number }; start: Rot; moved: boolean } | null = null;
  private frame = 0;
  private active = 0;

  constructor(private readonly engine: Engine, private readonly pick: (light: number) => void) {
    this.canvas.width = Math.round(W * this.dpr);
    this.canvas.height = Math.round(H * this.dpr);
    const g = this.canvas.getContext('2d');
    if (!g) throw new Error('2D canvas is unavailable');
    this.g = g;
    this.el.append(this.canvas);
    this.canvas.addEventListener('pointerdown', (e) => this.down(e));
    this.canvas.addEventListener('pointermove', (e) => this.move(e));
    this.canvas.addEventListener('pointerup', (e) => this.up(e, false));
    this.canvas.addEventListener('pointercancel', (e) => this.up(e, true));
    this.canvas.addEventListener('dblclick', () => { if (this.fx) this.engine.set3d(null, { rx: 0, ry: 0, rz: 0 }); });
  }

  sync(n: VNode | null, fx: Effect | null, lightAt: number): void {
    setHidden(this.el, !fx);
    if (this.drag) return;
    this.node = n;
    this.fx = fx;
    this.local = null;
    this.active = lightAt;
    if (fx) this.queue();
  }

  private num(k: string, d: number): number { const v = this.fx?.params[k]; return typeof v === 'number' ? v : d; }
  private rotOf(): Rot { return this.local?.rot ?? [this.num('rx', -18), this.num('ry', -26), this.num('rz', this.fx?.id === '3d.model' ? 0 : 8)]; }
  private lightsOf(): ReturnType<typeof lightSpecs> { return this.local?.lights ?? lightSpecs(this.fx?.params ?? {}); }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.draw(); }); }

  private draw(): void {
    const g = this.g, d = this.dpr, n = this.node, fx = this.fx, p = this.engine.current;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!n || !fx || !p || n.kind === 'layer') return;
    const pal = paint(), rot = this.rotOf(), lights = this.lightsOf();
    const params = { ...fx.params, rx: rot[0], ry: rot[1], rz: rot[2], lights: lightsToParam(lights), ray_trace: false };
    const clone: VNode = { ...n, ap: { ...n.ap, effects: n.ap.effects.map((e) => (e === fx ? { ...e, params } : e)) } };
    setSceneDraft(true);
    let faces: VNode[] | null = null;
    try { faces = threeDFaces(p.doc, clone); } finally { setSceneDraft(false); }
    if (faces?.length) {
      let b = emptyRect();
      for (const f of faces) if (f.kind === 'path') b = unionRect(b, pathBounds(f.d));
      if (Number.isFinite(b.x) && b.w + b.h > 0) {
        const pad = RL * 0.42, s = Math.min((W - pad * 2) / Math.max(b.w, 1), (H - pad * 2) / Math.max(b.h, 1)), tx = W / 2 - (b.x + b.w / 2) * s, ty = H / 2 - (b.y + b.h / 2) * s;
        g.save();
        g.setTransform(d * s, 0, 0, d * s, d * tx, d * ty);
        const rc = { doc: p.doc, scale: s, outline: false, assets: () => null, pixelRatio: d };
        for (const f of faces) renderNode(g, f, rc);
        g.restore();
      }
    }
    g.setTransform(d, 0, 0, d, 0, 0);
    g.lineWidth = 1;
    g.strokeStyle = pal.handle;
    g.globalAlpha = 0.45;
    g.setLineDash([3, 4]);
    g.beginPath(); g.arc(W / 2, H / 2, RL, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;
    lights.forEach((l, i) => {
      const o = lightOffset(l.rotation, l.height, RL), x = W / 2 + o.x, y = H / 2 + o.y, on = i === this.active;
      g.strokeStyle = pal.handle; g.globalAlpha = 0.6;
      g.beginPath(); g.moveTo(W / 2, H / 2); g.lineTo(x, y); g.stroke();
      g.globalAlpha = 1;
      g.fillStyle = l.color; g.strokeStyle = on ? pal.accent : pal.handle; g.lineWidth = on ? 2.5 : 1.5;
      g.beginPath(); g.arc(x, y, on ? 6 : 5, 0, Math.PI * 2); g.fill(); g.stroke();
    });
  }

  private at(e: MouseEvent): { x: number; y: number } { const r = this.canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; }

  private down(e: PointerEvent): void {
    if (e.button !== 0 || !this.fx) return;
    const q = this.at(e), lights = this.lightsOf();
    let light = -1, best = GRAB;
    lights.forEach((l, i) => { const o = lightOffset(l.rotation, l.height, RL), dd = Math.hypot(W / 2 + o.x - q.x, H / 2 + o.y - q.y); if (dd <= best) { best = dd; light = i; } });
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.drag = { id: e.pointerId, kind: light >= 0 ? 'light' : 'orbit', light, p0: q, start: this.rotOf(), moved: false };
    if (light >= 0) { this.active = light; this.pick(light); }
    this.local = { rot: this.rotOf(), lights: lights.map((l) => ({ ...l })) };
  }

  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.id || !this.local) return;
    const q = this.at(e);
    if (!d.moved && Math.hypot(q.x - d.p0.x, q.y - d.p0.y) < 2) return;
    d.moved = true;
    if (d.kind === 'orbit') this.local.rot = freeRotate(d.start, q.x - d.p0.x, q.y - d.p0.y, e.shiftKey);
    else if (this.local.lights) {
      const o = lightFromOffset(q.x - W / 2, q.y - H / 2, RL), list = this.local.lights;
      list[d.light] = { ...list[d.light], rotation: e.shiftKey ? Math.round(o.rotation / 15) * 15 : o.rotation, height: o.height };
    }
    this.queue();
  }

  private up(e: PointerEvent, cancel: boolean): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    const l = this.local;
    if (!d.moved || cancel || !l) { this.local = null; this.queue(); return; }
    if (d.kind === 'orbit') this.engine.set3d(null, { rx: l.rot[0], ry: l.rot[1], rz: l.rot[2] });
    else if (l.lights) this.engine.set3d(null, { lights: lightsToParam(l.lights) });
  }
}

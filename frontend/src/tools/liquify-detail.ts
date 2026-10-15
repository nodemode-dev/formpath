import { findNode } from '../engine/doc';
import { splitSegmentAt } from '../engine/geometry';
import type { Anchor, PathData, Pt, SubPath, VNode } from '../engine';
import { registerTool } from '../extensions/registry';
import { replaceNode } from './select';

type Kind = 'scallop' | 'crystallize' | 'wrinkle';
const D = { intensity: 5, detail: 5 };
const G = { on: false, last: { x: 0, y: 0 }, hover: null as Pt | null, ids: [] as string[], seed: 1, moved: false };

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function refine(sp: SubPath, c: Pt, r: number, gap: number): SubPath {
  let cur = sp;
  for (let pass = 0; pass < 5; pass++) {
    const n = cur.pts.length, segs = cur.closed ? n : n - 1;
    let split = false;
    for (let i = segs - 1; i >= 0 && cur.pts.length < 20000; i--) {
      const a = cur.pts[i], b = cur.pts[(i + 1) % n], len = Math.hypot(b.x - a.x, b.y - a.y);
      const t = len > 1e-9 ? Math.max(0, Math.min(1, ((c.x - a.x) * (b.x - a.x) + (c.y - a.y) * (b.y - a.y)) / (len * len))) : 0;
      if (len > gap && Math.hypot(a.x + (b.x - a.x) * t - c.x, a.y + (b.y - a.y) * t - c.y) < r + len * 0.25) { cur = splitSegmentAt(cur, i, 0.5); split = true; }
    }
    if (!split) break;
  }
  return cur;
}

const move = (a: Anchor, dx: number, dy: number): Anchor => ({ ...a, x: a.x + dx, y: a.y + dy, ix: a.ix + dx, iy: a.iy + dy, ox: a.ox + dx, oy: a.oy + dy });
const corner = (a: Anchor): Anchor => ({ ...a, ix: a.x, iy: a.y, ox: a.x, oy: a.y, smooth: false });

function shape(sp: SubPath, kind: Kind, c: Pt, r: number, amt: number, rand: () => number): SubPath {
  const n = sp.pts.length;
  const touched: boolean[] = new Array(n).fill(false);
  const pts = sp.pts.map((a, i) => {
    const d = Math.hypot(a.x - c.x, a.y - c.y);
    if (d >= r) return a;
    const w = (1 - d / r) ** 2, ux = d > 1e-6 ? (a.x - c.x) / d : 0, uy = d > 1e-6 ? (a.y - c.y) / d : 0;
    if (kind === 'wrinkle') {
      const ang = rand() * Math.PI * 2, m = (rand() - 0.5) * 2 * amt * w;
      touched[i] = true;
      return move(a, Math.cos(ang) * m, Math.sin(ang) * m);
    }
    if (rand() < 0.5) return a;
    const m = (0.3 + rand() * 0.7) * amt * w;
    touched[i] = true;
    if (kind === 'crystallize') return corner(move(a, ux * m, uy * m));
    return move(a, -ux * m, -uy * m);
  });
  if (kind === 'scallop') {
    return {
      closed: sp.closed,
      pts: pts.map((a, i) => {
        if (!touched[i]) return a;
        const p = i > 0 ? pts[i - 1] : sp.closed ? pts[n - 1] : null, q = i < n - 1 ? pts[i + 1] : sp.closed ? pts[0] : null;
        if (!p || !q) return a;
        const tx = (q.x - p.x) / 5, ty = (q.y - p.y) / 5;
        return { ...a, ix: a.x - tx, iy: a.y - ty, ox: a.x + tx, oy: a.y + ty, smooth: true };
      }),
    };
  }
  return { closed: sp.closed, pts };
}

function mapPaths(n: VNode, f: (d: PathData) => PathData): VNode {
  if (n.kind === 'path') return { ...n, d: f(n.d), live: undefined };
  if (n.kind === 'compound') return { ...n, children: n.children.map((c) => ({ ...c, d: f(c.d) })) };
  if (n.kind === 'group') return { ...n, children: n.children.map((c) => mapPaths(c, f)) };
  return n;
}

function detailTool(id: string, label: string, iconName: string, order: number, kind: Kind, verb: string): void {
  registerTool({
    id, label, group: 'warp', order,
    icon: () => iconName,
    hint: () => `Drag over paths to ${verb}. [ and ] change the brush size.`,
    cursor: () => 'none',
    options: (e) => [
      { kind: 'title', text: label },
      { kind: 'range', label: 'Size', min: 4, max: 800, unit: 'pt', get: () => e.options.liquifySize, set: (v) => e.update({ liquifySize: v }) },
      { kind: 'range', label: 'Intensity', min: 1, max: 10, get: () => D.intensity, set: (v) => { D.intensity = v; } },
      { kind: 'range', label: 'Detail', min: 1, max: 10, get: () => D.detail, set: (v) => { D.detail = v; } },
    ],
    hover: (ctx, p) => { G.hover = p?.doc ?? null; ctx.redraw(); },
    keydown: (ctx, ev) => {
      if (ev.key !== '[' && ev.key !== ']') return false;
      const e = ctx.engine;
      e.update({ liquifySize: Math.max(4, e.options.liquifySize + (ev.key === ']' ? 6 : -6)) });
      ctx.redraw();
      return true;
    },
    down: (ctx, p) => {
      const e = ctx.engine, pr = e.current;
      if (!pr) return;
      G.on = true; G.last = p.doc; G.moved = false;
      G.seed = (Math.imul(Math.round(p.doc.x * 7), 73856093) ^ Math.imul(Math.round(p.doc.y * 7), 19349663)) >>> 0;
      G.ids = e.hasSelection ? e.targetIds() : pr.doc.layers.flatMap((l) => (l.hidden || l.locked ? [] : l.children.filter((c) => !c.hidden && !c.locked).map((c) => c.id)));
      e.beginDrag(label.replace(/ Tool$/, ''));
    },
    move: (ctx, p) => {
      const e = ctx.engine, pr = e.current;
      G.hover = p.doc;
      if (!G.on || !pr) return;
      const r = e.options.liquifySize / 2;
      if (Math.hypot(p.doc.x - G.last.x, p.doc.y - G.last.y) < Math.max(1, r * 0.2)) { ctx.redraw(); return; }
      G.last = p.doc;
      const rand = rng(G.seed + Math.round(p.doc.x * 31) * 7 + Math.round(p.doc.y * 17));
      const gap = Math.max(1.5, (r * 2) / (3 + D.detail * 2)), amt = (D.intensity / 10) * r * 0.35;
      const f = (d: PathData): PathData => d.map((sp) => shape(refine(sp, p.doc, r, gap), kind, p.doc, r, amt, rand));
      let doc = pr.doc;
      for (const id of G.ids) { const n = findNode(doc, id); if (n && n.kind !== 'text' && n.kind !== 'image') doc = replaceNode(doc, id, mapPaths(n, f)); }
      G.moved = true;
      e.dragTo(doc);
    },
    up: (ctx) => {
      if (!G.on) return;
      G.on = false;
      if (G.moved) ctx.engine.commitDrag(); else ctx.engine.cancelDrag();
    },
    cancel: (ctx) => { if (ctx.engine.dragging) ctx.engine.cancelDrag(); G.on = false; },
    overlay: (ctx, g) => {
      if (!G.hover) return;
      const v = ctx.view(), s = v.toScreen(G.hover);
      g.save(); g.strokeStyle = ctx.paint().accent; g.beginPath(); g.arc(s.x, s.y, (ctx.engine.options.liquifySize / 2) * v.zoom, 0, Math.PI * 2); g.stroke(); g.restore();
    },
  });
}

detailTool('scallop', 'Scallop Tool', 'vScallop', 61, 'scallop', 'add curved details');
detailTool('crystallize', 'Crystallize Tool', 'vCrystallize', 62, 'crystallize', 'add spiky details');
detailTool('wrinkle', 'Wrinkle Tool', 'vWrinkle', 63, 'wrinkle', 'add wrinkles');

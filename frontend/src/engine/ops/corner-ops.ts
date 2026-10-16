import { childrenOf, findNode, updateNodes } from '../doc';
import { cornerFrame, cornered, hasCorners } from '../corners';
import { EPS } from '../geometry';
import type { CornerSpec, Doc, LiveShape, PathData, PathNode, VNode } from '../types';
import { editLive, normalizeLive } from './live-shapes';

export type CornerTargets = Map<string, Set<number> | null>;

export function leafPathNodes(doc: Doc, ids: Iterable<string>): PathNode[] {
  const out: PathNode[] = [];
  const walk = (n: VNode): void => {
    if (n.kind === 'path') out.push(n);
    else if (n.kind === 'compound') out.push(...n.children);
    else { const ch = childrenOf(n); if (ch) ch.forEach(walk); }
  };
  for (const id of ids) { const n = findNode(doc, id); if (n) walk(n); }
  return out;
}

export function cornerSpecAt(d: PathData, flat: number): CornerSpec | null {
  let k = 0;
  for (const sp of d) for (const a of sp.pts) { if (k++ === flat) return a.corner ?? null; }
  return null;
}

export function patchCorners(d: PathData, which: Set<number> | null, patch: Partial<CornerSpec> | null): PathData {
  let k = 0, changed = false;
  const out = d.map((sp) => ({
    closed: sp.closed,
    pts: sp.pts.map((a, i) => {
      const flat = k++;
      if (which && !which.has(flat)) return a;
      if (!cornerFrame(sp, i)) return a;
      if (patch === null) {
        if (!a.corner) return a;
        const { corner, ...rest } = a; void corner; changed = true; return rest;
      }
      const base = a.corner ?? { type: 'round' as const, r: 0 };
      const mode = patch.mode ?? base.mode;
      const next: CornerSpec = { type: patch.type ?? base.type, r: Math.max(0, patch.r ?? base.r) };
      if (mode === 'relative') next.mode = 'relative';
      if (a.corner && a.corner.type === next.type && a.corner.r === next.r && a.corner.mode === next.mode) return a;
      changed = true;
      if (next.r === 0 && next.type === 'round' && !next.mode) { const { corner, ...rest } = a; void corner; return rest; }
      return { ...a, corner: next };
    }),
  }));
  return changed ? out : d;
}

function rectCornerOf(l: Extract<LiveShape, { kind: 'rect' }>): number[] {
  const max = Math.min(Math.abs(l.w), Math.abs(l.h)) / 2, out: number[] = [];
  l.radii.forEach((r, c) => { out.push(c); if (Math.max(0, Math.min(r, max)) >= EPS) out.push(c); });
  return out;
}

function liveCorners(n: PathNode, which: Set<number> | null, patch: Partial<CornerSpec> | null): PathNode | null {
  const live = n.live;
  if (!live || (live.kind !== 'rect' && live.kind !== 'polygon' && live.kind !== 'star') || patch?.mode === 'relative') return null;
  const l = normalizeLive(live);
  if (l.kind === 'rect') {
    const owner = rectCornerOf(l), hit = new Set<number>();
    owner.forEach((c, flat) => { if (!which || which.has(flat)) hit.add(c); });
    if (!hit.size) return n;
    const radii = l.radii.slice() as [number, number, number, number];
    for (const c of hit) radii[c] = patch === null ? 0 : patch.r ?? radii[c];
    const corner = patch?.type ?? l.corner;
    if (corner === l.corner && radii.every((r, i) => r === l.radii[i])) return n;
    return editLive(n, { radii, corner });
  }
  const s = l as Extract<LiveShape, { kind: 'polygon' | 'star' }>, cur = s.radius ?? 0;
  const radius = patch === null ? 0 : patch.r ?? cur, corner = patch?.type ?? s.corner ?? 'round';
  return radius === cur && corner === (s.corner ?? 'round') ? n : editLive(n, { radius, corner });
}

export function setCornersOp(doc: Doc, targets: CornerTargets, patch: Partial<CornerSpec> | null): Doc {
  return updateNodes(doc, [...targets.keys()], (n) => {
    if (n.kind !== 'path') return n;
    const kept = liveCorners(n, targets.get(n.id) ?? null, patch);
    if (kept) return kept;
    const d = patchCorners(n.d, targets.get(n.id) ?? null, patch);
    return d === n.d ? n : { ...n, d, live: undefined };
  });
}

export function expandCornersOp(doc: Doc, ids: Iterable<string>): Doc {
  const leaves = leafPathNodes(doc, ids).filter((n) => hasCorners(n.d)).map((n) => n.id);
  return updateNodes(doc, leaves, (n) => (n.kind === 'path' ? { ...n, d: cornered(n.d), live: undefined } : n));
}

export function firstCorner(doc: Doc, targets: CornerTargets): CornerSpec | null {
  for (const [id, set] of targets) {
    const n = findNode(doc, id);
    if (n?.kind !== 'path') continue;
    if (n.live?.kind === 'rect') { const l = normalizeLive(n.live) as Extract<LiveShape, { kind: 'rect' }>, r = l.radii.find((v) => v >= EPS); if (r !== undefined) return { type: l.corner, r }; }
    if (n.live?.kind === 'polygon' && (n.live.radius >= EPS || n.live.corner)) return { type: n.live.corner ?? 'round', r: n.live.radius };
    if (n.live?.kind === 'star' && ((n.live.radius ?? 0) >= EPS || n.live.corner)) return { type: n.live.corner ?? 'round', r: n.live.radius ?? 0 };
    let k = 0;
    for (const sp of n.d) for (const a of sp.pts) { if (a.corner && (!set || set.has(k))) return a.corner; k++; }
  }
  return null;
}

export function allTargets(doc: Doc, ids: Iterable<string>): CornerTargets {
  const m: CornerTargets = new Map();
  for (const n of leafPathNodes(doc, ids)) m.set(n.id, null);
  return m;
}

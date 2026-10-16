import { rotator, type V3 } from './threed';

export type Ring = 0 | 1 | 2;
export interface RingBasis { u: V3; v: V3 }

export const RING_KEYS = ['rx', 'ry', 'rz'] as const;
export const SNAP_STEP = 15;

export function ringBases(rx: number, ry: number, rz: number): RingBasis[] {
  const ex = rotator(rx, 0, 0), exy = rotator(rx, ry, 0);
  void rz;
  return [
    { u: [0, 1, 0], v: [0, 0, 1] },
    { u: ex.fwd([0, 0, 1]), v: ex.fwd([1, 0, 0]) },
    { u: exy.fwd([1, 0, 0]), v: exy.fwd([0, 1, 0]) },
  ];
}

export const wrapDeg = (v: number): number => { const w = ((((v + 180) % 360) + 360) % 360) - 180; return w === -180 && v > 0 ? 180 : w; };
export const snapDeg = (v: number, step = SNAP_STEP): number => Math.round(v / step) * step;
export const roundDeg = (v: number): number => Math.round(v * 100) / 100;

export function ringAngle(U: { x: number; y: number }, V: { x: number; y: number }, p: { x: number; y: number }): number | null {
  const det = U.x * V.y - U.y * V.x, scale = Math.hypot(U.x, U.y) * Math.hypot(V.x, V.y);
  if (!(Math.abs(det) >= 0.3 * scale) || scale < 1e-6) return null;
  const a = (p.x * V.y - p.y * V.x) / det, b = (U.x * p.y - U.y * p.x) / det;
  return Math.atan2(b, a);
}

export const deltaAngle = (a: number, b: number): number => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export function ringPoint(U: { x: number; y: number }, V: { x: number; y: number }, t: number): { x: number; y: number } {
  return { x: U.x * Math.cos(t) + V.x * Math.sin(t), y: U.y * Math.cos(t) + V.y * Math.sin(t) };
}

export function freeRotate(start: V3, dx: number, dy: number, snap: boolean): V3 {
  const k = 0.5;
  let rx = start[0] + dy * k, ry = start[1] - dx * k;
  if (snap) { rx = snapDeg(rx); ry = snapDeg(ry); }
  return [roundDeg(wrapDeg(rx)), roundDeg(wrapDeg(ry)), start[2]];
}

export function lightFromOffset(dx: number, dy: number, radius: number): { rotation: number; height: number } {
  const len = Math.min(1, Math.hypot(dx, dy) / radius), th = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return { rotation: Math.round(len < 0.02 ? 0 : th), height: Math.round((Math.acos(len) * 180) / Math.PI) };
}

export function lightOffset(rotation: number, height: number, radius: number): { x: number; y: number } {
  const th = (rotation * Math.PI) / 180, ph = (Math.max(0, Math.min(90, height)) * Math.PI) / 180;
  return { x: Math.cos(ph) * Math.sin(th) * radius, y: -Math.cos(ph) * Math.cos(th) * radius };
}

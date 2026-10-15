import { liveParams, type LivePatch } from '../engine/ops/live-shapes';
import { UNIT_PT, type Engine, type PathNode } from '../engine';
import { el, q, setHidden, setText } from './dom';
import { numField, row, selectCtl, type Ctl } from './panels/kit';

type Kind = 'rect' | 'ellipse' | 'polygon' | 'star' | 'line';

export class ShapeFields {
  readonly el = el('<div class="cv-shapef"></div>');
  private readonly groups = new Map<Kind, HTMLElement>();
  private readonly lengths: Array<Ctl<number | null>> = [];
  private readonly f: Record<string, Ctl<number | null>> = {};
  private readonly corner;

  constructor(private readonly engine: Engine) {
    const k = (): number => UNIT_PT[engine.doc?.units ?? 'pt'] ?? 1;
    const send = (p: LivePatch): void => { engine.editLiveShape(p); };
    const len = (key: string, label: string, make: (v: number) => LivePatch, o: { min?: number; title?: string } = {}): Ctl<number | null> => { const c = numField(label, 'pt', (v) => send(make(v * k())), { min: o.min ?? 0, max: 100000, title: o.title }); this.lengths.push(c); this.f[key] = c; return c; };
    const plain = (key: string, label: string, unit: string, make: (v: number) => LivePatch, o: { min?: number; max?: number; title?: string } = {}): Ctl<number | null> => { const c = numField(label, unit, (v) => send(make(v)), o); this.f[key] = c; return c; };
    const radii = (i: number) => (v: number): LivePatch => { const n = this.node(); const p = n?.live ? liveParams(n.live) : null; const r: [number, number, number, number] = p ? [Number(p.r0), Number(p.r1), Number(p.r2), Number(p.r3)] : [0, 0, 0, 0]; r[i] = v; return { radii: r }; };
    this.corner = selectCtl('Corners', [['round', 'Round'], ['inverted', 'Inverted Round'], ['chamfer', 'Chamfer']], (v) => send({ corner: v as 'round' }));
    const rect = el('<div class="cv-shapef-group"></div>');
    rect.append(row(len('w', 'W', (v) => ({ w: v }), { min: 0.01 }).el, len('h', 'H', (v) => ({ h: v }), { min: 0.01 }).el), this.corner.el, row(len('all', 'Radius', (v) => ({ radius: v }), { title: 'Every corner radius' }).el));
    const grid = el('<div class="cv-props-grid cv-shapef-radii"></div>');
    grid.append(len('r0', '', radii(0), { title: 'Top-left corner radius' }).el, len('r1', '', radii(1), { title: 'Top-right corner radius' }).el, len('r3', '', radii(3), { title: 'Bottom-left corner radius' }).el, len('r2', '', radii(2), { title: 'Bottom-right corner radius' }).el);
    for (const [key, label] of [['r0', 'TL'], ['r1', 'TR'], ['r3', 'BL'], ['r2', 'BR']] as const) setText(q(this.f[key].el, '.cv-pf-label'), label);
    rect.appendChild(grid);
    const ellipse = el('<div class="cv-shapef-group"></div>');
    ellipse.append(row(len('ew', 'W', (v) => ({ w: v }), { min: 0.01 }).el, len('eh', 'H', (v) => ({ h: v }), { min: 0.01 }).el), row(plain('start', 'Pie start', '°', (v) => ({ start: v }), { min: -360, max: 360 }).el, plain('end', 'Pie end', '°', (v) => ({ end: v }), { min: -360, max: 720 }).el));
    const polygon = el('<div class="cv-shapef-group"></div>');
    polygon.append(row(len('pr', 'Radius', (v) => ({ r: v }), { min: 0.01 }).el, plain('sides', 'Sides', '', (v) => ({ sides: v }), { min: 3, max: 1000 }).el), len('pc', 'Corner radius', (v) => ({ radius: v })).el);
    const star = el('<div class="cv-shapef-group"></div>');
    star.append(plain('points', 'Points', '', (v) => ({ points: v }), { min: 3, max: 1000 }).el, row(len('r1s', 'Radius 1', (v) => ({ r1: v }), { min: 0.01 }).el, len('r2s', 'Radius 2', (v) => ({ r2: v }), { min: 0.01 }).el), len('sc', 'Corner radius', (v) => ({ radius: v })).el);
    const line = el('<div class="cv-shapef-group"></div>');
    line.append(row(len('length', 'Length', (v) => ({ length: v }), { min: 0.01 }).el, plain('angle', 'Angle', '°', (v) => ({ angle: v }), { min: -360, max: 360 }).el));
    for (const [kind, g] of [['rect', rect], ['ellipse', ellipse], ['polygon', polygon], ['star', star], ['line', line]] as const) { this.groups.set(kind, g); this.el.appendChild(g); }
  }

  node(): PathNode | null { const s = this.engine.selected(); const n = s.length === 1 ? s[0] : null; return n?.kind === 'path' && n.live ? n : null; }

  sync(): boolean {
    const n = this.node();
    if (!n?.live) { setHidden(this.el, true); return false; }
    setHidden(this.el, false);
    const kind = n.live.kind, p = liveParams(n.live), k = UNIT_PT[this.engine.doc?.units ?? 'pt'] ?? 1, u = this.engine.doc?.units ?? 'pt';
    for (const [key, g] of this.groups) setHidden(g, key !== kind);
    const r = (v: unknown, unit = true): number => Math.round((Number(v) / (unit ? k : 1)) * 100) / 100;
    const map: Record<Kind, Array<[string, string, boolean]>> = {
      rect: [['w', 'w', true], ['h', 'h', true], ['r0', 'r0', true], ['r1', 'r1', true], ['r2', 'r2', true], ['r3', 'r3', true]],
      ellipse: [['ew', 'w', true], ['eh', 'h', true], ['start', 'start', false], ['end', 'end', false]],
      polygon: [['pr', 'r', true], ['sides', 'sides', false], ['pc', 'radius', true]],
      star: [['points', 'points', false], ['r1s', 'r1', true], ['r2s', 'r2', true], ['sc', 'radius', true]],
      line: [['length', 'length', true], ['angle', 'angle', false]],
    };
    for (const [field, key, unit] of map[kind]) this.f[field].set(r(p[key], unit));
    if (kind === 'rect') { const all = [p.r0, p.r1, p.r2, p.r3].map(Number); this.f.all.set(all.every((v) => Math.abs(v - all[0]) < 1e-6) ? r(all[0]) : null); this.corner.set(String(p.corner)); }
    for (const c of this.lengths) setText(q(c.el, '.cv-unit'), u);
    return true;
  }
}

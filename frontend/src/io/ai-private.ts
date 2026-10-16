import { visualBounds } from '../engine/bounds';
import { cornered } from '../engine/corners';
import { childrenOf } from '../engine/doc';
import { isLineSeg, segments } from '../engine/geometry';
import { mixOklab, resolvePaint, toCmyk, toRgb } from '../engine/paint';
import { gradientGeom } from '../engine/render';
import { instanceArt } from '../engine/symbolism';
import type { Artboard, BlendMode, Color, Doc, Gradient, ImageNode, LayerNode, Mat, Paint, PathData, Project, Rect, StrokeItem, Swatch, VNode } from '../engine';
import { pixelsOf } from './pdf-image';

/** The 256 colour palette Illustrator writes ahead of the 8 bit %AI7_Thumbnail pixels; the same bytes in every file. */
const THUMB_PALETTE = [
  '0000330000660000990000CC0033000033330033660033990033CC0033FF0066000066330066660066990066CC0066FF0099000099330099660099990099CC0099FF00CC0000CC3300CC6600CC9900CCCC00CCFF00FF3300FF6600FF9900FFCC3300003300333300663300993300CC3300FF',
  '3333003333333333663333993333CC3333FF3366003366333366663366993366CC3366FF3399003399333399663399993399CC3399FF33CC0033CC3333CC6633CC9933CCCC33CCFF33FF0033FF3333FF6633FF9933FFCC33FFFF6600006600336600666600996600CC6600FF6633006633336633',
  '666633996633CC6633FF6666006666336666666666996666CC6666FF6699006699336699666699996699CC6699FF66CC0066CC3366CC6666CC9966CCCC66CCFF66FF0066FF3366FF6666FF9966FFCC66FFFF9900009900339900669900999900CC9900FF9933009933339933669933999933CC9933FF',
  '9966009966339966669966999966CC9966FF9999009999339999669999999999CC9999FF99CC0099CC3399CC6699CC9999CCCC99CCFF99FF0099FF3399FF6699FF9999FFCC99FFFFCC0000CC0033CC0066CC0099CC00CCCC00FFCC3300CC3333CC3366CC3399CC33CCCC33FFCC6600CC6633CC6666',
  'CC6699CC66CCCC66FFCC9900CC9933CC9966CC9999CC99CCCC99FFCCCC00CCCC33CCCC66CCCC99CCCCCCCCCCFFCCFF00CCFF33CCFF66CCFF99CCFFCCCCFFFFFF0033FF0066FF0099FF00CCFF3300FF3333FF3366FF3399FF33CCFF33FFFF6600FF6633FF6666FF6699FF66CCFF66FFFF9900FF9933',
  'FF9966FF9999FF99CCFF99FFFFCC00FFCC33FFCC66FFCC99FFCCCCFFCCFFFFFF33FFFF66FFFF99FFFFCC110000001100000011111111220000002200000022222222440000004400000044444444550000005500000055555555770000007700000077777777880000008800000088888888AA000000',
  'AA000000AAAAAAAABB000000BB000000BBBBBBBBDD000000DD000000DDDDDDDDEE000000EE000000EEEEEEEE0000000000FF00FF0000FFFFFF0000FF00FFFFFF00FFFFFF',
].join('');

/** Layer colours Illustrator hands out by index; the sequence continues across layers and sublayers in order of creation. */
const LAYER_RGB: Array<[number, number, number]> = [
  [79, 128, 255], [255, 79, 79], [79, 255, 79], [79, 79, 255], [255, 255, 79], [255, 79, 255], [79, 255, 255], [128, 128, 128], [0, 0, 0], [255, 102, 0],
  [0, 85, 0], [0, 153, 153], [204, 153, 102], [153, 51, 0], [153, 51, 255], [255, 153, 0], [0, 0, 136], [255, 153, 204], [153, 153, 255], [153, 0, 0],
  [102, 102, 0], [255, 153, 153], [153, 0, 51], [153, 204, 0], [153, 102, 0], [102, 0, 102],
];

const BLEND_INDEX: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'soft_light', 'hard_light', 'color_dodge', 'color_burn', 'darken', 'lighten', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
const RULER_UNITS: Record<string, number> = { in: 0, mm: 1, pt: 2, pc: 3, cm: 4, px: 6 };
const BLOCK = 65536;
const CR = '\r';

const closedOf = new WeakMap<string[], boolean>();
const nf = (v: number, p = 1e5): string => { const r = Math.round(v * p) / p; return Object.is(r, -0) || !Number.isFinite(r) ? '0' : String(r); };
const cf = (v: number): string => nf(Math.max(0, Math.min(1, v)), 1e9);
const ps = (s: string): string => `(${s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/\r|\n/g, ' ').replace(/[^\x20-\x7e]/g, '?')})`;
const dateLine = (d: Date): string => `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${String(d.getUTCFullYear()).slice(2)} ${d.getUTCHours() % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${d.getUTCHours() < 12 ? 'AM' : 'PM'}`;

export interface AiPrivateInput {
  p: Project;
  boards: number[];
  outlines: Map<string, PathData>;
  title: string;
  version: string;
  deflate: (d: Uint8Array) => Promise<Uint8Array>;
  thumb: { width: number; height: number; data: Uint8ClampedArray } | null;
}
export interface AiPrivate { meta: Uint8Array; blocks: Uint8Array[]; creator: number; stats: AiStats }
export interface AiStats { layers: number; sublayers: number; objects: number; omitted: Map<string, number> }

function labOf(c: Color): [number, number, number] {
  const v = toRgb(c), lin = (u: number): number => { const s = u / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const r = lin(v.r), g = lin(v.g), b = lin(v.b);
  const X = (0.4360747 * r + 0.3850649 * g + 0.1430804 * b) / 0.9642, Y = 0.2225045 * r + 0.7168786 * g + 0.0606169 * b, Z = (0.0139322 * r + 0.0971045 * g + 0.7141733 * b) / 0.8249;
  const q = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = q(X), fy = q(Y), fz = q(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const cmykOf = (c: Color): { c: number; m: number; y: number; k: number } => { const k = toCmyk(c); return k.kind === 'cmyk' ? { c: k.c / 100, m: k.m / 100, y: k.y / 100, k: k.k / 100 } : { c: 0, m: 0, y: 0, k: 1 }; };

class Emit {
  readonly out: string[] = [];
  readonly stats: AiStats = { layers: 0, sublayers: 0, objects: 0, omitted: new Map() };
  private colourIndex = 0;
  private readonly ids: Map<string, number>;
  private lock = 0;
  private dir = -1;
  private readonly spots = new Map<string, Swatch>();
  private readonly images = new Map<string, { w: number; h: number; hex: string }>();
  private readonly gradients: Map<string, Gradient>;
  private readonly swatchByName: Map<string, string>;
  private ox = 0;
  private oy = 0;
  constructor(private readonly doc: Doc, private readonly outlines: Map<string, PathData>, private readonly a0: Artboard, root?: Emit) {
    this.ids = root ? root.ids : new Map();
    this.gradients = root ? root.gradients : new Map();
    this.swatchByName = root ? root.swatchByName : new Map();
    this.ox = a0.x; this.oy = a0.y;
    for (const s of doc.swatches) if (s.spot && s.paint.type === 'color') this.spots.set(s.id, s);
  }
  line(s: string): void { this.out.push(s); }
  note(what: string): void { this.stats.omitted.set(what, (this.stats.omitted.get(what) ?? 0) + 1); }
  fx(x: number): number { return x - this.ox; }
  fy(y: number): number { return this.oy - y; }
  pt(x: number, y: number): string { return `${nf(this.fx(x))} ${nf(this.fy(y))}`; }
  /** Id Illustrator derives from an object name: non-alphanumerics become underscores and repeats get _1_, _2_ suffixes. */
  xmlId(name: string): string {
    const base = (name.trim().replace(/[^A-Za-z0-9_\-.:]/g, '_') || 'Layer').replace(/^([^A-Za-z_])/, '_$1');
    const n = this.ids.get(base) ?? 0;
    this.ids.set(base, n + 1);
    return n === 0 ? base : `${base}_${n}_`;
  }
  artDict(name: string | undefined): void {
    if (!name) return;
    this.line('%_/ArtDictionary :');
    this.line(`%_/XMLUID : ${ps(this.xmlId(name))} ; (AI10_ArtUID) ,`);
    this.line('%_;');
    this.line('%_');
  }

  colour(paint: Paint, stroke: boolean, b: Rect): string[] {
    const r = resolvePaint(this.doc, paint);
    if (paint.type === 'color' && paint.swatch) {
      const sw = this.spots.get(paint.swatch);
      if (sw && sw.paint.type === 'color') {
        const k = cmykOf(sw.paint.color);
        return [`${cf(k.c)} ${cf(k.m)} ${cf(k.y)} ${cf(k.k)} ${ps(sw.name)} ${nf(1 - (paint.tint ?? 100) / 100, 1e6)} ${stroke ? 'XS' : 'Xs'}`];
      }
    }
    if (r.type === 'color') return this.solid(r.color, stroke);
    if (r.type === 'gradient') { const s = r.gradient.stops[0]; return this.solid(s ? s.color : { kind: 'gray', k: 50 }, stroke); }
    if (r.type === 'pattern') { this.note('pattern paints (drawn as 50 percent gray)'); return this.solid({ kind: 'gray', k: 50 }, stroke); }
    void b;
    return [];
  }
  solid(c: Color, stroke: boolean): string[] {
    if (c.kind === 'gray') return [`${cf(1 - c.k / 100)} ${stroke ? 'G' : 'g'}`];
    if (c.kind === 'cmyk') return [`${cf(c.c / 100)} ${cf(c.m / 100)} ${cf(c.y / 100)} ${cf(c.k / 100)} ${stroke ? 'K' : 'k'}`];
    const k = cmykOf(c), v = toRgb(c);
    return [`${cf(k.c)} ${cf(k.m)} ${cf(k.y)} ${cf(k.k)} ${cf(v.r / 255)} ${cf(v.g / 255)} ${cf(v.b / 255)} ${stroke ? 'XA' : 'Xa'}`];
  }

  sub(d: PathData): string[][] {
    const rows: string[][] = [];
    for (const sp of cornered(d)) {
      if (!sp.pts.length) continue;
      const o = [`${this.pt(sp.pts[0].x, sp.pts[0].y)} m`];
      for (const s of segments(sp)) o.push(isLineSeg(s) ? `${this.pt(s[3].x, s[3].y)} L` : `${this.pt(s[1].x, s[1].y)} ${this.pt(s[2].x, s[2].y)} ${this.pt(s[3].x, s[3].y)} C`);
      closedOf.set(o, sp.closed);
      rows.push(o);
    }
    return rows;
  }

  state(n: VNode, strokeItem: StrokeItem | null): void {
    const op = n.opacity;
    this.line(`${Math.max(0, BLEND_INDEX.indexOf(n.blend))} ${nf(Math.max(0, Math.min(1, op)), 1e6)} ${n.isolate ? 1 : 0} ${n.knockout === true ? 1 : 0} 0 Xy`);
    const s = strokeItem;
    this.line(`${s ? (s.cap === 'round' ? 1 : s.cap === 'square' ? 2 : 0) : 0} J ${s ? (s.join === 'round' ? 1 : s.join === 'bevel' ? 2 : 0) : 0} j ${nf(s ? s.width : 1)} w ${nf(s ? s.miter : 10)} M [${(s ? s.dash : []).map((v) => nf(v)).join(' ')}]${nf(s ? s.dashOffset : 0)} d`);
  }

  lockState(n: VNode, layerLocked: boolean): void {
    const want = n.locked || layerLocked ? 1 : 0;
    if (want !== this.lock) { this.lock = want; this.line(`${want} A`); }
  }

  /** The painting operator for a fill and a stroke of one subpath: f fill, s stroke, b both, n neither (lower case closes). */
  paintOp(closed: boolean, fill: boolean, stroke: boolean): string {
    if (fill && stroke) return closed ? 'b' : 'B';
    if (fill) return closed ? 'f' : 'F';
    if (stroke) return closed ? 's' : 'S';
    return 'n';
  }

  gradientDef(g: Gradient): string {
    for (const [name, x] of this.gradients) if (x === g) return name;
    let name = `Unnamed gradient ${this.gradients.size + 1}`;
    const sw = this.doc.swatches.find((s) => s.paint.type === 'gradient' && s.paint.gradient === g);
    if (sw && !this.swatchByName.has(sw.name)) { name = sw.name; this.swatchByName.set(name, sw.id); }
    this.gradients.set(name, g);
    return name;
  }
  gradientList(): Array<[string, Gradient]> { return [...this.gradients]; }
  spotList(): Swatch[] { return [...this.spots.values()]; }
  imageList(): Map<string, { w: number; h: number; hex: string }> { return this.images; }
  setImage(src: string, v: { w: number; h: number; hex: string }): void { this.images.set(src, v); }

  gradientInstance(g: Gradient, b: Rect, strokeToo: boolean): string[] {
    const geo = gradientGeom(g, b), x1 = this.fx(geo.x1), y1 = this.fy(geo.y1), x2 = this.fx(geo.x2), y2 = this.fy(geo.y2);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const name = this.gradientDef(g);
    void strokeToo;
    return ['Bb', `1 ${ps(name)} ${nf(x1)} ${nf(y1)} ${nf(ang)} ${nf(len)} 1 0 0 1 0 0 1 Bg`, '1 0 0 1 0 0 Xm', '1 0 0 1 0 0 Bm'];
  }

  object(n: VNode, layerLocked: boolean): void {
    if (n.hidden) { this.note('hidden objects'); return; }
    if (n.ap.effects.length) this.note('live effects (the base shape is written)');
    if (n.mask && !n.mask.disabled) this.note('opacity masks');
    this.stats.objects++;
    switch (n.kind) {
      case 'layer': this.layer(n, layerLocked, true); return;
      case 'group': {
        const kids = n.children.filter((c) => !c.hidden);
        if (!kids.length) return;
        this.lockState(n, layerLocked);
        if (n.opacity < 1 || n.blend !== 'normal') this.line(`${Math.max(0, BLEND_INDEX.indexOf(n.blend))} ${nf(n.opacity, 1e6)} ${n.isolate ? 1 : 0} ${n.knockout === true ? 1 : 0} 0 Xy`);
        this.line('0 Ae');
        this.line('u');
        if (n.clip && kids.length > 1) {
          const clipper = kids[kids.length - 1];
          this.line('0 Ae');
          this.line('q');
          for (const c of kids.slice(0, -1)) this.object(c, layerLocked);
          const rows = this.clipRows(clipper);
          for (const r of rows) { this.out.push(...r); this.line('h'); }
          this.line('W');
          this.line('n');
          this.line('Q');
        } else for (const c of kids) this.object(c, layerLocked);
        this.line('U');
        this.artDict(n.name);
        return;
      }
      case 'path': case 'compound': {
        if (n.kind === 'path' && n.guide) { this.guide(n); return; }
        const d: PathData = n.kind === 'path' ? n.d : n.children.flatMap((c) => c.d);
        this.shape(n, d, n.rule, layerLocked);
        return;
      }
      case 'text': {
        const d = this.outlines.get(n.id), st = n.spans[0]?.style;
        if (!d || !st) { this.note('type that could not be outlined'); return; }
        this.note('type (written as outlines, the live text stays in the formpth data)');
        const ap = { ...n.ap, items: [{ kind: 'fill' as const, paint: st.fill, opacity: 1, blend: 'normal' as const, visible: true, effects: [] }, ...(st.stroke.type !== 'none' && st.strokeWidth > 0 ? [{ kind: 'stroke' as const, paint: st.stroke, width: st.strokeWidth, cap: 'butt' as const, join: 'miter' as const, miter: 10, align: 'center' as const, dash: [], dashOffset: 0, dashCorners: false, startArrow: 'none', endArrow: 'none', arrowScale: [100, 100] as [number, number], arrowAlign: 'tip' as const, profile: null, brush: null, opacity: 1, blend: 'normal' as const, visible: true, effects: [] }] : [])] };
        this.shape({ ...n, ap, name: n.name || n.spans.map((s) => s.text).join('').slice(0, 40) }, d, 'nonzero', layerLocked);
        return;
      }
      case 'image': { this.raster(n, layerLocked); return; }
      case 'symbol': {
        const art = instanceArt(this.doc, n);
        if (!art) return;
        this.note('symbol instances (written as their expanded art)');
        this.lockState(n, layerLocked);
        this.line('0 Ae');
        this.line('u');
        this.object(this.moved(art, n.xf), layerLocked);
        this.line('U');
        this.artDict(n.name);
        return;
      }
      default: {
        const kids = childrenOf(n);
        if (kids) {
          this.note(`${n.kind} objects (written as their current art)`);
          this.line('0 Ae'); this.line('u');
          for (const c of kids) this.object(c, layerLocked);
          this.line('U');
          this.artDict(n.name);
        } else this.note(`${n.kind} objects`);
      }
    }
  }

  moved(n: VNode, m: Mat): VNode {
    const mul = (a: Mat, b: Mat): Mat => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
    const ap = (p: { x: number; y: number }): { x: number; y: number } => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
    const mv = (d: PathData): PathData => d.map((sp) => ({ ...sp, pts: sp.pts.map((a) => { const p = ap(a), hi = ap({ x: a.ix, y: a.iy }), ho = ap({ x: a.ox, y: a.oy }); return { ...a, x: p.x, y: p.y, ix: hi.x, iy: hi.y, ox: ho.x, oy: ho.y }; }) }));
    switch (n.kind) {
      case 'path': return { ...n, d: mv(n.d) };
      case 'compound': return { ...n, children: n.children.map((c) => ({ ...c, d: mv(c.d) })) };
      case 'group': case 'layer': return { ...n, children: n.children.map((c) => this.moved(c, m)) };
      case 'image': return { ...n, xf: mul(m, n.xf) };
      case 'text': { const d = this.outlines.get(n.id); if (d) this.outlines.set(n.id, mv(d)); return n; }
      default: return n;
    }
  }

  clipRows(c: VNode): string[][] {
    if (c.kind === 'path') return this.sub(c.d);
    if (c.kind === 'compound') return c.children.flatMap((k) => this.sub(k.d));
    const kids = childrenOf(c);
    return kids ? kids.flatMap((k) => this.clipRows(k)) : [];
  }

  guide(n: VNode & { kind: 'path' }): void {
    this.line('*');
    for (const r of this.sub(n.d)) { this.out.push(...r); this.line('h'); }
    this.line('n');
  }

  shape(n: VNode, d: PathData, rule: 'nonzero' | 'evenodd', layerLocked: boolean): void {
    const fills = n.ap.items.filter((i) => i.visible && i.kind === 'fill' && i.paint.type !== 'none'), strokes = n.ap.items.filter((i) => i.visible && i.kind === 'stroke' && i.paint.type !== 'none');
    if (fills.length > 1 || strokes.length > 1) this.note('extra fills and strokes in an appearance (the first of each is written)');
    const fill = fills[0] && fills[0].kind === 'fill' ? fills[0] : null, stroke = strokes[0] && strokes[0].kind === 'stroke' ? strokes[0] : null;
    if (stroke && (stroke.brush || stroke.profile)) this.note('brushes and width profiles (a plain stroke is written)');
    const rows = this.sub(d);
    if (!rows.length) return;
    const b = visualBounds(this.doc, n);
    this.lockState(n, layerLocked);
    const compound = n.kind === 'compound' || (n.kind === 'text' && rows.length > 1);
    if (fill) { this.line(`${fill.overprint ? 1 : 0} O`); for (const l of this.colour(fill.paint, false, b)) this.line(l); }
    if (stroke) { this.line(`${stroke.overprint ? 1 : 0} R`); for (const l of this.colour(stroke.paint, true, b)) this.line(l); }
    this.state(n, stroke);
    this.line(`${rule === 'evenodd' ? 1 : 0} XR`);
    const grad = fill && fill.paint.type === 'gradient' && fill.paint.gradient.kind !== 'freeform' ? fill.paint.gradient : null;
    if (fill && fill.paint.type === 'gradient' && fill.paint.gradient.kind === 'freeform') this.note('freeform gradients (first colour written)');
    if (compound) { this.line('0 Ae'); this.line('*u'); }
    rows.forEach((r) => {
      this.setDirection(0);
      this.out.push(...r);
      const closed = closedOf.get(r) ?? true;
      if (grad) {
        for (const l of this.gradientInstance(grad, b, !!stroke)) this.line(l);
        this.line(this.paintOp(closed, true, false));
        this.line(stroke ? '1 BB' : '0 BB');
      } else this.line(this.paintOp(closed, !!fill, !!stroke));
    });
    if (compound) this.line('*U');
    this.artDict(n.name);
  }
  setDirection(v: number): void { if (v !== this.dir) { this.dir = v; this.line(`${v} D`); } }

  raster(n: ImageNode, layerLocked: boolean): void {
    const im = this.images.get(n.src);
    if (!im) { this.note('images that could not be read'); return; }
    this.lockState(n, layerLocked);
    const [a, b, c, d, e, f] = n.xf, sx = n.w / im.w, sy = n.h / im.h;
    // pixel space (rows counted upward) to file space: x runs along the image, y is the doc y mirrored about the artboard top
    const p: Mat = [a * sx, -b * sx, -c * sy, d * sy, c * n.h + e - this.ox, this.oy - f - d * n.h];
    const mat = `[ ${p.map((v) => nf(v, 1e6)).join(' ')} ]`;
    this.line('0 Ae');
    this.line('u');
    this.line('0 Ae');
    this.line('q');
    this.line(`${Math.max(0, BLEND_INDEX.indexOf(n.blend))} ${nf(n.opacity, 1e6)} 0 0 1 Xy`);
    this.line('%AI5_File:');
    this.line('%AI5_BeginRaster');
    this.line('() 1 XG');
    this.line('/DeviceRGB XN');
    this.line(`${mat} ${im.w} ${im.h} 0 Xh`);
    this.line(`${mat} 0 0 ${im.w} ${im.h} ${im.w} ${im.h} 8 3 1 18 0 0 4 4 0 0`);
    this.line(`%%BeginData: ${im.hex.length + Math.ceil(im.hex.length / 64)} Hex Bytes`);
    this.line('XI');
    for (let i = 0; i < im.hex.length; i += 64) this.line(`%${im.hex.slice(i, i + 64)}`);
    this.line('%%EndData');
    this.line('%AI5_EndRaster');
    const w = n.w, h = n.h, xs = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => this.pt(n.xf[0] * x + n.xf[2] * y + n.xf[4], n.xf[1] * x + n.xf[3] * y + n.xf[5]));
    this.line(`${xs[0]} m`); this.line(`${xs[1]} L`); this.line(`${xs[2]} L`); this.line(`${xs[3]} L`);
    this.line('h'); this.line('W'); this.line('n');
    this.line('Q');
    this.line('U');
    this.artDict(n.name);
  }

  layerColour(l: LayerNode): { idx: number; rgb: [number, number, number] } {
    const i = this.colourIndex++ % LAYER_RGB.length;
    void l;
    return { idx: i, rgb: LAYER_RGB[i] };
  }

  layer(l: LayerNode, parentLocked: boolean, nested: boolean): void {
    if (l.template) this.note('template layers (written dimmed, locked and non-printing)');
    if (nested) this.stats.sublayers++; else this.stats.layers++;
    const c = this.layerColour(l), locked = parentLocked || !!l.locked;
    this.line('%AI5_BeginLayer');
    this.line(`${l.hidden ? 0 : 1} ${l.template ? 0 : 1} ${locked || l.template ? 0 : 1} ${l.printable === false || l.template ? 0 : 1} ${l.template ? 1 : 0} 0 ${l.hidden ? 0 : 1} ${c.idx} ${c.rgb.join(' ')} 0 50 0 Lb`);
    this.line(`${ps(l.name || 'Layer')} Ln`);
    this.line('0 AE');
    this.artDict(l.name || 'Layer');
    this.lock = locked ? 1 : 0;
    this.line(`${this.lock} A`);
    this.line('0 Xw');
    this.dir = -1;
    for (const ch of l.children) { this.object(ch, locked); if (ch.kind === 'layer') this.lock = -1; }
    this.line('LB');
    this.line('%AI5_EndLayer--');
  }

  symbolBlock(): string[] {
    const out: string[] = [];
    for (const s of this.doc.symbols) {
      out.push('%AI5_Begin_NonPrinting', 'Np');
      const sub = new Emit(this.doc, this.outlines, this.a0, this);
      sub.ox = s.reg.x; sub.oy = s.reg.y;
      sub.images.clear();
      for (const [k, v] of this.images) sub.images.set(k, v);
      sub.line('%AI14_BeginSymbol');
      sub.line(ps(s.name));
      sub.line('0 A');
      sub.line('0 Xw');
      sub.line('0 Ae');
      sub.line('u');
      sub.object(s.art, false);
      sub.line('U');
      sub.line('%AI10_EndSymbol');
      for (const [name, g] of sub.gradients) if (!this.gradients.has(name)) this.gradients.set(name, g);
      for (const [k, v] of sub.spots) this.spots.set(k, v);
      out.push(...sub.out, '%AI5_End_NonPrinting--');
    }
    return out;
  }

  gradientBlock(): string[] {
    const list = this.gradientList();
    if (!list.length) return [];
    const out = ['%AI5_Begin_NonPrinting', 'Np', `${list.length} Bn`];
    for (const [name, g] of list) {
      const stops = [...g.stops].sort((a, b) => a.offset - b.offset), cm = this.doc.colorMode === 'cmyk';
      const comps = stops.map((s) => { const k = cmykOf(s.color), v = toRgb(s.color); return [k.c, k.m, k.y, k.k, v.r / 255, v.g / 255, v.b / 255]; });
      out.push('%AI5_BeginGradient: ' + ps(name), `${ps(name)} ${g.kind === 'radial' ? 1 : 0} ${stops.length} Bd`, '[');
      for (let seg = 0; seg < stops.length - 1; seg++) {
        const a = comps[seg], b = comps[seg + 1];
        const ramp = g.blend === 'perceptual' ? Array.from({ length: 256 }, (_, i) => { const m = mixOklab(stops[seg].color, stops[seg + 1].color, i / 255), k = cmykOf(m), v = toRgb(m); return [k.c, k.m, k.y, k.k, v.r / 255, v.g / 255, v.b / 255]; }) : null;
        for (let ch = 0; ch < 7; ch++) {
          if (!ramp && Math.abs(a[ch] - b[ch]) < 1e-9) { out.push(cf(a[ch])); continue; }
          out.push('<');
          let hex = '';
          for (let i = 0; i < 256; i++) hex += Math.round(255 * (ramp ? ramp[i][ch] : a[ch] + ((b[ch] - a[ch]) * i) / 255)).toString(16).padStart(2, '0').toUpperCase();
          for (let i = 0; i < hex.length; i += 80) out.push(hex.slice(i, i + 80));
          out.push('>');
        }
        out.push('4 %_Br');
      }
      out.push('[');
      stops.forEach((s, i) => {
        const c = comps[i], head = (cm ? c.slice(0, 4) : c).map((v) => cf(v)).join(' '), tail = `${cm ? '1 1' : '2 1'} 6 ${nf(Math.max(0.1, Math.min(0.9, s.mid)) * 100, 1e4)} ${nf(s.offset * 100, 1e4)}`;
        out.push(`${head} ${tail} %_BS`, `%_${head} ${tail} Bs`);
      });
      out.push('BD', '%AI5_EndGradient');
    }
    out.push('%AI5_End_NonPrinting--');
    return out;
  }
}

function paletteLines(doc: Doc, e: Emit): string[] {
  const out = ['%AI5_BeginPalette', '0 0 Pb', '1 1 1 1 ([Registration]) 0 Xs', '([Registration])', 'Pc'];
  for (const s of doc.swatches) {
    if (s.paint.type !== 'color' || s.name === '[Registration]') continue;
    const c = s.paint.color;
    if (s.spot) {
      const k = cmykOf(c), lab = labOf(c);
      out.push(`${cf(k.c)} ${cf(k.m)} ${cf(k.y)} ${cf(k.k)} ${nf(lab[0], 1e6)} ${nf(lab[1], 1e6)} ${nf(lab[2], 1e6)} ${ps(s.name)} 0 2 Xx`, ps(s.name), 'Pc');
    } else {
      for (const l of e.solid(c, false)) out.push(l);
      out.push(ps(s.name), 'Pc');
    }
  }
  out.push('PB', '%AI5_EndPalette');
  return out;
}

const pluginGroups = [
  ['Adobe Line Plugin Group', 'Line artwork', 'IdeaFileFormat.aip'], ['Adobe Sketch Plugin Group', 'Sketch artwork', 'IdeaFileFormat.aip'], ['Adobe Vectorized Object', 'Image Tracing', 'Vectorize.aip'],
  ['Adobe Flare Plugin', 'Flare', 'Flare.aip'], ['Adobe Deform Plugin', 'Adobe Envelope Plugin', 'Deform.aip'], ['Adobe Planar Group', 'Adobe Live Paint Plugin', 'PlanetX.aip'],
  ['Adobe Perspective Plugin Group', 'Adobe Perspective Plugin Group', 'Perspective.aip'], ['Adobe Path Blends', 'Adobe Blends Plugin', 'LiveBlends.aip'],
  ['Adobe Calligraphic Brush Tool', 'Adobe Calligraphic Brush Plugin', 'CalligraphicBrushTool.aip'], ['Adobe Scatter Brush Tool', 'Adobe Scatter Brush Plugin', 'ScatterBrushTool.aip'],
  ['Adobe Scatter Brush Tool', 'Adobe Scatter Brush Plugin', 'ScatterBrushTool.aip'], ['Adobe PatternOnPath Brush Tool', 'Adobe Pattern Brush Plugin', 'ArtOnPathBrushTool.aip'],
  ['Adobe PatternOnPath Brush Tool', 'Adobe Pattern Brush Plugin', 'ArtOnPathBrushTool.aip'], ['Adobe ArtOnPath Brush Tool', 'Adobe Art Brush Plugin', 'ArtOnPathBrushTool.aip'],
  ['Adobe ArtOnPath Brush Tool', 'Adobe Art Brush Plugin', 'ArtOnPathBrushTool.aip'], ['Adobe Symbolism', 'Adobe Symbolism', 'ParticleSystem.aip'],
  ['Adobe Pattern Editor Plugin Group', 'Adobe Pattern Editor Plugin Group', 'SwatchLibs.aip'], ['Pathfinder Suite', 'Adobe Compound Shape', 'PathfinderS.aip'],
];

function thumbnail(t: NonNullable<AiPrivateInput['thumb']>): string[] {
  const pal: number[] = [];
  for (let i = 0; i < THUMB_PALETTE.length; i += 2) pal.push(parseInt(THUMB_PALETTE.slice(i, i + 2), 16));
  const idx = new Uint8Array(t.width * t.height), cache = new Map<number, number>();
  for (let i = 0; i < idx.length; i++) {
    const a = t.data[i * 4 + 3] / 255, r = Math.round(t.data[i * 4] * a + 255 * (1 - a)), g = Math.round(t.data[i * 4 + 1] * a + 255 * (1 - a)), b = Math.round(t.data[i * 4 + 2] * a + 255 * (1 - a)), key = (r << 16) | (g << 8) | b;
    let best = cache.get(key);
    if (best === undefined) {
      let bd = Infinity;
      best = 0;
      for (let k = 0; k < 256; k++) { const dr = pal[k * 3] - r, dg = pal[k * 3 + 1] - g, db = pal[k * 3 + 2] - b, dd = dr * dr + dg * dg + db * db; if (dd < bd) { bd = dd; best = k; } }
      cache.set(key, best);
    }
    idx[i] = best;
  }
  // run length coding: FD count value for a run, any other byte as it is; a literal FD travels as a run of one
  const rle: number[] = [];
  for (let i = 0; i < idx.length;) {
    let j = i + 1;
    while (j < idx.length && idx[j] === idx[i] && j - i < 252) j++;
    const run = j - i;
    if (run >= 4 || idx[i] === 0xfd) rle.push(0xfd, run, idx[i]); else for (let k = 0; k < run; k++) rle.push(idx[i]);
    i = j;
  }
  const hex = `524C45${rle.map((v) => v.toString(16).padStart(2, '0').toUpperCase()).join('')}`;
  const out = [`%AI7_Thumbnail: ${t.width} ${t.height} 8`, `%%BeginData: ${THUMB_PALETTE.length + hex.length + Math.ceil(THUMB_PALETTE.length / 60) + Math.ceil(hex.length / 60)} Hex Bytes`];
  for (let i = 0; i < THUMB_PALETTE.length; i += 60) out.push(`%${THUMB_PALETTE.slice(i, i + 60)}`);
  for (let i = 0; i < hex.length; i += 60) out.push(`%${hex.slice(i, i + 60)}`);
  out.push('%%EndData');
  return out;
}

const bytes = (s: string): Uint8Array => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff; return u; };

export async function buildAiPrivate(inp: AiPrivateInput): Promise<AiPrivate> {
  const { p, boards } = inp, doc = p.doc;
  const abs = (boards.length ? boards : doc.artboards.map((_, i) => i)).map((i) => doc.artboards[i]).filter((a): a is Artboard => !!a);
  const a0 = abs[0] ?? doc.artboards[0];
  const e = new Emit(doc, inp.outlines, a0);

  const maxPx = 2048;
  const scan = async (n: VNode): Promise<void> => {
    if (n.kind === 'image' && !e.imageList().has(n.src)) {
      const blob = p.assets.get(n.src);
      if (blob) {
        try {
          const bmp = await createImageBitmap(blob), k = Math.min(1, maxPx / Math.max(bmp.width, bmp.height)), size = { w: Math.max(1, Math.round(bmp.width * k)), h: Math.max(1, Math.round(bmp.height * k)) };
          const px = pixelsOf(bmp, size);
          let hex = '';
          const parts: string[] = [];
          for (let i = 0; i < px.width * px.height; i++) {
            const a = px.data[i * 4 + 3] / 255;
            for (let c = 0; c < 3; c++) hex += Math.round(px.data[i * 4 + c] * a + 255 * (1 - a)).toString(16).padStart(2, '0').toUpperCase();
            if (hex.length > 60000) { parts.push(hex); hex = ''; }
          }
          parts.push(hex);
          e.setImage(n.src, { w: px.width, h: px.height, hex: parts.join('') });
        } catch { /* image left out */ }
      }
    }
    for (const c of childrenOf(n) ?? []) await scan(c);
  };
  for (const l of doc.layers) await scan(l);
  for (const s of doc.symbols) await scan(s.art);

  const symbols = e.symbolBlock();
  const layerOut = new Emit(doc, inp.outlines, a0, e);
  for (const [k, v] of e.imageList()) layerOut.setImage(k, v);
  layerOut.stats.layers = 0;
  for (const l of doc.layers) layerOut.layer(l, false, false);
  const spotNames = new Map<string, Swatch>();
  for (const s of [...e.spotList(), ...layerOut.spotList()]) spotNames.set(s.name, s);

  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const l of doc.layers) { const r = visualBounds(doc, l); if (r.w > 0 || r.h > 0) { bx0 = Math.min(bx0, r.x); by0 = Math.min(by0, r.y); bx1 = Math.max(bx1, r.x + r.w); by1 = Math.max(by1, r.y + r.h); } }
  if (!Number.isFinite(bx0)) { bx0 = a0.x; by0 = a0.y; bx1 = a0.x + a0.w; by1 = a0.y + a0.h; }
  const fb = { x0: bx0 - a0.x, y0: a0.y - by1, x1: bx1 - a0.x, y1: a0.y - by0 };
  const now = new Date(), rgbDoc = doc.colorMode === 'rgb';
  const crop = [0, -a0.h, a0.w, 0];
  const hdr: string[] = [
    '%!PS-Adobe-3.0 ',
    '%%Creator: Adobe Illustrator(R) 17.0',
    '%%AI8_CreatorVersion: 21.0.0',
    '%%For: (formpth) ()',
    `%%Title: ${ps(inp.title)}`,
    `%%CreationDate: ${dateLine(now)}`,
    '%%Canvassize: 16383',
    `%%BoundingBox: ${Math.floor(fb.x0)} ${Math.floor(fb.y0)} ${Math.ceil(fb.x1)} ${Math.ceil(fb.y1)}`,
    `%%HiResBoundingBox: ${nf(fb.x0, 1e9)} ${nf(fb.y0, 1e9)} ${nf(fb.x1, 1e9)} ${nf(fb.y1, 1e9)}`,
    '%%DocumentProcessColors: Cyan Magenta Yellow Black',
  ];
  hdr.push('%AI5_FileFormat 13.0', '%AI12_BuildNumber: 326', '%AI3_ColorUsage: Color', '%AI7_ImageSettings: 0');
  const spots = [...spotNames.values()];
  if (spots.length) {
    hdr.push(`%%DocumentCustomColors: ${spots.map((s) => ps(s.name)).join(`${CR}%%+ `)}`);
    const cc = spots.map((s) => { const c = s.paint.type === 'color' ? s.paint.color : { kind: 'gray' as const, k: 50 }, v = toRgb(c); return `${cf(v.r / 255)} ${cf(v.g / 255)} ${cf(v.b / 255)} ${ps(s.name)}`; });
    hdr.push(`%%RGBCustomColor: ${cc.join(`${CR}%%+ `)}`);
  }
  hdr.push(rgbDoc ? '%%RGBProcessColor: 0 0 0 ([Registration])' : '%%CMYKProcessColor: 1 1 1 1 ([Registration])');
  const cx = a0.w / 2, cy = -a0.h / 2, tw = a0.w > a0.h ? 773.28 : 593.28, th = a0.w > a0.h ? 593.28 : 773.28;
  hdr.push(
    `%AI3_Cropmarks: ${crop.map((v) => nf(v)).join(' ')}`,
    `%AI3_TemplateBox: ${nf(cx - 0.5)} ${nf(cy - 0.5)} ${nf(cx - 0.5)} ${nf(cy - 0.5)}`,
    `%AI3_TileBox: ${[cx - tw / 2, cy - th / 2, cx + tw / 2, cy + th / 2].map((v) => nf(v)).join(' ')}`,
    '%AI3_DocumentPreview: None',
    '%AI5_ArtSize: 14400 14400',
    `%AI5_RulerUnits: ${RULER_UNITS[doc.units] ?? 2}`,
    `%AI9_ColorModel: ${rgbDoc ? 1 : 2}`,
    '%AI5_ArtFlags: 0 0 0 1 0 0 1 0 0',
    '%AI5_TargetResolution: 800',
    `%AI5_NumLayers: ${doc.layers.length}`,
    `%AI9_OpenToView: ${nf(cx - 644)} ${nf(-cy + 388)} 1 1288 777 26 0 0 21 78 0 0 0 1 1 0 1 1 0 1`,
    '%AI5_OpenViewLayers: 7',
    `%%PageOrigin:${nf(-Math.round(a0.w / 2) - 276)} ${nf(Math.round(a0.h / 2) - 330)}`,
    '%AI7_GridSettings: 72 8 72 8 1 0 0.800000011920929 0.800000011920929 0.800000011920929 0.899999976158142 0.899999976158142 0.899999976158142',
    '%AI9_Flatten: 1',
    '%AI12_CMSettings: 00.MS',
    '%%EndComments',
  );

  const body: string[] = [...hdr, '%%BeginProlog', '%%EndProlog', '%%BeginSetup'];
  body.push('%AI5_Begin_NonPrinting', 'Np');
  for (const g of pluginGroups) body.push('%AI8_PluginGroupInfo', `(${g[0]}) (${g[1]}) (${g[2]})`);
  body.push('%AI5_End_NonPrinting--');
  body.push(...e.gradientBlock());
  body.push(...symbols);
  body.push('%AI5_Begin_NonPrinting', 'Np', '%AI9_BeginArtStyles', '/KnownStyle :', '([Default]) /Name ,', '/SimpleStyle :', '0 O', '0 0 0 0 1 1 1 Xa', '0 R', '0.749721467494965 0.679194271564484 0.670496642589569 0.901457190513611 0 0 0 XA', '0 1 0 0 0 Xy', '0 J 0 j 1 w 10 M []0 d', '0 XR', '1 1 Xd', '/Paint ;', ' /Def ;', '%AI9_EndArtStyles', '%AI5_End_NonPrinting--');
  body.push(...paletteLines(doc, e));
  body.push('%AI5_Begin_NonPrinting', 'Np', '%AI9_BeginArtStyleList', '([Default])', '%AI9_EndArtStyleList', '%AI5_End_NonPrinting--');
  body.push('%AI5_Begin_NonPrinting', 'Np', '%AI10_BeginSymbolList ', ...doc.symbols.map((s) => ps(s.name)), '%AI10_EndSymbolList ', '%AI5_End_NonPrinting--');
  body.push('%AI9_BeginDocumentData', '%_/Document :', '%_/Dictionary :');
  body.push('%_0 /Int (AI9 Flattening Quality Level) ,', `%_${doc.colorMode === 'rgb' ? 1 : 0} /Int (AI11 Document Setup Color Mode) ,`, '%_/Array :');
  const base = { x: 7200 - Math.round(a0.w / 2), y: 7200 + Math.round(a0.h / 2) };
  for (const a of abs) {
    const x0 = a.x - a0.x, y0 = a0.y - a.y;
    body.push('%_/Dictionary :', `%_${ps(a.name)} /UnicodeString (Name) ,`, `%_${nf(x0)} ${nf(y0)} /RealPointRelToROrigin`, '%_ (PositionPoint1) ,', `%_${nf(base.x + x0)} ${nf(base.y + y0)} /RealPoint`, '%_ (RulerOrigin) ,', '%_0 /Int (DisplayMark) ,', `%_${nf(x0 + a.w)} ${nf(y0 - a.h)} /RealPointRelToROrigin`, '%_ (PositionPoint2) ,', '%_1 /Real (PAR) ,', `%_${/^Artboard \d+$/.test(a.name) ? 1 : 0} /Bool (IsArtboardDefaultName) ,`, '%_; ,');
  }
  body.push('%_; (ArtboardArray) ,', '%_;', '%_;', '%AI9_EndDocumentData', '%%EndSetup');
  body.push(...layerOut.out, '%%PageTrailer', 'gsave annotatepage grestore showpage', '%%Trailer', '%%EOF');

  const text = body.join(CR) + CR;
  const metaEnd = text.indexOf('%%EndComments') + '%%EndComments'.length;
  const meta = bytes(text.slice(0, metaEnd) + CR);
  const pre = [`%%BoundingBox: ${Math.floor(fb.x0)} ${Math.floor(fb.y0)} ${Math.ceil(fb.x1)} ${Math.ceil(fb.y1)}`, `%%HiResBoundingBox: ${nf(fb.x0, 1e9)} ${nf(fb.y0, 1e9)} ${nf(fb.x1, 1e9)} ${nf(fb.y1, 1e9)}`, ...(inp.thumb ? thumbnail(inp.thumb) : [])];
  const first = bytes(pre.join(CR) + CR);
  const z = await inp.deflate(new TextEncoder().encode(text));
  const tail = new Uint8Array(20 + z.length);
  tail.set(bytes('%AI12_CompressedData'), 0);
  tail.set(z, 20);
  const blocks: Uint8Array[] = [first];
  for (let i = 0; i < tail.length; i += BLOCK) blocks.push(tail.subarray(i, Math.min(tail.length, i + BLOCK)));
  const stats = layerOut.stats;
  for (const [k, v] of e.stats.omitted) stats.omitted.set(k, (stats.omitted.get(k) ?? 0) + v);
  return { meta, blocks, creator: 21, stats };
}

export function aiThumbSize(w: number, h: number): { width: number; height: number } {
  const s = 128 / Math.max(w, h);
  return { width: Math.max(1, Math.ceil(w * s)), height: Math.max(1, Math.ceil(h * s)) };
}

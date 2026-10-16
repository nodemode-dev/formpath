import { effectDefaults } from '../engine/effects';
import { hex, parseColor } from '../engine/paint';
import type { Effect } from '../engine';

type Ex =
  | { t: 'src' } | { t: 'alpha' } | { t: 'bad' }
  | { t: 'blur'; a: Ex; sx: number; sy: number }
  | { t: 'off'; a: Ex; dx: number; dy: number }
  | { t: 'flood'; color: string; op: number }
  | { t: 'comp'; a: Ex; b: Ex; op: string }
  | { t: 'merge'; list: Ex[] }
  | { t: 'inva'; a: Ex }
  | { t: 'shadow'; a: Ex; dx: number; dy: number; sd: number; color: string; op: number };

export interface FilterScale { k: number; lin: [number, number, number, number] }

const local = (e: Element): string => e.nodeName.toLowerCase().replace(/^.*:/, '');
const hrefOf = (e: Element): string => (e.getAttribute('href') ?? e.getAttribute('xlink:href') ?? '').replace(/^#/, '');

function prop(e: Element, name: string): string | null {
  const st = e.getAttribute('style');
  if (st) for (const part of st.split(';')) { const i = part.indexOf(':'); if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim(); }
  return e.getAttribute(name);
}

const nums = (v: string | null, d: number): number[] => {
  const a = (v ?? '').trim().split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isFinite);
  return a.length ? a : [d];
};

function flood(e: Element): { color: string; op: number } {
  const raw = prop(e, 'flood-color') ?? '#000000';
  const c = parseColor(raw === 'currentColor' ? '#000' : raw);
  const o = parseFloat(prop(e, 'flood-opacity') ?? '1');
  return { color: c ? hex(c) : '#000000', op: Number.isFinite(o) ? Math.max(0, Math.min(1, o)) : 1 };
}

export function filterChain(first: Element | undefined, ids: Map<string, Element>): Element[] {
  const chain: Element[] = [];
  let cur: Element | undefined = first;
  while (cur && local(cur) === 'filter' && !chain.includes(cur)) {
    chain.push(cur);
    const h = hrefOf(cur);
    cur = h ? ids.get(h) : undefined;
  }
  return chain;
}

function buildExpr(chain: Element[]): Ex | null {
  const holder = chain.find((c) => Array.from(c.children).some((k) => local(k).startsWith('fe')));
  if (!holder) return null;
  if ((chain.map((c) => c.getAttribute('primitiveUnits')).find((v) => v !== null) ?? 'userSpaceOnUse') === 'objectBoundingBox') return null;
  const src: Ex = { t: 'src' }, alpha: Ex = { t: 'alpha' }, bad: Ex = { t: 'bad' };
  const named = new Map<string, Ex>();
  let prev: Ex = src;
  for (const p of Array.from(holder.children)) {
    const tag = local(p);
    if (!tag.startsWith('fe')) continue;
    const pick = (k: string): Ex => {
      const v = p.getAttribute(k);
      if (v === null || v === '') return prev;
      if (v === 'SourceGraphic') return src;
      if (v === 'SourceAlpha') return alpha;
      return named.get(v) ?? (/^(BackgroundImage|BackgroundAlpha|FillPaint|StrokePaint)$/.test(v) ? bad : prev);
    };
    let out: Ex = bad;
    if (tag === 'fegaussianblur') {
      const sd = nums(p.getAttribute('stdDeviation'), 0);
      out = { t: 'blur', a: pick('in'), sx: sd[0], sy: sd[1] ?? sd[0] };
    } else if (tag === 'feoffset') out = { t: 'off', a: pick('in'), dx: parseFloat(p.getAttribute('dx') ?? '0') || 0, dy: parseFloat(p.getAttribute('dy') ?? '0') || 0 };
    else if (tag === 'feflood') { const f = flood(p); out = { t: 'flood', color: f.color, op: f.op }; }
    else if (tag === 'fecomposite') out = { t: 'comp', a: pick('in'), b: pick('in2'), op: p.getAttribute('operator') ?? 'over' };
    else if (tag === 'femerge') out = { t: 'merge', list: Array.from(p.children).filter((c) => local(c) === 'femergenode').map((c) => { const v = c.getAttribute('in'); return v === null ? prev : v === 'SourceGraphic' ? src : v === 'SourceAlpha' ? alpha : named.get(v) ?? bad; }) };
    else if (tag === 'fedropshadow') {
      const sd = nums(p.getAttribute('stdDeviation'), 2), f = flood(p);
      out = sd[0] === (sd[1] ?? sd[0]) ? { t: 'shadow', a: pick('in'), dx: parseFloat(p.getAttribute('dx') ?? '2') || 0, dy: parseFloat(p.getAttribute('dy') ?? '2') || 0, sd: sd[0], color: f.color, op: f.op } : bad;
    } else if (tag === 'fecomponenttransfer') {
      const fa = Array.from(p.children).find((c) => local(c) === 'fefunca'), others = Array.from(p.children).filter((c) => c !== fa && (c.getAttribute('type') ?? 'identity') !== 'identity');
      out = fa && !others.length && fa.getAttribute('type') === 'table' && nums(fa.getAttribute('tableValues'), 0).join(' ') === '1 0' ? { t: 'inva', a: pick('in') } : bad;
    }
    const res = p.getAttribute('result');
    if (res) named.set(res, out);
    prev = out;
  }
  return prev;
}

function shadowOf(s: Ex, x: Ex): { dx: number; dy: number; sd: number; color: string; op: number } | null {
  let cur = s, dx = 0, dy = 0, sd = -1, color: string | null = null, op = 1;
  for (let guard = 0; guard < 8; guard++) {
    if (cur === x || (cur.t === 'alpha' && x.t === 'src')) {
      if (cur.t === 'alpha' && color === null) { color = '#000000'; op = 1; }
      return color === null ? null : { dx, dy, sd: Math.max(sd, 0), color, op };
    }
    if (cur.t === 'off') { dx += cur.dx; dy += cur.dy; cur = cur.a; continue; }
    if (cur.t === 'blur') { if (sd >= 0 || cur.sx !== cur.sy) return null; sd = cur.sx; cur = cur.a; continue; }
    if (cur.t === 'comp' && cur.op === 'in' && cur.a.t === 'flood') { if (color !== null) return null; color = cur.a.color; op = cur.a.op; cur = cur.b; continue; }
    return null;
  }
  return null;
}

interface Stage { id: string; at: Record<string, number | string>; input: Ex }

function stageOf(ex: Ex, sc: FilterScale): Stage | null {
  const shadow = (a: Ex, s: { dx: number; dy: number; sd: number; color: string; op: number }): Stage => (s.dx === 0 && s.dy === 0
    ? { id: 'stylize.outer_glow', input: a, at: { mode: 'normal', opacity: Math.round(s.op * 10000) / 100, blur: s.sd * sc.k, color: s.color } }
    : {
      id: 'stylize.drop_shadow', input: a,
      at: { mode: 'normal', opacity: Math.round(s.op * 10000) / 100, x: sc.lin[0] * s.dx + sc.lin[2] * s.dy, y: sc.lin[1] * s.dx + sc.lin[3] * s.dy, blur: s.sd * sc.k, color: s.color },
    });
  if (ex.t === 'shadow') return shadow(ex.a, ex);
  if (ex.t === 'merge' && ex.list.length === 2) {
    const [a, b] = ex.list, sh = shadowOf(a, b);
    if (sh) return shadow(b, sh);
    if (b.t === 'comp' && b.op === 'in' && b.b === a && b.a.t === 'comp' && b.a.op === 'in' && b.a.a.t === 'flood' && b.a.b.t === 'blur' && b.a.b.sx === b.a.b.sy && b.a.b.a.t === 'inva' && b.a.b.a.a === a) {
      return { id: 'stylize.inner_glow', input: a, at: { mode: 'normal', opacity: Math.round(b.a.a.op * 10000) / 100, blur: b.a.b.sx * sc.k, color: b.a.a.color } };
    }
  }
  if (ex.t === 'comp' && ex.op === 'over') { const sh = shadowOf(ex.b, ex.a); if (sh) return shadow(ex.a, sh); }
  if (ex.t === 'comp' && ex.op === 'in' && ex.b.t === 'blur' && ex.b.a === ex.a && ex.b.sx === ex.b.sy) return { id: 'stylize.feather', input: ex.a, at: { radius: ex.b.sx * sc.k } };
  if (ex.t === 'blur' && ex.sx === ex.sy) return { id: 'blur.gaussian', input: ex.a, at: { radius: ex.sx * sc.k } };
  return null;
}

export function filterPrimitives(chain: Element[]): string[] {
  const holder = chain.find((c) => Array.from(c.children).some((k) => local(k).startsWith('fe')));
  const names = new Set<string>();
  for (const p of Array.from(holder?.children ?? [])) if (local(p).startsWith('fe')) names.add(p.nodeName.replace(/^.*:/, ''));
  return [...names];
}

export function filterEffects(chain: Element[], sc: FilterScale): Effect[] | null {
  const ex = buildExpr(chain);
  if (!ex) return null;
  const stages: Stage[] = [];
  let cur: Ex = ex;
  for (let guard = 0; guard < 12 && cur.t !== 'src'; guard++) {
    const s = stageOf(cur, sc);
    if (!s) return null;
    stages.unshift(s);
    cur = s.input;
  }
  if (cur.t !== 'src' || !stages.length) return null;
  return stages.map((s) => ({ id: s.id, params: { ...effectDefaults(s.id), ...s.at }, visible: true }));
}

export function cssFilterEffects(v: string, sc: FilterScale): Effect[] | null {
  const out: Effect[] = [];
  const re = /(blur|drop-shadow)\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g;
  let rest = v, m: RegExpExecArray | null;
  while ((m = re.exec(v))) {
    rest = rest.replace(m[0], '');
    const px = (s: string): number => parseFloat(s) || 0;
    if (m[1] === 'blur') out.push({ id: 'blur.gaussian', params: { ...effectDefaults('blur.gaussian'), radius: px(m[2]) * sc.k }, visible: true });
    else {
      const cm = /(rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\s*$/.exec(m[2]) ?? /^(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})/.exec(m[2]);
      const lens = m[2].replace(cm?.[0] ?? '', '').trim().split(/\s+/).map(px);
      const col = cm ? parseColor(cm[0]) : null;
      const dx = lens[0] ?? 0, dy = lens[1] ?? 0;
      out.push({ id: 'stylize.drop_shadow', params: { ...effectDefaults('stylize.drop_shadow'), mode: 'normal', opacity: 100, x: sc.lin[0] * dx + sc.lin[2] * dy, y: sc.lin[1] * dx + sc.lin[3] * dy, blur: ((lens[2] ?? 0) / 2) * sc.k, color: col ? hex(col) : '#000000' }, visible: true });
    }
  }
  return out.length && !rest.replace(/\s+/g, '') ? out : null;
}

import type { HyphenOptions, Justification } from './types';

export const DEFAULT_HYPH: HyphenOptions = { minWord: 6, after: 2, before: 2, limit: 2, zone: 0, caps: true };
export const DEFAULT_JUST: Justification = { wordMin: 80, wordDes: 100, wordMax: 133, letterMin: 0, letterDes: 0, letterMax: 0, glyphMin: 100, glyphDes: 100, glyphMax: 100, single: 'justify' };

const VOWEL = /[aeiouy]/;
const TEAMS = new Set(['ai', 'ay', 'au', 'aw', 'ea', 'ee', 'ei', 'eu', 'ey', 'ie', 'oa', 'oe', 'oi', 'oo', 'ou', 'ow', 'oy', 'ue', 'ui', 'uy']);
const UNITS = ['tch', 'ch', 'sh', 'th', 'ph', 'wh', 'gh', 'ck', 'qu'];
const ONSETS = new Set(['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'tr', 'tw', 'dw', 'thr', 'chr', 'shr', 'phr']);
const SUFFIXES = ['tion', 'sion', 'cian', 'tial', 'cial', 'ture', 'ment', 'ness', 'less', 'ship', 'ful', 'ing', 'able', 'ible'];
const PREFIXES = ['under', 'inter', 'trans', 'super', 'over', 'anti', 'non', 'dis', 'mis', 'un'];

interface Unit { s: string; at: number; vowel: boolean }

function units(w: string): Unit[] {
  const out: Unit[] = [];
  for (let i = 0; i < w.length;) {
    const c = w[i];
    const v = c === 'y' ? i > 0 && !VOWEL.test(w[i - 1]) : VOWEL.test(c);
    if (v) {
      const pair = w.slice(i, i + 2);
      if (pair.length === 2 && TEAMS.has(pair) && !(pair[1] === 'y' && i + 2 < w.length && VOWEL.test(w[i + 2]))) { out.push({ s: pair, at: i, vowel: true }); i += 2; continue; }
      out.push({ s: c, at: i, vowel: true }); i++; continue;
    }
    const u = UNITS.find((x) => w.startsWith(x, i));
    if (u) { out.push({ s: u, at: i, vowel: false }); i += u.length; continue; }
    out.push({ s: c, at: i, vowel: false }); i++;
  }
  return out;
}

function silentTail(w: string, us: Unit[]): Unit[] {
  const last = us[us.length - 1], prev = us[us.length - 2];
  if (!last || !prev) return us;
  if (last.s === 'e' && !prev.vowel && us.filter((u) => u.vowel).length > 1) {
    if (prev.s === 'l' && us[us.length - 3] && !us[us.length - 3].vowel) return us;
    return us.map((u, i) => (i === us.length - 1 ? { ...u, vowel: false } : u));
  }
  if (us.length >= 3 && (last.s === 'd' || last.s === 's') && prev.s === 'e') {
    const before = us[us.length - 3];
    const keep = last.s === 'd' ? before.s === 't' || before.s === 'd' : /^(s|x|z|ch|sh)$/.test(before.s) || (/^[cg]$/.test(before.s));
    if (!keep && !before.vowel && us.filter((u) => u.vowel).length > 1) return us.map((u, i) => (i === us.length - 2 ? { ...u, vowel: false } : u));
  }
  return us;
}

function syllableBreaks(w: string): number[] {
  const us = silentTail(w, units(w)), out: number[] = [];
  const nuclei = us.map((u, i) => (u.vowel ? i : -1)).filter((i) => i >= 0);
  for (let k = 0; k + 1 < nuclei.length; k++) {
    const a = nuclei[k], b = nuclei[k + 1], cl = us.slice(a + 1, b);
    if (!cl.length) {
      const v = us[a], before = us[a - 1]?.s ?? '';
      if (v.s.length < 2 && !(v.s === 'u' && /^(g|q)$/.test(before)) && !(v.s === 'i' && /^(t|c|s|g|x)$/.test(before))) out.push(us[b].at);
      continue;
    }
    if (cl.length === 1) {
      const c = cl[0];
      if (c.s === 'x' || c.s === 'ck') out.push(us[b].at);
      else out.push(c.at);
      continue;
    }
    let cut = -1;
    for (let j = 1; j < cl.length && cut < 0; j++) if (cl[j - 1].s === cl[j].s) cut = j;
    for (let j = 0; j < cl.length && cut < 0; j++) if (ONSETS.has(cl.slice(j).map((u) => u.s).join(''))) cut = j;
    if (cut < 0) cut = cl.length - 1;
    if (b === us.length - 1 && us[b].s === 'e' && cl[cl.length - 1].s === 'l') cut = Math.max(0, cl.length - 2);
    out.push(cl[cut].at);
  }
  return out;
}

export function hyphenPoints(word: string): number[] {
  const w = word.toLowerCase();
  if (w.length < 4 || !/^[a-z]+$/.test(w)) return [];
  const forced = new Set<number>(), blocked: Array<[number, number]> = [];
  let lo = 0, hi = w.length;
  for (const p of PREFIXES) if (w.startsWith(p) && w.length - p.length >= 4 && VOWEL.test(w.slice(p.length))) { forced.add(p.length); lo = p.length; break; }
  for (const s of SUFFIXES) if (w.endsWith(s) && w.length - s.length >= 3 && VOWEL.test(w.slice(0, -s.length))) { const at = s === 'ing' && w[w.length - 4] === w[w.length - 5] ? w.length - 4 : w.length - s.length; forced.add(at); blocked.push([at, w.length]); hi = at; break; }
  const core = w.slice(lo, hi), pts = new Set<number>(forced);
  for (const b of syllableBreaks(core)) pts.add(b + lo);
  for (const [a, z] of blocked) for (const p of [...pts]) if (p > a && p < z) pts.delete(p);
  return [...pts].filter((p) => p > 0 && p < w.length).sort((a, b) => a - b);
}

export function allowedBreaks(word: string, o: HyphenOptions): number[] {
  if (word.length < Math.max(2, o.minWord)) return [];
  if (!o.caps && /^\p{Lu}/u.test(word)) return [];
  return hyphenPoints(word).filter((p) => p >= Math.max(1, o.after) && word.length - p >= Math.max(1, o.before));
}

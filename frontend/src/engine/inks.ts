import { toCmyk } from './paint';
import type { Color, Doc, InkSettings, Paint, Swatch } from './types';

export const PROCESS_INKS = [['C', 'Cyan'], ['M', 'Magenta'], ['Y', 'Yellow'], ['K', 'Black']] as const;
export type ProcessInk = 'C' | 'M' | 'Y' | 'K';
export interface Plate { key: string; label: string; value: string; spot: boolean; swatch?: Swatch }
export interface InkRow { name: string; label: string; spot: boolean; print: boolean; process: boolean; alias: string | null; aliasOptions: string[]; plate: boolean }
export type InkTarget = { kind: 'process' } | { kind: 'spot'; name: string; swatch: Swatch };

export const isRegistration = (sw: Swatch | undefined): boolean => sw?.name === '[Registration]';

export function spotSwatches(doc: Doc): Swatch[] {
  const seen = new Set<string>(), out: Swatch[] = [];
  for (const s of doc.swatches) if (s.spot && s.paint.type === 'color' && !seen.has(s.name)) { seen.add(s.name); out.push(s); }
  return out;
}

export const swatchOf = (doc: Doc, raw: Paint): Swatch | undefined => (raw.type === 'color' && raw.swatch ? doc.swatches.find((s) => s.id === raw.swatch) : undefined);

function aliasEnd(doc: Doc, name: string, spots: Swatch[]): string {
  const alias = doc.inks?.alias;
  if (!alias) return name;
  const seen = new Set<string>();
  let n = name;
  while (alias[n] && !seen.has(n) && spots.some((s) => s.name === alias[n])) { seen.add(n); n = alias[n]; }
  return n;
}

export function inkTarget(doc: Doc, sw: Swatch): InkTarget {
  const spots = spotSwatches(doc), end = aliasEnd(doc, sw.name, spots), ink = doc.inks;
  const hit = spots.find((s) => s.name === end);
  if (!hit || ink?.allSpotsToProcess || ink?.process?.includes(end) || ink?.process?.includes(sw.name)) return { kind: 'process' };
  return { kind: 'spot', name: end, swatch: hit };
}

export function spotAsProcess(sw: Swatch, tint: number): { c: number; m: number; y: number; k: number } {
  const col: Color = sw.paint.type === 'color' ? sw.paint.color : { kind: 'gray', k: 100 };
  const k = toCmyk(col);
  const t = Math.max(0, Math.min(100, tint)) / 100;
  return k.kind === 'cmyk' ? { c: k.c * t, m: k.m * t, y: k.y * t, k: k.k * t } : { c: 0, m: 0, y: 0, k: 100 * t };
}

export function inkOn(doc: Doc, name: string): boolean { return !doc.inks?.off?.includes(name); }

export function platesOf(doc: Doc, forPrint = false): Plate[] {
  const out: Plate[] = PROCESS_INKS.filter(([v]) => !forPrint || inkOn(doc, v)).map(([v, label]) => ({ key: v, label, value: v, spot: false }));
  const seen = new Set<string>();
  for (const s of spotSwatches(doc)) {
    const t = inkTarget(doc, s);
    if (t.kind !== 'spot' || seen.has(t.name)) continue;
    seen.add(t.name);
    if (forPrint && !inkOn(doc, t.name)) continue;
    out.push({ key: `spot:${t.swatch.id}`, label: t.name, value: t.name, spot: true, swatch: t.swatch });
  }
  return out;
}

export function inkRows(doc: Doc): InkRow[] {
  const spots = spotSwatches(doc), ink = doc.inks;
  const rows: InkRow[] = PROCESS_INKS.map(([v, label]) => ({ name: v, label, spot: false, print: inkOn(doc, v), process: false, alias: null, aliasOptions: [], plate: true }));
  for (const s of spots) {
    const t = inkTarget(doc, s), alias = ink?.alias?.[s.name] && spots.some((x) => x.name === ink.alias?.[s.name]) ? ink.alias[s.name] : null;
    rows.push({ name: s.name, label: s.name, spot: true, print: inkOn(doc, s.name), process: !!ink?.allSpotsToProcess || !!ink?.process?.includes(s.name), alias, aliasOptions: spots.filter((x) => x.name !== s.name).map((x) => x.name), plate: t.kind === 'spot' && t.name === s.name });
  }
  return rows;
}

export function inksEqual(a: InkSettings | undefined, b: InkSettings | undefined): boolean { return JSON.stringify(a ?? null) === JSON.stringify(b ?? null); }

export function withInks(doc: Doc, patch: Partial<InkSettings>): Doc {
  const next: InkSettings = { ...(doc.inks ?? {}), ...patch };
  if (!next.off?.length) delete next.off;
  if (!next.process?.length) delete next.process;
  if (!next.alias || !Object.keys(next.alias).length) delete next.alias;
  if (!next.allSpotsToProcess) delete next.allSpotsToProcess;
  const rest = { ...doc };
  if (Object.keys(next).length) rest.inks = next; else delete rest.inks;
  return rest;
}

export function setInkPrint(doc: Doc, name: string, on: boolean): Doc {
  const off = new Set(doc.inks?.off ?? []);
  if (on) off.delete(name); else off.add(name);
  return withInks(doc, { off: [...off] });
}

export function setInkProcess(doc: Doc, name: string, on: boolean): Doc {
  const set = new Set(doc.inks?.process ?? []);
  if (on) set.add(name); else set.delete(name);
  return withInks(doc, { process: [...set] });
}

export function setInkAlias(doc: Doc, name: string, target: string | null): Doc {
  const alias = { ...(doc.inks?.alias ?? {}) };
  if (!target || target === name) delete alias[name]; else alias[name] = target;
  return withInks(doc, { alias });
}

export function processValue(c: Color, ink: ProcessInk): number {
  const k = toCmyk(c);
  return k.kind === 'cmyk' ? (ink === 'C' ? k.c : ink === 'M' ? k.m : ink === 'Y' ? k.y : k.k) : 0;
}

export function plateValue(doc: Doc, raw: Paint, c: Color, ink: string): number {
  const sw = swatchOf(doc, raw);
  if (isRegistration(sw)) return 100;
  const tint = raw.type === 'color' ? raw.tint ?? 100 : 100;
  const process = ink === 'C' || ink === 'M' || ink === 'Y' || ink === 'K';
  if (sw?.spot) {
    const t = inkTarget(doc, sw);
    if (t.kind === 'process') return process ? spotAsProcess(sw, tint)[ink.toLowerCase() as 'c' | 'm' | 'y' | 'k'] : 0;
    return !process && t.name === ink ? Math.max(0, Math.min(100, tint)) : 0;
  }
  return process ? processValue(c, ink as ProcessInk) : 0;
}

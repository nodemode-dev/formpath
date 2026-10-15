import { DEFAULT_MARKS, type PdfMarks } from './pdf-marks';

export type PaperId = 'letter' | 'a4' | 'a3' | 'tabloid' | 'custom';
export const PAPERS: ReadonlyArray<readonly [Exclude<PaperId, 'custom'>, string, number, number]> = [
  ['letter', 'Letter (8.5 x 11 in)', 612, 792],
  ['a4', 'A4 (210 x 297 mm)', 595.276, 841.89],
  ['a3', 'A3 (297 x 420 mm)', 841.89, 1190.551],
  ['tabloid', 'Tabloid (11 x 17 in)', 792, 1224],
];
export const MAX_SHEETS = 64;

export interface PrintSettings {
  copies: number;
  collate: boolean;
  range: number[];
  media: PaperId;
  custom: { w: number; h: number };
  orientation: 'auto' | 'portrait' | 'landscape';
  scaling: 'fit' | 'percent' | 'tile';
  percent: number;
  overlap: number;
  placement: 'center' | 'topleft';
  marks: PdfMarks;
  output: 'composite' | 'separations';
  plateDpi: number;
  colors: 'formpth' | 'printer';
  profile: string;
  intent: 0 | 1 | 2 | 3;
}

export const DEFAULT_PRINT: PrintSettings = {
  copies: 1, collate: true, range: [0], media: 'letter', custom: { w: 612, h: 792 }, orientation: 'auto', scaling: 'fit', percent: 100, overlap: 18, placement: 'center',
  marks: { ...DEFAULT_MARKS }, output: 'composite', plateDpi: 300, colors: 'printer', profile: '', intent: 1,
};

export interface Sheet { w: number; h: number }
export interface Tile { k: number; tx: number; ty: number; col: number; row: number }

const clampNum = (v: number, lo: number, hi: number, d: number): number => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

export function paperSize(s: PrintSettings): Sheet {
  if (s.media === 'custom') return { w: clampNum(s.custom.w, 36, 14400, 612), h: clampNum(s.custom.h, 36, 14400, 792) };
  const hit = PAPERS.find((p) => p[0] === s.media) ?? PAPERS[0];
  return { w: hit[2], h: hit[3] };
}

export function sheetFor(s: PrintSettings, w: number, h: number): Sheet {
  const p = paperSize(s), lo = Math.min(p.w, p.h), hi = Math.max(p.w, p.h);
  const landscape = s.orientation === 'landscape' || (s.orientation === 'auto' && w > h);
  return landscape ? { w: hi, h: lo } : { w: lo, h: hi };
}

export function scaleFor(s: PrintSettings, sheet: Sheet, w: number, h: number): number {
  if (s.scaling === 'fit') return Math.min(sheet.w / Math.max(1, w), sheet.h / Math.max(1, h));
  return clampNum(s.percent, 1, 1000, 100) / 100;
}

export function tilesFor(s: PrintSettings, sheet: Sheet, w: number, h: number): Tile[] {
  const k = scaleFor(s, sheet, w, h), cw = w * k, ch = h * k;
  const ax = s.placement === 'center' ? (sheet.w - cw) / 2 : 0, ay = s.placement === 'center' ? (sheet.h - ch) / 2 : sheet.h - ch;
  if (s.scaling !== 'tile' || (cw <= sheet.w + 1e-6 && ch <= sheet.h + 1e-6)) return [{ k, tx: ax, ty: ay, col: 0, row: 0 }];
  const ov = clampNum(s.overlap, 0, Math.min(sheet.w, sheet.h) / 2, 0), sx = sheet.w - ov, sy = sheet.h - ov;
  const cols = cw <= sheet.w + 1e-6 ? 1 : 1 + Math.ceil((cw - sheet.w) / sx - 1e-9), rows = ch <= sheet.h + 1e-6 ? 1 : 1 + Math.ceil((ch - sheet.h) / sy - 1e-9);
  const out: Tile[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ k, tx: cols > 1 ? -c * sx : ax, ty: rows > 1 ? sheet.h - ch + r * sy : ay, col: c, row: r });
  return out;
}

export function sheetCount(s: PrintSettings, w: number, h: number): number {
  return tilesFor(s, sheetFor(s, w, h), w, h).length;
}

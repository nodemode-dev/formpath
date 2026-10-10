import type { Engine, Units } from '../engine';
import { History } from '../engine/history';

export type CheckerSize = 'small' | 'medium' | 'large';
export type CheckerColors = 'light' | 'medium' | 'dark';

export interface Prefs {
  shortcuts: Record<string, string[]>;
  restoreSession: boolean;
  agentsAllowed: boolean;
  nodemodeUrl: string;
  historyStates: number;
  recoverySeconds: number;
  autoShowHome: boolean;
  zoomWheel: boolean;
  keyIncrement: number;
  snapTolerance: number;
  units: Units;
  scaleStrokes: boolean;
  previewBounds: boolean;
  gridInBack: boolean;
  gridSpacing: number;
  gridSubdivisions: number;
  guideColor: string;
  gridColor: string;
  checkerSize: CheckerSize;
  checkerColors: CheckerColors;
  narrowCollapse: boolean;
  newMaskClip: boolean;
  newMaskInvert: boolean;
}

export const UNIT_CHOICES: ReadonlyArray<readonly [Units, string]> = [['pt', 'Points'], ['px', 'Pixels'], ['in', 'Inches'], ['mm', 'Millimeters'], ['cm', 'Centimeters'], ['pc', 'Picas']];
export const CHECKER_SIZES: ReadonlyArray<readonly [CheckerSize, string]> = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']];
export const CHECKER_COLORS: ReadonlyArray<readonly [CheckerColors, string]> = [['light', 'Light'], ['medium', 'Medium'], ['dark', 'Dark']];
export const CHECKER_CELL: Record<CheckerSize, number> = { small: 4, medium: 8, large: 16 };
export const CHECKER_PAIR: Record<CheckerColors, readonly [string, string]> = { light: ['#ffffff', '#cccccc'], medium: ['#cccccc', '#999999'], dark: ['#666666', '#999999'] };
export const RECOVERY_CHOICES: ReadonlyArray<readonly [string, string]> = [['10', '10 seconds'], ['20', '20 seconds'], ['60', '1 minute'], ['300', '5 minutes']];

export const DEFAULT_PREFS: Prefs = {
  shortcuts: {}, restoreSession: true, agentsAllowed: false, nodemodeUrl: 'http://localhost:8000', historyStates: 200, recoverySeconds: 20, autoShowHome: true,
  zoomWheel: false, keyIncrement: 1, snapTolerance: 4, units: 'pt', scaleStrokes: true, previewBounds: false, gridInBack: true, gridSpacing: 72, gridSubdivisions: 8,
  guideColor: '', gridColor: '', checkerSize: 'medium', checkerColors: 'light', narrowCollapse: true, newMaskClip: true, newMaskInvert: false,
};

const KEY = 'formpth.prefs';
const num = (v: unknown, lo: number, hi: number, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const color = (v: unknown): string => (typeof v === 'string' && /^(#[0-9a-f]{6})?$/i.test(v) ? v : '');

export function loadPrefs(): Prefs {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<keyof Prefs, unknown>>;
    return {
      shortcuts: r.shortcuts && typeof r.shortcuts === 'object' ? Object.fromEntries(Object.entries(r.shortcuts as Record<string, unknown>).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as unknown[]).filter((x): x is string => typeof x === 'string')])) : {},
      restoreSession: bool(r.restoreSession, true),
      agentsAllowed: r.agentsAllowed === true,
      nodemodeUrl: typeof r.nodemodeUrl === 'string' && /^https?:\/\/./.test(r.nodemodeUrl) ? r.nodemodeUrl.slice(0, 300) : DEFAULT_PREFS.nodemodeUrl,
      historyStates: Math.round(num(r.historyStates, 10, 1000, DEFAULT_PREFS.historyStates)),
      recoverySeconds: Math.round(num(r.recoverySeconds, 5, 3600, DEFAULT_PREFS.recoverySeconds)),
      autoShowHome: bool(r.autoShowHome, true),
      zoomWheel: bool(r.zoomWheel, false),
      keyIncrement: num(r.keyIncrement, 0.01, 1000, DEFAULT_PREFS.keyIncrement),
      snapTolerance: num(r.snapTolerance, 1, 20, DEFAULT_PREFS.snapTolerance),
      units: UNIT_CHOICES.some(([k]) => k === r.units) ? r.units as Units : 'pt',
      scaleStrokes: bool(r.scaleStrokes, true),
      previewBounds: bool(r.previewBounds, false),
      gridInBack: bool(r.gridInBack, true),
      gridSpacing: num(r.gridSpacing, 1, 5000, DEFAULT_PREFS.gridSpacing),
      gridSubdivisions: Math.round(num(r.gridSubdivisions, 1, 64, DEFAULT_PREFS.gridSubdivisions)),
      guideColor: color(r.guideColor),
      gridColor: color(r.gridColor),
      checkerSize: CHECKER_SIZES.some(([k]) => k === r.checkerSize) ? r.checkerSize as CheckerSize : 'medium',
      checkerColors: CHECKER_COLORS.some(([k]) => k === r.checkerColors) ? r.checkerColors as CheckerColors : 'light',
      narrowCollapse: bool(r.narrowCollapse, true),
      newMaskClip: bool(r.newMaskClip, true),
      newMaskInvert: bool(r.newMaskInvert, false),
    };
  } catch { return { ...DEFAULT_PREFS }; }
}

export function savePrefs(p: Prefs): void { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { } }

export function applyPrefs(engine: Engine, p: Prefs): void {
  History.limit = p.historyStates;
  engine.view = { ...engine.view, scaleStrokes: p.scaleStrokes, previewBounds: p.previewBounds };
  engine.maskDefaults = { clip: p.newMaskClip, invert: p.newMaskInvert };
  engine.emit('options', null);
  engine.emit('overlay', null);
}

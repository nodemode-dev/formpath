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
  showGenerative: boolean;
  anchorSize: AnchorSize;
  snapAngleSet: SnapAngleSet;
  smartLabels: boolean;
  smartMeasure: boolean;
  smartHighlight: boolean;
  smartSpacing: boolean;
  scaleCorners: boolean;
  helpBar: boolean;
  taskBar: boolean;
  pasteOnArtboards: boolean;
  autoSpell: boolean;
  pfPrecision: number;
  pfRemoveRedundant: boolean;
  pfRemoveUnpainted: boolean;
}

export type AnchorSize = 'small' | 'medium' | 'large' | 'xlarge';
export type SnapAngleSet = 'a45' | 'a30-45' | 'a30';
export const ANCHOR_SIZES: ReadonlyArray<readonly [AnchorSize, string]> = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large'], ['xlarge', 'Extra large']];
export const ANCHOR_SCALE: Record<AnchorSize, number> = { small: 1, medium: 1.25, large: 1.6, xlarge: 2 };
export const SNAP_ANGLE_SETS: ReadonlyArray<readonly [SnapAngleSet, string]> = [['a45', '90° and 45° angles'], ['a30-45', '30°, 45°, 60° and 90° angles'], ['a30', '30° angles']];
export const SNAP_ANGLES: Record<SnapAngleSet, number[]> = { a45: [0, 45, 90, 135], 'a30-45': [0, 30, 45, 60, 90, 120, 135, 150], a30: [0, 30, 60, 90, 120, 150] };

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
  showGenerative: true, anchorSize: 'small', snapAngleSet: 'a45', smartLabels: true, smartMeasure: true, smartHighlight: true, smartSpacing: true, scaleCorners: true, helpBar: false, taskBar: true, pasteOnArtboards: false, autoSpell: false,
  pfPrecision: 0.028, pfRemoveRedundant: false, pfRemoveUnpainted: false,
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
      showGenerative: bool(r.showGenerative, true),
      anchorSize: ANCHOR_SIZES.some(([k]) => k === r.anchorSize) ? r.anchorSize as AnchorSize : 'small',
      snapAngleSet: SNAP_ANGLE_SETS.some(([k]) => k === r.snapAngleSet) ? r.snapAngleSet as SnapAngleSet : 'a45',
      smartLabels: bool(r.smartLabels, true),
      smartMeasure: bool(r.smartMeasure, true),
      smartHighlight: bool(r.smartHighlight, true),
      smartSpacing: bool(r.smartSpacing, true),
      scaleCorners: bool(r.scaleCorners, true),
      helpBar: bool(r.helpBar, false),
      taskBar: bool(r.taskBar, true),
      pasteOnArtboards: bool(r.pasteOnArtboards, false),
      autoSpell: bool(r.autoSpell, false),
      pfPrecision: num(r.pfPrecision, 0.001, 100, DEFAULT_PREFS.pfPrecision),
      pfRemoveRedundant: bool(r.pfRemoveRedundant, false),
      pfRemoveUnpainted: bool(r.pfRemoveUnpainted, false),
    };
  } catch { return { ...DEFAULT_PREFS }; }
}

export function savePrefs(p: Prefs): void { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { } }

export function applyPrefs(engine: Engine, p: Prefs): void {
  if (History.limit !== p.historyStates) engine.setHistoryLimit(p.historyStates);
  engine.setView({ scaleStrokes: p.scaleStrokes, previewBounds: p.previewBounds, scaleCorners: p.scaleCorners });
  engine.maskDefaults = { clip: p.newMaskClip, invert: p.newMaskInvert };
  engine.setPathfinderOptions({ precision: p.pfPrecision, removeRedundant: p.pfRemoveRedundant, removeUnpainted: p.pfRemoveUnpainted });
  engine.emit('options', null);
  engine.emit('overlay', null);
}

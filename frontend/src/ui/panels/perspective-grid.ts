import { hex, parseColor } from '../../engine/paint';
import { gridOf, presetGrid, PRESET_NAMES, reprojectDoc, sanitizeGrid } from '../../engine/perspective';
import type { Doc, Engine, PerspGrid } from '../../engine';
import { askForm, type Field, type FieldValue } from '../form-dialog';
import { previewEdit } from './preview-edit';

const STORE = 'formpath.perspectivePresets';

export interface GridPreset { name: string; grid: PerspGrid }

export function savedPresets(): GridPreset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is GridPreset => !!x && typeof (x as GridPreset).name === 'string' && typeof (x as GridPreset).grid === 'object') : [];
  } catch { return []; }
}

function storePresets(list: GridPreset[]): void { try { localStorage.setItem(STORE, JSON.stringify(list)); } catch { } }

export function presetById(doc: Doc, id: string): PerspGrid | null {
  if (id === '1p' || id === '2p' || id === '3p') return presetGrid(doc, Number(id[0]) as 1 | 2 | 3);
  const m = /^user-(\d+)$/.exec(id), p = m ? savedPresets()[Number(m[1])] : null;
  return p ? sanitizeGrid({ ...p.grid, name: p.name }) : null;
}

export function presetChoices(): ReadonlyArray<readonly [string, string]> {
  return [['1p', PRESET_NAMES[1]], ['2p', PRESET_NAMES[2]], ['3p', PRESET_NAMES[3]], ...savedPresets().map((p, i) => [`user-${i}`, p.name] as const)];
}

export async function saveGridPreset(engine: Engine): Promise<boolean> {
  const g = engine.perspGrid();
  if (!g) return false;
  const v = await askForm('Save Grid as Preset', [{ kind: 'text', key: 'name', label: 'Name', value: `${g.type}P-Custom ${savedPresets().length + 1}` }, { kind: 'note', text: 'Saved presets appear in Define Grid and under View > Perspective Grid.' }]);
  const name = v ? String(v.name).trim() : '';
  if (!name) return false;
  const list = savedPresets().filter((p) => p.name !== name);
  list.push({ name, grid: { ...g, name } });
  storePresets(list);
  engine.notice(`Saved the perspective grid preset ${name}.`);
  return true;
}

function fieldsFor(g: PerspGrid): Field[] {
  return [
    { kind: 'select', key: 'preset', label: 'Preset', value: 'current', choices: [['current', 'Current grid'], ...presetChoices()] },
    { kind: 'select', key: 'type', label: 'Type', value: String(g.type), choices: [['1', 'One Point Perspective'], ['2', 'Two Point Perspective'], ['3', 'Three Point Perspective']] },
    { kind: 'number', key: 'cell', label: 'Gridline every', value: g.cell, min: 1, max: 2000, unit: 'pt' },
    { kind: 'number', key: 'angle', label: 'Viewing angle', value: g.angle, min: 0.5, max: 89.5, unit: '°' },
    { kind: 'number', key: 'distance', label: 'Viewing distance', value: Math.round(g.distance * 100) / 100, min: 1, max: 100000, unit: 'pt' },
    { kind: 'number', key: 'height', label: 'Horizon height', value: Math.round(g.height * 100) / 100, min: -100000, max: 100000, unit: 'pt' },
    { kind: 'number', key: 'vp3', label: 'Third vanishing point', value: Math.round(g.vp3 * 100) / 100, min: -100000, max: 100000, unit: 'pt' },
    { kind: 'number', key: 'extLeft', label: 'Left extent', value: Math.round(g.ext.left), min: 1, max: 100000, unit: 'pt' },
    { kind: 'number', key: 'extRight', label: 'Right extent', value: Math.round(g.ext.right), min: 1, max: 100000, unit: 'pt' },
    { kind: 'number', key: 'extHeight', label: 'Vertical extent', value: Math.round(g.ext.height), min: 1, max: 100000, unit: 'pt' },
    { kind: 'color', key: 'left', label: 'Left grid', value: hex(g.colors.left) },
    { kind: 'color', key: 'right', label: 'Right grid', value: hex(g.colors.right) },
    { kind: 'color', key: 'floor', label: 'Horizontal grid', value: hex(g.colors.floor) },
    { kind: 'number', key: 'opacity', label: 'Opacity', value: Math.round(g.opacity * 100), min: 0, max: 100, unit: '%' },
    { kind: 'note', text: 'The horizon height is measured up from the ground level. The third vanishing point is its distance below the horizon (negative is above) and applies to three point grids.' },
  ];
}

function gridFrom(doc: Doc, base: PerspGrid, start: Record<string, FieldValue>, v: Record<string, FieldValue>): PerspGrid {
  const preset = String(v.preset);
  let g = preset !== 'current' ? presetById(doc, preset) ?? base : base;
  const changed = (k: string): boolean => v[k] !== start[k];
  const num = (k: string): number => Number(v[k]);
  if (changed('type')) g = { ...g, type: Number(v.type) as 1 | 2 | 3 };
  if (g.type === 3 && Math.abs(g.vp3) < 1) g = { ...g, vp3: Math.max(4 * g.distance, Math.abs(g.height) * 4) };
  if (changed('cell')) g = { ...g, cell: num('cell') };
  if (changed('angle')) g = { ...g, angle: num('angle') };
  if (changed('distance')) g = { ...g, distance: num('distance') };
  if (changed('height')) g = { ...g, height: num('height') };
  if (changed('vp3')) g = { ...g, vp3: num('vp3') };
  if (changed('extLeft') || changed('extRight') || changed('extHeight')) g = { ...g, ext: { left: changed('extLeft') ? num('extLeft') : g.ext.left, right: changed('extRight') ? num('extRight') : g.ext.right, height: changed('extHeight') ? num('extHeight') : g.ext.height } };
  const col = (k: 'left' | 'right' | 'floor'): void => { if (changed(k)) { const c = parseColor(String(v[k])); if (c) g = { ...g, colors: { ...g.colors, [k]: c } }; } };
  col('left'); col('right'); col('floor');
  if (changed('opacity')) g = { ...g, opacity: num('opacity') / 100 };
  return sanitizeGrid(g);
}

export async function defineGrid(engine: Engine): Promise<boolean> {
  const d = engine.doc;
  if (!d) return false;
  const base = gridOf(d), fields = fieldsFor(base);
  const start = Object.fromEntries(fields.flatMap((f) => (f.kind === 'note' ? [] : [[f.key, f.value]]))) as Record<string, FieldValue>;
  const r = await previewEdit(engine, 'Define Perspective Grid', fields, (origin, v) => reprojectDoc(origin, gridFrom(origin, gridOf(origin), start, v)));
  if (r) engine.setPerspView({ show: true });
  return !!r;
}

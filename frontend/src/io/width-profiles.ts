import { CUSTOM_WIDTH_PROFILES, normalizeWidthPoints, WIDTH_PROFILES } from '../engine/effects';
import type { WidthPoint } from '../engine/types';

const KEY = 'formpath.widthProfiles';
const listeners = new Set<() => void>();

const persist = (): void => { try { localStorage.setItem(KEY, JSON.stringify(CUSTOM_WIDTH_PROFILES)); } catch { } };
const notify = (): void => listeners.forEach((f) => f());
const clash = (name: string): boolean => Object.keys(WIDTH_PROFILES).some((k) => k === name.toLowerCase().replace(/\s+/g, '_'));

function load(): void {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (!v || typeof v !== 'object') return;
    for (const [k, pts] of Object.entries(v)) if (Array.isArray(pts) && pts.length && !clash(k)) CUSTOM_WIDTH_PROFILES[k] = normalizeWidthPoints(pts as WidthPoint[]);
  } catch { }
}
load();

export const customProfileNames = (): string[] => Object.keys(CUSTOM_WIDTH_PROFILES);
export const isCustomProfile = (name: string): boolean => Object.prototype.hasOwnProperty.call(CUSTOM_WIDTH_PROFILES, name);
export const onWidthProfiles = (fn: () => void): void => { listeners.add(fn); };

export function saveWidthProfile(name: string, pts: ReadonlyArray<Partial<WidthPoint>>): string | null {
  const key = name.trim().slice(0, 60);
  if (!key || clash(key) || !pts.length) return null;
  CUSTOM_WIDTH_PROFILES[key] = normalizeWidthPoints(pts);
  persist();
  notify();
  return key;
}

export function deleteWidthProfile(name: string): boolean {
  if (!isCustomProfile(name)) return false;
  delete CUSTOM_WIDTH_PROFILES[name];
  persist();
  notify();
  return true;
}

export function resetWidthProfiles(): number {
  const n = customProfileNames();
  for (const k of n) delete CUSTOM_WIDTH_PROFILES[k];
  persist();
  notify();
  return n.length;
}

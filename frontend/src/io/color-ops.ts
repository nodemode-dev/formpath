import { addProfile, cmykLuts, genericCmyk, profileList, refOf, refreshProfiles, resolveProfile, resolveSettings, setColorBackend, withSettings, type ProfileInfo } from '../engine/color-management';
import { convertDoc, throughCmykFn, toRgbFn } from '../engine/ops/profile-convert';
import type { Engine } from '../engine';
import type { ColorSettings, Doc } from '../engine/types';
import { api } from './api';

export function installColorBackend(): void {
  setColorBackend({
    profiles: () => api.colorProfiles(),
    profileBytes: (id) => api.colorProfileBytes(id),
    lut: (kind, body) => api.colorLut(kind, body),
    displayProfile: () => api.colorDisplayProfile(),
  });
}

export async function uploadProfile(file: File): Promise<ProfileInfo> {
  const info = await api.colorUpload(file);
  addProfile(info);
  await refreshProfiles(true);
  return info;
}

export function findProfile(query: string, space?: 'RGB' | 'CMYK'): ProfileInfo | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const pool = profileList().filter((p) => !space || p.space === space);
  return pool.find((p) => p.id === q) ?? pool.find((p) => p.name.toLowerCase() === q) ?? pool.find((p) => p.name.toLowerCase().includes(q)) ?? null;
}

export function settingsPatch(rgb: ProfileInfo | null, cmyk: ProfileInfo | null, intent: number, bpc: boolean, base: ColorSettings | undefined): Partial<ColorSettings> {
  const builtin = resolveProfile(undefined, 'RGB');
  return {
    rgb: rgb && rgb.id !== builtin?.id ? refOf(rgb) : undefined,
    cmyk: cmyk ? refOf(cmyk) : undefined,
    intent: intent === 1 ? undefined : (intent as 0 | 2 | 3),
    bpc: bpc ? undefined : false,
    proof: base?.proof,
  };
}

export function applySettings(engine: Engine, patch: Partial<ColorSettings>, name = 'Color Settings'): boolean {
  const d = engine.doc;
  if (!d) return false;
  const next = withSettings(d, patch);
  if (JSON.stringify(next.cm ?? null) === JSON.stringify(d.cm ?? null)) return false;
  return engine.edit(name, (doc) => withSettings(doc, patch));
}

export async function convertToProfile(engine: Engine, target: ProfileInfo): Promise<boolean> {
  const doc: Doc | null = engine.doc;
  if (!doc) throw new Error('Open a document first.');
  if (!profileList().length) await refreshProfiles();
  const s = resolveSettings(doc.cm);
  if (!s.rgb) throw new Error('The RGB working space is unavailable. Start the formpth engine and try again.');
  if (target.space === 'CMYK') {
    const old = s.cmyk ? await cmykLuts(s.rgb, s.cmyk, s.intent, s.bpc) : null;
    const next = await cmykLuts(s.rgb, target, s.intent, s.bpc);
    const fn = throughCmykFn(old ? old.c2r : null, next.r2c);
    return engine.edit('Convert to Profile', (d) => withSettings({ ...convertDoc(d, fn), colorMode: 'cmyk' }, { cmyk: refOf(target) }));
  }
  if (target.space === 'RGB') {
    const source = s.cmyk ?? genericCmyk();
    if (!source) throw new Error('No CMYK profile is available to convert from. Start the formpth engine and try again.');
    const luts = await cmykLuts(target, source, s.intent, s.bpc);
    const fn = toRgbFn(luts.c2r);
    const builtin = resolveProfile(undefined, 'RGB');
    return engine.edit('Convert to Profile', (d) => withSettings({ ...convertDoc(d, fn), colorMode: 'rgb' }, { rgb: target.id === builtin?.id ? undefined : refOf(target) }));
  }
  throw new Error('Choose an RGB or CMYK profile.');
}

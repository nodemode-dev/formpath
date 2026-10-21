import type { Engine } from '../engine';
import { INTENTS, genericCmyk, isProofing, proofDevice, profileList, refOf, refreshDisplayProfile, refreshProfiles, resolveSettings, setProofing, type ProfileInfo } from '../engine/color-management';
import { applySettings, convertToProfile, settingsPatch, uploadProfile } from '../io/color-ops';
import { askForm, type Field, type FieldValue } from './form-dialog';
import { toast } from './toast';

const NONE = 'none';
const label = (p: ProfileInfo): string => (p.source === 'system' ? `${p.name} (system)` : p.source === 'user' ? `${p.name} (loaded)` : p.name);
const choices = (list: ProfileInfo[]): Array<[string, string]> => list.map((p) => [p.id, label(p)]);

async function ready(engine: Engine): Promise<boolean> {
  if (!engine.doc) return false;
  const list = await refreshProfiles();
  if (!list.length) { toast('The formpath engine is offline, so colour profiles cannot be listed. Start it with ./formpath boot.', 'error'); return false; }
  return true;
}

function pickFile(): Promise<File | null> {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.icc,.icm';
  const promise = new Promise<File | null>((resolve) => {
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => resolve(null));
  });
  input.click();
  return promise;
}

export async function colorSettingsDialog(engine: Engine, seed?: Record<string, FieldValue>): Promise<void> {
  if (!(await ready(engine))) return;
  const doc = engine.doc;
  if (!doc) return;
  const s = resolveSettings(doc.cm);
  const rgbs = profileList().filter((p) => p.space === 'RGB'), cmyks = profileList().filter((p) => p.space === 'CMYK');
  const fields: Field[] = [
    { kind: 'select', key: 'rgb', label: 'RGB working space', value: String(seed?.rgb ?? s.rgb?.id ?? rgbs[0]?.id ?? ''), choices: choices(rgbs) },
    { kind: 'select', key: 'cmyk', label: 'CMYK working space', value: String(seed?.cmyk ?? s.cmyk?.id ?? NONE), choices: [[NONE, 'None (formula)'], ...choices(cmyks)] },
    { kind: 'select', key: 'intent', label: 'Rendering intent', value: String(seed?.intent ?? s.intent), choices: INTENTS.map(([n, name]) => [String(n), name] as const) },
    { kind: 'check', key: 'bpc', label: 'Use black point compensation', value: seed?.bpc === undefined ? s.bpc : !!seed.bpc },
    { kind: 'note', text: 'With a CMYK working space set, CMYK colours are shown and converted through that profile. With None, formpath keeps its simple formula.' },
  ];
  let load: Promise<File | null> | null = null;
  const v = await askForm('Color Settings', fields, { ok: 'OK', extra: { label: 'Load Profile...', run: () => { load = pickFile(); } } });
  if (!v) return;
  if (load) {
    const file = await (load as Promise<File | null>);
    let picked: ProfileInfo | null = null;
    if (file) {
      try { picked = await uploadProfile(file); toast(`Loaded ${picked.name}.`); } catch (err) { toast(err instanceof Error ? err.message : 'That profile could not be loaded.', 'error'); }
    }
    const next = { ...v };
    if (picked?.space === 'RGB') next.rgb = picked.id;
    if (picked?.space === 'CMYK') next.cmyk = picked.id;
    await colorSettingsDialog(engine, next);
    return;
  }
  const rgb = profileList().find((p) => p.id === v.rgb) ?? null, cmyk = profileList().find((p) => p.id === v.cmyk) ?? null;
  applySettings(engine, settingsPatch(rgb, cmyk, Number(v.intent), !!v.bpc, doc.cm));
}

export async function assignProfileDialog(engine: Engine): Promise<void> {
  if (!(await ready(engine))) return;
  const doc = engine.doc;
  if (!doc) return;
  const s = resolveSettings(doc.cm);
  const rgbs = profileList().filter((p) => p.space === 'RGB'), cmyks = profileList().filter((p) => p.space === 'CMYK');
  const v = await askForm('Assign Profile', [
    { kind: 'select', key: 'cmyk', label: 'CMYK profile', value: s.cmyk?.id ?? NONE, choices: [[NONE, 'Do not color manage CMYK'], ...choices(cmyks)] },
    { kind: 'select', key: 'rgb', label: 'RGB profile', value: s.rgb?.id ?? rgbs[0]?.id ?? '', choices: choices(rgbs) },
    { kind: 'note', text: 'Assigning changes how the colour numbers are interpreted. The numbers themselves stay as they are. Use Convert to Profile to keep the look instead.' },
  ], { ok: 'Assign' });
  if (!v) return;
  const rgb = rgbs.find((p) => p.id === v.rgb) ?? null, cmyk = cmyks.find((p) => p.id === v.cmyk) ?? null;
  applySettings(engine, settingsPatch(rgb, cmyk, s.intent, s.bpc, doc.cm), 'Assign Profile');
}

export async function convertToProfileDialog(engine: Engine): Promise<void> {
  if (!(await ready(engine))) return;
  const doc = engine.doc;
  if (!doc) return;
  const list = profileList().filter((p) => p.space === 'RGB' || p.space === 'CMYK');
  const s = resolveSettings(doc.cm);
  const v = await askForm('Convert to Profile', [
    { kind: 'select', key: 'target', label: 'Destination profile', value: s.cmyk?.id ?? genericCmyk()?.id ?? list[0]?.id ?? '', choices: list.map((p) => [p.id, `${label(p)} (${p.space})`] as [string, string]) },
    { kind: 'note', text: 'Every fill, stroke, gradient stop, mesh point, swatch and artboard colour is converted with the document rendering intent and black point setting. One Undo reverses the whole conversion.' },
  ], { ok: 'Convert' });
  if (!v) return;
  const target = list.find((p) => p.id === v.target);
  if (!target) return;
  try { await convertToProfile(engine, target); } catch (err) { toast(err instanceof Error ? err.message : 'The conversion failed.', 'error'); }
}

export async function proofSetupDialog(engine: Engine): Promise<void> {
  if (!(await ready(engine))) return;
  const doc = engine.doc;
  if (!doc) return;
  const cmyks = profileList().filter((p) => p.space === 'CMYK');
  const cur = proofDevice(doc.cm);
  const pr = doc.cm?.proof ?? {};
  const shown = await refreshDisplayProfile();
  const via = { colord: 'colord', x11: 'the X11 _ICC_PROFILE atom', colorsync: 'ColorSync', windows: 'Windows colour management', env: 'FORMPATH_DISPLAY_PROFILE' }[shown?.via ?? ''] ?? '';
  const v = await askForm('Proof Setup', [
    { kind: 'select', key: 'device', label: 'Device to simulate', value: cur?.id ?? cmyks[0]?.id ?? '', choices: choices(cmyks) },
    { kind: 'note', text: shown ? `Display: ${shown.name} (from ${via}).` : 'Display: sRGB (built-in). No display profile was found on this computer.' },
    { kind: 'check', key: 'preserve', label: 'Preserve CMYK numbers', value: !!pr.preserve },
    { kind: 'check', key: 'paper', label: 'Simulate paper color', value: !!pr.paper },
    { kind: 'check', key: 'ink', label: 'Simulate black ink', value: !!pr.blackInk },
    { kind: 'note', text: 'Choose View > Proof Colors to see the artwork as the selected device would print it. Simulating paper color uses absolute colorimetric rendering.' },
  ], { ok: 'OK' });
  if (!v) return;
  const device = cmyks.find((p) => p.id === v.device);
  applySettings(engine, { proof: { device: device ? refOf(device) : undefined, preserve: v.preserve ? true : undefined, paper: v.paper ? true : undefined, blackInk: v.ink ? true : undefined } }, 'Proof Setup');
  if (isProofing()) void setProofing(true, engine.doc);
}

export async function proofPreset(engine: Engine, which: 'working' | 'monitor' | ProfileInfo): Promise<void> {
  if (!(await ready(engine))) return;
  const doc = engine.doc;
  if (!doc) return;
  if (which === 'monitor') { await toggleProofColors(engine, false); return; }
  const pr = doc.cm?.proof ?? {};
  applySettings(engine, { proof: { ...pr, device: which === 'working' ? undefined : refOf(which) } }, 'Proof Setup');
  await toggleProofColors(engine, true);
}

export function proofPresetOn(engine: Engine, which: 'working' | 'monitor' | ProfileInfo): boolean {
  const dev = engine.doc?.cm?.proof?.device;
  if (which === 'monitor') return !isProofing();
  if (!isProofing()) return false;
  if (which === 'working') return !dev;
  return !!dev && (dev.id === which.id || dev.name === which.name);
}

export async function toggleProofColors(engine: Engine, on?: boolean): Promise<boolean> {
  const want = on ?? !isProofing();
  if (want && !(await ready(engine))) return false;
  const ok = await setProofing(want, engine.doc);
  if (want && !ok) toast('Proof Colors could not start. Check that the engine is running and that a CMYK profile is available.', 'error');
  return isProofing();
}

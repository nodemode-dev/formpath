import { cmykLuts, genericCmyk, profileList, refOf, refreshProfiles, resolveProfile, resolveSettings, withSettings } from '../engine/color-management';
import { convertDoc, throughCmykFn, toRgbFn } from '../engine/ops/profile-convert';
import type { Project } from '../engine';
import type { Doc } from '../engine/types';
import { exportPdf } from './pdf';
import { exportPlates } from './pdf-plates';
import type { PrintSettings } from './print-layout';

function clone(p: Project, doc: Doc): Project {
  const q = Object.create(p) as Project;
  Object.defineProperty(q, 'doc', { value: doc });
  return q;
}

export async function managed(p: Project, s: PrintSettings): Promise<{ project: Project; x4: boolean }> {
  if (s.colors !== 'formpth' || !s.profile) return { project: p, x4: false };
  if (!profileList().length) await refreshProfiles();
  const target = profileList().find((x) => x.id === s.profile);
  if (!target) throw new Error('The printer profile is not available. Choose another profile or start the formpth engine.');
  const cur = resolveSettings(p.doc.cm);
  if (!cur.rgb) throw new Error('The RGB working space is unavailable. Start the formpth engine and try again.');
  if (target.space === 'CMYK') {
    const old = cur.cmyk ? await cmykLuts(cur.rgb, cur.cmyk, s.intent, cur.bpc) : null, next = await cmykLuts(cur.rgb, target, s.intent, cur.bpc);
    const doc = withSettings({ ...convertDoc(p.doc, throughCmykFn(old ? old.c2r : null, next.r2c)), colorMode: 'cmyk' }, { cmyk: refOf(target) });
    return { project: clone(p, doc), x4: true };
  }
  const source = cur.cmyk ?? genericCmyk();
  if (!source) throw new Error('No CMYK profile is available to convert from. Start the formpth engine and try again.');
  const luts = await cmykLuts(target, source, s.intent, cur.bpc), builtin = resolveProfile(undefined, 'RGB');
  const doc = withSettings({ ...convertDoc(p.doc, toRgbFn(luts.c2r)), colorMode: 'rgb' }, { rgb: target.id === builtin?.id ? undefined : refOf(target) });
  return { project: clone(p, doc), x4: false };
}

export async function buildPrintPdf(p: Project, s: PrintSettings, version: string): Promise<Blob> {
  const artboards = s.range.filter((i) => p.doc.artboards[i]);
  if (!artboards.length) throw new Error('Choose at least one artboard to print.');
  if (s.output === 'separations') return exportPlates(p, { artboards, marks: s.marks, dpi: s.plateDpi, sheet: s, version });
  const { project, x4 } = await managed(p, s);
  return exportPdf(project, { artboards, preserve: false, ppi: p.doc.rasterPpi || 300, version, marks: s.marks, standard: x4 ? 'x4' : 'none', sheet: s });
}

export function printPdf(blob: Blob, fallback: (b: Blob) => Promise<void>): Promise<'printed' | 'saved'> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob), frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
    let done = false;
    const clean = (): void => { frame.remove(); URL.revokeObjectURL(url); };
    const go = (): void => {
      if (done) return;
      done = true;
      try {
        const w = frame.contentWindow;
        if (!w) throw new Error('no window');
        w.focus();
        w.print();
        window.setTimeout(clean, 120000);
        resolve('printed');
      } catch {
        clean();
        fallback(blob).then(() => resolve('saved'), reject);
      }
    };
    frame.addEventListener('load', () => window.setTimeout(go, 250));
    window.setTimeout(go, 2500);
    frame.src = url;
    document.body.append(frame);
  });
}

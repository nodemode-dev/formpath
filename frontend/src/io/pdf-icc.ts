import { refOf, withSettings } from '../engine/color-management';
import type { Doc } from '../engine/types';
import { uploadProfile } from './color-ops';

export interface PdfProfile { bytes: Uint8Array; space: 'CMYK' | 'RGB' | 'GRAY'; name: string }

const SCAN_LIMIT = 200 * 1024 * 1024;
const PROFILE_LIMIT = 16 * 1024 * 1024;
const SPACES: Record<string, PdfProfile['space']> = { 'CMYK': 'CMYK', 'RGB ': 'RGB', 'GRAY': 'GRAY' };

async function inflate(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try { return new Uint8Array(await new Response(new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer()); } catch { return null; }
}

const tag = (b: Uint8Array, at: number): string => String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]);

function profileName(b: Uint8Array): string {
  const dv = new DataView(b.buffer, b.byteOffset, b.length), count = Math.min(dv.getUint32(128), 200);
  for (let i = 0; i < count; i++) {
    const at = 132 + i * 12;
    if (at + 12 > b.length || tag(b, at) !== 'desc') continue;
    const off = dv.getUint32(at + 4), size = dv.getUint32(at + 8);
    if (off + size > b.length || size < 12) return 'PDF profile';
    const kind = tag(b, off);
    if (kind === 'desc') {
      const n = Math.min(dv.getUint32(off + 8), size - 12);
      return String.fromCharCode(...b.subarray(off + 12, off + 12 + n)).replace(/\0+$/, '').trim() || 'PDF profile';
    }
    if (kind === 'mluc' && size >= 28) {
      const len = dv.getUint32(off + 20), pos = dv.getUint32(off + 24);
      let s = '';
      for (let j = 0; j + 1 < len && off + pos + j + 1 < b.length; j += 2) s += String.fromCharCode(dv.getUint16(off + pos + j));
      return s.trim() || 'PDF profile';
    }
  }
  return 'PDF profile';
}

export function readProfile(b: Uint8Array): PdfProfile | null {
  if (b.length < 132 || tag(b, 36) !== 'acsp') return null;
  const space = SPACES[tag(b, 16)];
  return space ? { bytes: b, space, name: profileName(b) } : null;
}

/** Finds the ICC profiles that ICCBased colour spaces of a PDF point at, without running the page interpreter. Encrypted files yield none. */
export async function pdfProfiles(data: ArrayBuffer, max = 8): Promise<PdfProfile[]> {
  if (data.byteLength > SCAN_LIMIT) return [];
  const bytes = new Uint8Array(data), text = new TextDecoder('latin1').decode(bytes), found: PdfProfile[] = [], seen = new Set<string>();
  const dict = /<<(?:(?!>>)[\s\S])*?\/N\s+([134])(?![0-9])(?:(?!>>)[\s\S])*?>>\s*stream\r?\n/g;
  for (let m = dict.exec(text); m && found.length < max; m = dict.exec(text)) {
    if (/\/Type\s*\/XObject|\/Subtype\s*\/Image/.test(m[0])) continue;
    const start = m.index + m[0].length, end = text.indexOf('endstream', start);
    if (end < 0) break;
    let raw: Uint8Array = bytes.subarray(start, end);
    const len = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(m[0]);
    if (len && Number(len[1]) <= raw.length) raw = raw.subarray(0, Number(len[1]));
    else if (raw.length && (raw[raw.length - 1] === 10 || raw[raw.length - 1] === 13)) raw = raw.subarray(0, raw.length - (raw.length > 1 && raw[raw.length - 2] === 13 ? 2 : 1));
    if (raw.length > PROFILE_LIMIT) continue;
    if (/\/FlateDecode|\/Fl\b/.test(m[0])) { const out = await inflate(raw); if (!out) continue; raw = out; }
    const p = readProfile(raw);
    if (!p) continue;
    const key = `${p.space}|${raw.length}|${raw[84]}${raw[85]}${raw[86]}${raw[87]}${raw[88]}${raw[89]}${raw[90]}${raw[91]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(p);
  }
  return found;
}

/** A PDF whose colours are tagged with a CMYK ICC profile keeps its CMYK numbers; the profile becomes the document CMYK working space so they are shown through its table. */
export async function assignPdfProfile(doc: Doc, data: ArrayBuffer): Promise<{ doc: Doc; name: string | null }> {
  if (doc.cm?.cmyk) return { doc, name: null };
  try {
    const cmyk = (await pdfProfiles(data)).find((p) => p.space === 'CMYK');
    if (!cmyk) return { doc, name: null };
    const name = cmyk.name.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'PDF CMYK profile';
    const info = await uploadProfile(new File([cmyk.bytes as Uint8Array<ArrayBuffer>], `${name}.icc`, { type: 'application/vnd.iccprofile' }));
    return info.space === 'CMYK' ? { doc: withSettings(doc, { cmyk: refOf(info) }), name: info.name } : { doc, name: null };
  } catch { return { doc, name: null }; }
}

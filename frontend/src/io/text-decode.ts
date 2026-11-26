const LEGACY: Record<string, string> = {
  'zh-tw': 'big5', 'zh-hk': 'big5', 'zh-mo': 'big5', 'zh-hant': 'big5', zh: 'gb18030', ja: 'shift_jis', ko: 'euc-kr',
  ru: 'windows-1251', uk: 'windows-1251', bg: 'windows-1251', sr: 'windows-1251', el: 'windows-1253', tr: 'windows-1254', he: 'windows-1255', ar: 'windows-1256', th: 'windows-874', vi: 'windows-1258',
  pl: 'windows-1250', cs: 'windows-1250', hu: 'windows-1250', sk: 'windows-1250', ro: 'windows-1250', lt: 'windows-1257', lv: 'windows-1257', et: 'windows-1257',
};

export function localeLabel(lang?: string): string {
  const l = (lang ?? globalThis.navigator?.language ?? 'en').toLowerCase();
  return LEGACY[l] ?? LEGACY[l.split('-').slice(0, 2).join('-')] ?? LEGACY[l.split('-')[0]] ?? 'windows-1252';
}

function decode(bytes: Uint8Array, label: string, fatal: boolean): string | null {
  try { return new TextDecoder(label, { fatal }).decode(bytes); } catch { return null; }
}

export function decodeText(bytes: Uint8Array, hint?: string | null): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return decode(bytes.subarray(3), 'utf-8', false) ?? '';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return decode(bytes.subarray(2), 'utf-16le', false) ?? '';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return decode(bytes.subarray(2), 'utf-16be', false) ?? '';
  return decode(bytes, 'utf-8', true) ?? (hint ? decode(bytes, hint, true) : null) ?? decode(bytes, localeLabel(), true) ?? decode(bytes, 'windows-1252', false) ?? '';
}

export async function fileText(file: Blob, hint?: string | null): Promise<string> {
  return decodeText(new Uint8Array(await file.arrayBuffer()), hint);
}

const DWG_CP: Record<number, string> = {
  3: 'iso-8859-2', 4: 'iso-8859-3', 5: 'iso-8859-4', 6: 'iso-8859-5', 7: 'iso-8859-6', 8: 'iso-8859-7', 9: 'iso-8859-8', 10: 'iso-8859-9', 22: 'shift_jis', 23: 'macintosh', 24: 'big5', 25: 'euc-kr', 27: 'ibm866',
  28: 'windows-1250', 29: 'windows-1251', 30: 'windows-1252', 31: 'gbk', 32: 'windows-1253', 33: 'windows-1254', 34: 'windows-1255', 35: 'windows-1256', 36: 'windows-1257', 37: 'windows-874', 38: 'shift_jis', 39: 'gbk', 40: 'euc-kr', 41: 'big5',
};
export const dwgCodePage = (n: number): string => DWG_CP[n] ?? 'windows-1252';

const MIF: Record<string, string> = { 1: 'shift_jis', 2: 'big5', 3: 'euc-kr', 5: 'gbk' };
const PCT: Record<string, string> = { c: 'Ø', d: '°', p: '±', u: '', o: '', k: '', '%': '%' };

export function cadEscapes(s: string, cp?: string | null, codes = false): string {
  if (!s.includes('\\') && !(codes && s.includes('%%'))) return s;
  const rx = codes ? /\\U\+([0-9a-fA-F]{4})|\\M\+([1-5])([0-9a-fA-F]{4})|%%(\d{3}|[cdpuokCDPUOK%])/g : /\\U\+([0-9a-fA-F]{4})|\\M\+([1-5])([0-9a-fA-F]{4})/g;
  return s.replace(rx, (m: string, u?: string, n?: string, mb?: string, pc?: string) => {
    if (u) return String.fromCharCode(parseInt(u, 16));
    if (n && mb) { const l = MIF[n]; return l ? decode(Uint8Array.of(parseInt(mb.slice(0, 2), 16), parseInt(mb.slice(2), 16)), l, true) ?? m : m; }
    if (!pc) return m;
    if (pc.length === 1) return PCT[pc.toLowerCase()];
    const c = Number(pc);
    return c > 255 ? m : c < 128 ? String.fromCharCode(c) : decode(Uint8Array.of(c), cp || 'windows-1252', true) ?? m;
  });
}

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

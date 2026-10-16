import { t } from '../i18n';
import { buildAi, findZstd, inflate, latin1, type AiRead } from './ai-legacy';
import { zstdDecompress } from './ai-zstd';
import { PdfPasswordError, readAiPrivateBlocks, type PdfSession } from './pdf-read';

export interface ModernAi { read: AiRead | null; why: string }

const fail = (why: string): ModernAi => ({ read: null, why: `${why}. ${t('Opened through its PDF page instead.')}` });

export async function aiPrivateText(bytes: Uint8Array, skipped: Set<string>): Promise<string | null> {
  const probe = latin1(bytes.subarray(0, Math.min(bytes.length, 1 << 20)));
  const mk = /%AI\d+_(CompressedData|ZStandard_Data)/.exec(probe);
  if (!mk) return probe.length === bytes.length ? probe : latin1(bytes);
  let p = mk.index + mk[0].length;
  while (p < bytes.length && (bytes[p] === 10 || bytes[p] === 13 || bytes[p] === 32)) p++;
  const body = bytes.subarray(p), zi = findZstd(body);
  if (body[0] !== 0x78 && zi >= 0) {
    try { return latin1(zstdDecompress(body.subarray(zi))); } catch (err) { skipped.add(`${t('ZStandard compressed art')} (${err instanceof Error ? err.message : t('not supported')})`); return null; }
  }
  try { return latin1(await inflate(body)); } catch { skipped.add(t('compressed art that could not be unpacked')); return null; }
}

/**
 * A binary raster is `%%BeginData: N` then XI, a line end and the pixels; N counts those three and the colour bytes only, so a plane of w*h alpha bytes after them (the XI line says one is there) lies beyond N and the %%EndData is searched from N on. The pixels are cut out before any line work (a line split would corrupt them) and handed over by index.
 * The same block inside an %_ dictionary (an opacity mask) is dropped.
 */
export function liftRasters(raw: string): { text: string; bins: string[]; masks: number } {
  const re = /(%_)?%%BeginData:[ \t]*(\d+)([^\r\n]*)(\r\n|\r|\n)/g, out: string[] = [], bins: string[] = [];
  let last = 0, masks = 0, m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    if (/hex/i.test(m[3])) continue;
    const start = m.index + m[0].length, xi = /^XI(\r\n|\r|\n)/.exec(raw.slice(start, start + 4)), found = raw.indexOf('%%EndData', start + Number(m[2]));
    if (!xi || found < 0) continue;
    const end = raw.startsWith('%_', found - 2) ? found - 2 : found;
    out.push(raw.slice(last, start));
    if (m[1]) masks++; else { bins.push(raw.slice(start + xi[0].length, end)); out.push(`@BIN ${bins.length - 1}\n`); }
    last = end;
    re.lastIndex = end;
  }
  out.push(raw.slice(last));
  return { text: out.join(''), bins, masks };
}

/**
 * Content versioned for newer Illustrator releases is followed by an alternate for older ones; only the first is kept.
 * The setup holds font encoding vectors that open a [ and close with a TE, TZ or TF operator instead of a ]; they carry nothing and would swallow the art, so they are dropped.
 */
export function modernText(text: string): string {
  const out: string[] = [], lines = text.split(/\r\n|\r|\n/), ends = /\bT[EZF]\s*$/;
  let skip = false, setup = true, depth = 0, waiting = false, attrs: number[] | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^%AI\d+_Begin_Content_if_version_gt/.test(l)) continue;
    if (/^%AI\d+_Alternate_Content/.test(l)) { skip = true; continue; }
    if (/^%AI\d+_End_Versioned_Content/.test(l)) { skip = false; continue; }
    if (skip) continue;
    if (setup && /^%AI5_BeginLayer/.test(l)) setup = false;
    if (!setup) {
      if (/^%AI5_BeginLayer/.test(l)) { if (++depth > 1) { out.push('u'); attrs = null; waiting = true; continue; } } else if (/^%AI5_EndLayer/.test(l)) { if (depth-- > 1) { out.push('U'); continue; } } else if (depth > 1) {
        if (waiting && /\bLb\s*$/.test(l)) { attrs = l.trim().split(/\s+/).map(Number); continue; }
        if (waiting && /\) Ln\s*$/.test(l)) { waiting = false; out.push(`${l.replace(/\s*Ln\s*$/, '')} ${attrs?.[0] ?? 1} ${attrs?.[2] ?? 1} SL`); continue; }
        if (/^LB\s*$/.test(l)) continue;
      }
    }
    if (setup && l.startsWith('[') && !l.includes(']')) {
      let j = i;
      while (j < lines.length && j < i + 40 && !ends.test(lines[j]) && !lines[j].includes(']') && (j === i || !lines[j].startsWith('%'))) j++;
      if (j < i + 40 && j < lines.length && ends.test(lines[j])) { i = j; continue; }
    }
    out.push(l);
  }
  return out.join('\n');
}

function unescape(raw: string): string {
  let s = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c !== '\\') { s += c; continue; }
    const e = raw[++i];
    if (e >= '0' && e <= '7') { let o = e; while (o.length < 3 && raw[i + 1] >= '0' && raw[i + 1] <= '7') o += raw[++i]; s += String.fromCharCode(parseInt(o, 8) & 255); } else if (e === 'n') s += '\n'; else if (e === 'r') s += '\r'; else if (e === 't') s += '\t'; else s += e ?? '';
  }
  if (s.charCodeAt(0) === 0xfe && s.charCodeAt(1) === 0xff) {
    let u = '';
    for (let i = 2; i + 1 < s.length; i += 2) u += String.fromCharCode((s.charCodeAt(i) << 8) | s.charCodeAt(i + 1));
    return u;
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(s, (c) => c.charCodeAt(0) & 255)); } catch { return s; }
}

interface Boards { boxes: number[][]; names: string[] }

/** The artboards: the document dictionary's ArtboardArray (name and the two corners in art space), else the single %AI3_Cropmarks rectangle. */
export function aiArtboards(text: string): Boards {
  const lines = text.split(/\r\n|\r|\n/);
  let end = -1;
  for (let i = lines.length - 1; i >= 0; i--) if (/^%_; \(ArtboardArray\)/.test(lines[i])) { end = i; break; }
  const boxes: number[][] = [], names: string[] = [];
  if (end >= 0) {
    let depth = 1, start = end;
    while (start > 0 && depth > 0) {
      start--;
      const l = lines[start];
      if (/^%_; ?(\(|,|$)/.test(l)) depth++;
      else if (/^%_\/(Dictionary|Array) :/.test(l)) depth--;
    }
    const body = lines.slice(start + 1, end).map((l) => (l.startsWith('%_') ? l.slice(2) : l)), joined = body.join('\n');
    for (const chunk of joined.split(/^\/Dictionary :$/m).slice(1)) {
      const nm = /\(((?:[^()\\]|\\[\s\S]|\([^()]*\))*)\) \/UnicodeString \(Name\)/.exec(chunk);
      const p1 = /([-+\d.eE]+) ([-+\d.eE]+) \/RealPointRelToROrigin\s*\n \(PositionPoint1\)/.exec(chunk), p2 = /([-+\d.eE]+) ([-+\d.eE]+) \/RealPointRelToROrigin\s*\n \(PositionPoint2\)/.exec(chunk);
      if (!p1 || !p2) continue;
      const a = [Number(p1[1]), Number(p1[2]), Number(p2[1]), Number(p2[2])];
      if (a.some((v) => !Number.isFinite(v))) continue;
      boxes.push([Math.min(a[0], a[2]), Math.min(a[1], a[3]), Math.max(a[0], a[2]), Math.max(a[1], a[3])]);
      names.push(nm ? unescape(nm[1]) : '');
    }
  }
  if (!boxes.length) {
    const m = /^%AI3_Cropmarks:\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/m.exec(text);
    if (m) {
      const a = [m[1], m[2], m[3], m[4]].map(Number);
      if (a.every(Number.isFinite) && a[2] > a[0] && a[3] > a[1]) boxes.push(a);
    }
  }
  return { boxes, names };
}

/** Opens a PDF compatible .ai through its Illustrator private data. read is null when it has none or could not be read; why then says so for a notice, empty when the file simply has no private data. */
export async function readAiModern(data: ArrayBuffer, title: string, password?: string, session?: PdfSession): Promise<ModernAi> {
  let blocks: Awaited<ReturnType<typeof readAiPrivateBlocks>>;
  try { blocks = await readAiPrivateBlocks(data, password, session); } catch (err) {
    if (err instanceof PdfPasswordError) return { read: null, why: '' };
    return fail(`${t('The Illustrator data in this file could not be read')} (${err instanceof Error ? err.message : String(err)})`);
  }
  if (!blocks) return { read: null, why: '' };
  const early = new Set<string>();
  try {
    const raw = await aiPrivateText(blocks.bytes, early);
    if (raw === null) return fail([...early][0] ?? t('The Illustrator data in this file could not be unpacked'));
    const lifted = liftRasters(raw), text = modernText(lifted.text);
    if (!/^\s*%!PS/.test(text)) return fail(t('The Illustrator data in this file is not in a known layout'));
    const boards = aiArtboards(text);
    if (lifted.masks) early.add('opacity mask images');
    const read = await buildAi(text, title, early, { boxes: boards.boxes, names: boards.names, rasters: lifted.bins });
    return { read, why: '' };
  } catch (err) {
    return fail(`${t('The Illustrator data in this file could not be read')} (${err instanceof Error ? err.message : String(err)})`);
  }
}

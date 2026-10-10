import { findNode, newId, nodeLabel, updateNodes } from './doc';
import { cleanData, parseGrid, parseTable } from './graph';
import { plainText, setPlainText } from './text';
import type { DataSet, Doc, GraphData, ImageAsset, Mat, Variable, VariableKind, VariableValue, VNode } from './types';

export const VARIABLE_KINDS: ReadonlyArray<readonly [VariableKind, string]> = [['text', 'Text String'], ['image', 'Linked File'], ['visibility', 'Visibility'], ['graph', 'Graph Data']];

export function kindFits(kind: VariableKind, n: VNode | null): boolean {
  if (!n) return false;
  if (kind === 'text') return n.kind === 'text';
  if (kind === 'image') return n.kind === 'image';
  if (kind === 'graph') return n.kind === 'group' && !!n.graph;
  return n.kind !== 'layer';
}

export function kindFor(n: VNode): VariableKind { return n.kind === 'text' ? 'text' : n.kind === 'image' ? 'image' : n.kind === 'group' && n.graph ? 'graph' : 'visibility'; }

export function uniqueName(doc: Doc, base: string): string {
  const taken = new Set((doc.variables ?? []).map((v) => v.name));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

export function currentValue(doc: Doc, v: Variable): VariableValue | undefined {
  const n = v.node ? findNode(doc, v.node) : null;
  if (!n || !kindFits(v.kind, n)) return undefined;
  if (v.kind === 'text' && n.kind === 'text') return plainText(n);
  if (v.kind === 'image' && n.kind === 'image') return n.link && /^(\/|~|[a-z]:\\|https?:)/i.test(n.link) ? n.link : `asset:${n.src}`;
  if (v.kind === 'graph' && n.kind === 'group' && n.graph) return n.graph.data;
  return !n.hidden;
}

export function captureValues(doc: Doc): Record<string, VariableValue> {
  const out: Record<string, VariableValue> = {};
  for (const v of doc.variables ?? []) { const x = currentValue(doc, v); if (x !== undefined) out[v.id] = x; }
  return out;
}

export interface ResolvedImage { key: string; asset: ImageAsset; name: string }

function fitImage(n: Extract<VNode, { kind: 'image' }>, key: string, a: ImageAsset, name: string): VNode {
  const m = n.xf, ow = Math.hypot(m[0], m[1]) * n.w, oh = Math.hypot(m[2], m[3]) * n.h, k = Math.min(ow / a.w, oh / a.h);
  const ux = { x: m[0] / (Math.hypot(m[0], m[1]) || 1), y: m[1] / (Math.hypot(m[0], m[1]) || 1) }, uy = { x: m[2] / (Math.hypot(m[2], m[3]) || 1), y: m[3] / (Math.hypot(m[2], m[3]) || 1) };
  const dx = (ow - a.w * k) / 2, dy = (oh - a.h * k) / 2;
  const xf: Mat = [ux.x * k, ux.y * k, uy.x * k, uy.y * k, m[4] + ux.x * dx + uy.x * dy, m[5] + ux.y * dx + uy.y * dy];
  return { ...n, src: key, w: a.w, h: a.h, xf, link: name };
}

export function asBool(v: VariableValue): boolean { return typeof v === 'boolean' ? v : !/^(false|0|no|off|hidden|)$/i.test(String(v).trim()); }
export function asGraph(v: VariableValue): GraphData | null {
  const g = typeof v === 'object' && v ? cleanData(v) : typeof v === 'string' && v.trim() ? parseTable(v.replace(/\\t/g, '\t').replace(/\\n/g, '\n').replace(/\|/g, '\n')) : null;
  return g && g.values.some((r) => r.some((x) => x !== null)) ? g : null;
}

export function applyDataSetDoc(doc: Doc, index: number, images: Record<string, ResolvedImage> = {}): Doc {
  const set = doc.dataSets?.[index];
  if (!set) return doc;
  let out: Doc = { ...doc, dataSet: index };
  const extra: Record<string, ImageAsset> = {};
  for (const v of doc.variables ?? []) {
    if (!v.node || !(v.id in set.values)) continue;
    const val = set.values[v.id], n = findNode(out, v.node);
    if (!n || !kindFits(v.kind, n)) continue;
    out = updateNodes(out, [n.id], (x) => {
      if (v.kind === 'text' && x.kind === 'text') { const t = String(val); return plainText(x) === t ? x : { ...x, spans: setPlainText(x, t) }; }
      if (v.kind === 'visibility') { const show = asBool(val); return !x.hidden === show ? x : { ...x, hidden: !show }; }
      if (v.kind === 'graph' && x.kind === 'group' && x.graph) { const g = asGraph(val); return g ? { ...x, graph: { ...x.graph, data: g } } : x; }
      if (v.kind === 'image' && x.kind === 'image') { const r = images[v.id]; if (!r || r.key === x.src) return x; extra[r.key] = r.asset; return fitImage(x, r.key, r.asset, r.name); }
      return x;
    });
  }
  return Object.keys(extra).length ? { ...out, images: { ...out.images, ...extra } } : out;
}

export function variablesFromRows(doc: Doc, header: string[], rows: string[][], nameCol: number | null): { variables: Variable[]; sets: DataSet[] } {
  const vars = [...(doc.variables ?? [])];
  const cols = header.map((h, i) => {
    if (i === nameCol) return null;
    const name = h.trim().replace(/^@/, '') || `Variable${i + 1}`;
    let v = vars.find((x) => x.name === name);
    if (!v) {
      const vals = rows.map((r) => (r[i] ?? '').trim()).filter(Boolean);
      const kind: VariableKind = h.trim().startsWith('@') || (vals.length > 0 && vals.every((x) => /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(x))) ? 'image' : vals.length > 0 && vals.every((x) => /^(true|false|visible|hidden)$/i.test(x)) ? 'visibility' : vals.some((x) => /[|\n]/.test(x) && /\d/.test(x)) ? 'graph' : 'text';
      v = { id: newId('var'), name, kind, node: null };
      vars.push(v);
    }
    return v;
  });
  const sets: DataSet[] = rows.map((r, k) => ({
    id: newId('ds'), name: (nameCol !== null ? r[nameCol] : '') || `Data Set ${(doc.dataSets?.length ?? 0) + k + 1}`,
    values: Object.fromEntries(cols.flatMap((v, i) => (v ? [[v.id, v.kind === 'visibility' ? asBool(r[i] ?? '') : (r[i] ?? '')]] : []))),
  }));
  return { variables: vars, sets };
}

export function parseDataFile(doc: Doc, text: string, kind: 'csv' | 'json'): { variables: Variable[]; sets: DataSet[] } {
  if (kind === 'csv') {
    const g = parseGrid(text);
    if (g.length < 2) throw new Error('The CSV needs a header row of variable names and at least one row of data.');
    const header = g[0], nameCol = header.findIndex((h) => /^(data ?set|name of data ?set|dataset name|#name)$/i.test(h.trim()));
    return variablesFromRows(doc, header, g.slice(1).filter((r) => r.some((c) => c.trim())), nameCol >= 0 ? nameCol : null);
  }
  const raw = JSON.parse(text) as unknown;
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as { dataSets?: unknown }).dataSets) ? (raw as { dataSets: unknown[] }).dataSets : null;
  if (!list) throw new Error('The JSON must be an array of objects (one per data set, keys are variable names) or { "dataSets": [...] }.');
  const declared = raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as { variables?: unknown }).variables) ? (raw as { variables: Array<{ name?: string; kind?: string }> }).variables : [];
  const rows = list.map((o) => (o && typeof o === 'object' ? ((o as { values?: unknown }).values && typeof (o as { values: unknown }).values === 'object' ? { ...(o as { values: Record<string, unknown> }).values, ...((o as { name?: unknown }).name !== undefined ? { '#name': (o as { name: unknown }).name } : {}) } : o as Record<string, unknown>) : {}));
  const header = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  let base = doc;
  for (const d of declared) if (d.name && !(base.variables ?? []).some((v) => v.name === d.name)) base = { ...base, variables: [...(base.variables ?? []), { id: newId('var'), name: d.name, kind: (VARIABLE_KINDS.some((k) => k[0] === d.kind) ? d.kind : 'text') as VariableKind, node: null }] };
  const nameCol = header.indexOf('#name');
  const r = variablesFromRows(base, header, rows.map((o) => header.map((h) => { const v = o[h]; return v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); })), nameCol >= 0 ? nameCol : null);
  for (const s of r.sets) for (const v of r.variables) if (v.kind === 'graph' && typeof s.values[v.id] === 'string' && /^[[{]/.test(String(s.values[v.id]))) { try { const g = JSON.parse(String(s.values[v.id])) as GraphData; if (g && Array.isArray(g.values)) s.values[v.id] = cleanData(g); } catch { } }
  return r;
}

export function boundLabel(doc: Doc, v: Variable): string { const n = v.node ? findNode(doc, v.node) : null; return n ? nodeLabel(n) : ''; }

export function fileStem(doc: Doc, set: DataSet, varName: string | null, index: number): string {
  const v = varName ? (doc.variables ?? []).find((x) => x.name === varName) : null;
  const raw = v ? set.values[v.id] : set.name;
  const s = (typeof raw === 'string' || typeof raw === 'boolean' ? String(raw) : set.name).replace(/[\\/:*?"<>|\n\r\t]+/g, '-').trim().slice(0, 120);
  return s || `data-set-${index + 1}`;
}

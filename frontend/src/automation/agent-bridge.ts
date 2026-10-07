import { geomBounds, selectionBounds, visualBounds } from '../engine/bounds';
import { findNode, nodeLabel, updateNodes } from '../engine/doc';
import { EFFECTS, effectDef, WIDTH_PROFILES } from '../engine/effects';
import { anchor, flatIndex, inflate, isEmptyRect, isLineSeg, segOf, normRect, reflectAbout, rotateAbout, scaleAbout, shearAbout, splitSegmentAt, translate, unflatIndex, mul, emptyRect, unionRect } from '../engine/geometry';
import { collectColors, mapFn, nearestFn, RECOLOR, recolorDoc } from '../engine/ops/recolor';
import { BLACK, fill as fillItem, firstFill, parseColor, paintFromInput, solid, stroke as strokeItem, withFirstFill, withFirstStroke, hex } from '../engine/paint';
import { DEFAULT_CHAR, layoutText, plainText, styleSpans } from '../engine/text';
import { harmonyColors, variations, type HarmonyRule, type Variation } from '../engine/harmony';
import { liveParams, type LivePatch } from '../engine/ops/live-shapes';
import { transformNode } from '../engine/transform';
import { interiorOf, liveFaceNodes, liveFaces } from '../engine/livepaint';
import { addMeshLine, meshPointAt, removeMeshLines } from '../engine/mesh';
import { SYMBOLISM_NAMES, UNIT_PT, type Anchor, type BlendMode, type Color, type Engine, type Mat, type MeshNode, type Paint, type PathData, type PathNode, type Pt, type Rect, type StrokeItem, type SymbolismMethod, type SymbolismOp, type TextNode, type TraceView, type Units, type VNode } from '../engine';
import type { Commands } from '../ui/commands';

export interface McpResult { content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>; structuredContent?: Record<string, unknown>; isError?: boolean }
export interface AgentDeps {
  ask(title: string, text: string): Promise<boolean>;
  note(text: string): void;
  allow(): void;
  openFile(file: File): Promise<void>;
  placeFile(file: File, at: Pt | null, width: number | null): Promise<string | null>;
  projectBlob(): Promise<Blob | null>;
  exportBlob(format: 'svg' | 'pdf' | 'png' | 'jpeg' | 'webp', o: { scope: string; artboard?: number; scale: number; quality: number; transparent: boolean; outlineText: boolean }): Promise<Blob | null>;
  image(scope: string, artboard: number | undefined, maxSize: number, outline: boolean): Promise<Blob | null>;
  svg(scope: string, artboard: number | undefined, ids: string[] | undefined): Promise<string>;
  outlines(ids?: string[]): Promise<boolean>;
  trace(id: string, o: Record<string, unknown>): Promise<string | null>;
  ensureFace?(family: string, style: string): Promise<void>;
}

const text = (t: string, data?: Record<string, unknown>): McpResult => ({ content: [{ type: 'text', text: t }], ...(data ? { structuredContent: data } : {}) });
const fail = (t: string): McpResult => ({ content: [{ type: 'text', text: t }], isError: true });
const sleep = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));
const b64 = async (blob: Blob): Promise<string> => { const b = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const r2 = (v: number): number => Math.round(v * 100) / 100;
const box = (b: Rect | null): Record<string, number> | null => (b && !isEmptyRect(b) ? { x: r2(b.x), y: r2(b.y), width: r2(b.w), height: r2(b.h) } : null);
const SHAPES: Record<string, string> = { rectangle: 'rectangle', rounded_rectangle: 'rounded_rectangle', ellipse: 'ellipse', polygon: 'polygon', star: 'star', line: 'line', arc: 'arc', spiral: 'spiral', flare: 'flare' };

class ToolError extends Error {}

export class AgentBridge {
  private on = false;
  private looping = false;
  commands: Commands | null = null;
  constructor(private readonly engine: Engine, private readonly deps: AgentDeps) {}

  setEnabled(on: boolean): void {
    const was = this.on;
    this.on = on;
    if (!this.looping) void this.loop();
    if (was && !on) void fetch('/api/mcp/bridge/stop', { method: 'POST' }).catch(() => undefined);
  }

  get enabled(): boolean { return this.on; }

  private async loop(): Promise<void> {
    this.looping = true;
    for (;;) {
      try {
        const res = await fetch(`/api/mcp/bridge/next?allowed=${this.on ? 1 : 0}`);
        if (res.status === 200) {
          const item = await res.json() as { id: string; name: string; arguments: Record<string, unknown> };
          if (item.name === '__consent__') {
            const yes = this.on || await this.deps.ask('Allow an outside agent to edit?', 'An AI agent connected to formpth (such as Claude Code, Codex or Cursor) asks to draw in and edit your documents. Each change is one undoable step. You can turn this off in Preferences > Plugins.');
            if (yes && !this.on) { this.on = true; this.deps.allow(); }
            await fetch('/api/mcp/bridge/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, result: { allowed: yes } }) });
            continue;
          }
          const result = this.on ? await this.run(item.name, item.arguments ?? {}) : fail('formpth stopped taking requests.');
          await fetch('/api/mcp/bridge/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, result }) });
        } else if (res.status !== 204) await sleep(2000);
      } catch { await sleep(2000); }
    }
  }

  private ids(a: Record<string, unknown>, key = 'ids'): string[] | undefined {
    const v = a[key];
    if (!Array.isArray(v) || !v.length) { if (!this.engine.hasSelection) throw new ToolError('Nothing is selected: pass ids (from get_document) or select first.'); return undefined; }
    const doc = this.engine.doc, list = v.map(String);
    const missing = list.filter((id) => !doc || !findNode(doc, id));
    if (missing.length) throw new ToolError(`No object has the id ${missing.join(', ')}: call get_document for current ids.`);
    return list;
  }

  private paint(raw: unknown, what: string): Paint {
    const p = paintFromInput(raw, this.engine.doc ?? undefined);
    if (!p) throw new ToolError(`${what} must be a colour (#rrggbb, rgb(), cmyk(), gray(), a swatch name), none, or a gradient {type, angle, stops}.`);
    return p;
  }

  private freeform(o: Record<string, unknown>, ids: string[] | undefined): void {
    const e = this.engine, doc = e.doc, mode = o.mode === 'lines' ? 'lines' : 'points';
    if (!doc) return;
    const targets = ids ?? e.targetIds(), colors = Array.isArray(o.colors) ? o.colors.map((c) => parseColor(String(c))).filter((c): c is Color => !!c) : [];
    if (!Array.isArray(o.points) || !o.points.length) { e.setFreeform(mode, targets, colors.length ? colors : undefined); return; }
    const abs = o.absolute === true, raw = o.points as Array<Record<string, unknown>>;
    e.beginGesture();
    try {
      for (const id of targets) {
        const n = this.node(id), b = geomBounds(doc, n), side = Math.max(b.w, b.h);
        const points = raw.map((q) => {
          const x = Number(q.x ?? 0.5), y = Number(q.y ?? 0.5), sp = q.spread === undefined ? null : Number(q.spread);
          const color = parseColor(String(q.color ?? '#000'));
          if (!color) throw new ToolError(`${String(q.color)} is not a colour.`);
          return { x: abs ? x : b.x + x * b.w, y: abs ? y : b.y + y * b.h, color, spread: sp === null ? side * 0.35 : abs ? sp : sp * side };
        });
        e.setFill({ type: 'gradient', gradient: { kind: 'freeform', stops: [], angle: 0, aspect: 1, geom: null, mode, points } }, [id]);
      }
    } finally { e.endGesture(); }
  }

  private livePaintSummary(id: string): string {
    const g = this.engine.doc ? findNode(this.engine.doc, id) : null;
    if (g?.kind !== 'group' || !g.livePaint) return 'no faces';
    const faces = liveFaces(g), painted = liveFaceNodes(g).length;
    return `${faces.length} face(s), ${painted} painted${faces.length ? `; face centres ${faces.slice(0, 12).map((f) => { const q = interiorOf(f); return `(${Math.round(q.x)}, ${Math.round(q.y)})`; }).join(' ')}` : ''}`;
  }

  private node(id: unknown): VNode {
    const n = this.engine.doc ? findNode(this.engine.doc, String(id ?? '')) : null;
    if (!n) throw new ToolError(`No object has the id ${String(id)}: call get_document for current ids.`);
    return n;
  }

  private origin(a: Record<string, unknown>, b: Rect): Pt {
    const o = a.origin;
    if (Array.isArray(o) && o.length === 2) return { x: Number(o[0]), y: Number(o[1]) };
    const k = typeof o === 'string' ? o : 'center';
    const fx = /left/.test(k) ? 0 : /right/.test(k) ? 1 : 0.5, fy = /top/.test(k) ? 0 : /bottom/.test(k) ? 1 : 0.5;
    return { x: b.x + b.w * fx, y: b.y + b.h * fy };
  }

  private styled(n: VNode, a: Record<string, unknown>): VNode {
    let ap = n.ap;
    if (a.fill !== undefined) ap = withFirstFill(ap, this.paint(a.fill, 'fill'));
    if (a.stroke !== undefined) ap = withFirstStroke(ap, { paint: this.paint(a.stroke, 'stroke') });
    if (typeof a.stroke_width === 'number') ap = withFirstStroke(ap, { width: Math.max(0, a.stroke_width) });
    return { ...n, ap, ...(typeof a.name === 'string' && a.name ? { name: a.name } : {}) };
  }

  private layer(a: Record<string, unknown>): string | undefined {
    if (typeof a.layer !== 'string' || !a.layer) return undefined;
    const n = this.node(a.layer);
    if (n.kind !== 'layer') throw new ToolError(`${a.layer} is not a layer id.`);
    return n.id;
  }

  private describe(n: VNode): Record<string, unknown> {
    const doc = this.engine.doc;
    if (!doc) return {};
    const f = firstFill(n.ap);
    const t = n.kind === 'text' ? { overflow: layoutText(n).overflow >= 0, ...(n.next ? { next: n.next } : {}), ...(n.wrapShape?.length ? { wrapped: true } : {}) } : {};
    return { id: n.id, kind: n.kind, name: nodeLabel(n), bounds: box(geomBounds(doc, n)), fill: f ? (f.paint.type === 'color' ? hex(f.paint.color) : f.paint.type) : undefined, ...t, ...(n.wrap ? { wrap: n.wrap } : {}) };
  }

  async run(name: string, a: Record<string, unknown>): Promise<McpResult> {
    const e = this.engine;
    const num = (k: string, d: number): number => (typeof a[k] === 'number' && Number.isFinite(a[k]) ? a[k] as number : d);
    const str = (k: string, d = ''): string => (typeof a[k] === 'string' ? a[k] as string : d);
    const has = (k: string): boolean => a[k] !== undefined && a[k] !== null;
    const step = name !== 'undo' && name !== 'redo';
    if (step) e.beginStep();
    try {
      if (name === 'new_document') {
        const units = (str('units', 'pt') as Units), k = UNIT_PT[units] ?? 1;
        const p = e.newDocument(num('width', 612) * k, num('height', 792) * k, { title: str('name') || 'Untitled', units, colorMode: str('color_mode') === 'cmyk' ? 'cmyk' : 'rgb', artboards: Math.round(num('artboards', 1)) });
        const ab = p.doc.artboards[0];
        return text(`Opened ${p.name}: ${p.doc.artboards.length} artboard${p.doc.artboards.length === 1 ? '' : 's'} of ${r2(ab.w)} by ${r2(ab.h)} pt.`, { name: p.name, artboards: p.doc.artboards.map((x) => ({ x: x.x, y: x.y, width: x.w, height: x.h })), layer: p.activeLayer });
      }
      if (name === '__open') {
        const bytes = Uint8Array.from(atob(str('data')), (c) => c.charCodeAt(0)), file = new File([bytes], str('name'));
        await this.deps.openFile(file);
        const q = e.current;
        return q ? text(`Opened ${file.name} as ${q.name}: ${q.doc.artboards.length} artboard(s), ${q.doc.layers.length} layer(s).`, { name: q.name }) : fail(`Could not open ${file.name}.`);
      }
      if (name === 'list_commands') {
        const c = this.commands, needle = str('filter').toLowerCase();
        const list = (c?.all() ?? []).filter((x) => !x.id.startsWith('plugin:')).map((x) => ({ id: x.id, label: c?.label(x) ?? x.id, enabled: c?.enabled(x) ?? false })).filter((x) => !needle || x.id.includes(needle) || x.label.toLowerCase().includes(needle));
        return text(list.map((x) => `${x.id}: ${x.label}${x.enabled ? '' : ' (not available now)'}`).join('\n') || 'No commands match.', { commands: list });
      }
      if (name === 'run_command') {
        const c = this.commands, id = str('command'), cmd = c?.get(id);
        if (!cmd) return fail(`There is no command ${id}: call list_commands.`);
        if (!c?.enabled(cmd)) return fail(`${c?.label(cmd)} is not available now (it may need a selection or an open document).`);
        c.run(id);
        return text(`Ran ${c.label(cmd).replace(/\.\.\.$/, '')}.`);
      }
      const p = e.current;
      if (!p) return fail('No document is open: call new_document or open_file first.');
      switch (name) {
        case 'get_document': { const d = e.describe(Math.max(1, Math.min(32, Math.round(num('depth', 8))))); return text(JSON.stringify(d), d); }
        case 'get_image': {
          const blob = await this.deps.image(str('scope', 'artboard'), has('artboard') ? Math.round(num('artboard', 0)) : undefined, Math.max(64, Math.min(2048, Math.round(num('max_size', 1024)))), a.outline === true);
          if (!blob) return fail('There is nothing to show in that scope.');
          return { content: [{ type: 'image', data: await b64(blob), mimeType: 'image/png' }, { type: 'text', text: `The ${str('scope', 'artboard')} as it looks now.` }] };
        }
        case 'get_svg': { const s = await this.deps.svg(str('scope', 'artboard'), has('artboard') ? Math.round(num('artboard', 0)) : undefined, Array.isArray(a.ids) ? a.ids.map(String) : undefined); return text(s.length > 200000 ? `${s.slice(0, 200000)}\n<!-- truncated -->` : s); }
        case 'get_object': { const n = this.node(a.id); const out = { ...JSON.parse(JSON.stringify(n)) as Record<string, unknown>, bounds: box(geomBounds(p.doc, n)), visual_bounds: box(visualBounds(p.doc, n)), ...(n.kind === 'text' ? { text: plainText(n), overflow: layoutText(n).overflow >= 0 } : {}), ...(n.kind === 'path' && n.live ? { shape: { kind: n.live.kind, ...liveParams(n.live) } } : {}) }; return text(JSON.stringify(out).slice(0, 100000), out); }
        case '__place': {
          const bytes = Uint8Array.from(atob(str('data')), (c) => c.charCodeAt(0)), file = new File([bytes], str('name'));
          const id = await this.deps.placeFile(file, has('x') && has('y') ? { x: num('x', 0), y: num('y', 0) } : null, has('width') ? num('width', 100) : null);
          return id ? text(`Placed ${file.name} (id ${id}).`, { id }) : fail(`Could not place ${file.name}.`);
        }
        case '__project': { const blob = await this.deps.projectBlob(); return blob ? text('Packed the project.', { data: await b64(blob) }) : fail('Could not pack the project: is the engine running (./formpth boot)?'); }
        case '__export': {
          const fmt = str('format') as 'svg' | 'pdf' | 'png' | 'jpeg' | 'webp';
          const blob = await this.deps.exportBlob(fmt, { scope: str('scope', fmt === 'pdf' ? 'all_artboards' : 'artboard'), artboard: has('artboard') ? Math.round(num('artboard', 0)) : undefined, scale: Math.max(0.01, Math.min(16, num('scale', 1))), quality: Math.max(0.05, Math.min(1, num('quality', 0.92))), transparent: a.transparent === true, outlineText: a.outline_text === true });
          return blob ? text(`Exported ${fmt.toUpperCase()}.`, { data: await b64(blob) }) : fail('There was nothing to export in that scope.');
        }
        case 'switch_document': {
          const q = has('index') ? e.projects[Math.round(num('index', 0))] : e.projects.find((x) => x.name === str('name'));
          if (!q) return fail(`No open document matches: ${e.projects.map((x, i) => `${i} ${x.name}`).join(', ')}.`);
          e.switchTo(q.id);
          return text(`Switched to ${q.name}.`);
        }
        case 'document_setup': {
          const patch: Parameters<Engine['documentSetup']>[0] = {};
          if (has('units')) patch.units = str('units') as Units;
          if (has('color_mode')) patch.colorMode = str('color_mode') === 'cmyk' ? 'cmyk' : 'rgb';
          if (has('title')) patch.title = str('title');
          e.documentSetup(patch);
          return text('Updated the document setup.');
        }
        case 'select': {
          if (a.none === true) { e.deselect(); return text('Deselected.'); }
          if (a.all === true) e.selectAll();
          else if (a.inverse === true) e.selectInverse();
          else if (a.rect && typeof a.rect === 'object') { const r = a.rect as Record<string, number>; e.selectInRect({ x: Number(r.x) || 0, y: Number(r.y) || 0, w: Number(r.width) || 0, h: Number(r.height) || 0 }, (str('mode', 'replace') as 'replace'), false); }
          else if (Array.isArray(a.ids)) { const ids = a.ids.map(String).filter((id) => findNode(p.doc, id)); e.select(ids, str('mode', 'replace') as 'replace'); }
          const sel = e.selectedIds();
          return text(`${sel.length} object${sel.length === 1 ? '' : 's'} selected.`, { selection: sel, bounds: box(e.selectionBounds()) });
        }
        case 'select_same': { e.selectSame(str('attribute'), has('id') ? String(this.node(a.id).id) : undefined); const sel = e.selectedIds(); return text(`${sel.length} objects selected.`, { selection: sel }); }
        case 'draw_path': {
          let d: PathData;
          if (typeof a.d === 'string' && a.d.trim()) d = e.pathFromSvg(a.d);
          else if (Array.isArray(a.points) && a.points.length >= 2) d = e.pathFromPoints(a.points.map((q) => (Array.isArray(q) ? { x: Number(q[0]), y: Number(q[1]) } : { x: Number((q as Pt).x), y: Number((q as Pt).y) })), a.smooth === true, a.closed === true, 1);
          else return fail('Give d (an SVG path) or at least two points.');
          if (has('closed') && typeof a.d === 'string') d = d.map((sp) => ({ ...sp, closed: a.closed === true }));
          if (!d.length || d.every((sp) => sp.pts.length < 2)) return fail('That path has no segments.');
          const n = this.styled(e.makePath(d), a);
          const [id] = e.addNodes('Draw Path', [n], { layer: this.layer(a) });
          return text(`Drew a path (id ${id}).`, this.describe(this.node(id)));
        }
        case 'draw_shape': {
          const shape = str('shape'), x = num('x', 0), y = num('y', 0), w = num('width', 100), h = num('height', has('width') ? num('width', 100) : 100);
          let n: VNode;
          if (shape === 'rectangular_grid' || shape === 'polar_grid') n = e.gridGroup(shape === 'polar_grid' ? 'polar' : 'rectangular', x, y, w, h, Math.max(1, Math.round(num('rows', 5))), Math.max(1, Math.round(num('columns', 5))));
          else {
            const kind = SHAPES[shape];
            if (!kind) return fail(`Unknown shape ${shape}.`);
            n = e.shapePath(kind, x, y, w, h, { radius: has('corner_radius') ? num('corner_radius', 0) : undefined, sides: has('sides') ? Math.max(3, Math.round(num('sides', 6))) : undefined, points: has('points') ? Math.max(3, Math.round(num('points', 5))) : undefined, ratio: has('inner_ratio') ? num('inner_ratio', 0.5) : undefined, turns: has('turns') ? num('turns', 3) : undefined, x2: has('x2') ? num('x2', x + w) : undefined, y2: has('y2') ? num('y2', y + h) : undefined });
          }
          if (has('rotation') && num('rotation', 0)) { const b = geomBounds(p.doc, n); n = transformNode(n, rotateAbout(-num('rotation', 0), b.x + b.w / 2, b.y + b.h / 2)); }
          n = this.styled(n, a);
          const [id] = e.addNodes(`Draw ${shape.replace(/_/g, ' ')}`, [n], { layer: this.layer(a) });
          return text(`Drew ${/^[aeiou]/.test(shape) ? 'an' : 'a'} ${shape.replace(/_/g, ' ')} (id ${id}).`, this.describe(this.node(id)));
        }
        case 'add_text': {
          const mode = (str('mode', 'point') as 'point' | 'area' | 'path');
          const style: Partial<typeof DEFAULT_CHAR> = { ...(has('font') ? { font: str('font') } : {}), ...(has('style') ? { style: /^\d{3}$/.test(str('style')) ? `${str('style')}` : str('style') } : {}), ...(has('size') ? { size: Math.max(0.1, num('size', 12)) } : {}), fill: has('color') ? this.paint(a.color, 'color') : solid(BLACK), ...(has('leading') ? { leading: num('leading', 14) } : {}), ...(has('tracking') ? { tracking: num('tracking', 0) } : {}) };
          let path: PathData | undefined;
          if (mode === 'path') { const src = this.node(a.path_id); if (src.kind !== 'path') return fail('path_id must be a path.'); path = src.d; }
          const id = e.addText(str('text'), num('x', 0), num('y', 0), { mode, width: num('width', 200), height: num('height', 100), path, style, para: has('align') ? { align: str('align') as 'left' } : undefined, name: str('name') || undefined, layer: this.layer(a) });
          if (!id) return fail('Could not add the type.');
          return text(`Added ${mode} type (id ${id}).`, this.describe(this.node(id)));
        }
        case 'edit_anchors': {
          const n = this.node(a.id);
          if (n.kind !== 'path') return fail('edit_anchors works on paths: create_outlines or expand first.');
          const act = str('action'), idx = new Set((Array.isArray(a.indices) ? a.indices : []).map(Number));
          let d = n.d;
          const map = (f: (a0: Anchor, k: number, sp: number, i: number) => Anchor): PathData => { let k = 0; return d.map((sp, s) => ({ ...sp, pts: sp.pts.map((q, i) => f(q, k++, s, i)) })); };
          if (act === 'move') { const dx = num('dx', 0), dy = num('dy', 0); d = map((q, k) => (idx.has(k) || !idx.size ? { ...q, x: q.x + dx, y: q.y + dy, ix: q.ix + dx, iy: q.iy + dy, ox: q.ox + dx, oy: q.oy + dy } : q)); }
          else if (act === 'replace') {
            const list = Array.isArray(a.anchors) ? a.anchors : [];
            const pts = list.map((q) => { if (Array.isArray(q)) return anchor(Number(q[0]), Number(q[1])); const o = q as { x: number; y: number; in?: number[]; out?: number[] }; return anchor(o.x, o.y, o.in?.[0] ?? o.x, o.in?.[1] ?? o.y, o.out?.[0] ?? o.x, o.out?.[1] ?? o.y); });
            if (pts.length < 2) return fail('replace needs at least two anchors.');
            d = [{ closed: a.closed === true, pts }];
          } else if (act === 'insert') {
            const seg = Math.round(num('segment', 0)), t = Math.max(0.001, Math.min(0.999, num('t', 0.5)));
            const u = unflatIndex(d, seg);
            if (!u) return fail(`segment must be 0..${d.reduce((s, sp) => s + sp.pts.length, 0) - 1}.`);
            const sp0 = d[u[0]], line = isLineSeg(segOf(sp0.pts[u[1]], sp0.pts[(u[1] + 1) % sp0.pts.length]));
            d = d.map((sp, s) => (s === u[0] ? splitSegmentAt(sp, u[1], line ? 0.5 - Math.sin(Math.asin(1 - 2 * t) / 3) : t) : sp));
          } else if (act === 'delete') d = d.map((sp, s) => ({ ...sp, pts: sp.pts.filter((_, i) => !idx.has(flatIndex(d, s, i))) })).filter((sp) => sp.pts.length > 0);
          else if (act === 'corner') d = map((q, k) => (idx.has(k) || !idx.size ? { ...q, ix: q.x, iy: q.y, ox: q.x, oy: q.y, smooth: false } : q));
          else if (act === 'smooth') d = map((q, k, s, i) => {
            if (idx.size && !idx.has(k)) return q;
            const sp = d[s], n0 = sp.pts.length, prev = sp.pts[(i - 1 + n0) % n0], next = sp.pts[(i + 1) % n0];
            if ((!sp.closed && (i === 0 || i === n0 - 1)) || n0 < 3) return q;
            const tx = (next.x - prev.x) / 6, ty = (next.y - prev.y) / 6;
            return { ...q, ix: q.x - tx, iy: q.y - ty, ox: q.x + tx, oy: q.y + ty, smooth: true };
          });
          else return fail('action must be move, replace, insert, delete, smooth or corner.');
          e.edit('Edit Anchors', (doc) => updateNodes(doc, [n.id], (x) => (x.kind === 'path' ? { ...x, d, live: undefined } : x)));
          return text(`Edited the anchors of ${n.id}: now ${d.reduce((s, sp) => s + sp.pts.length, 0)} anchors.`);
        }
        case 'set_paint': {
          const ids = this.ids(a), ff = a.fill && typeof a.fill === 'object' && (a.fill as { type?: string }).type === 'freeform' ? a.fill as Record<string, unknown> : null;
          if (ff) this.freeform(ff, ids);
          else if (has('fill')) e.setFill(this.paint(a.fill, 'fill'), ids);
          if (has('stroke')) e.setStroke({ paint: this.paint(a.stroke, 'stroke') }, ids);
          return text('Painted.');
        }
        case 'set_stroke': {
          const ids = this.ids(a), patch: Partial<StrokeItem> = {};
          if (has('width')) patch.width = Math.max(0, num('width', 1));
          if (has('cap')) patch.cap = str('cap') as StrokeItem['cap'];
          if (has('join')) patch.join = str('join') as StrokeItem['join'];
          if (has('miter_limit')) patch.miter = num('miter_limit', 10);
          if (has('align')) patch.align = str('align') as StrokeItem['align'];
          if (Array.isArray(a.dash)) patch.dash = a.dash.map(Number).filter((v) => Number.isFinite(v) && v >= 0);
          if (has('dash_offset')) patch.dashOffset = num('dash_offset', 0);
          if (has('dash_align_corners')) patch.dashCorners = a.dash_align_corners === true;
          if (has('start_arrow')) patch.startArrow = str('start_arrow');
          if (has('end_arrow')) patch.endArrow = str('end_arrow');
          if (has('arrow_scale')) patch.arrowScale = [num('arrow_scale', 100), num('arrow_scale', 100)];
          if (Object.keys(patch).length) e.setStroke(patch, ids);
          if (has('profile')) { if (!WIDTH_PROFILES[str('profile')]) return fail(`profile must be one of ${Object.keys(WIDTH_PROFILES).join(', ')}.`); e.setWidthProfile(str('profile'), ids); }
          return text('Set the stroke.');
        }
        case 'set_appearance': {
          const ids = this.ids(a);
          if (has('opacity') || has('blend_mode')) e.setObjectProps({ ...(has('opacity') ? { opacity: Math.max(0, Math.min(1, num('opacity', 1) > 1 ? num('opacity', 100) / 100 : num('opacity', 1))) } : {}), ...(has('blend_mode') ? { blend: str('blend_mode') as BlendMode } : {}) }, ids);
          if (a.clear === true) e.editAppearance('Clear Appearance', () => ({ items: [], effects: [] }), ids);
          if (a.reduce_to_basic === true) e.editAppearance('Reduce to Basic Appearance', (ap) => { const f = ap.items.find((i) => i.kind === 'fill'), s = ap.items.find((i) => i.kind === 'stroke'); return { items: [...(f ? [f] : []), ...(s ? [s] : [])], effects: [] }; }, ids);
          if (has('add_fill')) { const pt = this.paint(a.add_fill, 'add_fill'); e.editAppearance('Add New Fill', (ap) => ({ ...ap, items: [...ap.items, fillItem(pt)] }), ids); }
          if (a.add_stroke && typeof a.add_stroke === 'object') { const s = a.add_stroke as Record<string, unknown>; const it = strokeItem(this.paint(s.color ?? '#000000', 'add_stroke.color'), Number(s.width ?? 1), { ...(s.dash ? { dash: (s.dash as number[]).map(Number) } : {}), ...(s.align ? { align: s.align as StrokeItem['align'] } : {}) }); e.editAppearance('Add New Stroke', (ap) => ({ ...ap, items: [...ap.items, it] }), ids); }
          if (Array.isArray(a.items)) {
            const items = a.items.map((raw) => { const o = raw as Record<string, unknown>; const paint = this.paint(o.color ?? 'none', 'items[].color'); if (o.kind === 'stroke') return strokeItem(paint, Number(o.width ?? 1), { opacity: Number(o.opacity ?? 1), blend: (o.blend_mode as BlendMode) ?? 'normal', visible: o.visible !== false, ...(o.dash ? { dash: (o.dash as number[]).map(Number) } : {}), ...(o.cap ? { cap: o.cap as StrokeItem['cap'] } : {}), ...(o.join ? { join: o.join as StrokeItem['join'] } : {}), ...(o.align ? { align: o.align as StrokeItem['align'] } : {}) }); return { ...fillItem(paint, Number(o.opacity ?? 1), (o.blend_mode as BlendMode) ?? 'normal'), visible: o.visible !== false }; });
            e.editAppearance('Appearance', (ap) => ({ ...ap, items }), ids);
          }
          return text('Updated the appearance.');
        }
        case 'add_swatch': { const pt = this.paint(a.color, 'color'); const id = e.addSwatch(str('name') || 'Swatch', pt, a.global === true, a.spot === true, str('group') || undefined); return text(`Added the swatch ${str('name')} (id ${id}).`, { id }); }
        case 'graphic_style': {
          const act = str('action');
          if (act === 'list') { const list = p.doc.styles.map((s) => ({ id: s.id, name: s.name })); return text(list.map((s) => `${s.id}: ${s.name}`).join('\n'), { styles: list }); }
          if (act === 'create') { const src = Array.isArray(a.ids) && a.ids.length ? String(a.ids[0]) : undefined; const id = e.addGraphicStyle(str('name') || 'Graphic Style', src); return id ? text(`Made the graphic style ${str('name')} (id ${id}).`, { id }) : fail('Select or pass the object whose look to keep.'); }
          if (act === 'apply') { const st = p.doc.styles.find((s) => s.id === str('id') || s.name === str('name') || s.name === str('id')); if (!st) return fail('No graphic style matches: call graphic_style with action list.'); e.applyGraphicStyle(st.id, this.ids(a)); return text(`Applied ${st.name}.`); }
          if (act === 'delete') { const st = p.doc.styles.find((s) => s.id === str('id') || s.name === str('name')); if (!st) return fail('No graphic style matches.'); e.edit('Delete Graphic Style', (d) => ({ ...d, styles: d.styles.filter((s) => s.id !== st.id) })); return text(`Deleted ${st.name}.`); }
          return fail('action must be create, apply, list or delete.');
        }
        case 'set_object': {
          const ids = this.ids(a);
          e.setObjectProps({ ...(has('name') ? { name: str('name') } : {}), ...(has('visible') ? { hidden: a.visible !== true } : {}), ...(has('locked') ? { locked: a.locked === true } : {}), ...(has('opacity') ? { opacity: Math.max(0, Math.min(1, num('opacity', 1) > 1 ? num('opacity', 100) / 100 : num('opacity', 1))) } : {}), ...(has('blend_mode') ? { blend: str('blend_mode') as BlendMode } : {}) }, ids);
          return text('Updated the objects.');
        }
        case 'arrange': { e.arrange(str('order') as 'bring_to_front', this.ids(a)); return text('Rearranged.'); }
        case 'group': { const ok = str('action', 'group') === 'ungroup' ? e.ungroup(this.ids(a)) : e.group(this.ids(a)); return ok ? text(str('action', 'group') === 'ungroup' ? 'Ungrouped.' : `Grouped (id ${e.selectedIds()[0]}).`, { selection: e.selectedIds(), ...(str('action', 'group') === 'ungroup' ? {} : { id: e.selectedIds()[0] }) }) : fail('Nothing changed: check the ids.'); }
        case 'compound_path': { const ok = str('action', 'make') === 'release' ? e.releaseCompound(this.ids(a)) : e.makeCompound(this.ids(a), has('rule') ? (str('rule') as 'nonzero') : undefined); return ok ? text('Done.', { selection: e.selectedIds() }) : fail('Nothing changed: compound paths need paths.'); }
        case 'clipping_mask': { const ok = str('action', 'make') === 'release' ? e.releaseClip(this.ids(a)) : e.makeClip(this.ids(a)); return ok ? text('Done: the topmost object clips the others.', { selection: e.selectedIds() }) : fail('Nothing changed: select two or more objects, the clipping shape on top.'); }
        case 'delete_objects': { const ids = this.ids(a); e.deleteSelection(ids ?? e.targetIds()); return text('Deleted.'); }
        case 'duplicate_objects': { e.duplicate(num('dx', 0), num('dy', 0), this.ids(a)); return text(`Duplicated: ${e.selectedIds().join(', ')}.`, { ids: e.selectedIds() }); }
        case 'add_layer': { const id = e.addLayer(str('name') || undefined, { above: str('above') || undefined, sublayerOf: str('sublayer_of') || undefined }); return text(`Added the layer (id ${id}).`, { id }); }
        case 'set_layer': {
          const l = this.node(a.id);
          if (l.kind !== 'layer') return fail(`${l.id} is not a layer.`);
          const patch: Parameters<Engine['setLayer']>[1] = {};
          if (has('name')) patch.name = str('name');
          if (has('visible')) patch.hidden = a.visible !== true;
          if (has('locked')) patch.locked = a.locked === true;
          if (has('printable')) patch.printable = a.printable === true;
          if (has('template')) patch.template = a.template === true;
          if (Object.keys(patch).length) e.setLayer(l.id, patch);
          if (a.active === true) e.setActiveLayer(l.id);
          return text('Updated the layer.');
        }
        case 'delete_layer': { const l = this.node(a.id); if (l.kind !== 'layer') return fail(`${l.id} is not a layer.`); e.deleteLayer(l.id); return text('Deleted the layer.'); }
        case 'move_to_layer': { const l = this.node(a.layer); if (l.kind !== 'layer') return fail(`${l.id} is not a layer.`); e.moveToLayer(l.id, this.ids(a)); return text(`Moved to ${nodeLabel(l)}.`); }
        case 'transform': {
          const ids = this.ids(a) ?? e.targetIds();
          const b = selectionBounds(p.doc, ids.map((id) => findNode(p.doc, id) as VNode));
          if (isEmptyRect(b)) return fail('Those objects have no bounds.');
          const make = (bb: Rect): Mat => {
            const o = this.origin(a, bb);
            let m: Mat = [1, 0, 0, 1, 0, 0];
            const sx = has('scale') ? num('scale', 100) / 100 : has('scale_x') ? num('scale_x', 100) / 100 : has('width') && bb.w > 1e-9 ? num('width', bb.w) / bb.w : 1;
            const sy = has('scale') ? num('scale', 100) / 100 : has('scale_y') ? num('scale_y', 100) / 100 : has('height') && bb.h > 1e-9 ? num('height', bb.h) / bb.h : 1;
            if (sx !== 1 || sy !== 1) m = mul(scaleAbout(sx, sy, o.x, o.y), m);
            if (has('rotate')) m = mul(rotateAbout(-num('rotate', 0), o.x, o.y), m);
            if (has('shear')) m = mul(shearAbout(num('shear', 0), (str('shear_axis', 'horizontal') as 'horizontal'), o.x, o.y), m);
            if (has('reflect')) m = mul(reflectAbout(str('reflect') === 'vertical' ? 'vertical' : 'horizontal', o.x, o.y), m);
            if (has('x') || has('y')) m = mul(translate(has('x') ? num('x', bb.x) - bb.x : 0, has('y') ? num('y', bb.y) - bb.y : 0), m);
            if (has('dx') || has('dy')) m = mul(translate(num('dx', 0), num('dy', 0)), m);
            return m;
          };
          if (has('scale_strokes')) e.setView({ scaleStrokes: a.scale_strokes === true });
          const ok = a.each === true ? e.transformEach(make, { copy: a.copy === true, ids }) : e.transform(make(b), { copy: a.copy === true, ids });
          return ok ? text(`Transformed; bounds now ${JSON.stringify(box(e.selectionBounds(false)))}.`, { selection: e.selectedIds(), bounds: box(e.selectionBounds(false)) }) : fail('Nothing changed.');
        }
        case 'align': { const ok = e.align(str('action') as 'left', (str('to', 'selection') as 'selection'), has('key') ? String(this.node(a.key).id) : null, has('spacing') ? num('spacing', 0) : null, this.ids(a)); return ok ? text('Aligned.') : fail('Nothing moved: align needs two or more objects, or to: artboard.'); }
        case 'pathfinder': { const ok = e.pathfinder(str('operation') as 'unite', this.ids(a)); return ok ? text(`Pathfinder ${str('operation')} done.`, { selection: e.selectedIds() }) : fail('Nothing changed: Pathfinder needs two or more overlapping shapes (crop, divide and outline can take one).'); }
        case 'path_operation': {
          const op = str('operation') as Parameters<Engine['pathOp']>[0];
          const ok = e.pathOp(op, { offset: has('offset') ? num('offset', 10) : undefined, joins: has('joins') ? (str('joins') as 'miter') : undefined, miterLimit: has('miter_limit') ? num('miter_limit', 4) : undefined, precision: has('precision') ? num('precision', 50) : undefined, axis: has('axis') ? (str('axis') as 'both') : undefined, rows: has('rows') ? Math.round(num('rows', 2)) : undefined, columns: has('columns') ? Math.round(num('columns', 2)) : undefined, gutter: has('gutter') ? num('gutter', 10) : undefined }, this.ids(a));
          return ok ? text(`${op.replace(/_/g, ' ')} done.`, { selection: e.selectedIds() }) : fail('Nothing changed: check that the objects are paths.');
        }
        case 'shape_builder': {
          const pts = (Array.isArray(a.points) ? a.points : []).map((q) => (Array.isArray(q) ? { x: Number(q[0]), y: Number(q[1]) } : { x: Number((q as Pt).x), y: Number((q as Pt).y) }));
          if (!pts.length) return fail('Give points inside the regions to merge.');
          const ok = e.shapeBuild(pts, a.delete === true, this.ids(a));
          return ok ? text(a.delete === true ? 'Deleted the regions.' : 'Merged the regions.', { selection: e.selectedIds() }) : fail('No region of the shapes lies under those points.');
        }
        case 'apply_effect': {
          if (a.list === true || !has('effect')) { const list = EFFECTS.map((x) => ({ id: x.id, label: x.label, menu: x.menu, params: x.params.map((q) => ({ key: q.key, kind: q.kind, default: q.def, ...(q.min !== undefined ? { min: q.min, max: q.max } : {}), ...(q.choices ? { choices: q.choices } : {}) })) })); return text(list.map((x) => `${x.id} (${x.menu} > ${x.label}): ${x.params.map((q) => q.key).join(', ')}`).join('\n'), { effects: list }); }
          const id = str('effect');
          if (!effectDef(id)) return fail(`There is no effect ${id}: call apply_effect with list true.`);
          const ok = e.addEffect(id, (a.params && typeof a.params === 'object' ? a.params : {}) as Record<string, number | string | boolean>, this.ids(a));
          return ok ? text(`Applied ${effectDef(id)?.label}; it stays editable until expanded.`) : fail('Nothing changed.');
        }
        case 'expand': { const ok = e.expand(str('what', 'all') as 'all', this.ids(a)); return ok ? text('Expanded to plain objects.', { selection: e.selectedIds() }) : fail('Nothing to expand.'); }
        case 'make_blend': {
          const act = str('action', 'make');
          if (act === 'release') return e.releaseLive(this.ids(a)) ? text('Released the blend.') : fail('Select a blend.');
          if (act === 'expand') return e.expand('object', this.ids(a)) ? text('Expanded the blend.') : fail('Select a blend.');
          if (act === 'options') return e.setBlendSpec({ ...(has('spacing') ? { spacing: str('spacing') as 'smooth' } : {}), ...(has('steps') ? { steps: Math.max(1, Math.round(num('steps', 8))) } : {}), ...(has('distance') ? { distance: num('distance', 10) } : {}), ...(has('align_to_path') ? { alignToPath: a.align_to_path === true } : {}) }, this.ids(a)) ? text('Changed the blend options.') : fail('Select a blend.');
          const ok = e.makeBlend(has('steps') ? Math.max(1, Math.round(num('steps', 8))) : undefined, (str('spacing', 'steps') as 'steps'), num('distance', 10), this.ids(a));
          return ok ? text(`Made a blend (id ${e.selectedIds()[0]}).`, { id: e.selectedIds()[0] }) : fail('Blends need two or more objects.');
        }
        case 'envelope': {
          const act = str('action');
          if (act === 'release') return e.releaseLive(this.ids(a)) ? text('Released the envelope.') : fail('Select an envelope.');
          if (act === 'expand') return e.expand('object', this.ids(a)) ? text('Expanded the envelope.') : fail('Select an envelope.');
          const ok = act === 'top_object' ? e.makeEnvelope('top', this.ids(a)) : act === 'mesh' ? e.makeEnvelope({ kind: 'mesh', rows: Math.max(1, Math.round(num('rows', 2))), cols: Math.max(1, Math.round(num('columns', 2))), points: [] }, this.ids(a)) : e.makeEnvelope({ kind: 'warp', style: str('style', 'arc'), bend: num('bend', 50), h: num('horizontal', 0), v: num('vertical', 0), vertical: a.vertical_orientation === true }, this.ids(a));
          return ok ? text(`Made an envelope (id ${e.selectedIds()[0]}).`, { id: e.selectedIds()[0] }) : fail('Nothing changed: top_object needs the shape on top of the art.');
        }
        case 'repeat': {
          const kind = str('kind');
          if (kind === 'release') return e.releaseLive(this.ids(a)) ? text('Released the repeat.') : fail('Select a repeat.');
          if (kind === 'expand') return e.expand('object', this.ids(a)) ? text('Expanded the repeat.') : fail('Select a repeat.');
          const sel = e.selected()[0];
          if (sel?.kind === 'repeat' && !Array.isArray(a.ids)) { e.setRepeatSpec({ ...(has('instances') ? { instances: Math.round(num('instances', 8)) } : {}), ...(has('radius') ? { radius: num('radius', 100) } : {}), ...(has('rows') ? { rows: Math.round(num('rows', 3)) } : {}), ...(has('columns') ? { cols: Math.round(num('columns', 3)) } : {}), ...(has('h_spacing') ? { hs: num('h_spacing', 10) } : {}), ...(has('v_spacing') ? { vs: num('v_spacing', 10) } : {}), ...(has('angle') ? { angle: num('angle', 90) } : {}) }); return text('Changed the repeat options.'); }
          const ok = e.makeRepeat(kind as 'radial', { instances: has('instances') ? Math.round(num('instances', 8)) : undefined, radius: has('radius') ? num('radius', 100) : undefined, rows: has('rows') ? Math.round(num('rows', 3)) : undefined, cols: has('columns') ? Math.round(num('columns', 3)) : undefined, hs: has('h_spacing') ? num('h_spacing', 10) : undefined, vs: has('v_spacing') ? num('v_spacing', 10) : undefined, angle: has('angle') ? num('angle', 90) : undefined }, this.ids(a));
          return ok ? text(`Made a ${kind} repeat (id ${e.selectedIds()[0]}).`, { id: e.selectedIds()[0] }) : fail('Nothing changed.');
        }
        case 'symbol': {
          const act = str('action');
          if (act === 'list') { const list = p.doc.symbols.map((s) => ({ id: s.id, name: s.name })); return text(list.map((s) => `${s.id}: ${s.name}`).join('\n') || 'No symbols yet.', { symbols: list }); }
          if (act === 'create') { const id = e.makeSymbol(str('name') || `Symbol ${p.doc.symbols.length + 1}`, this.ids(a)); return id ? text(`Made the symbol (id ${id}); the art became an instance.`, { id, instance: e.selectedIds()[0] }) : fail('Select art to make a symbol from.'); }
          const sym = p.doc.symbols.find((s) => s.id === str('name') || s.name === str('name'));
          if (act === 'place') { if (!sym) return fail('No symbol has that name: call symbol with action list.'); const id = e.placeSymbol(sym.id, { x: num('x', 0), y: num('y', 0) }, num('scale', 1)); return text(`Placed ${sym.name} (id ${id}).`, { id }); }
          if (act === 'break_link') { e.breakSymbolLink(this.ids(a)); return text('Broke the link to the symbol.'); }
          if (act === 'replace') { if (!sym) return fail('Name the replacement symbol.'); const ids = this.ids(a) ?? e.targetIds(); e.edit('Replace Symbol', (d) => updateNodes(d, ids, (n) => (n.kind === 'symbol' ? { ...n, symbol: sym.id } : n))); return text(`Replaced with ${sym.name}.`); }
          if (act === 'delete') { if (!sym) return fail('Name the symbol.'); e.edit('Delete Symbol', (d) => ({ ...d, symbols: d.symbols.filter((s) => s.id !== sym.id) })); return text(`Deleted ${sym.name}.`); }
          return fail('action must be create, place, list, break_link, replace or delete.');
        }
        case 'apply_brush': {
          if (a.list === true) { const list = p.doc.brushes.map((b) => ({ id: b.id, name: b.name, type: b.brush.type })); return text(list.map((b) => `${b.name} (${b.type})`).join('\n'), { brushes: list }); }
          const ok = e.applyBrush(has('brush') && str('brush') !== 'none' ? str('brush') : null, this.ids(a));
          return ok ? text('Applied the brush.') : fail('Nothing changed.');
        }
        case 'image_trace': {
          const target = has('id') ? this.node(a.id) : e.selected().find((n) => n.kind === 'image' || (n.kind === 'group' && !!n.trace));
          const live = target?.kind === 'group' && !!target.trace;
          if (!target || (target.kind !== 'image' && !live)) return fail('Pass the id of a placed image or of an image tracing object.');
          const act = str('action', 'trace');
          if (act === 'expand' || act === 'release') {
            if (!live) return fail(`${act} needs an image tracing object; trace the image first.`);
            const ok = act === 'expand' ? e.expandTrace([target.id]) : e.releaseTrace([target.id]);
            return ok ? text(act === 'expand' ? `Expanded into ordinary paths (group ${target.id}).` : `Released the image (id ${e.selectedIds()[0] ?? ''}).`, { id: act === 'expand' ? target.id : e.selectedIds()[0] }) : fail('Nothing changed.');
          }
          if (live && has('view') && Object.keys(a).every((k) => k === 'id' || k === 'view' || k === 'action')) return e.setTraceView(str('view') as TraceView, [target.id]) ? text(`The tracing object shows ${str('view')}.`, { id: target.id }) : fail('Nothing changed.');
          const id = await this.deps.trace(target.id, a);
          if (!id) return fail('The trace found no shapes: try a different preset, mode or threshold.');
          const g = this.node(id);
          const kids = g.kind === 'group' ? g.children.length : 0, noun = kids === 1 ? 'path' : 'paths';
          return text(a.expand === true ? `Traced and expanded into ${kids} ${noun} (group ${id}).` : `Traced into a live tracing object with ${kids} ${noun} (id ${id}); image_trace with action expand makes them ordinary paths.`, { id, paths: kids });
        }
        case 'live_paint': {
          const act = str('action');
          if (act === 'make') { const id = e.makeLivePaint(this.ids(a)); return id ? text(`Live Paint group ${id} with ${this.livePaintSummary(id)}.`, { id }) : fail('Select or pass paths to make a Live Paint group.'); }
          const id = has('id') ? String(a.id) : e.livePaintTargets()[0];
          const g = id ? this.node(id) : null;
          if (!g || g.kind !== 'group' || !g.livePaint) return fail('Pass the id of a Live Paint group (live_paint with action make returns one).');
          if (act === 'fill' || act === 'edge') {
            if (!has('x') || !has('y')) return fail('Give x and y in document points.');
            const paint = has('color') ? this.paint(a.color, 'color') : act === 'fill' ? e.fillPaint : e.strokePaint;
            const at = { x: num('x', 0), y: num('y', 0) };
            const ok = act === 'fill' ? e.livePaintFill(g.id, at, paint) : e.livePaintEdge(g.id, at, paint, 6);
            return ok ? text(act === 'fill' ? `Filled the face at ${at.x}, ${at.y}; ${this.livePaintSummary(g.id)}.` : 'Painted the edge.', { id: g.id }) : fail(act === 'fill' ? 'No closed face there: pick a point inside an area the paths close, or set a gap.' : 'No edge within 6 points of that point.');
          }
          if (act === 'gap') return e.setLivePaintGap(num('gap', 0), [g.id]) ? text(`Gap detection ${num('gap', 0) > 0 ? `closes gaps up to ${num('gap', 0)} pt` : 'is off'}; ${this.livePaintSummary(g.id)}.`, { id: g.id }) : fail('Nothing changed.');
          if (act === 'expand') return e.expandLivePaint([g.id]) ? text(`Expanded into filled faces and strokes (group ${g.id}).`, { id: g.id }) : fail('Nothing changed.');
          if (act === 'release') return e.releaseLivePaint([g.id]) ? text(`Released to a plain group of the paths (${g.id}).`, { id: g.id }) : fail('Nothing changed.');
          return fail('action must be make, fill, edge, gap, expand or release.');
        }
        case 'symbolism': {
          const op = str('op') as SymbolismOp;
          if (!SYMBOLISM_NAMES[op]) return fail('op must be shift, scrunch, size, spin, stain, screen or style.');
          const ids = this.ids(a) ?? e.targetIds();
          const color = has('color') ? parseColor(str('color')) : null;
          if (op === 'stain' && !color && a.reverse !== true && num('intensity', 5) > 0 && str('method', 'user') === 'user') return fail('stain needs a color.');
          const style = has('style') ? p.doc.styles.find((s) => s.name === str('style') || s.id === str('style')) ?? null : null;
          if (op === 'style' && !style && a.reverse !== true) return fail(`No graphic style named ${str('style')}. Graphic styles: ${p.doc.styles.map((s) => s.name).join(', ') || 'none'}.`);
          const at = has('x') && has('y') ? { x: num('x', 0), y: num('y', 0) } : null;
          let touched = 0;
          for (let i = 0; i < Math.max(1, Math.min(50, Math.round(num('repeat', 1)))); i++) touched = e.symbolism({ op, at, radius: num('radius', 60), intensity: num('intensity', 5), method: (['user', 'average', 'random'].includes(str('method')) ? str('method') : 'user') as SymbolismMethod, reverse: a.reverse === true, dx: num('dx', 0), dy: num('dy', 0), ...(has('angle') ? { angle: num('angle', 0) } : {}), ...(color ? { color } : {}), style }, ids);
          return touched ? text(`${SYMBOLISM_NAMES[op]} changed ${touched} instance(s).`, { changed: touched }) : fail(at ? 'No symbol instance under that brush: widen radius or move x, y.' : 'Those objects hold no symbol instances.');
        }
        case 'gradient_mesh': {
          const act = str('action');
          if (act === 'make') { const ok = e.createMesh(Math.max(1, Math.round(num('rows', 4))), Math.max(1, Math.round(num('columns', 4))), (['flat', 'center', 'edge'].includes(str('highlight')) ? str('highlight') : 'flat') as 'flat', this.ids(a)); return ok ? text(`Made ${e.selectedIds().length} gradient mesh(es).`, { ids: e.selectedIds() }) : fail('Pass closed shapes to turn into meshes.'); }
          const m = has('id') ? this.node(a.id) : e.selected().find((n) => n.kind === 'mesh');
          if (!m || m.kind !== 'mesh') return fail('Pass the id of a gradient mesh.');
          const w = m.cols + 1, r = Math.round(num('row', 0)), c = Math.round(num('column', 0)), idx = r * w + c;
          if (act === 'list') return text(`${m.rows} rows x ${m.cols} columns of patches, ${m.points.length} points.`, { rows: m.rows, columns: m.cols, points: m.points.map((q, i) => ({ row: Math.floor(i / w), column: i % w, x: Math.round(q.x * 100) / 100, y: Math.round(q.y * 100) / 100, color: hex(q.color), opacity: Math.round(q.opacity * 100) })) });
          if ((act === 'point' || act === 'remove_point') && (r < 0 || c < 0 || r > m.rows || c > m.cols)) return fail(`row must be 0..${m.rows} and column 0..${m.cols}.`);
          if (act === 'remove_point') { e.edit('Delete Mesh Point', (d) => updateNodes(d, [m.id], (n) => (n.kind === 'mesh' ? removeMeshLines(n, idx) : n))); return text(`The mesh is now ${(this.node(m.id) as MeshNode).rows} x ${(this.node(m.id) as MeshNode).cols}.`, { id: m.id }); }
          if (act === 'point') {
            const color = has('color') ? parseColor(str('color')) : null;
            if (has('color') && !color) return fail('color must be #rrggbb, rgb(), cmyk() or gray().');
            e.edit('Mesh Point', (d) => updateNodes(d, [m.id], (n) => (n.kind === 'mesh' ? { ...n, points: n.points.map((q, i) => (i === idx ? { ...q, ...(color ? { color } : {}), ...(has('opacity') ? { opacity: Math.max(0, Math.min(1, num('opacity', 100) / 100)) } : {}), x: q.x + num('dx', 0), y: q.y + num('dy', 0) } : q)) } : n)));
            return text(`Set point row ${r}, column ${c}.`, { id: m.id });
          }
          if (act === 'add_line') {
            if (!has('x') || !has('y')) return fail('Give x and y inside the mesh.');
            const color = has('color') ? parseColor(str('color')) : null, at = { x: num('x', 0), y: num('y', 0) };
            const before = m.points.length;
            e.edit('Add Mesh Line', (d) => updateNodes(d, [m.id], (n) => { if (n.kind !== 'mesh') return n; const next = addMeshLine(n, at), k = meshPointAt(next, at, 1e9); return color && k >= 0 ? { ...next, points: next.points.map((q, i) => (i === k ? { ...q, color } : q)) } : next; }));
            const after = this.node(m.id) as MeshNode;
            return after.points.length > before ? text(`The mesh is now ${after.rows} x ${after.cols}.`, { id: m.id, rows: after.rows, columns: after.cols }) : fail('That point is not inside the mesh.');
          }
          return fail('action must be make, list, point, add_line or remove_point.');
        }
        case 'edit_pattern': {
          const tile = has('tile') ? ({ grid: 'grid', brick_by_row: 'brick_row', brick_by_column: 'brick_col', hex_by_column: 'hex_col', hex_by_row: 'hex_row' } as const)[str('tile') as 'grid'] : undefined;
          if (has('tile') && !tile) return fail('tile must be grid, brick_by_row, brick_by_column, hex_by_column or hex_by_row.');
          const def = p.doc.patterns.find((x) => x.name === str('pattern') || x.id === str('pattern'));
          if (!def) return fail(`No pattern named ${str('pattern')}. Patterns: ${p.doc.patterns.map((x) => x.name).join(', ') || 'none'}.`);
          const ok = e.setPatternOptions(def.id, { ...(has('name') ? { name: str('name') } : {}), ...(tile ? { type: tile } : {}), ...(has('h_spacing') ? { hs: num('h_spacing', 0) } : {}), ...(has('v_spacing') ? { vs: num('v_spacing', 0) } : {}), ...(has('brick_offset') ? { brick: num('brick_offset', 0.5) } : {}), ...(has('width') ? { width: num('width', 0) } : {}), ...(has('height') ? { height: num('height', 0) } : {}), ...(has('overlap_h') || has('overlap_v') ? { overlap: [str('overlap_h', def.overlap?.[0] ?? 'left') as 'left', str('overlap_v', def.overlap?.[1] ?? 'top') as 'top'] } : {}) });
          return ok ? text(`Updated the pattern ${str('name') || def.name}.`, { id: def.id }) : fail('Nothing changed.');
        }
        case 'make_pattern': {
          const id = e.makePattern(str('name') || 'Pattern', this.ids(a), ({ grid: 'grid', brick_by_row: 'brick_row', brick_by_column: 'brick_col', hex_by_column: 'hex_col', hex_by_row: 'hex_row' } as const)[str('tile', 'grid') as 'grid'] ?? 'grid', num('h_spacing', 0), num('v_spacing', 0));
          if (!id) return fail('Select art for the tile.');
          if (Array.isArray(a.apply_to) && a.apply_to.length) e.setFill({ type: 'pattern', pattern: id, xf: [1, 0, 0, 1, 0, 0] }, a.apply_to.map(String));
          return text(`Made the pattern ${str('name')} (swatch added).`, { id });
        }
        case 'recolor': {
          const ids = this.ids(a) ?? e.targetIds(), act = str('action', has('map') ? 'map' : has('palette') ? 'palette' : 'invert');
          let fn;
          if (act === 'map') { const m = new Map<string, Color>(); for (const [k, v] of Object.entries((a.map ?? {}) as Record<string, string>)) { const from = parseColor(k), to = parseColor(String(v)); if (from && to) m.set(hex(from), to); } fn = mapFn(m); }
          else if (act === 'palette') { const pal = (Array.isArray(a.palette) ? a.palette : []).map((c) => parseColor(String(c))).filter((c): c is Color => !!c); if (!pal.length) return fail('Give palette colours.'); fn = nearestFn(pal); }
          else if (RECOLOR[act]) fn = RECOLOR[act](num('amount', 0));
          else return fail('action must be map, palette, invert, grayscale, cmyk, rgb or saturate.');
          const before = collectColors(ids.map((id) => findNode(p.doc, id) as VNode)).map(hex);
          e.edit('Recolor Artwork', (d) => recolorDoc(d, ids, fn));
          return text(`Recoloured ${before.length} colour${before.length === 1 ? '' : 's'}.`, { colors_before: before });
        }
        case 'artboard': {
          const act = str('action'), i = has('index') ? Math.round(num('index', 0)) : p.activeArtboard;
          if (act === 'list') { const list = p.doc.artboards.map((x, k) => ({ index: k, name: x.name, x: x.x, y: x.y, width: x.w, height: x.h, active: k === p.activeArtboard })); return text(JSON.stringify(list), { artboards: list }); }
          if (act === 'add') { const last = p.doc.artboards[p.doc.artboards.length - 1]; e.addArtboard({ x: num('x', last ? last.x + last.w + 40 : 0), y: num('y', last?.y ?? 0), w: num('width', last?.w ?? 612), h: num('height', last?.h ?? 792) }, str('name') || undefined); return text(`Added artboard ${p.doc.artboards.length - 1}.`, { index: p.doc.artboards.length - 1 }); }
          if (!p.doc.artboards[i]) return fail(`index must be 0..${p.doc.artboards.length - 1}.`);
          if (act === 'set') { e.setArtboard(i, { ...(has('name') ? { name: str('name') } : {}), ...(has('x') ? { x: num('x', 0) } : {}), ...(has('y') ? { y: num('y', 0) } : {}), ...(has('width') ? { w: num('width', 612) } : {}), ...(has('height') ? { h: num('height', 792) } : {}) }); return text('Changed the artboard.'); }
          if (act === 'delete') { if (p.doc.artboards.length < 2) return fail('A document keeps at least one artboard.'); e.deleteArtboard(i); return text('Deleted the artboard.'); }
          if (act === 'fit_to_art' || act === 'fit_to_selection') { e.fitArtboard(i, act === 'fit_to_art' ? 'art' : 'selection'); return text('Fitted the artboard.'); }
          if (act === 'rearrange') { e.rearrangeArtboards(Math.max(1, Math.round(num('columns', 2))), num('spacing', 20)); return text('Rearranged the artboards.'); }
          if (act === 'activate') { e.setActiveArtboard(i); e.fit(); return text(`Artboard ${i} is active.`); }
          return fail('action must be add, set, delete, fit_to_art, fit_to_selection, rearrange, list or activate.');
        }
        case 'set_text': {
          const n = this.node(a.id);
          if (n.kind !== 'text') return fail(`${n.id} is not type.`);
          if (has('text')) e.setTextSpans(n.id, [{ text: str('text'), style: n.spans[0]?.style ?? DEFAULT_CHAR }], 'Edit Text');
          const patch: Partial<typeof DEFAULT_CHAR> = { ...(has('font') ? { font: str('font') } : {}), ...(has('style') ? { style: str('style') } : {}), ...(has('size') ? { size: Math.max(0.1, num('size', 12)) } : {}), ...(has('color') ? { fill: this.paint(a.color, 'color') } : {}), ...(has('leading') ? { leading: num('leading', 14) } : {}), ...(has('tracking') ? { tracking: num('tracking', 0) } : {}), ...(Array.isArray(a.features) ? { features: a.features.filter((f): f is string => typeof f === 'string' && /^[a-z0-9]{4}$/.test(f)) } : {}), ...(has('caps') ? { caps: str('caps') as 'none' } : {}) };
          if (Object.keys(patch).length) {
            const cur = e.nodeById(n.id) as TextNode, range: [number, number] | undefined = has('start') || has('end') ? [Math.max(0, Math.round(num('start', 0))), Math.round(num('end', plainText(cur).length))] : undefined;
            e.edit('Character', (d) => updateNodes(d, [n.id], (x) => (x.kind === 'text' ? { ...x, spans: range ? styleSpans(x.spans, range[0], range[1], patch) : x.spans.map((s) => ({ ...s, style: { ...s.style, ...patch } })) } : x)));
          }
          if (has('align')) e.setParaStyle({ align: str('align') as 'left' }, [n.id]);
          return text('Changed the type.', this.describe(this.node(n.id)));
        }
        case 'select_similar': {
          const ref = has('id') ? this.node(a.id).id : e.selectedIds()[0];
          if (!ref) return fail('Give the id of the object to match, or select it first.');
          const tol = (k: string): number | null => (typeof a[k] === 'number' ? a[k] as number : null);
          const c = { fill: tol('fill_tolerance'), stroke: tol('stroke_tolerance'), weight: tol('weight_tolerance'), opacity: tol('opacity_tolerance'), blend: a.blend === true };
          if (c.fill === null && c.stroke === null && c.weight === null && c.opacity === null && !c.blend) c.fill = 32;
          const n = e.selectSimilar(ref, c, (str('mode', 'replace') as 'replace'));
          return text(`${n} object(s) match.`, { selection: e.selectedIds() });
        }
        case 'edit_shape': {
          const ids = this.ids(a) ?? e.targetIds();
          const live = ids.map((id) => this.node(id)).filter((n): n is PathNode => n.kind === 'path' && !!n.live);
          if (!live.length) return fail('None of those objects is a live shape; draw_shape makes them, and expand turns them into plain paths.');
          const patch: LivePatch = {
            ...(has('width') ? { w: num('width', 1) } : {}), ...(has('height') ? { h: num('height', 1) } : {}),
            ...(has('corner_radius') ? { radius: num('corner_radius', 0) } : {}), ...(Array.isArray(a.radii) && a.radii.length === 4 ? { radii: a.radii.map(Number) as [number, number, number, number] } : {}),
            ...(has('corner_type') ? { corner: str('corner_type') as 'round' } : {}), ...(has('pie_start') ? { start: num('pie_start', 0) } : {}), ...(has('pie_end') ? { end: num('pie_end', 360) } : {}),
            ...(has('sides') ? { sides: num('sides', 6) } : {}), ...(has('points') ? { points: num('points', 5) } : {}), ...(has('outer_radius') ? { r1: num('outer_radius', 50) } : {}), ...(has('inner_radius') ? { r2: num('inner_radius', 25) } : {}),
            ...(has('length') ? { length: num('length', 100) } : {}), ...(has('angle') ? { angle: num('angle', 0) } : {}),
          };
          if (has('radius')) { for (const n of live) e.editLiveShape(n.live?.kind === 'polygon' ? { ...patch, r: num('radius', 50) } : patch, [n.id]); }
          else e.editLiveShape(patch, live.map((n) => n.id));
          return text(`Changed ${live.length} shape(s).`, { shapes: live.map((n) => { const x = this.node(n.id); return x.kind === 'path' && x.live ? { id: x.id, kind: x.live.kind, ...liveParams(x.live) } : { id: x.id }; }) });
        }
        case 'color_harmony': {
          const fp = e.fillPaint, base = has('color') ? parseColor(str('color')) : fp.type === 'color' ? fp.color : null;
          if (!base) return fail('Give color as #rrggbb, or set a solid fill colour first.');
          const rule = str('rule', 'complementary') as HarmonyRule, cols = harmonyColors(base, rule), vary = str('variation', 'none');
          const out: Record<string, unknown> = { rule, colors: cols.map(hex) };
          if (vary !== 'none') out.variations = cols.map((c) => variations(c, vary as Variation, 3).map(hex));
          const group = str('save_group');
          if (group) { e.beginGesture(); try { cols.forEach((c, i) => e.addSwatch(`${group} ${i + 1}`, solid(c), false, false, group)); } finally { e.endGesture(); } }
          return text(`${rule.replace(/_/g, ' ')}: ${cols.map(hex).join(' ')}${group ? `; saved as ${group}` : ''}`, out);
        }
        case 'text_flow': {
          const act = str('action'), ids = this.ids(a);
          if (act === 'thread') { if (!ids || ids.length < 2) return fail('Give ids: the area type first, then the frames or closed paths to thread into, in order.'); return e.threadText(ids) ? text('Threaded the type.', { frames: ids.map((id) => this.describe(this.node(id))) }) : fail('Nothing was threaded: the first id must be area type and the rest area type or closed paths.'); }
          if (act === 'release' || act === 'remove') return e.releaseThread(ids, act === 'remove') ? text(act === 'remove' ? 'Removed the threading; each frame keeps its text.' : 'Released the frames; their text flowed back into the thread.') : fail('Those objects are not threaded type.');
          if (act === 'wrap') return e.setTextWrap({ offset: num('offset', 6), invert: a.invert === true }, ids) ? text('Area type below these objects in their layer now wraps around them.') : fail('Nothing to wrap: give ids or select objects.');
          if (act === 'unwrap') return e.setTextWrap(null, ids) ? text('Released the text wrap.') : fail('Nothing to release.');
          return fail('action must be thread, release, remove, wrap or unwrap.');
        }
        case 'text_style': {
          const kind = str('kind', 'char') === 'para' ? 'para' : 'char', act = str('action', 'list'), doc = p.doc;
          const defs: Array<{ id: string; name: string }> = kind === 'char' ? doc.charStyles : doc.paraStyles;
          const pick = (): string | null => { const s = str('style'); if (!s) return null; const d = defs.find((x) => x.id === s || x.name.toLowerCase() === s.toLowerCase()); if (!d) throw new ToolError(`There is no ${kind === 'char' ? 'character' : 'paragraph'} style ${s}: call text_style with action list.`); return d.id; };
          if (act === 'list') return text(defs.length ? defs.map((d) => `${d.id}: ${d.name}`).join('\n') : 'No styles yet.', { styles: kind === 'char' ? doc.charStyles : doc.paraStyles });
          if (act === 'create') { const ids = this.ids(a); if (ids?.length) e.select(ids); const id = e.addTextStyle(kind, str('name') || `Style ${defs.length + 1}`); if (id && e.selected().some((x) => x.kind === 'text')) e.applyTextStyle(kind, id); return id ? text(`Made the style ${id} from the selected type and applied it.`, { id }) : fail('No document.'); }
          if (act === 'apply') { const range: [number, number] | undefined = kind === 'char' && (has('start') || has('end')) ? [Math.max(0, Math.round(num('start', 0))), Math.round(num('end', 1e9))] : undefined; return e.applyTextStyle(kind, pick(), this.ids(a), range) ? text('Applied the style.') : fail('Select type or give ids of type objects.'); }
          if (act === 'redefine') { const ids = this.ids(a); if (ids?.length) e.select(ids); const id = pick(); return id && e.redefineTextStyle(kind, id) ? text('Redefined the style from the selected type and updated everything using it.') : fail('Give the style and select the type to take it from.'); }
          if (act === 'delete') { const id = pick(); return id && e.deleteTextStyle(kind, id) ? text('Deleted the style; type that used it keeps its look.') : fail('Give the style to delete.'); }
          return fail('action must be list, create, apply, redefine or delete.');
        }
        case 'find_font': {
          const used = e.fontsUsed();
          if (str('action', 'list') === 'list') return text(used.map((u) => `${u.font} ${u.style}: ${u.ids.length} object(s)`).join('\n') || 'The document has no type.', { fonts: used.map((u) => ({ font: u.font, style: u.style, objects: u.ids })) });
          if (!has('font') || !has('to_font')) return fail('replace needs font (and optionally style) and to_font (and optionally to_style).');
          const to = { font: str('to_font'), style: str('to_style', 'Regular') };
          await this.deps.ensureFace?.(to.font, to.style);
          const n = e.replaceFont({ font: str('font'), style: has('style') ? str('style') : undefined }, to);
          return n ? text(`Replaced ${n} run(s) with ${to.font} ${to.style}.`) : fail(`No type uses ${str('font')}${has('style') ? ` ${str('style')}` : ''}.`);
        }
        case 'create_outlines': { const ok = await this.deps.outlines(this.ids(a)); return ok ? text('Created outlines.', { selection: e.selectedIds() }) : fail('Nothing was outlined: select type, and check that its font can be read.'); }
        case 'undo': { const n = Math.max(1, Math.round(num('steps', 1))); return e.undo(n) ? text(`Undid ${n} step${n === 1 ? '' : 's'}.`) : fail('Nothing to undo.'); }
        case 'redo': { const n = Math.max(1, Math.round(num('steps', 1))); return e.redo(n) ? text(`Redid ${n} step${n === 1 ? '' : 's'}.`) : fail('Nothing to redo.'); }
        default: return fail(`formpth has no tool named ${name}.`);
      }
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    } finally { if (step) e.endStep(); if (!name.startsWith('__') && !/^(get_|list_)/.test(name)) this.deps.note(`An agent used ${name}.`); }
  }
}

export function regionOf(e: Engine, scope: string, artboard?: number): Rect | null {
  const p = e.current;
  if (!p) return null;
  if (scope === 'selection') { const b = e.selectionBounds(true); return b ? inflate(b, 4) : null; }
  if (scope === 'document') {
    let r = p.doc.artboards.reduce((acc, a) => unionRect(acc, { x: a.x, y: a.y, w: a.w, h: a.h }), emptyRect());
    for (const l of p.doc.layers) { const b = visualBounds(p.doc, l); if (!isEmptyRect(b)) r = unionRect(r, b); }
    return isEmptyRect(r) ? null : r;
  }
  const a = p.doc.artboards[artboard ?? 0] ?? p.doc.artboards[0];
  return a ? normRect(a.x, a.y, a.x + a.w, a.y + a.h) : null;
}

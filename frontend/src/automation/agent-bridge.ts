import { geomBounds, selectionBounds, visualBounds } from '../engine/bounds';
import { findNode, inDocOrder, nodeLabel, updateNodes } from '../engine/doc';
import { EFFECTS, effectDef, isItemEffect, WIDTH_PROFILES, widthProfileNamed } from '../engine/effects';
import { customProfileNames, saveWidthProfile } from '../io/width-profiles';
import { STYLE_LIBRARIES, styleLibrary } from '../engine/style-libraries';
import { LIGHT_LIMIT, LIGHTING_PRESETS, lightsToParam, ROTATION_PRESETS, SURFACE_CHOICES, surfaceSpecs, surfacesToParam, type SurfSpec } from '../engine/threed';
import { modelSiblings } from '../io/model';
import type { RasterExtra } from '../io/raster';
import { CROP_CHOICES, type CropTo, type PlaceOptions } from '../io/place';
import { textureAverage, textureName } from '../engine/texture';
import { anchor, flatIndex, inflate, isEmptyRect, isLineSeg, segOf, normRect, reflectAbout, rotateAbout, scaleAbout, shearAbout, splitSegmentAt, translate, unflatIndex, mul, emptyRect, unionRect } from '../engine/geometry';
import { collectColors, fitRowsToPalette, mapFn, nearestFn, oklab, RECOLOR, recolorDoc, reduceRows, rowReference, rowsFn } from '../engine/ops/recolor';
import { libraryColors, swatchLibrary, SWATCH_LIBRARIES, type SwatchLibrary } from '../engine/swatch-libraries';
import { brushLibrary, BRUSH_LIBRARIES, type BrushLibrary } from '../engine/brush-libraries';
import { symbolLibrary, SYMBOL_LIBRARIES, type SymbolLibrary } from '../engine/symbol-libraries';
import { SYMBOL_REGISTRATIONS, type SymbolRegistration } from '../engine/symbols';
import { BLACK, fill as fillItem, firstFill, parseColor, paintFromInput, solid, stroke as strokeItem, withFirstFill, withFirstStroke, hex } from '../engine/paint';
import { charStyleAt, DEFAULT_CHAR, layoutText, plainText, styleSpans } from '../engine/text';
import { DEFAULT_HYPH, DEFAULT_JUST } from '../engine/hyphen';
import { variationOf } from '../io/fonts';
import { harmonyColors, variations, type HarmonyRule, type Variation } from '../engine/harmony';
import { CONVERT_KINDS, liveParams, type ConvertKind, type LivePatch } from '../engine/ops/live-shapes';
import { transformNode } from '../engine/transform';
import { interiorOf, liveFaceNodes, liveFaces } from '../engine/livepaint';
import { addMeshLine, meshPointAt, removeMeshLines } from '../engine/mesh';
import { envelopeOptions, meshHandles } from '../engine/envelope';
import { circleFrom, circumcentre, dimLabel } from '../engine/dimension';
import type { DimensionSpec } from '../engine/types';
import { SYMBOLISM_NAMES, UNIT_PT, type Anchor, type BlendMode, type Color, type Engine, type Mat, type MeshNode, type Paint, type PathData, type PathNode, type Pt, type Rect, type StrokeItem, type SymbolismMethod, type SymbolismOp, type TextNode, type TraceView, type ParaStyle, type Justification, type TabStop, type ListStyle, type Units, type VNode } from '../engine';
import type { Commands } from '../ui/commands';
import type { Catalogue, CatalogueEntry } from './catalogue';
import type { ActionsPanel } from '../ui/panels/actions';
import { cleanData, dataToText, GRAPH_TYPES, graphSummary, parseNumber, parseTable, swapXY, transposeData } from '../engine/graph';
import { boundLabel, parseDataFile, VARIABLE_KINDS } from '../engine/variables';
import { exportDataSets, showDataSet } from '../io/data-merge';
import { VERSION } from '../version';
import type { GraphColumnDesign, GraphData, GraphSeriesType, GraphSpec, GraphType, Variable, VariableKind } from '../engine/types';
import { api } from '../io/api';
import { bakeTraced } from '../io/raster';
import { attachPlace, gridOf, leafPlaneBounds, planeLocalRect, presetGrid, vanishing } from '../engine/perspective';
import type { BrushDef, Doc, PerspPlane } from '../engine/types';
import { DXF_UNITS, type DxfImportOptions, type DxfUnit } from '../io/dxf';
import type { CadChoice } from '../ui/app-dialogs';
import { compressionFrom, pdfRefusal, securityFrom, standardFrom, type PdfCompression, type PdfSecurity, type PdfStandard } from '../io/pdf-std';
import { artParts, generativePalettes, modelState, PATTERN_PRESETS, patternVariations, placeVector, recolorWithPalette, shapeFillVariations, textToVectorVariations, type GenCommon, type PatternLayout, type Variation as GenVariation } from '../io/generative';
import { detailLevel, EFFECT_NAMES, STYLE_IDS, styleReference, TONE_IDS } from '../io/gen-options';
import { reportLines } from '../io/gen-repair';
import { loadPrefs } from '../ui/prefs';
import { colorManaged, colorSettled, INTENTS, isProofing, proofDevice, refOf, refreshDisplayProfile, refreshProfiles, resolveSettings, setProofing, type ProfileInfo } from '../engine/color-management';
import { applySettings, convertToProfile, findProfile, settingsPatch } from '../io/color-ops';
import { rankFonts, recognize, retypeNode, sourceFromImage, sourceFromOutlines } from '../io/retype';

export interface McpResult { content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>; structuredContent?: Record<string, unknown>; isError?: boolean }
export interface AgentDeps {
  ask(title: string, text: string): Promise<boolean>;
  note(text: string): void;
  allow(): void;
  openFile(file: File, dxf?: Partial<DxfImportOptions> | null, password?: string): Promise<void>;
  placeFile(file: File, at: Pt | null, width: number | null, dxf?: Partial<DxfImportOptions> | null, placing?: PlaceOptions): Promise<string | null>;
  placeLinked?(path: string, at: Pt | null, width: number | null, placing?: PlaceOptions): Promise<string | null>;
  links?(a: Record<string, unknown>): Promise<{ ok: boolean; text: string; data?: Record<string, unknown> }>;
  projectBlob(): Promise<Blob | null>;
  exportBlob(format: 'svg' | 'pdf' | 'ai' | 'png' | 'png8' | 'gif' | 'bmp' | 'psd' | 'tiff' | 'jpeg' | 'webp' | 'eps' | 'dxf' | 'dwg', o: { raster?: Partial<RasterExtra>; scope: string; artboard?: number; scale: number; quality: number; transparent: boolean; outlineText: boolean; liveText?: boolean; standard?: PdfStandard; layers?: boolean; compression?: PdfCompression; security?: PdfSecurity; cmyk?: boolean; cad?: CadChoice }): Promise<Blob | null>;
  image(scope: string, artboard: number | undefined, maxSize: number, outline: boolean): Promise<Blob | null>;
  svg(scope: string, artboard: number | undefined, ids: string[] | undefined): Promise<string>;
  outlines(ids?: string[]): Promise<boolean>;
  trace(id: string, o: Record<string, unknown>): Promise<string | null>;
  ensureFace?(family: string, style: string): Promise<void>;
  userLibraries?(): { swatches: SwatchLibrary[]; brushes: BrushLibrary[]; symbols?: SymbolLibrary[] };
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
  catalogue: Catalogue | null = null;
  actions: ActionsPanel | null = null;
  constructor(private readonly engine: Engine, private readonly deps: AgentDeps) {}

  setEnabled(on: boolean): void {
    const was = this.on;
    this.on = on;
    if (!this.looping) void this.loop();
    if (was && !on && this.secret) void api.mcpStop(this.secret);
  }

  get enabled(): boolean { return this.on; }

  private secret: string | null = null;

  private refocused(): Promise<void> {
    return new Promise((ok) => {
      const done = (): void => { window.removeEventListener('focus', done); document.removeEventListener('visibilitychange', seen); ok(); };
      const seen = (): void => { if (document.visibilityState === 'visible' && document.hasFocus()) done(); };
      window.addEventListener('focus', done);
      document.addEventListener('visibilitychange', seen);
    });
  }

  private async loop(): Promise<void> {
    this.looping = true;
    for (;;) {
      try {
        if (!this.secret) { this.secret = await api.mcpSession(); if (!this.secret) { await sleep(3000); continue; } }
        const secret = this.secret, { status, item } = await api.mcpNext(secret, this.on);
        if (status === 205) { this.secret = null; await this.refocused(); continue; }
        if (status === 403) { this.secret = null; await sleep(1000); continue; }
        if (status === 200 && item) {
          if (item.name === '__consent__') {
            const yes = this.on || await this.deps.ask('Allow an outside agent to edit?', 'An AI agent connected to formpath (such as Claude Code, Codex or Cursor) asks to draw in and edit your documents. Each change is one undoable step. You can turn this off in Preferences > Plugins.');
            if (yes && !this.on) { this.on = true; this.deps.allow(); }
            await api.mcpResult(secret, item.id, { allowed: yes });
            continue;
          }
          const result = this.on || item.inapp === true ? await this.run(item.name, item.arguments ?? {}, 'loop') : fail('formpath stopped taking requests.');
          await api.mcpResult(secret, item.id, result);
        } else if (status !== 204) await sleep(2000);
      } catch { await sleep(2000); }
    }
  }

  private envelopeAction(act: string, a: Record<string, unknown>, num: (k: string, d: number) => number, str: (k: string, d?: string) => string, has: (k: string) => boolean): McpResult {
    const e = this.engine, doc = e.doc;
    const env = doc ? (this.ids(a) ?? e.selectedIds()).map((id) => e.envelopeOf(id)).find((x) => !!x) ?? null : null;
    if (!doc || !env) return fail('Select an envelope (or pass its id in ids); make one with action warp, mesh or top_object.');
    const s = e.envelopeMesh(doc, env), H = meshHandles(s), w = s.cols + 1, sides = ['right', 'left', 'down', 'up'];
    const pick = (): number => {
      const idx = has('point') ? Math.round(num('point', -1)) : has('row') && has('column') ? Math.round(num('row', 0)) * w + Math.round(num('column', 0)) : -1;
      if (idx < 0 || idx >= s.points.length || (has('column') && num('column', 0) > s.cols) || (has('row') && num('row', 0) > s.rows)) throw new ToolError(`Give point (0 to ${s.points.length - 1}) or row (0 to ${s.rows}) and column (0 to ${s.cols}); envelope info lists them.`);
      return idx;
    };
    const after = (msg: string): McpResult => { const n = e.envelopeOf(env.id), m = n && e.doc ? e.envelopeMesh(e.doc, n) : null; return text(`${msg} get_image shows it.`, { id: env.id, rows: m?.rows ?? null, columns: m?.cols ?? null, selection: e.selectedIds() }); };
    switch (act) {
      case 'info': {
        const o = envelopeOptions(env.opts);
        return text(`Envelope ${env.id}: ${env.spec.kind === 'mesh' ? 'mesh' : env.spec.kind === 'warp' ? `warp (${env.spec.style}); moving a point turns it into this mesh` : 'top object; moving a point turns it into this mesh'}, ${s.rows} rows by ${s.cols} columns, ${s.points.length} points; editing the ${env.editContents ? 'contents' : 'envelope'}.`, {
          id: env.id, kind: env.spec.kind, rows: s.rows, columns: s.cols, editing: env.editContents ? 'contents' : 'envelope',
          options: { fidelity: o.fidelity, distort_appearance: o.appearance, distort_gradients: o.gradients, distort_patterns: o.patterns, anti_alias: o.antiAlias },
          points: s.points.map((q, i) => ({ point: i, row: Math.floor(i / w), column: i % w, x: r2(q.x), y: r2(q.y), handles: Object.fromEntries(H[i].map((h, k) => [sides[k], Math.hypot(h.x, h.y) > 1e-6 ? [r2(q.x + h.x), r2(q.y + h.y)] : null])) })),
        });
      }
      case 'move_point': {
        const idx = pick(), hi = has('handle') ? sides.indexOf(str('handle')) : -1, P = s.points[idx];
        if (hi >= 0 && Math.hypot(H[idx][hi].x, H[idx][hi].y) < 1e-6) throw new ToolError(`Point ${idx} has no ${str('handle')} handle (it is on that edge of the mesh).`);
        const base = hi >= 0 ? { x: P.x + H[idx][hi].x, y: P.y + H[idx][hi].y } : P;
        const to = has('x') || has('y') ? { x: num('x', base.x), y: num('y', base.y) } : { x: base.x + num('dx', 0), y: base.y + num('dy', 0) };
        return e.moveEnvelopePoint(env.id, idx, to, hi, a.mirror === true) ? after(`Moved ${hi >= 0 ? `the ${str('handle')} handle of ` : ''}point ${idx} to ${r2(to.x)}, ${r2(to.y)}.`) : fail('Nothing changed.');
      }
      case 'add_mesh_line': {
        if (!has('x') || !has('y')) throw new ToolError('add_mesh_line needs x and y inside the envelope.');
        const idx = e.addEnvelopeMeshLine(env.id, { x: num('x', 0), y: num('y', 0) }, 1e6);
        return idx >= 0 ? after(`Added mesh lines through point ${idx}.`) : fail('Nothing changed: that place is already on a mesh point.');
      }
      case 'delete_mesh_point': return e.removeEnvelopeMeshLines(env.id, pick()) ? after('Removed the mesh lines through that point.') : fail('Nothing changed: points on the outer edge of the mesh cannot be removed.');
      case 'reset_mesh': return e.resetEnvelope({ kind: 'mesh', rows: num('rows', 4), cols: num('columns', 4), keepShape: a.maintain_shape !== false }, [env.id]) ? after('Reset the envelope with a mesh.') : fail('Nothing changed.');
      case 'reset_warp': return e.resetEnvelope({ kind: 'warp', style: str('style', 'arc'), bend: num('bend', 50), h: num('horizontal', 0), v: num('vertical', 0), vertical: a.vertical_orientation === true }, [env.id]) ? after('Reset the envelope with a warp.') : fail('Nothing changed.');
      case 'options': {
        const patch = { ...(has('fidelity') ? { fidelity: Math.max(0, Math.min(100, num('fidelity', 50))) } : {}), ...(has('distort_appearance') ? { appearance: a.distort_appearance === true } : {}), ...(has('distort_gradients') ? { gradients: a.distort_gradients === true } : {}), ...(has('distort_patterns') ? { patterns: a.distort_patterns === true } : {}), ...(has('anti_alias') ? { antiAlias: a.anti_alias === true } : {}) };
        if (!Object.keys(patch).length) throw new ToolError('options takes fidelity, distort_appearance, distort_gradients, distort_patterns or anti_alias.');
        return e.setEnvelopeOptions(patch, [env.id]) ? after('Changed the envelope options.') : fail('Nothing changed.');
      }
      case 'edit_contents': return e.envelopeContents(true, [env.id]) ? text(`Editing the contents of ${env.id}: the selection is the art inside (ids ${e.selectedIds().join(', ')}); set_text, transform and the rest change it, and the envelope follows. Call edit_envelope when done.`, { id: env.id, selection: e.selectedIds() }) : fail('Nothing changed.');
      case 'edit_envelope': return e.envelopeContents(false, [env.id]) ? text(`Editing the envelope ${env.id} again.`, { id: env.id, selection: e.selectedIds() }) : fail('Nothing changed.');
    }
    return fail('Unknown envelope action.');
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

  private graphPatch(a: Record<string, unknown>, num: (k: string, d: number) => number, str: (k: string, d?: string) => string, has: (k: string) => boolean): Partial<GraphSpec> {
    const p: Partial<GraphSpec> = {};
    const pick = <T extends string>(k: string, ok: readonly T[], map: Record<string, T> = {}): T | undefined => { if (!has(k)) return undefined; const v = map[str(k)] ?? str(k) as T; if (!ok.includes(v)) throw new ToolError(`${k} must be one of ${[...ok, ...Object.keys(map)].join(', ')}.`); return v; };
    const set = <K extends keyof GraphSpec>(k: K, v: GraphSpec[K] | undefined): void => { if (v !== undefined) p[k] = v; };
    set('legend', pick('legend', ['right', 'top', 'none'] as const));
    set('axis', pick('value_axis', ['start', 'end', 'both'] as const, { left: 'start', bottom: 'start', right: 'end', top: 'end' }));
    set('valueTicks', pick('ticks', ['none', 'short', 'full'] as const));
    set('catTicks', pick('category_ticks', ['none', 'short', 'full'] as const));
    set('pieLegend', pick('pie_legend', ['standard', 'wedges', 'none'] as const));
    set('pieSort', pick('pie_sort', ['none', 'all', 'first'] as const));
    set('piePosition', pick('pie_position', ['ratio', 'even', 'stacked'] as const));
    if (has('min') || has('max') || has('divisions')) { p.auto = false; if (has('min')) p.min = num('min', 0); if (has('max')) p.max = num('max', 100); if (has('divisions')) p.divisions = Math.max(1, Math.round(num('divisions', 5))); }
    if (a.auto === true) p.auto = true;
    if (has('prefix')) p.prefix = str('prefix');
    if (has('suffix')) p.suffix = str('suffix');
    if (has('column_width')) p.colWidth = Math.max(1, num('column_width', 90));
    if (has('cluster_width')) p.clusterWidth = Math.max(1, num('cluster_width', 80));
    if (has('mark_points')) p.mark = a.mark_points === true;
    if (has('connect_points')) p.connect = a.connect_points === true;
    if (has('edge_to_edge')) p.edgeToEdge = a.edge_to_edge === true;
    if (has('fill_lines')) p.fillLines = a.fill_lines === true;
    if (has('line_width')) p.lineWidth = Math.max(0.1, num('line_width', 1));
    if (has('marker_size')) p.markerSize = Math.max(1, num('marker_size', 5));
    if (has('drop_shadow')) p.shadow = a.drop_shadow === true;
    if (has('font')) p.font = str('font');
    if (has('size')) p.size = Math.max(4, Math.min(72, num('size', 9)));
    return p;
  }

  private perspectiveTool(a: Record<string, unknown>, num: (k: string, d: number) => number, str: (k: string, d?: string) => string, has: (k: string) => boolean): McpResult {
    const e = this.engine, doc = e.doc as Doc, act = str('action', 'get');
    const toPlane = (v: string): PerspPlane | null => (v === 'horizontal' || v === 'floor' ? 'floor' : v === 'left' || v === 'right' ? v : null);
    const planeArg = (): PerspPlane => {
      if (has('plane')) { const p = toPlane(str('plane')); if (!p) throw new ToolError('plane must be left, right or horizontal.'); return p; }
      const v = e.perspView.plane;
      if (v === 'none') throw new ToolError('No plane is active: pass plane (left, right or horizontal).');
      return v;
    };
    const outName = (p: PerspPlane): string => (p === 'floor' ? 'horizontal' : p);
    const describe = (): McpResult => {
      const g = gridOf(e.doc as Doc), v = e.perspView, vp = vanishing(g), pt = (q: Pt | null): number[] | null => (q ? [r2(q.x), r2(q.y)] : null);
      const planes = Object.fromEntries((['left', 'right', 'floor'] as const).map((p) => { const r = planeLocalRect(g, p); return [outName(p), { x: r2(r.x), y: r2(r.y), width: r2(r.w), height: r2(r.h), offset: r2(g.off[p]) }]; }));
      const attached: Array<Record<string, unknown>> = [];
      const walkAll = (ns: VNode[]): void => { for (const n of ns) { if (n.persp) { const b = leafPlaneBounds(e.doc as Doc, n); attached.push({ id: n.id, kind: n.kind, plane: outName(n.persp.plane), offset: r2(n.persp.off), plane_bounds: box(b) }); } else if (n.kind === 'group' || n.kind === 'layer') walkAll(n.children); } };
      walkAll((e.doc as Doc).layers);
      const data = { type: g.type, show: v.show, lock: v.lock, snap: v.snap, active_plane: v.plane === 'none' ? 'none' : outName(v.plane), cell: r2(g.cell), angle: r2(g.angle), distance: r2(g.distance), horizon_height: r2(g.height), vp3: r2(g.vp3), ground: [r2(g.ground.x), r2(g.ground.y)], station: r2(g.station), horizon_y: r2(vp.hy), vanishing_points: { left: pt(vp.left), right: pt(vp.right), center: pt(vp.center), third: pt(vp.third) }, planes, opacity: Math.round(g.opacity * 100), attached };
      return text(`${g.type} point perspective grid${v.show ? '' : ' (hidden)'}, horizon at y ${r2(vp.hy)}, ground level origin at ${r2(g.ground.x)}, ${r2(g.ground.y)}, gridlines every ${r2(g.cell)} pt, active plane ${data.active_plane}; ${attached.length} object(s) in perspective.`, data);
    };
    switch (act) {
      case 'get': return describe();
      case 'grid': {
        let g = has('preset') ? presetGrid(doc, str('preset') === 'one_point' ? 1 : str('preset') === 'three_point' ? 3 : 2) : gridOf(doc);
        if (has('type')) { const t = Math.round(num('type', 2)); if (t < 1 || t > 3) throw new ToolError('type must be 1, 2 or 3.'); g = { ...g, type: t as 1 | 2 | 3 }; if (t === 3 && Math.abs(g.vp3) < 1) g = { ...g, vp3: Math.max(4 * g.distance, Math.abs(g.height) * 4) }; }
        const n = (k: string, d: number): number => num(k, d);
        if (has('cell')) g = { ...g, cell: n('cell', g.cell) };
        if (has('angle')) g = { ...g, angle: n('angle', g.angle) };
        if (has('distance')) g = { ...g, distance: n('distance', g.distance) };
        if (has('horizon_height')) g = { ...g, height: n('horizon_height', g.height) };
        if (has('vp3')) g = { ...g, vp3: n('vp3', g.vp3) };
        if (has('ground_x') || has('ground_y')) g = { ...g, ground: { x: n('ground_x', g.ground.x), y: n('ground_y', g.ground.y) } };
        if (has('station')) g = { ...g, station: n('station', g.station) };
        g = { ...g, ext: { left: n('extent_left', g.ext.left), right: n('extent_right', g.ext.right), height: n('extent_height', g.ext.height) }, off: { left: n('offset_left', g.off.left), right: n('offset_right', g.off.right), floor: n('offset_horizontal', g.off.floor) } };
        for (const [k, p] of [['left_color', 'left'], ['right_color', 'right'], ['horizontal_color', 'floor']] as const) if (has(k)) { const c = parseColor(str(k)); if (!c) throw new ToolError(`${k} must be #rrggbb.`); g = { ...g, colors: { ...g.colors, [p]: c } }; }
        if (has('opacity')) g = { ...g, opacity: n('opacity', 50) / 100 };
        const changed = JSON.stringify(g) !== JSON.stringify(gridOf(doc));
        if (changed) e.setPerspGrid(g, has('preset') ? 'Perspective Grid Preset' : 'Define Perspective Grid');
        const ap = has('active_plane') ? str('active_plane') : null;
        if (ap !== null && ap !== 'none' && !toPlane(ap)) throw new ToolError('active_plane must be left, right, horizontal or none.');
        e.setPerspView({ show: has('show') ? a.show === true : true, ...(has('lock') ? { lock: a.lock === true } : {}), ...(has('snap') ? { snap: a.snap === true } : {}), ...(ap !== null ? { plane: ap === 'none' ? 'none' : toPlane(ap) as PerspPlane } : {}) });
        return describe();
      }
      case 'draw': {
        const plane = planeArg(), g = gridOf(doc), off = has('offset') ? num('offset', 0) : g.off[plane], shape = str('shape', 'rectangle');
        const r = planeLocalRect(g, plane), w = num('width', 100), h = num('height', 100), x = num('x', r.x + r.w / 2 - w / 2), y = num('y', r.y + r.h / 2 - h / 2);
        if (!(w > 0 && h > 0)) throw new ToolError('width and height must be positive.');
        const node = shape === 'rectangular_grid' || shape === 'polar_grid' ? e.gridGroup(shape === 'polar_grid' ? 'polar' : 'rectangular', x, y, w, h, e.options.gridRows, e.options.gridCols) : shape === 'line' ? e.shapePath('line', x, y, w, h, { x2: x + w, y2: y + h }) : e.shapePath(shape, x, y, w, h);
        const placed = attachPlace(doc, node, g, { plane, off }, [1, 0, 0, 1, 0, 0]);
        const label = shape.replace(/_/g, ' ');
        const id = e.addNodes(`${label[0].toUpperCase()}${label.slice(1)} in Perspective`, [placed])[0];
        return text(`Drew a ${shape.replace(/_/g, ' ')} on the ${outName(plane)} plane (id ${id}).`, { id, plane: outName(plane), bounds: box(e.boundsOf(e.nodeById(id) as VNode)) });
      }
      case 'place': {
        const plane = planeArg(), ids = this.ids(a);
        const out = e.placeOnPlane(ids, plane, { ...(has('x') ? { x: num('x', 0) } : {}), ...(has('y') ? { y: num('y', 0) } : {}), scale: Math.max(0.001, num('scale', 1)), ...(has('offset') ? { off: num('offset', 0) } : {}), copy: a.copy === true });
        if (!out.length) return fail('Nothing was placed: the art must be in front of the viewer on that plane (try x and y inside the plane extents from get).');
        return text(`Brought ${out.length} object(s) onto the ${outName(plane)} plane: ${out.join(', ')}.`, { ids: out, plane: outName(plane) });
      }
      case 'attach': {
        const plane = planeArg(), out = e.attachToPlane(this.ids(a), plane);
        return out.length ? text(`Attached ${out.join(', ')} to the ${outName(plane)} plane.`, { ids: out }) : fail('Nothing was attached.');
      }
      case 'move': {
        const out = e.perspMove({ x: num('dx', 0), y: num('dy', 0), n: num('dn', 0) }, { ids: this.ids(a), copy: a.copy === true });
        return out.length ? text(`${a.copy === true ? 'Copied' : 'Moved'} ${out.join(', ')} in perspective.`, { ids: out }) : fail('The objects are not in perspective: place or attach them first.');
      }
      case 'scale': {
        const sx = num('sx', 1), sy = num('sy', sx);
        if (!(Math.abs(sx) > 1e-6 && Math.abs(sy) > 1e-6)) throw new ToolError('sx and sy must not be 0.');
        return e.perspScale(sx, sy, { ids: this.ids(a) }) ? text('Scaled in perspective.', { selection: e.selectedIds() }) : fail('The objects are not in perspective: place or attach them first.');
      }
      case 'release': return e.releasePerspective(this.ids(a)) ? text('Released from perspective; the art keeps its look.') : fail('The objects are not in perspective.');
      case 'match_plane': return e.movePlaneToObject(this.ids(a)) ? describe() : fail('The object is not in perspective.');
    }
    return fail('Unknown perspective action: use get, grid, draw, place, attach, move, scale, release or match_plane.');
  }

  private graphTool(a: Record<string, unknown>, num: (k: string, d: number) => number, str: (k: string, d?: string) => string, has: (k: string) => boolean): McpResult {
    const e = this.engine, act = str('action', has('id') ? 'update' : 'create');
    const describeGraph = (id: string): McpResult => {
      const n = this.node(id);
      if (n.kind !== 'group' || !n.graph) return fail(`${id} is not a graph.`);
      const d = cleanData(n.graph.data), series = n.children.filter((c) => /^s\d+$/.test(c.part ?? '')).map((c) => ({ index: Number(c.part?.slice(1)), name: n.graph?.type === 'scatter' ? d.series[2 * Number(c.part?.slice(1))] : d.series[Number(c.part?.slice(1))], group_id: c.id }));
      return text(`${graphSummary(n.graph)} (id ${id}). Series groups: ${series.map((s) => `${s.index} ${s.name || '(unnamed)'} = ${s.group_id}`).join('; ')}. Data:\n${dataToText(d)}`, { id, type: n.graph.type, data: { series: d.series, categories: d.cats, values: d.values }, series, designs: (e.doc?.graphDesigns ?? []).map((x) => ({ id: x.id, name: x.name })) });
    };
    if (act === 'make_design') {
      const id = e.addGraphDesign(str('name'), this.ids(a));
      return id ? text(`Made the design ${str('name') || id} (id ${id}); use it with column_design or marker_design.`, { design: id }) : fail('Select or pass the art for the design (not part of a graph).');
    }
    let data: GraphData | undefined;
    if (has('table')) data = parseTable(str('table'));
    else if (a.data && typeof a.data === 'object') {
      const d = a.data as { series?: unknown; categories?: unknown; values?: unknown };
      if (!Array.isArray(d.values)) return fail('data needs values: a list of rows, each a list of numbers (null for an empty cell).');
      data = cleanData({ series: Array.isArray(d.series) ? d.series.map(String) : [], cats: Array.isArray(d.categories) ? d.categories.map(String) : [], values: d.values.map((r) => (Array.isArray(r) ? r.map((v) => (typeof v === 'number' ? v : v === null || v === '' ? null : parseNumber(String(v)))) : [])) });
    }
    if (data && a.transpose === true) data = transposeData(data);
    if (data && a.switch_xy === true) data = swapXY(data);
    const patch = this.graphPatch(a, num, str, has);
    const type = has('type') ? str('type') : undefined;
    if (type && !GRAPH_TYPES.some((t) => t[0] === type)) return fail(`type must be one of ${GRAPH_TYPES.map((t) => t[0]).join(', ')}.`);
    let id: string | null;
    if (act === 'create') {
      id = e.addGraph((type ?? 'column') as GraphType, { x: num('x', 72), y: num('y', 72), w: Math.max(4, num('width', 240)), h: Math.max(4, num('height', 160)) }, data, patch);
      if (!id) return fail('Could not add the graph.');
    } else {
      id = has('id') ? e.graphOf(str('id')) : e.graphTargets()[0] ?? null;
      if (!id) return fail('Pass the id of a graph (graph with action create returns one), or select one.');
      if (act === 'get') return describeGraph(id);
      const full: Partial<GraphSpec> = { ...patch, ...(data ? { data } : {}), ...(type ? { type: type as GraphType } : {}) };
      if (Object.keys(full).length) e.setGraph(full, [id], data && Object.keys(full).length === 1 ? 'Graph Data' : 'Graph');
    }
    if (a.series_types && typeof a.series_types === 'object') for (const [k, v] of Object.entries(a.series_types as Record<string, unknown>)) {
      if (v !== null && !['column', 'stacked', 'line', 'area'].includes(String(v))) return fail('series_types values are column, stacked, line, area or null.');
      e.setGraphSeries([Number(k)], { type: v === null ? null : v as GraphSeriesType }, [id]);
    }
    const designOf = (raw: unknown): string | null => { const d = e.doc?.graphDesigns?.find((x) => x.id === raw || x.name === raw); if (raw !== null && raw !== '' && !d) throw new ToolError(`No graph design is called ${String(raw)}: make one with action make_design.`); return d?.id ?? null; };
    for (const k of ['column_design', 'marker_design'] as const) {
      const o = a[k] as { series?: unknown; design?: unknown; mode?: unknown; per?: unknown; fraction?: unknown } | undefined;
      if (!o || typeof o !== 'object') continue;
      const n = this.node(id), count = n.kind === 'group' && n.graph ? Math.max(n.graph.data.series.length, ...n.graph.data.values.map((r) => r.length)) : 0;
      const series = Array.isArray(o.series) && o.series.length ? o.series.map(Number) : Array.from({ length: count }, (_, i) => i), des = designOf(o.design ?? null);
      if (k === 'column_design') e.setGraphSeries(series, { column: des ? { design: des, mode: (['vertical', 'uniform', 'repeat'].includes(String(o.mode)) ? o.mode : 'vertical') as GraphColumnDesign['mode'], per: Math.max(1e-6, Number(o.per ?? 10) || 10), fraction: o.fraction === 'scale' ? 'scale' : 'chop' } : null }, [id]);
      else e.setGraphSeries(series, { marker: des }, [id]);
    }
    return describeGraph(id);
  }

  private async variablesTool(a: Record<string, unknown>, num: (k: string, d: number) => number, str: (k: string, d?: string) => string, has: (k: string) => boolean): Promise<McpResult> {
    const e = this.engine, p = e.current as NonNullable<Engine['current']>, act = str('action', 'list');
    const vars = (): Variable[] => e.doc?.variables ?? [];
    const findVar = (): Variable => { const k = str('variable'); const v = vars().find((x) => x.id === k || x.name === k); if (!v) throw new ToolError(`No variable is called ${k}: call variables with action list.`); return v; };
    const list = (): McpResult => {
      const d = p.doc, sets = d.dataSets ?? [];
      const out = { variables: vars().map((v) => ({ id: v.id, name: v.name, kind: v.kind, object: v.node, bound: boundLabel(d, v) || null })), data_sets: sets.map((s, i) => ({ index: i, name: s.name, values: Object.fromEntries(vars().map((v) => [v.name, s.values[v.id] ?? null])) })), current: d.dataSet ?? null };
      return text(`${out.variables.length} variable(s): ${out.variables.map((v) => `${v.name} (${v.kind}${v.bound ? `, bound to ${v.bound}` : ', unbound'})`).join('; ') || 'none'}. ${sets.length} data set(s)${d.dataSet !== undefined ? `, showing ${sets[d.dataSet]?.name}` : ''}.`, out);
    };
    switch (act) {
      case 'list': return list();
      case 'make': {
        const kind = str('kind', 'text') as VariableKind;
        if (!VARIABLE_KINDS.some((k) => k[0] === kind)) return fail('kind is text, image, visibility or graph.');
        const id = e.makeVariable(kind, has('id') ? this.node(a.id).id : null, has('name') ? str('name') : undefined);
        return id ? list() : fail(kind === 'text' ? 'A text variable binds to type: pass the id of a text object.' : kind === 'image' ? 'An image variable binds to a placed image.' : kind === 'graph' ? 'A graph variable binds to a graph.' : 'Could not make the variable.');
      }
      case 'bind': return e.bindVariable(findVar().id, this.node(a.id).id) ? list() : fail('That object does not fit the variable (text to type, image to a placed image, graph to a graph).');
      case 'unbind': return e.bindVariable(findVar().id, null) ? list() : fail('Nothing changed.');
      case 'rename': return e.renameVariable(findVar().id, str('name')) ? list() : fail('Give a new name that no other variable has.');
      case 'delete': return e.deleteVariable(findVar().id) ? list() : fail('Nothing changed.');
      case 'capture': { const i = e.captureDataSet(has('name') ? str('name') : undefined); return i >= 0 ? list() : fail('Make a variable first.'); }
      case 'update': return e.updateDataSet(has('index') ? Math.round(num('index', 0)) : undefined) ? list() : fail('Show a data set first (action show).');
      case 'import': {
        if (!has('data')) return fail('Pass the data as CSV text (header row of variable names) or JSON (an array of objects).');
        const raw = typeof a.data === 'string' ? a.data : JSON.stringify(a.data), r = parseDataFile(p.doc, raw, typeof a.data === 'string' && str('format', /^\s*[[{]/.test(raw) ? 'json' : 'csv') === 'csv' ? 'csv' : 'json');
        if (!e.addDataSets(r.variables, r.sets)) return fail('The data has no rows.');
        return list();
      }
      case 'show': case 'load': {
        const sets = p.doc.dataSets ?? [], i = has('index') ? Math.round(num('index', 0)) : sets.findIndex((s) => s.name === str('name'));
        if (!sets[i]) return fail(`There is no data set ${has('index') ? i : str('name')}: call variables with action list.`);
        await showDataSet(e, i);
        return text(`Showing data set ${i}: ${sets[i].name}. get_image shows the result.`, { current: i });
      }
      case 'export': {
        const folder = str('folder').trim();
        if (!folder) return fail('Give folder, an absolute path where formpath writes one file per data set (it is created if missing).');
        const fmt = str('format', 'png');
        if (!['png', 'svg', 'pdf'].includes(fmt)) return fail('format is png, svg or pdf.');
        const r = await exportDataSets(e, { format: fmt as 'png', fpth: a.fpth === true, nameVar: has('name_variable') ? str('name_variable') : null, folder, scale: Math.max(0.1, Math.min(8, num('scale', 1))), artboard: Math.round(num('artboard', p.activeArtboard)), sets: Array.isArray(a.data_sets) ? a.data_sets.map(Number) : undefined }, VERSION);
        return (r.files.length ? text : fail)(`Wrote ${r.files.length} file(s) to ${folder}.${r.errors.length ? ` Problems: ${r.errors.join('; ')}` : ''}`, { files: r.files, errors: r.errors });
      }
      default: return fail('action is list, make, bind, unbind, rename, delete, capture, update, import, show or export.');
    }
  }

  private async actionsTool(a: Record<string, unknown>, str: (k: string, d?: string) => string, has: (k: string) => boolean): Promise<McpResult> {
    const ap = this.actions, act = str('action', 'list');
    if (!ap) return fail('The Actions panel is not ready yet: retry in a moment.');
    if (act === 'list') {
      const sets = ap.describe();
      return text(sets.map((s) => `${s.set}: ${s.actions.map((x) => `${x.name} (${x.steps.length} steps)`).join(', ')}`).join('\n') || 'No actions.', { sets });
    }
    if (!has('name')) return fail('Pass name (the action) and, if two sets have one by that name, set.');
    if (act === 'play') {
      if (!this.engine.current) return fail('No document is open: call new_document or open_file first.');
      const r = await ap.playNamed(has('set') ? str('set') : undefined, str('name'));
      if (!r) return fail(`There is no action called ${str('name')}: call actions with action list.`);
      return (r.stopped ? fail : text)(`Played ${str('name')}: ${r.ran} of ${r.total} steps ran${r.stopped ? `; it stopped: ${r.stopped}` : ''}.`, { ran: r.ran, total: r.total, stopped: r.stopped });
    }
    if (act === 'batch') {
      const source = str('source', 'folder') === 'data_sets' ? 'datasets' : 'folder';
      if (source === 'folder' && !str('folder').trim()) return fail('Give folder, the absolute path of the folder of .fpth, SVG or PDF files to run the action on.');
      if (!str('out').trim()) return fail('Give out, the absolute path of the folder to save the results and the log in.');
      const fmt = str('format', 'same');
      if (!['same', 'fpth', 'svg', 'pdf', 'png'].includes(fmt)) return fail('format is same, fpth, svg, pdf or png.');
      const r = await ap.batch({ set: has('set') ? str('set') : '', action: str('name'), source, folder: str('folder'), kinds: Array.isArray(a.kinds) ? a.kinds.map((k) => `.${String(k).replace(/^\./, '').toLowerCase()}`) : undefined, dest: 'folder', out: str('out'), format: fmt as 'same', name: has('name_variable') ? str('name_variable') : null, stopOnError: a.stop_on_error === true });
      return text(`Batch done: ${r.done} file(s) saved, ${r.failed} failed. Log: ${r.logPath ?? 'not written'}.`, { done: r.done, failed: r.failed, files: r.files, log: r.log, log_path: r.logPath });
    }
    return fail('action is list, play or batch.');
  }

  private async shapeFillTool(a: Record<string, unknown>, num: (k: string, d: number) => number, str: (k: string, d?: string) => string, has: (k: string) => boolean): Promise<McpResult> {
    const e = this.engine, st = await modelState();
    if (!st.ready) return fail(st.message);
    const n = has('id') ? this.node(a.id) : e.selected().find((x) => x.kind === 'path' || x.kind === 'compound');
    if (!n || (n.kind !== 'path' && n.kind !== 'compound')) return fail('Pass id of a closed path or compound path (or select one) to fill.');
    const d = n.kind === 'path' ? n.d : n.children.flatMap((c) => c.d);
    if (!d.some((s) => s.closed)) return fail('The path is open: AI Shape Fill fills closed shapes.');
    const fillC = n.ap.items.find((i) => i.kind === 'fill' && i.paint.type === 'color');
    const common = await this.genCommon(a, st.vision);
    if (typeof common === 'string') return fail(common);
    const res = await shapeFillVariations({ d, rule: n.rule, color: fillC && fillC.paint.type === 'color' ? fillC.paint.color : null }, { ...common, prompt: str('prompt'), strength: num('shape_strength', 50), detail: common.detail ?? 5, variations: Math.round(num('variations', 1)) });
    const ok = res.map((r, i) => (r.art ? i : -1)).filter((i) => i >= 0);
    if (!ok.length) return fail(`The model gave no usable art: ${res.map((r) => r.error).filter(Boolean).join('; ')}`);
    const pick = has('pick') && ok.includes(Math.round(num('pick', 0))) ? Math.round(num('pick', 0)) : ok[0];
    const art = res[pick].art as VNode;
    const id = e.replaceWithClip(n.id, artParts(art), 'AI Shape Fill', 'AI Shape Fill');
    if (!id) return fail('Could not place the art.');
    const rep = reportLines(res[pick].report ?? { dropped: [], fixed: [], notes: [] });
    return text(`Filled ${n.id} with variation ${pick} of ${res.length} (${st.model}); the art is a clipping group ${id} whose last child is the original shape.${rep.length ? ` Repairs: ${rep.join('; ')}.` : ''} get_image shows it.`, { id, shape: n.id, variations: this.genRows(res), picked: pick, report: rep });
  }

  private genRows(res: GenVariation[]): Array<{ index: number; ok: boolean; error: string | null; report: string[] }> {
    return res.map((r, i) => ({ index: i, ok: !!r.art, error: r.error, report: r.report ? reportLines(r.report) : [] }));
  }

  private async genCommon(a: Record<string, unknown>, vision: boolean): Promise<GenCommon | string> {
    const style = typeof a.style_preset === 'string' && a.style_preset ? a.style_preset : 'auto';
    if (style !== 'auto' && !STYLE_IDS.includes(style)) return `style_preset is one of ${STYLE_IDS.join(', ')}.`;
    const fx = Array.isArray(a.effects) ? a.effects.map((x) => String(x)) : [];
    const badFx = fx.find((x) => !EFFECT_NAMES.includes(x));
    if (badFx) return `effects are ${EFFECT_NAMES.join(', ')}; "${badFx}" is not one.`;
    const tone = typeof a.color_tone === 'string' && a.color_tone ? a.color_tone : 'auto';
    if (tone !== 'auto' && tone !== 'reference' && !TONE_IDS.includes(tone)) return `color_tone is one of ${TONE_IDS.join(', ')}, reference.`;
    const palette: Color[] = [];
    if (Array.isArray(a.palette)) for (const raw of a.palette.slice(0, 8)) { const c = parseColor(String(raw)); if (!c) return `palette colour "${String(raw)}" is not a colour.`; palette.push(c); }
    let reference = null;
    if (typeof a.style_reference === 'string' && a.style_reference) {
      const p = this.engine.current;
      if (!p) return 'No document is open.';
      try { reference = await styleReference(p, [this.node(a.style_reference)], vision); } catch (err) { return err instanceof Error ? err.message : String(err); }
    }
    if (tone === 'reference' && !reference) return 'color_tone reference needs style_reference.';
    return { detail: detailLevel(a.detail, 5), style, reference, effects: fx, tone, ...(palette.length ? { palette } : {}) };
  }

  private async textToVectorTool(a: Record<string, unknown>, num: (k: string, d: number) => number, str: (k: string, d?: string) => string, has: (k: string) => boolean): Promise<McpResult> {
    if (!loadPrefs().showGenerative) return fail('Generative features are hidden: turn on View > Generative Features first.');
    const e = this.engine, st = await modelState();
    if (!st.ready) return fail(st.message);
    const type = str('type', 'subject');
    if (!['subject', 'scene', 'icon', 'pattern'].includes(type)) return fail('type is subject, scene, icon or pattern.');
    const common = await this.genCommon(a, st.vision);
    if (typeof common === 'string') return fail(common);
    const res = await textToVectorVariations({ ...common, prompt: str('prompt'), type, detail: common.detail ?? 5, variations: Math.round(num('variations', 1)) });
    const ok = res.map((r, i) => (r.art ? i : -1)).filter((i) => i >= 0);
    if (!ok.length) return fail(`The model gave no usable art: ${res.map((r) => r.error).filter(Boolean).join('; ')}`);
    const pick = has('pick') && ok.includes(Math.round(num('pick', 0))) ? Math.round(num('pick', 0)) : ok[0];
    const id = placeVector(e, res[pick].art as VNode);
    if (!id) return fail('Could not place the art.');
    const rep = reportLines(res[pick].report ?? { dropped: [], fixed: [], notes: [] });
    return text(`Placed variation ${pick} of ${res.length} (${st.model}) as group ${id}, fitted to the selection or the artboard; every path is editable.${rep.length ? ` Repairs: ${rep.join('; ')}.` : ''} get_image shows it.`, { id, variations: this.genRows(res), picked: pick, report: rep });
  }

  private async generativeRecolorTool(a: Record<string, unknown>, num: (k: string, d: number) => number, str: (k: string, d?: string) => string, has: (k: string) => boolean): Promise<McpResult> {
    if (!loadPrefs().showGenerative) return fail('Generative features are hidden: turn on View > Generative Features first.');
    const e = this.engine, p = e.current, st = await modelState();
    if (!st.ready) return fail(st.message);
    if (!p) return fail('No document is open.');
    const ids = this.ids(a) ?? e.targetIds();
    const nodes = ids.map((id) => findNode(p.doc, id)).filter((n): n is VNode => !!n);
    if (!collectColors(nodes).length) return fail('Those objects have no colours to recolour: select or pass ids of painted objects.');
    const palettes = await generativePalettes(str('prompt'), Math.round(num('count', 1)));
    const pick = has('pick') && palettes[Math.round(num('pick', 0))] ? Math.round(num('pick', 0)) : 0;
    e.edit('AI Recolor', (d) => recolorWithPalette(d, ids, nodes, palettes[pick]));
    return text(`Recolored ${ids.length} object(s) with palette ${pick} of ${palettes.length} (${st.model}).`, { palettes: palettes.map((pl) => pl.map((c) => hex(c))), picked: pick });
  }

  private async colorTool(name: string, a: Record<string, unknown>, str: (k: string, d?: string) => string, has: (k: string) => boolean): Promise<McpResult> {
    const e = this.engine, doc = e.doc;
    if (!doc) return fail('No document is open.');
    const list = await refreshProfiles();
    if (!list.length) return fail('The colour profiles are unavailable: is the engine running (./formpath boot)?');
    const pick = (key: string, space: 'RGB' | 'CMYK'): ProfileInfo | string => {
      const hit = findProfile(str(key), space);
      return hit ?? `${key} "${str(key)}" is not a ${space} profile on this computer. list_color_profiles shows the names to use.`;
    };
    const line = (p: ProfileInfo): string => `${p.name} [${p.space}, ${p.class}, ${p.source}] id ${p.id}`;
    if (name === 'list_color_profiles') {
      const s = resolveSettings(doc.cm);
      const shown = await refreshDisplayProfile();
      return text(`${list.length} colour profiles. The document uses RGB ${s.rgb?.name ?? 'none'}, CMYK ${s.cmyk?.name ?? 'none (formula)'}, intent ${INTENTS[s.intent][1]}, black point compensation ${s.bpc ? 'on' : 'off'}; Proof Colors is ${isProofing() ? 'on' : 'off'}; the display profile is ${shown ? `${shown.name} (from ${shown.via})` : 'unknown, so proofs use sRGB'}.\n${list.map(line).join('\n')}`, { profiles: list, settings: { rgb: s.rgb?.name ?? null, cmyk: s.cmyk?.name ?? null, intent: s.intent, bpc: s.bpc, proof: isProofing() }, display: shown ? { name: shown.name, id: shown.id, via: shown.via } : null });
    }
    if (name === 'set_color_settings') {
      const s = resolveSettings(doc.cm);
      let rgb = s.rgb, cmyk = s.cmyk, intent: number = s.intent, bpc = s.bpc;
      if (has('rgb_profile')) { const r = pick('rgb_profile', 'RGB'); if (typeof r === 'string') return fail(r); rgb = r; }
      if (has('cmyk_profile')) {
        if (['none', 'formula', ''].includes(str('cmyk_profile').toLowerCase())) cmyk = null;
        else { const r = pick('cmyk_profile', 'CMYK'); if (typeof r === 'string') return fail(r); cmyk = r; }
      }
      if (has('intent')) {
        const names: Record<string, number> = { perceptual: 0, relative: 1, relative_colorimetric: 1, saturation: 2, absolute: 3, absolute_colorimetric: 3 };
        const v = names[str('intent').toLowerCase()];
        if (v === undefined) return fail('intent is one of perceptual, relative_colorimetric, saturation, absolute_colorimetric.');
        intent = v;
      }
      if (has('bpc')) bpc = a.bpc === true;
      const changed = applySettings(e, settingsPatch(rgb, cmyk, intent, bpc, doc.cm));
      await colorSettled();
      const now = resolveSettings(e.doc?.cm);
      return text(`${changed ? 'Set' : 'Kept'} Color Settings: RGB ${now.rgb?.name ?? 'none'}, CMYK ${now.cmyk?.name ?? 'none (formula)'}, ${INTENTS[now.intent][1]}, black point compensation ${now.bpc ? 'on' : 'off'}${colorManaged() ? '; CMYK colours now follow the profile' : ''}.`, { changed, rgb: now.rgb?.name ?? null, cmyk: now.cmyk?.name ?? null, intent: now.intent, bpc: now.bpc });
    }
    if (name === 'convert_to_profile') {
      const hit = findProfile(str('profile'));
      if (!hit || (hit.space !== 'RGB' && hit.space !== 'CMYK')) return fail(`profile "${str('profile')}" is not an RGB or CMYK profile on this computer. list_color_profiles shows the names to use.`);
      try { await convertToProfile(e, hit); } catch (err) { return fail(err instanceof Error ? err.message : 'The conversion failed.'); }
      await colorSettled();
      return text(`Converted every colour in the document to ${hit.name} as one undo step.`, { profile: hit.name, space: hit.space });
    }
    if (has('profile')) {
      const r = pick('profile', 'CMYK');
      if (typeof r === 'string') return fail(r);
      applySettings(e, { proof: { ...(doc.cm?.proof ?? {}), device: refOf(r) } }, 'Proof Setup');
    }
    const on = a.on !== false;
    const ok = await setProofing(on, e.doc);
    if (on && !ok) return fail('Proof Colors could not start: is the engine running and is a CMYK profile available?');
    return text(`Proof Colors is ${on ? 'on' : 'off'}${on ? ` for ${proofDevice(e.doc?.cm)?.name ?? 'the proof device'}` : ''}. get_image shows the document colours, not the proof.`, { on });
  }

  private async patternsTool(a: Record<string, unknown>, num: (k: string, d: number) => number, str: (k: string, d?: string) => string, has: (k: string) => boolean): Promise<McpResult> {
    const e = this.engine, st = await modelState();
    if (!st.ready) return fail(st.message);
    let colors: Color[] = [];
    if (Array.isArray(a.colors)) colors = a.colors.map((c) => parseColor(String(c))).filter((c): c is Color => !!c).slice(0, 12);
    else if (has('preset')) {
      const p = str('preset');
      if (p === 'document') colors = (e.doc?.swatches ?? []).flatMap((s) => (s.paint.type === 'color' && !s.name.startsWith('[') ? [s.paint.color] : [])).slice(0, 12);
      else { const hit = PATTERN_PRESETS.find(([id]) => id === p); if (!hit) return fail(`preset is one of ${PATTERN_PRESETS.map(([id]) => id).join(', ')}, document.`); colors = hit[2].map((h) => parseColor(h)).filter((c): c is Color => !!c); }
    }
    const common = await this.genCommon(a, st.vision);
    if (typeof common === 'string') return fail(common);
    const layouts: Record<string, PatternLayout> = { grid: 'grid', brick_by_row: 'brick_row', brick_by_column: 'brick_col', hex_by_column: 'hex_col', hex_by_row: 'hex_row' };
    const layout = layouts[str('layout', 'grid')];
    if (!layout) return fail(`layout is one of ${Object.keys(layouts).join(', ')}.`);
    const res = await patternVariations({ ...common, prompt: str('prompt'), colors, detail: common.detail ?? 4, density: num('density', 3), variations: Math.round(num('variations', 2)), tile: num('tile_size', 96), seamless: a.seamless !== false, layout, hs: num('h_spacing', 0), vs: num('v_spacing', 0), project: e.current });
    const good = res.filter((r) => r.art);
    if (!good.length) return fail(`The model gave no usable tile: ${res.map((r) => r.error).filter(Boolean).join('; ')}`);
    const base = (str('name') || str('prompt') || 'Generated Pattern').replace(/\s+/g, ' ').slice(0, 32);
    const fillIds = a.fill_selection === true ? (this.ids(a) ?? e.selectedIds()) : [];
    const ids = e.addPatternSwatches(good.map((r, i) => ({ name: `${base} ${i + 1}`, tile: r.tile, art: r.art as VNode, type: r.layout?.type, hs: r.layout?.hs, vs: r.layout?.vs })), fillIds);
    const defs = (e.doc?.patterns ?? []).filter((p) => ids.includes(p.id));
    const rep = good.flatMap((r) => (r.report ? reportLines(r.report) : []));
    return text(`Saved ${ids.length} pattern swatch${ids.length === 1 ? '' : 'es'}: ${defs.map((p) => p.name).join(', ')}${fillIds.length ? '; filled the selection with the first' : ''}. Paint with set_paint using the swatch name.${rep.length ? ` Notes: ${[...new Set(rep)].join('; ')}.` : ''}`, { patterns: defs.map((p) => ({ id: p.id, name: p.name })), errors: res.map((r) => r.error).filter(Boolean), variations: res.map((r, i) => ({ index: i, ok: !!r.art, error: r.error, report: r.report ? reportLines(r.report) : [], seam: r.seam ?? null })) });
  }

  private async retypeTool(a: Record<string, unknown>, num: (k: string, d: number) => number, str: (k: string, d?: string) => string, has: (k: string) => boolean): Promise<McpResult> {
    const e = this.engine, p = e.current;
    if (!p) return fail('No document is open.');
    const nodes = (this.ids(a) ?? e.selectedIds()).map((id) => findNode(p.doc, id)).filter((n): n is VNode => !!n);
    const img = nodes.find((n) => n.kind === 'image');
    const reg = a.region && typeof a.region === 'object' ? a.region as Record<string, unknown> : null;
    const region = reg && [reg.x, reg.y, reg.width, reg.height].every((v) => typeof v === 'number') ? { x: reg.x as number, y: reg.y as number, w: reg.width as number, h: reg.height as number } : null;
    const outl = nodes.filter((n) => n.kind === 'path' || n.kind === 'compound' || (n.kind === 'group' && !n.clip));
    if (!img && !outl.length) return fail('Pass ids of outlined type (paths, compound paths or their group) or of a placed image, or select them.');
    const src = img ? await sourceFromImage(p, img, region) : await sourceFromOutlines(p, outl);
    const st = await modelState();
    let known = has('text') && str('text').trim() ? { text: str('text').trim(), description: '' } : null;
    if (!known && st.ready && st.vision) known = await recognize(src, async (prompt, image) => (await api.llmGenerate('', prompt, { image, temperature: 0, maxTokens: 400 })).text).catch(() => null);
    if (!known && img) return fail(st.ready && st.vision ? 'The model could not read text in the image: pass text.' : 'Reading text in an image needs a model that reads images (Preferences > Plugins, The model reads images). Pass text with the words instead.');
    const r = await rankFonts(src, known, () => undefined);
    const list = r.matches.map((m, i) => ({ index: i, family: m.family, style: m.style, score: Math.round(m.score * 100) }));
    if (a.apply !== true) return text(`Read "${r.text}". Top matches: ${list.map((m) => `${m.index} ${m.family} ${m.style} (${m.score}%)`).join(', ')}. Call retype again with apply true and pick (or font and style) to make live text.`, { text: r.text, matches: list, recognized_by: known ? (has('text') ? 'given' : 'model') : 'shapes' });
    const fam = str('font'), sty = str('style');
    const m = fam ? r.matches.find((x) => x.family === fam && (!sty || x.style === sty)) ?? { family: fam, style: sty || 'Regular', score: 0, text: r.text } : r.matches[Math.max(0, Math.min(r.matches.length - 1, Math.round(num('pick', 0))))];
    if (!m) return fail('No font matched.');
    await this.deps.ensureFace?.(m.family, m.style);
    const node = await retypeNode(src, m, has('text') ? str('text') : r.text);
    const id = e.replaceWithText(src.ids, node, !!img && a.keep_image !== false);
    return id ? text(`Set "${r.text}" as live ${m.family} ${m.style} (id ${id}).`, { id, family: m.family, style: m.style, matches: list }) : fail('Could not place the text.');
  }

  /** Files that travel with a 3D model (its .mtl, .bin and textures), read from the same folder by the engine service. */
  private siblings(file: File, a: Record<string, unknown>): void {
    if (!Array.isArray(a.parts) || !/\.(obj|glb|gltf)$/i.test(file.name)) return;
    const out: File[] = [];
    for (const q of a.parts as Array<Record<string, unknown>>) {
      if (!q || typeof q.name !== 'string' || typeof q.data !== 'string') continue;
      out.push(new File([Uint8Array.from(atob(q.data), (c) => c.charCodeAt(0))], q.name));
    }
    if (out.length) modelSiblings.set(file, out);
  }

  private dxfArgs(a: Record<string, unknown>, place: boolean): Partial<DxfImportOptions> {
    const u = typeof a.units === 'string' && DXF_UNITS.some(([x]) => x === a.units) ? a.units as DxfUnit : undefined;
    return { units: u, scale: typeof a.drawing_scale === 'number' && a.drawing_scale > 0 ? a.drawing_scale : undefined, layout: typeof a.layout === 'string' ? a.layout : undefined, merge: typeof a.merge_layers === 'boolean' ? a.merge_layers : place, fit: a.fit_artboard === true ? 'artboard' : undefined };
  }

  async run(name: string, a: Record<string, unknown>, from: 'loop' | 'plugin' | 'assistant' = 'plugin'): Promise<McpResult> {
    const e = this.engine;
    const num = (k: string, d: number): number => (typeof a[k] === 'number' && Number.isFinite(a[k]) ? a[k] as number : d);
    const str = (k: string, d = ''): string => (typeof a[k] === 'string' ? a[k] as string : d);
    const has = (k: string): boolean => a[k] !== undefined && a[k] !== null;
    if (from !== 'loop' && (name.startsWith('__') || /^(open_file|save_project|export_file|place_image|links)$/.test(name) || (name === 'variables' && ['export', 'show', 'load'].includes(str('action', 'list'))) || (name === 'actions' && str('action', 'list') === 'batch'))) return fail(`${name}${name === 'variables' || name === 'actions' ? ` ${str('action')}` : ''} reads or writes files, which only outside agents can do.`);
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
        this.siblings(file, a);
        await this.deps.openFile(file, this.dxfArgs(a, false), typeof a.password === 'string' ? a.password : undefined);
        const q = e.current;
        return q ? text(`Opened ${file.name} as ${q.name}: ${q.doc.artboards.length} artboard(s), ${q.doc.layers.length} layer(s).`, { name: q.name }) : fail(`Could not open ${file.name}.`);
      }
      if (name === 'list_commands' && this.catalogue) {
        const shown = this.catalogue.list(str('group') || undefined, str('filter') || str('text') || undefined).filter((x) => !x.windowOnly);
        const cap = Math.max(1, Math.min(1000, Number(a.limit) || 400));
        const line = (x: CatalogueEntry): string => `${x.id}: ${x.path}${x.keys ? ` [${x.keys[0]}]` : ''}${x.params ? ` (params: ${Object.keys(x.params).join(', ')})` : ''}${x.risky ? ' (undo cannot reverse)' : ''}${x.enabled ? '' : ' (not available now)'}`;
        const groups = [...new Set(this.catalogue.build().filter((x) => !x.windowOnly).map((x) => x.group))].sort();
        return text(`${shown.length} of the catalogue${shown.length > cap ? `, first ${cap} shown` : ''}. Groups: ${groups.join(', ')}.\n${shown.slice(0, cap).map(line).join('\n') || 'No commands match.'}`, { size: shown.length, groups, commands: shown.slice(0, cap) });
      }
      if (name === 'describe_command' && this.catalogue) {
        const d = this.catalogue.describe(str('id') || str('command'));
        if ('error' in d) return fail(`${d.error}${d.suggestions.length ? ` Did you mean ${d.suggestions.join(', ')}?` : ' list_commands lists every id.'}`);
        return text(`${d.id}: ${d.path}. ${d.description}${d.when ? ` ${d.when}` : ''}${d.enabled ? '' : ' Not available now.'}`, { ...d });
      }
      if (name === 'run_command' && this.catalogue) {
        const params = typeof a.params === 'object' && a.params !== null && !Array.isArray(a.params) ? a.params as Record<string, unknown> : undefined;
        const r = this.catalogue.run(str('id') || str('command'), params, true);
        return r.ok ? text(r.message, { ...r }) : fail(r.message);
      }
      if (name === 'run_commands' && this.catalogue) {
        const steps = Array.isArray(a.steps) ? (a.steps as Array<{ id: string; params?: Record<string, unknown> }>).filter((s) => s && typeof s === 'object') : [];
        if (!steps.length) return fail('steps needs at least one {id, params} item.');
        const rs = this.catalogue.runMany(steps, true);
        const bad = rs.find((r) => !r.ok);
        const summary = rs.map((r, i) => `${i + 1}. ${r.id}: ${r.message}`).join('\n');
        return bad ? fail(`Stopped at step ${rs.length} of ${steps.length}; the steps that ran are one undo step.\n${summary}`) : text(`Ran ${rs.length} commands as one undo step.\n${summary}`, { results: rs });
      }
      if (name === 'actions') return await this.actionsTool(a, str, has);
      const p = e.current;
      if (!p) return fail('No document is open: call new_document or open_file first.');
      switch (name) {
        case 'graph': return this.graphTool(a, num, str, has);
        case 'perspective': return this.perspectiveTool(a, num, str, has);
        case 'variables': return await this.variablesTool(a, num, str, has);
        case 'generative_shape_fill': return await this.shapeFillTool(a, num, str, has);
        case 'generate_patterns': return await this.patternsTool(a, num, str, has);
        case 'text_to_vector': return await this.textToVectorTool(a, num, str, has);
        case 'generative_recolor': return await this.generativeRecolorTool(a, num, str, has);
        case 'retype': return await this.retypeTool(a, num, str, has);
        case 'list_color_profiles': case 'set_color_settings': case 'convert_to_profile': case 'proof_colors': return await this.colorTool(name, a, str, has);
        case 'get_document': { const d = e.describe(Math.max(1, Math.min(32, Math.round(num('depth', 8))))); return text(JSON.stringify(d), d); }
        case 'get_image': {
          const blob = await this.deps.image(str('scope', 'artboard'), has('artboard') ? Math.round(num('artboard', 0)) : undefined, Math.max(64, Math.min(2048, Math.round(num('max_size', 1024)))), a.outline === true);
          if (!blob) return fail('There is nothing to show in that scope.');
          return { content: [{ type: 'image', data: await b64(blob), mimeType: 'image/png' }, { type: 'text', text: `The ${str('scope', 'artboard')} as it looks now.` }] };
        }
        case 'get_svg': { const s = await this.deps.svg(str('scope', 'artboard'), has('artboard') ? Math.round(num('artboard', 0)) : undefined, Array.isArray(a.ids) ? a.ids.map(String) : undefined); return text(s.length > 200000 ? `${s.slice(0, 200000)}\n<!-- truncated -->` : s); }
        case 'get_object': { const n = this.node(a.id); const out = { ...JSON.parse(JSON.stringify(n)) as Record<string, unknown>, bounds: box(geomBounds(p.doc, n)), visual_bounds: box(visualBounds(p.doc, n)), ...(n.kind === 'text' ? { text: plainText(n), overflow: layoutText(n).overflow >= 0 } : {}), ...(n.kind === 'path' && n.live ? { shape: { kind: n.live.kind, ...liveParams(n.live) } } : {}) }; return text(JSON.stringify(out).slice(0, 100000), out); }
        case '__place': {
          const crop = str('crop', 'bounding') as CropTo;
          if (has('crop') && !CROP_CHOICES.some(([c]) => c === crop)) return fail(`crop must be one of ${CROP_CHOICES.map(([c]) => c).join(', ')}.`);
          if (has('psd_import') && !['objects', 'flatten'].includes(str('psd_import'))) return fail('psd_import must be objects or flatten.');
          const placing: PlaceOptions = { ...(has('page') ? { page: Math.max(1, Math.round(num('page', 1))) } : {}), ...(has('crop') ? { crop } : {}), ...(has('psd_import') ? { psd: str('psd_import') === 'flatten' ? 'flatten' as const : 'layers' as const } : {}), mode: a.link === true ? 'link' as const : 'embed' as const };
          if (a.link === true && has('path') && this.deps.placeLinked) {
            const id = await this.deps.placeLinked(str('path'), has('x') && has('y') ? { x: num('x', 0), y: num('y', 0) } : null, has('width') ? num('width', 100) : null, placing);
            return id ? text(`Placed ${str('name')} linked to ${str('path')} (id ${id}); the links tool reports when the file changes.`, { id, linked: true }) : fail(`Could not place ${str('name')}.`);
          }
          const bytes = Uint8Array.from(atob(str('data')), (c) => c.charCodeAt(0)), file = new File([bytes], str('name'));
          this.siblings(file, a);
          const id = await this.deps.placeFile(file, has('x') && has('y') ? { x: num('x', 0), y: num('y', 0) } : null, has('width') ? num('width', 100) : null, this.dxfArgs(a, true), placing);
          return id ? text(`Placed ${file.name} (id ${id}).`, { id }) : fail(`Could not place ${file.name}.`);
        }
        case '__project': { const blob = await this.deps.projectBlob(); return blob ? text('Packed the project.', { data: await b64(blob) }) : fail('Could not pack the project: is the engine running (./formpath boot)?'); }
        case '__export': {
          const asked = str('format') as 'svg' | 'pdf' | 'ai' | 'png' | 'gif' | 'bmp' | 'psd' | 'tiff' | 'jpeg' | 'webp' | 'eps' | 'dxf' | 'dwg';
          const fmt = asked === 'png' && has('colors') ? 'png8' : asked;
          const oneOf = (key: string, list: readonly string[], dflt: string): string => { const v = str(key, dflt); return list.includes(v) ? v : ''; };
          const aa = oneOf('anti_aliasing', ['art', 'none', 'type'], 'art'), palette = oneOf('palette', ['perceptual', 'selective', 'adaptive'], 'perceptual'), dither = oneOf('dither', ['diffusion', 'none'], 'diffusion');
          if (!aa || !palette || !dither) return fail(`${!aa ? 'anti_aliasing must be art, none or type' : !palette ? 'palette must be perceptual, selective or adaptive' : 'dither must be diffusion or none'}.`);
          if (has('matte') && !/^#?[0-9a-fA-F]{6}$/.test(str('matte'))) return fail('matte must be a hex colour such as #ffffff.');
          const raster: Partial<RasterExtra> = { aa: aa as RasterExtra['aa'], colors: Math.max(2, Math.min(256, Math.round(num('colors', 256)))), palette: palette as RasterExtra['palette'], dither: dither as RasterExtra['dither'], amount: Math.max(0, Math.min(100, num('dither_amount', 88))), matte: has('matte') ? '#' + str('matte').replace('#', '') : '#ffffff', interlace: a.interlaced === true, bmpBits: num('bmp_bits', 24) === 32 ? 32 : 24, psdCmyk: fmt === 'psd' && str('color') === 'cmyk', psdLayers: a.psd_layers !== false, psdEdit: a.psd_edit !== false };
          const units = str('units', 'mm') as DxfUnit;
          if (fmt === 'dwg' && str('dxf_version', '2000') === 'R12') return fail('DWG is written as AutoCAD 2000 only; dxf_version R12 applies to .dxf.');
          if ((fmt === 'dxf' || fmt === 'dwg') && !DXF_UNITS.some(([u]) => u === units)) return fail(`units must be one of ${DXF_UNITS.map(([u]) => u).join(', ')}.`);
          const cad: CadChoice = { version: str('dxf_version', '2000') === 'R12' ? 'R12' : '2000', units, scale: Math.max(1e-4, num('drawing_scale', 1)), text: a.outline_text === true ? 'outlines' : 'text', lineweights: a.scale_lineweights === true };
          const pdfOnly = fmt === 'pdf', standard = pdfOnly ? standardFrom(a.pdf_standard) : 'none', security = pdfOnly ? securityFrom(a) : undefined, layers = pdfOnly && a.pdf_layers === true;
          if (pdfOnly) { const refusal = pdfRefusal({ standard, security, layers }); if (refusal) return fail(refusal); }
          const blob = await this.deps.exportBlob(fmt, { scope: str('scope', fmt === 'pdf' || fmt === 'ai' ? 'all_artboards' : 'artboard'), artboard: has('artboard') ? Math.round(num('artboard', 0)) : undefined, raster, scale: has('ppi') ? Math.max(1, Math.min(2400, num('ppi', 72))) / 72 : Math.max(0.01, Math.min(16, num('scale', 1))), quality: Math.max(0.05, Math.min(1, num('quality', 0.92))), transparent: a.transparent === true, outlineText: a.outline_text === true, liveText: a.live_text !== false, standard, layers, security, compression: pdfOnly ? compressionFrom(a) : undefined, cmyk: has('color') ? str('color') === 'cmyk' : undefined, cad });
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
          const id = e.addText(str('text'), num('x', 0), num('y', 0), { mode, width: num('width', 200), height: num('height', 100), path, style, para: has('align') ? { align: str('align') as 'left' } : undefined, name: str('name') || undefined, layer: this.layer(a), vertical: str('orientation') === 'vertical' });
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
          if (has('overprint_fill')) e.setOverprint('fill', a.overprint_fill === true, ids);
          if (has('overprint_stroke')) e.setOverprint('stroke', a.overprint_stroke === true, ids);
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
          if (has('custom_profile')) { if (!widthProfileNamed(str('custom_profile'))) return fail(`custom_profile "${str('custom_profile')}" is not a saved profile. Saved profiles: ${customProfileNames().join(', ') || 'none'}.`); e.setWidthProfile(str('custom_profile'), ids); }
          if (Array.isArray(a.width_points)) {
            const pts = a.width_points.map((raw: unknown) => { const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>; return { t: Number(o.offset), l: Number(o.left), r: Number(o.right ?? o.left) }; });
            if (!pts.length || pts.some((q) => !(q.t >= 0 && q.t <= 1 && q.l >= 0 && q.r >= 0 && Number.isFinite(q.l) && Number.isFinite(q.r)))) return fail('width_points are {offset, left, right}: offset from 0 (start) to 1 (end), left and right 0 or more as multiples of half the stroke weight.');
            e.setWidthPoints(pts, ids);
          }
          if (a.flip_along === true || a.flip_across === true) e.flipWidthProfile(a.flip_along === true, a.flip_across === true, ids);
          if (has('save_profile_as')) {
            const t0 = e.targetIds(ids)[0], nd = t0 && e.doc ? findNode(e.doc, t0) : null, sv = nd && nd.kind !== 'text' ? (nd.ap.items.find((i) => i.kind === 'stroke') as StrokeItem | undefined)?.profile : null;
            if (!sv?.length) return fail('save_profile_as needs an object whose stroke has width points: set profile or width_points first.');
            if (!saveWidthProfile(str('save_profile_as'), sv)) return fail('save_profile_as needs a name that is not one of the built-in profiles.');
          }
          if (has('gradient_mode')) {
            const m = str('gradient_mode');
            if (m !== 'within' && m !== 'along' && m !== 'across') return fail('gradient_mode is within, along or across.');
            if (!e.setStrokeGradientMode(m, ids)) return fail('None of these objects has a linear or radial gradient stroke: give them one with set_paint (stroke: {type: linear, stops: [...]}) first.');
          }
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
        case 'add_swatch': {
          if (has('tint_of')) {
            const parent = p.doc.swatches.find((s) => s.name === str('tint_of') || s.id === str('tint_of'));
            if (!parent) return fail(`No swatch called ${str('tint_of')}: see the swatches in get_document.`);
            const id = e.addTintSwatch(parent.id, num('tint', 50));
            if (!id) return fail(`${parent.name} is a process swatch; tints come from global or spot swatches (add_swatch with global or spot true).`);
            if (has('name')) e.editSwatch(id, { name: str('name') });
            return text(`Added the tint swatch ${has('name') ? str('name') : `${parent.name} ${Math.round(num('tint', 50))}%`} (id ${id}).`, { id });
          }
          if (!has('color')) return fail('Give color, or tint_of with tint.');
          const pt = this.paint(a.color, 'color'); const id = e.addSwatch(str('name') || 'Swatch', pt, a.global === true || a.spot === true, a.spot === true, str('group') || undefined); return text(`Added the swatch ${str('name')} (id ${id}).`, { id });
        }
        case 'swatch_library': {
          const libs = [...SWATCH_LIBRARIES, ...(this.deps.userLibraries?.().swatches ?? [])];
          if (str('action', 'list') === 'list') { const list = libs.map((l) => ({ id: l.id, name: l.name, folder: l.user ? 'User Defined' : l.folder ?? '', groups: l.groups.map((g) => ({ name: g.name, swatches: g.swatches.map((s) => s.name) })) })); return text(list.map((l) => `${l.id} (${l.folder ? `${l.folder} > ` : ''}${l.name}): ${l.groups.map((g) => `${g.name || 'ungrouped'} [${g.swatches.length}]`).join(', ')}`).join('\n'), { libraries: list }); }
          const lib = swatchLibrary(str('library'), libs.filter((l) => l.user));
          if (!lib) return fail(`library is one of ${libs.map((l) => l.id).join(', ')}.`);
          const groups = has('group') ? lib.groups.filter((g) => g.name.toLowerCase() === str('group').toLowerCase()) : lib.groups;
          if (!groups.length) return fail(`${lib.name} has the groups ${lib.groups.map((g) => g.name).join(', ')}.`);
          const names = Array.isArray(a.names) ? a.names.map(String) : undefined;
          const ids = e.addLibrarySwatches({ ...lib, groups }, names);
          if (!ids.length) return fail(`None of those names are in ${lib.name}.`);
          const targets = this.ids(a, 'apply_to'), first = e.doc?.swatches.find((s) => s.id === ids[0]);
          if (targets?.length && first) e.setFill(first.global || first.spot ? (first.paint.type === 'color' ? { type: 'color', color: first.paint.color, swatch: first.id, tint: 100 } : first.paint) : first.paint, targets);
          return text(`Loaded ${ids.length} swatch${ids.length === 1 ? '' : 'es'} from ${lib.name}${targets?.length && first ? `; filled ${targets.length} object(s) with ${first.name}` : ''}.`, { ids });
        }
        case 'swatch_group': {
          const act = str('action', 'list'), name = str('name');
          const find = (k: string) => p.doc.swatches.find((s) => s.id === k || s.name === k);
          if (act === 'list') { const list = e.swatchGroups().map((g) => ({ name: g, swatches: p.doc.swatches.filter((s) => s.group === g).map((s) => s.name) })); return text(list.length ? list.map((g) => `${g.name}: ${g.swatches.join(', ')}`).join('\n') : 'No colour groups yet.', { groups: list }); }
          if (act === 'make') {
            if (!name) return fail('Give the group a name.');
            if (Array.isArray(a.colors) && a.colors.length) {
              const cols = a.colors.map((c) => parseColor(String(c))).filter((c): c is Color => !!c);
              if (!cols.length) return fail('colors must be #rrggbb, rgb(), cmyk() or gray().');
              e.beginGesture(); try { cols.forEach((c) => e.addSwatch(hex(c).toUpperCase(), solid(c), false, false, name)); } finally { e.endGesture(); }
              return text(`Made ${name} with ${cols.length} new swatches.`);
            }
            const sw = (Array.isArray(a.swatches) ? a.swatches.map(String) : []).map(find).filter((s): s is NonNullable<typeof s> => !!s);
            if (!sw.length) return fail('Give swatches (names or ids from get_document) or colors.');
            return e.groupSwatches(sw.map((s) => s.id), name) ? text(`Made the colour group ${name} with ${sw.length} swatches.`) : fail('Nothing changed.');
          }
          if (act === 'move') {
            const sw = (Array.isArray(a.swatches) ? a.swatches.map(String) : []).map(find).filter((s): s is NonNullable<typeof s> => !!s);
            if (!sw.length) return fail('Give swatches by name or id.');
            return e.moveSwatches(sw.map((s) => s.id), !name || name === 'none' ? null : name) ? text(`Moved ${sw.length} swatch(es) ${!name || name === 'none' ? 'out of their groups' : `into ${name}`}.`) : fail('Nothing changed.');
          }
          if (!e.swatchGroups().includes(name)) return fail(`No colour group called ${name}; the groups are ${e.swatchGroups().join(', ') || 'none'}.`);
          if (act === 'rename') return e.renameSwatchGroup(name, str('new_name')) ? text(`Renamed ${name} to ${str('new_name')}.`) : fail('Give new_name.');
          if (act === 'ungroup' || act === 'delete') { e.ungroupSwatches(name, act === 'delete'); return text(act === 'delete' ? `Deleted ${name} and its swatches.` : `Ungrouped ${name}.`); }
          return fail('action is list, make, move, rename, ungroup or delete.');
        }
        case 'graphic_style': {
          const act = str('action');
          if (act === 'list') { const list = p.doc.styles.map((s) => ({ id: s.id, name: s.name })); return text(list.map((s) => `${s.id}: ${s.name}`).join('\n'), { styles: list }); }
          if (act === 'create') { const src = Array.isArray(a.ids) && a.ids.length ? String(a.ids[0]) : undefined; const id = e.addGraphicStyle(str('name') || 'Graphic Style', src); return id ? text(`Made the graphic style ${str('name')} (id ${id}).`, { id }) : fail('Select or pass the object whose look to keep.'); }
          if (act === 'apply' && has('library')) {
            const lib = styleLibrary(str('library')), want = str('name') || str('id'), s = lib?.styles.find((x) => x.name.toLowerCase() === want.toLowerCase());
            if (!lib) return fail(`library is one of ${STYLE_LIBRARIES.map((l) => l.id).join(', ')}.`);
            if (!s) return fail(`${lib.name} has ${lib.styles.map((x) => x.name).join(', ')}.`);
            const id = e.useLibraryStyle(lib.id, s.name, this.ids(a));
            return text(`Applied ${s.name} from ${lib.name} (graphic style ${id}).`, { id });
          }
          if (act === 'apply') { const st = p.doc.styles.find((s) => s.id === str('id') || s.name === str('name') || s.name === str('id')); if (!st) return fail('No graphic style matches: call graphic_style with action list.'); e.applyGraphicStyle(st.id, this.ids(a)); return text(`Applied ${st.name}.`); }
          if (act === 'delete') { const st = p.doc.styles.find((s) => s.id === str('id') || s.name === str('name')); if (!st) return fail('No graphic style matches.'); e.edit('Delete Graphic Style', (d) => ({ ...d, styles: d.styles.filter((s) => s.id !== st.id) })); return text(`Deleted ${st.name}.`); }
          if (act === 'redefine') {
            const st = p.doc.styles.find((s) => s.id === str('id') || s.name === str('name') || s.name === str('id'));
            if (!st) return fail('No graphic style matches: call graphic_style with action list.');
            const src = Array.isArray(a.ids) && a.ids.length ? String(this.node(a.ids[0]).id) : e.selectedIds()[0];
            if (!src) return fail('Pass ids (the object whose look the style should take) or select it first.');
            return e.redefineGraphicStyle(st.id, src) ? text(`Redefined ${st.name}; objects linked to it follow.`) : fail('Nothing changed.');
          }
          if (act === 'break_link') { const ok = e.breakGraphicStyleLink(this.ids(a)); return ok ? text('The objects are no longer linked to a graphic style.') : fail('Nothing changed.'); }
          if (act === 'libraries') { const list = STYLE_LIBRARIES.map((l) => ({ id: l.id, name: l.name, styles: l.styles.map((s) => s.name) })); return text(list.map((l) => `${l.id} (${l.name}): ${l.styles.join(', ')}`).join('\n'), { libraries: list }); }
          if (act === 'load_library') { const lib = styleLibrary(str('library')); if (!lib) return fail(`library is one of ${STYLE_LIBRARIES.map((l) => l.id).join(', ')}.`); const ids = e.loadStyleLibrary(lib.id); return text(`Loaded ${lib.name}: ${ids.length} graphic styles are in the document.`, { styles: (e.doc?.styles ?? []).filter((s) => ids.includes(s.id)).map((s) => ({ id: s.id, name: s.name })) }); }
          return fail('action must be create, apply, list, delete, redefine, break_link, libraries or load_library.');
        }
        case 'set_object': {
          const ids = this.ids(a);
          const ko = has('knockout') ? str('knockout') : null;
          if (ko !== null && ko !== 'on' && ko !== 'off' && ko !== 'inherit') return fail('knockout is on, off or inherit.');
          e.setObjectProps({ ...(has('name') ? { name: str('name') } : {}), ...(has('visible') ? { hidden: a.visible !== true } : {}), ...(has('locked') ? { locked: a.locked === true } : {}), ...(has('opacity') ? { opacity: Math.max(0, Math.min(1, num('opacity', 1) > 1 ? num('opacity', 100) / 100 : num('opacity', 1))) } : {}), ...(has('blend_mode') ? { blend: str('blend_mode') as BlendMode } : {}), ...(has('isolate') ? { isolate: a.isolate === true } : {}), ...(ko ? { knockout: ko === 'inherit' ? 'inherit' as const : ko === 'on' } : {}), ...(has('knockout_shape') ? { knockoutShape: a.knockout_shape === true } : {}) }, ids);
          const groups = (ids ?? e.targetIds()).filter((id) => { const k = this.node(id).kind; return k === 'group' || k === 'layer'; }).length;
          return text(ko && !groups ? 'Updated the objects. Knockout takes effect on groups and layers: group the overlapping objects and set knockout on the group.' : 'Updated the objects.');
        }
        case 'opacity_mask': {
          const ids = this.ids(a), act = str('action', 'make');
          const patch = { ...(has('clip') ? { clip: a.clip === true } : {}), ...(has('invert') ? { invert: a.invert === true } : {}), ...(has('disabled') ? { disabled: a.disabled === true } : {}), ...(has('linked') ? { linked: a.linked === true } : {}) };
          if (act === 'make') {
            if (!e.makeOpacityMask(ids ? inDocOrder(p.doc, ids) : undefined)) return fail('Pass two or more objects (or select them): the topmost becomes the mask of the others.');
            const id = e.selectedIds()[0];
            if (Object.keys(patch).length) e.setOpacityMask(patch, [id]);
            return text(`Made the opacity mask on ${id}.`, { id });
          }
          if (act === 'release') return e.releaseOpacityMask(ids) ? text('Released: the mask art is an ordinary object again.', { selection: e.selectedIds() }) : fail('None of these objects has an opacity mask.');
          if (act !== 'options') return fail('action is make, release or options.');
          const t = (ids ?? e.targetIds()).filter((id) => !!this.node(id).mask);
          if (!t.length) return fail('None of these objects has an opacity mask: make one with action make.');
          if (Object.keys(patch).length) e.setOpacityMask(patch, t);
          const list = t.map((id) => { const m = this.node(id).mask!; return { id, clip: m.clip, invert: m.invert, disabled: m.disabled, linked: m.linked }; });
          return text(list.map((m) => `${m.id}: clip ${m.clip}, invert ${m.invert}, disabled ${m.disabled}, linked ${m.linked}`).join('\n'), { masks: list });
        }
        case 'arrange': { e.arrange(str('order') as 'bring_to_front', this.ids(a)); return text('Rearranged.'); }
        case 'group': { const ok = str('action', 'group') === 'ungroup' ? e.ungroup(this.ids(a)) : e.group(this.ids(a)); return ok ? text(str('action', 'group') === 'ungroup' ? 'Ungrouped.' : `Grouped (id ${e.selectedIds()[0]}).`, { selection: e.selectedIds(), ...(str('action', 'group') === 'ungroup' ? {} : { id: e.selectedIds()[0] }) }) : fail('Nothing changed: check the ids.'); }
        case 'compound_path': { const ok = str('action', 'make') === 'release' ? e.releaseCompound(this.ids(a)) : e.makeCompound(this.ids(a), has('rule') ? (str('rule') as 'nonzero') : undefined); return ok ? text('Done.', { selection: e.selectedIds() }) : fail('Nothing changed: compound paths need paths.'); }
        case 'attributes': {
          const ids = this.ids(a);
          if (has('fill_rule')) { const r = str('fill_rule'); if (r !== 'nonzero' && r !== 'evenodd') return fail('fill_rule is nonzero or evenodd.'); if (!e.fillRuleOf(ids)) return fail('Fill rules belong to paths and compound paths: none of these objects is one.'); e.setFillRule(r, ids); }
          if (a.reverse === true && !e.pathOp('reverse', {}, ids)) return fail('Nothing to reverse: reverse works on paths and compound paths.');
          if (has('note')) e.setObjectProps({ note: str('note').trim() || undefined }, ids);
          const list = (ids ?? e.targetIds()).map((id) => { const n = this.node(id); return { id, kind: n.kind, fill_rule: e.fillRuleOf([id]), note: n.note ?? '' }; });
          return text(list.map((x) => `${x.id} (${x.kind}): fill rule ${x.fill_rule ?? 'none'}${x.note ? `, note "${x.note}"` : ''}`).join('\n'), { objects: list });
        }
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
        case 'layer_action': {
          const act = str('action'), given = Array.isArray(a.ids) ? a.ids.map(String) : undefined, doc = e.doc as Doc;
          const missing = (given ?? []).filter((id) => !findNode(doc, id));
          if (missing.length) return fail(`No object has the id ${missing.join(', ')}: call get_document for current ids.`);
          const notLayers = (given ?? []).filter((id) => findNode(doc, id)?.kind !== 'layer');
          if ((act === 'duplicate' || act === 'merge') && notLayers.length) return fail(`${notLayers.join(', ')} ${notLayers.length === 1 ? 'is' : 'are'} not a layer id: layers are listed by get_document.`);
          if (act === 'duplicate') { const made = e.duplicateLayers(given); return made.length ? text(`Duplicated ${made.length} layer${made.length === 1 ? '' : 's'}.`, { ids: made }) : fail('There is no layer to duplicate: pass ids.'); }
          if (act === 'merge') { const pick = given ?? e.layerSelection; if (pick.length < 2) return fail('Merge needs two or more layer ids in ids.'); return e.mergeLayers(pick) ? text('Merged the layers into the topmost one.', { id: e.activeLayer }) : fail('Nothing was merged.'); }
          if (act === 'flatten') {
            const target = str('id') || undefined;
            if (target && findNode(doc, target)?.kind !== 'layer') return fail(`${target} is not a layer id.`);
            return e.flattenArtwork(a.discard_hidden === true, target) ? text(`Flattened the artwork into one layer${a.discard_hidden === true ? ', hidden art discarded' : ''}.`, { id: e.activeLayer }) : fail('Nothing to flatten.');
          }
          if (act === 'release_sequence' || act === 'release_build') {
            const host = str('id') || undefined, hn = host ? findNode(doc, host) : null;
            if (host && (!hn || (hn.kind !== 'layer' && hn.kind !== 'group'))) return fail(`${host} is not a layer or group id.`);
            const made = e.releaseToLayers(act === 'release_build' ? 'build' : 'sequence', host);
            return made.length ? text(`Released into ${made.length} sublayer${made.length === 1 ? '' : 's'}.`, { ids: made }) : fail('Nothing to release: the layer or group has no objects.');
          }
          if (act === 'reverse_order') return e.reverseOrder(given) ? text('Reversed the stacking order.') : fail('Reverse Order needs two or more layers or objects with the same parent.');
          if (act === 'collect') { const ids = given ?? this.ids(a); const before = doc.layers.length; e.collectInNewLayer(ids); return e.doc && e.doc.layers.length > before ? text('Collected the objects in a new layer.') : fail('Nothing was collected: pass object ids.'); }
          return fail('action must be duplicate, merge, flatten, release_sequence, release_build, reverse_order or collect.');
        }
        case 'move_to_layer': { const l = this.node(a.layer); if (l.kind !== 'layer') return fail(`${l.id} is not a layer.`); e.moveToLayer(l.id, this.ids(a)); return text(`Moved to ${nodeLabel(l)}.`); }
        case 'transform': {
          const ids = this.ids(a) ?? e.targetIds();
          const b = selectionBounds(p.doc, ids.map((id) => findNode(p.doc, id) as VNode));
          if (isEmptyRect(b)) return fail('Those objects have no bounds.');
          if (has('corners') || has('perspective')) {
            const fr = e.selectionFrame(ids);
            if (!fr) return fail('Those objects have no bounds.');
            let to: Pt[];
            if (has('corners')) {
              const c = a.corners;
              if (!Array.isArray(c) || c.length !== 4 || !c.every((q) => Array.isArray(q) && q.length === 2 && q.every((v) => typeof v === 'number' && Number.isFinite(v)))) throw new ToolError('corners takes four [x, y] pairs: top-left, top-right, bottom-right, bottom-left.');
              to = (c as number[][]).map((q) => ({ x: q[0], y: q[1] }));
            } else {
              const k = num('perspective', 0), c = fr.corners, l = Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y) || 1, ux = (c[1].x - c[0].x) / l, uy = (c[1].y - c[0].y) / l;
              if (Math.abs(k) * 2 >= l) throw new ToolError(`perspective must be less than half the width (${r2(l / 2)} points).`);
              to = [{ x: c[0].x + ux * k, y: c[0].y + uy * k }, { x: c[1].x - ux * k, y: c[1].y - uy * k }, c[2], c[3]];
            }
            e.beginStep();
            const ok = e.distort(to, ids, has('corners') ? 'Free Distort' : 'Perspective Distort');
            if (ok && a.reset_bounding_box === true) e.resetBoundingBox(e.selectedIds());
            e.endStep();
            return ok ? text(`Distorted; bounds now ${JSON.stringify(box(e.selectionBounds(false)))}. Type, images and symbols are in envelope meshes (envelope info lists their points).`, { selection: e.selectedIds(), bounds: box(e.selectionBounds(false)) }) : fail('Nothing changed.');
          }
          if (a.reset_bounding_box === true && !['dx', 'dy', 'x', 'y', 'rotate', 'scale', 'scale_x', 'scale_y', 'width', 'height', 'reflect', 'shear'].some(has)) {
            return e.resetBoundingBox(ids) ? text('Reset the bounding box to the page.', { selection: e.selectedIds(), bounds: box(e.selectionBounds(false)) }) : fail('Nothing changed: the bounding box is already square to the page.');
          }
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
          e.beginStep();
          const ok = a.each === true ? e.transformEach(make, { copy: a.copy === true, ids }) : e.transform(make(b), { copy: a.copy === true, ids });
          if (ok && a.reset_bounding_box === true) e.resetBoundingBox(e.selectedIds());
          e.endStep();
          return ok ? text(`Transformed; bounds now ${JSON.stringify(box(e.selectionBounds(false)))}.`, { selection: e.selectedIds(), bounds: box(e.selectionBounds(false)) }) : fail('Nothing changed.');
        }
        case 'align': { const ok = e.align(str('action') as 'left', (str('to', 'selection') as 'selection'), has('key') ? String(this.node(a.key).id) : null, has('spacing') ? num('spacing', 0) : null, this.ids(a)); return ok ? text('Aligned.') : fail('Nothing moved: align needs two or more objects, or to: artboard.'); }
        case 'puppet_warp': {
          const raw = Array.isArray(a.pins) ? a.pins as Array<Record<string, unknown>> : [];
          const pins = raw.map((q) => {
            const x = Number(q.x), y = Number(q.y), tx = q.to_x === undefined ? x : Number(q.to_x), ty = q.to_y === undefined ? y : Number(q.to_y);
            return { from: { x, y }, to: { x: tx, y: ty }, ...(q.rotate !== undefined && q.rotate !== null ? { rotate: Number(q.rotate) } : {}) };
          });
          if (!pins.length || pins.some((q) => ![q.from.x, q.from.y, q.to.x, q.to.y].every(Number.isFinite) || (q.rotate !== undefined && !Number.isFinite(q.rotate)))) return fail('Give pins as [{x, y, to_x, to_y}] in document points.');
          const ok = e.puppetWarp(pins, { expand: Math.max(0, Math.min(100, num('expand', 3))) }, this.ids(a));
          return ok ? text(`Warped ${e.selectedIds().length} object(s) with ${pins.length} pin(s).`, { selection: e.selectedIds() }) : fail('Nothing changed: select art (or pass ids) and put the pins on or near it.');
        }
        case 'add_dimension': {
          const color = has('color') ? parseColor(str('color')) : null;
          if (has('color') && !color) return fail('color must be #rrggbb.');
          const patch: Partial<DimensionSpec> = {};
          if (has('orientation')) patch.orient = str('orientation') as DimensionSpec['orient'];
          if (has('measure')) patch.radial = str('measure') as DimensionSpec['radial'];
          if (has('offset')) patch.offset = num('offset', 18);
          if (has('units')) patch.units = str('units') as DimensionSpec['units'];
          if (has('precision')) patch.precision = Math.max(0, Math.min(6, Math.round(num('precision', 2))));
          if (has('scale')) patch.scale = Math.max(0.0001, num('scale', 1));
          if (has('show_units')) patch.showUnits = a.show_units === true;
          if (has('arrow')) patch.arrow = str('arrow') as DimensionSpec['arrow'];
          if (has('arrow_size')) patch.arrowSize = Math.max(1, num('arrow_size', 6));
          if (has('font')) patch.font = str('font');
          if (has('style')) patch.style = str('style');
          if (has('size')) patch.size = Math.max(1, num('size', 9));
          if (has('text_position')) patch.textPos = str('text_position') as DimensionSpec['textPos'];
          if (has('weight')) patch.weight = Math.max(0.05, num('weight', 0.75));
          if (color) patch.color = color;
          const pts = (Array.isArray(a.points) ? a.points : []).map((q) => (Array.isArray(q) ? { x: Number(q[0]), y: Number(q[1]) } : { x: NaN, y: NaN }));
          if (pts.some((q) => !Number.isFinite(q.x) || !Number.isFinite(q.y))) return fail('points must be [x, y] pairs in document points.');
          if (!pts.length && !has('circle') && has('ids')) {
            const ok = e.setDimension(patch, this.ids(a));
            return ok ? text('Changed the dimension settings.', { selection: e.selectedIds() }) : fail('Nothing changed: ids must be dimensions.');
          }
          const type = str('type', 'linear') as DimensionSpec['type'];
          let at = pts;
          if (type === 'radial') {
            if (has('circle')) {
              const c = circleFrom(this.node(a.circle));
              if (!c) return fail(`${String(a.circle)} is not a circle, ellipse or circular arc: give points instead.`);
              const dir = pts[0] ? Math.atan2(pts[0].y - c.c.y, pts[0].x - c.c.x) : -Math.PI / 4;
              at = [c.c, { x: c.c.x + Math.cos(dir) * c.r, y: c.c.y + Math.sin(dir) * c.r }];
            } else if (str('from') === 'three_points') {
              const c = pts.length === 3 ? circumcentre(pts[0], pts[1], pts[2]) : null;
              if (!c) return fail('three_points needs three points that are not in a line.');
              at = [c, pts[0]];
            }
          }
          const want = type === 'angular' ? 3 : 2;
          if (at.length !== want) return fail(`A ${type} dimension needs ${want} points.`);
          const id = e.addDimension({ ...patch, type, pts: at.slice(0, want) });
          if (!id) return fail('Could not add the dimension.');
          const g = this.node(id);
          return text(`Added ${type === 'angular' ? 'an' : 'a'} ${type} dimension (id ${id}) reading ${g.kind === 'group' && g.dim ? dimLabel(g.dim, p.doc.units) : ''}.`, { id, label: g.kind === 'group' && g.dim ? dimLabel(g.dim, p.doc.units) : '' });
        }
        case 'pathfinder': {
          const opts: Record<string, unknown> = {};
          if (has('precision')) opts.precision = Math.max(0.001, Math.min(100, num('precision', 0.028)));
          if (has('remove_redundant_points')) opts.remove_redundant_points = a.remove_redundant_points === true;
          if (has('remove_unpainted')) opts.remove_unpainted = a.remove_unpainted === true;
          if (Object.keys(opts).length) {
            if (this.catalogue) this.catalogue.run('pf-options', opts, true);
            else e.setPathfinderOptions({ ...(has('precision') ? { precision: opts.precision as number } : {}), ...(has('remove_redundant_points') ? { removeRedundant: opts.remove_redundant_points as boolean } : {}), ...(has('remove_unpainted') ? { removeUnpainted: opts.remove_unpainted as boolean } : {}) });
          }
          const compound = str('compound'), mode = str('shape_mode'), op = str('operation');
          if (compound === 'expand' || compound === 'release') { const ok = compound === 'expand' ? e.expandCompoundShape(this.ids(a)) : e.releaseCompoundShape(this.ids(a)); return ok ? text(`Compound shape ${compound === 'expand' ? 'expanded into a path' : 'released into its parts'}.`, { selection: e.selectedIds() }) : fail('Nothing changed: pass the id of a live compound shape (pathfinder with live true makes one).'); }
          if (mode) { const ok = e.shapeMode(mode as 'add', this.ids(a)); return ok ? text(`Shape mode ${mode} set.`, { selection: e.selectedIds() }) : fail('Nothing changed: select a part of a live compound shape, or the compound shape itself.'); }
          if (!op) return Object.keys(opts).length ? text('Pathfinder options set.') : fail('Pass operation, compound or shape_mode.');
          const live = a.live === true;
          if (live && !['unite', 'minus_front', 'intersect', 'exclude'].includes(op)) return fail('live works with unite, minus_front, intersect and exclude only.');
          const ok = e.pathfinder(op as 'unite', this.ids(a), live);
          return ok ? text(live ? `Made a live compound shape (${op}).` : `Pathfinder ${op} done.`, { selection: e.selectedIds() }) : fail('Nothing changed: Pathfinder needs two or more overlapping shapes (crop, divide and outline can take one).');
        }
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
          const ids = this.ids(a), item = has('item') ? Math.round(num('item', -1)) : undefined;
          if (item !== undefined) {
            if (!isItemEffect(id)) return fail(`${effectDef(id)?.label} applies to the whole object: call again without item.`);
            const short = (ids ?? e.targetIds()).map((x) => this.node(x)).filter((n) => !n.ap.items[item]);
            if (short.length) return fail(`${short.map((n) => `${n.id} has ${n.ap.items.length} appearance item(s)`).join('; ')}: item is an index into get_object's ap.items, from 0.`);
          }
          const ok = e.addEffect(id, (a.params && typeof a.params === 'object' ? a.params : {}) as Record<string, number | string | boolean>, ids, item);
          return ok ? text(`Applied ${effectDef(id)?.label}${item !== undefined ? ` to appearance item ${item}` : ''}; it stays editable until expanded.`) : fail('Nothing changed.');
        }
        case 'three_d': {
          const ids = this.ids(a);
          if (a.remove === true) return e.set3d(null, {}, ids) ? text('Removed the 3D effect.') : fail('Nothing had a 3D effect.');
          const KIND: Record<string, string> = { extrude: '3d.extrude', revolve: '3d.revolve', inflate: '3d.inflate', plane: '3d.rotate' }, kind = has('kind') ? KIND[str('kind')] : null;
          if (has('kind') && !kind) return fail('kind is extrude, revolve, inflate or plane.');
          const patch: Record<string, number | string | boolean> = {};
          if (has('lighting')) { const pr = LIGHTING_PRESETS[str('lighting')]; if (!pr) return fail(`lighting is one of ${Object.keys(LIGHTING_PRESETS).join(', ')}.`); patch.lights = lightsToParam(pr.lights); patch.ambient = pr.ambient; }
          if (Array.isArray(a.lights)) {
            if (a.lights.length > LIGHT_LIMIT) return fail(`lights holds at most ${LIGHT_LIMIT} lights.`);
            patch.lights = lightsToParam((a.lights as Array<Record<string, unknown>>).map((o) => { const q = o && typeof o === 'object' ? o : {}, n = (k: string, d: number): number => (typeof q[k] === 'number' ? (q[k] as number) : d), c = typeof q.color === 'string' ? parseColor(q.color) : null; return { color: c ? hex(c) : '#ffffff', intensity: n('intensity', 100), rotation: n('rotation', -45), height: n('height', 40), softness: n('softness', 0) }; }));
          }
          for (const k of ['texture_scale', 'texture_rotation', 'texture_offset_x', 'texture_offset_y', 'rx', 'ry', 'rz', 'perspective', 'depth', 'bevel_height', 'angle', 'offset', 'volume', 'intensity', 'ambient', 'highlight', 'map_scale', 'map_x', 'map_y', 'shadow_distance', 'shadow_softness', 'shadow_opacity']) if (has(k)) patch[k] = num(k, 0);
          for (const k of ['bevel', 'from', 'material', 'light', 'shadow_position', 'quality']) if (has(k)) patch[k] = str(k);
          for (const k of ['cap', 'shade_art', 'shadow', 'ray_trace']) if (has(k)) patch[k] = a[k] === true;
          if (has('map_symbol')) {
            const want = typeof a.map_symbol === 'string' ? a.map_symbol.trim() : '', syms = e.doc?.symbols ?? [], sym = syms.find((s) => s.id === want || s.name === want);
            if (want && !sym) return fail(syms.length ? `map_symbol is one of ${syms.map((s) => s.name).join(', ')}, or empty to clear it.` : 'The document has no symbols: make one with the symbol tool first.');
            patch.map_symbol = sym ? sym.id : '';
          }
          if (has('texture')) {
            const want = typeof a.texture === 'string' ? a.texture.trim() : '', d = e.doc, node = want ? e.nodeById(want) : null;
            const ref = !want ? '' : d?.images[want] ? want : node?.kind === 'image' ? node.src : d?.symbols.find((s) => s.id === want || s.name === want)?.id ?? '';
            if (want && !ref) return fail(`texture is an image object id (place one with place_image), an embedded image key, or a symbol name${d?.symbols.length ? ` (${d.symbols.map((s) => s.name).join(', ')})` : ''}; empty clears it.`);
            const p = e.current, avg = ref && p ? await textureAverage(p, ref) : null;
            patch.texture = ref;
            patch.texture_color = avg ?? '';
          }
          for (const k of ['roughness', 'metallic']) if (has(k)) { const v = num(k, NaN); if (!Number.isFinite(v) || v < 0 || v > 1) return fail(`${k} is a number from 0 to 1.`); patch[k] = Math.round(v * 1000) / 1000; }
          if (a.reset_surface === true) { patch.roughness = ''; patch.metallic = ''; }
          if (has('shading_color')) { const p = this.paint(a.shading_color, 'shading_color'); if (p.type === 'color') patch.shading_color = hex(p.color); }
          if (has('position')) { const r = ROTATION_PRESETS[str('position')]; if (!r) return fail(`position is one of ${Object.keys(ROTATION_PRESETS).join(', ')}.`); patch.rx = r[0]; patch.ry = r[1]; patch.rz = r[2]; }
          const targets = e.targetIds(ids), before = targets.map((id) => e.nodeById(id)).filter((n): n is VNode => !!n && n.ap.effects.some((x) => x.id.startsWith('3d.')));
          if (!targets.length) return fail('Select objects or pass ids.');
          if (!kind && !before.length) return fail('Pass kind (extrude, revolve, inflate or plane) to give the objects depth.');
          if (has('surface') && str('surface').toLowerCase() !== 'all') {
            const sid = str('surface').toLowerCase(), cur0 = before[0]?.ap.effects.find((x) => x.id.startsWith('3d.')), fid = kind ?? cur0?.id ?? '';
            const choices = SURFACE_CHOICES[fid] ?? [], valid = fid === '3d.model' ? /^g\d+$/.test(sid) : choices.some(([k]) => k === sid);
            if (!valid) return fail(fid === '3d.model' ? 'surface is a material group of the model: g0, g1 and so on in the order the file lists them (get_object shows the effect), or all.' : choices.length ? `surface is one of ${choices.map(([k]) => k).join(', ')} for this kind, or all.` : 'This kind has one surface: leave surface out.');
            if (fid === '3d.model' && (has('texture') || has('texture_scale') || has('texture_rotation') || has('texture_offset_x') || has('texture_offset_y'))) return fail('A model surface takes material, color, roughness and metallic; its pictures come from the file.');
            const all = surfaceSpecs(cur0?.params ?? {}) ?? {}, spec: Record<string, string | number> = { ...(all[sid] ?? {}) };
            if (has('color')) { const c = typeof a.color === 'string' ? a.color.trim() : ''; if (!c) delete spec.color; else { const pc = this.paint(a.color, 'color'); if (pc.type !== 'color') return fail('color is a colour such as #c0392b, or empty to clear it.'); spec.color = hex(pc.color); } }
            if (a.reset_surface === true) { delete all[sid]; for (const k of ['material', 'texture', 'texture_color', 'texture_scale', 'texture_rotation', 'texture_offset_x', 'texture_offset_y', 'roughness', 'metallic']) delete patch[k]; }
            else {
              for (const k of ['material', 'texture', 'texture_color', 'texture_scale', 'texture_rotation', 'texture_offset_x', 'texture_offset_y', 'roughness', 'metallic']) {
                if (!(k in patch)) continue;
                const v = patch[k];
                if (typeof v === 'boolean' || (v === '' && k !== 'texture')) delete spec[k]; else spec[k] = v;
                delete patch[k];
              }
              if (!spec.texture) delete spec.texture_color;
              if (Object.keys(spec).length) all[sid] = spec as SurfSpec; else delete all[sid];
            }
            patch.surfaces = surfacesToParam(all);
          }
          const ok = e.set3d(kind, patch, ids), n = e.nodeById(targets[0]), fx = n?.ap.effects.find((x) => x.id.startsWith('3d.'));
          return ok && fx ? text(`${effectDef(fx.id)?.label ?? '3D'}: ${Object.entries(fx.params).filter(([k, v]) => v !== '' && k !== 'texture_color').map(([k, v]) => `${k} ${k === 'map_symbol' ? e.doc?.symbols.find((s) => s.id === v)?.name ?? v : k === 'texture' && e.current ? textureName(e.current, String(v)) : v}`).join(', ')}. get_image shows it; expand makes it plain paths.`) : fail('Nothing changed.');
        }
        case 'expand': { const what = str('what', 'all') as 'all' | 'object' | 'appearance', ok = e.expand(what, this.ids(a), what === 'object' ? undefined : await bakeTraced(e, this.ids(a))); return ok ? text('Expanded to plain objects.', { selection: e.selectedIds() }) : fail('Nothing to expand.'); }
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
          if (['info', 'move_point', 'add_mesh_line', 'delete_mesh_point', 'reset_mesh', 'reset_warp', 'options', 'edit_contents', 'edit_envelope'].includes(act)) return this.envelopeAction(act, a, num, str, has);
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
          const symLibs = (): SymbolLibrary[] => [...SYMBOL_LIBRARIES, ...(this.deps.userLibraries?.().symbols ?? [])];
          const type = a.type === 'static' || a.type === 'dynamic' ? a.type : undefined;
          const sliceArg = Array.isArray(a.slice_guides) && a.slice_guides.length === 4 && a.slice_guides.every((v) => typeof v === 'number') ? { x1: Number(a.slice_guides[0]), y1: Number(a.slice_guides[1]), x2: Number(a.slice_guides[2]), y2: Number(a.slice_guides[3]) } : null;
          if (act === 'list') { const list = p.doc.symbols.map((s) => ({ id: s.id, name: s.name, type: s.type ?? 'static', slice: s.slice ?? null })); return text(list.map((s) => `${s.id}: ${s.name} (${s.type}${s.slice ? ', 9-slice' : ''})`).join('\n') || 'No symbols yet.', { symbols: list }); }
          if (act === 'libraries') { const libs = symLibs(); return text(libs.map((l) => `${l.id}: ${l.name} (${l.symbols.map((s) => s.name).join(', ')})`).join('\n'), { libraries: libs.map((l) => ({ id: l.id, name: l.name, user: !!l.user, symbols: l.symbols.map((s) => s.name) })) }); }
          if (act === 'create') { const reg = SYMBOL_REGISTRATIONS.some(([k]) => k === a.registration) ? a.registration as SymbolRegistration : undefined; const id = e.makeSymbol(str('name') || `Symbol ${p.doc.symbols.length + 1}`, this.ids(a), { type, reg, slice: a.slice === true || !!sliceArg }); if (id && sliceArg) e.setSymbolSlice(id, sliceArg); return id ? text(`Made the symbol (id ${id}); the art became an instance.`, { id, instance: e.selectedIds()[0] }) : fail('Select art to make a symbol from.'); }
          if (act === 'load_library' || (act === 'place' && has('library'))) {
            const lib = symbolLibrary(str('library'), symLibs().filter((l) => l.user));
            if (!lib) return fail(`library is one of ${symLibs().map((l) => l.id).join(', ')}.`);
            const want = act === 'place' ? [str('name')] : Array.isArray(a.names) ? a.names.map(String) : [];
            const pick = want.length && want[0] ? lib.symbols.filter((s) => want.some((w) => w.toLowerCase() === s.name.toLowerCase())) : lib.symbols;
            if (!pick.length) return fail(`${lib.name} has ${lib.symbols.map((s) => s.name).join(', ')}.`);
            const ids = e.addLibrarySymbols(pick);
            if (act === 'load_library') return text(`Loaded ${ids.length} symbols from ${lib.name} into the Symbols panel.`, { ids });
            const id = e.placeSymbol(ids[0], { x: num('x', 0), y: num('y', 0) }, num('scale', 1));
            return text(`Placed ${pick[0].name} from ${lib.name} (id ${id}).`, { id, symbol: ids[0] });
          }
          if (act === 'exit' || act === 'cancel') { if (!e.symbolSession) return fail('No symbol is being edited.'); const ok = e.exitSymbolEdit(act === 'exit'); return text(ok ? 'Saved the symbol and left symbol editing mode; every instance follows.' : 'Left symbol editing mode without keeping the changes.'); }
          if (act === 'reset_overrides') return text(`Reset the overrides of ${e.resetSymbolParts(this.ids(a))} instances.`);
          const inst = has('id') ? e.selectedInstances([str('id')])[0] : undefined;
          const sym = p.doc.symbols.find((s) => s.id === str('name') || s.name === str('name')) ?? (inst ? p.doc.symbols.find((s) => s.id === inst.symbol) : undefined);
          if (act === 'place') { if (!sym) return fail('No symbol has that name: call symbol with action list, or pass library.'); const id = e.placeSymbol(sym.id, { x: num('x', 0), y: num('y', 0) }, num('scale', 1)); return text(`Placed ${sym.name} (id ${id}).`, { id }); }
          if (act === 'break_link') { e.breakSymbolLink(this.ids(a)); return text('Broke the link to the symbol.'); }
          if (act === 'replace') { if (!sym) return fail('Name the replacement symbol.'); const n = e.replaceSymbol(sym.id, this.ids(a)); return n ? text(`Replaced ${n} instances with ${sym.name}.`) : fail('Select or pass symbol instances to replace.'); }
          if (act === 'delete') { if (!sym) return fail('Name the symbol.'); e.edit('Delete Symbol', (d) => ({ ...d, symbols: d.symbols.filter((s) => s.id !== sym.id) })); return text(`Deleted ${sym.name}.`); }
          if (!sym) return fail('Name the symbol (or pass an instance id): call symbol with action list.');
          if (act === 'edit') {
            if (!e.enterSymbolEdit(sym.id, inst?.id)) return fail('Could not enter symbol editing mode.');
            const g = e.symbolSession?.group ?? '', kids = e.nodeById(g)?.kind === 'group' ? (e.nodeById(g) as VNode & { children: VNode[] }).children.map((c) => c.id) : [];
            return text(`Editing ${sym.name}: its art is in the group ${g} (objects ${kids.join(', ')}). Change it with any tool (every instance follows), then call symbol with action exit.`, { group: g, objects: kids });
          }
          if (act === 'redefine') return e.redefineSymbol(sym.id, this.ids(a)) ? text(`Redefined ${sym.name} from the art; every instance follows.`, { instance: e.selectedIds()[0] }) : fail('Pass or select the art that should become the symbol.');
          if (act === 'duplicate') { const id = e.duplicateSymbol(sym.id); return text(`Duplicated ${sym.name} (id ${id}).`, { id }); }
          if (act === 'options') {
            const ok = e.setSymbolOptions(sym.id, { ...(has('new_name') ? { name: str('new_name') } : {}), ...(type ? { type } : {}), ...(typeof a.slice === 'boolean' ? { slice: a.slice } : {}) });
            if (sliceArg) e.setSymbolSlice(sym.id, sliceArg);
            return ok || sliceArg ? text(`Updated ${sym.name}.`) : fail('Nothing changed.');
          }
          if (act === 'override') {
            if (!inst) return fail('Pass id: the instance whose part to recolour.');
            if (sym.type !== 'dynamic') return fail(`${sym.name} is a static symbol: set type dynamic with action options first.`);
            const part = str('part');
            if (!part) return fail('Pass part: the id of a part in the symbol art (see get_object on the symbol, or the ids listed by action edit).');
            const ok = e.setSymbolPart(inst.id, part, { ...(has('fill') ? { fill: this.paint(a.fill, 'fill') } : {}), ...(has('stroke') ? { stroke: this.paint(a.stroke, 'stroke') } : {}), ...(typeof a.stroke_width === 'number' ? { strokeWidth: a.stroke_width } : {}), ...(typeof a.opacity === 'number' ? { opacity: Math.max(0, Math.min(100, a.opacity)) / 100 } : {}) });
            return ok ? text(`Overrode part ${part} of ${inst.id}.`) : fail('No part has that id in this symbol.');
          }
          return fail('action must be create, place, list, break_link, replace, delete, edit, exit, cancel, redefine, duplicate, options, override, reset_overrides, libraries or load_library.');
        }
        case 'apply_brush': {
          if (a.list === true) { const list = p.doc.brushes.map((b) => ({ id: b.id, name: b.name, type: b.brush.type })); return text(list.map((b) => `${b.name} (${b.type})`).join('\n'), { brushes: list }); }
          if (has('library')) {
            const lib = brushLibrary(str('library'), this.deps.userLibraries?.().brushes ?? []), b = lib?.brushes.find((x) => x.name.toLowerCase() === str('brush').toLowerCase());
            if (!lib) return fail(`library is one of ${[...BRUSH_LIBRARIES, ...(this.deps.userLibraries?.().brushes ?? [])].map((l) => l.id).join(', ')}.`);
            if (!b) return fail(`${lib.name} has ${lib.brushes.map((x) => x.name).join(', ')}.`);
            const [id] = e.addLibraryBrushes([{ ...b, id: 'l' }]);
            return e.applyBrush(id, this.ids(a)) ? text(`Applied ${b.name} from ${lib.name}.`, { id }) : fail('Select or pass objects with a stroke.');
          }
          const ok = e.applyBrush(has('brush') && str('brush') !== 'none' ? str('brush') : null, this.ids(a));
          return ok ? text('Applied the brush.') : fail('Nothing changed.');
        }
        case 'new_brush': {
          const kind = str('kind') as BrushDef['brush']['type'];
          if (!['calligraphic', 'scatter', 'art', 'pattern', 'bristle'].includes(kind)) return fail('kind is calligraphic, scatter, art, pattern or bristle.');
          const o: Record<string, number | string | boolean> = {};
          for (const k of ['angle', 'roundness', 'size', 'spacing', 'scatter', 'rotation', 'width', 'length', 'density', 'thickness', 'stiffness']) if (typeof a[k] === 'number') o[k] = a[k] as number;
          if (typeof a.paint_opacity === 'number') o.opacity = a.paint_opacity;
          for (const k of ['relative', 'flip']) if (typeof a[k] === 'boolean') o[k] = a[k] as boolean;
          if (typeof a.flip_along === 'boolean') o.flipAlong = a.flip_along;
          for (const k of ['fit', 'shape', 'outer', 'inner', 'start', 'end']) if (typeof a[k] === 'string') o[k] = a[k] as string;
          if (kind === 'pattern') for (const k of ['outer', 'inner', 'start', 'end']) if (typeof o[k] === 'string' && o[k] !== 'none' && !p.doc.patterns.some((x) => x.name === o[k] || x.id === o[k])) return fail(`${k} must name a pattern swatch (make_pattern makes one from art); the patterns are ${p.doc.patterns.map((x) => x.name).join(', ') || 'none'}.`);
          if (kind === 'art') { if (typeof a.scale_mode === 'string') o.scaleMode = a.scale_mode; if (Array.isArray(a.guides) && a.guides.length === 2) { o.guide1 = Number(a.guides[0]); o.guide2 = Number(a.guides[1]); if (!o.scaleMode) o.scaleMode = 'guides'; } }
          if ((kind === 'scatter' || kind === 'art' || kind === 'pattern') && !(this.ids(a) ?? e.selectedIds()).length) return fail(`A ${kind} brush is made from art: pass ids of filled or stroked paths.`);
          const id = e.newBrush(str('name') || `${kind[0].toUpperCase()}${kind.slice(1)} Brush`, kind, o, (str('colorize', 'none') as BrushDef['colorize']), this.ids(a));
          if (!id) return fail('The brush was not made: pass ids of paths for its art.');
          const targets = this.ids(a, 'apply_to');
          if (targets?.length) e.applyBrush(id, targets);
          return text(`Made the ${kind} brush ${str('name') || id}${targets?.length ? ` and applied it to ${targets.length} object(s)` : ''}.`, { id });
        }
        case 'brush_library': {
          const libs = [...BRUSH_LIBRARIES, ...(this.deps.userLibraries?.().brushes ?? [])];
          if (str('action', 'list') === 'list') { const list = libs.map((l) => ({ id: l.id, name: l.name, user: !!l.user, brushes: l.brushes.map((b) => ({ name: b.name, type: b.brush.type })) })); return text(list.map((l) => `${l.id} (${l.name}): ${l.brushes.map((b) => `${b.name} [${b.type}]`).join(', ')}`).join('\n'), { libraries: list }); }
          const lib = brushLibrary(str('library'), libs.filter((l) => l.user));
          if (!lib) return fail(`library is one of ${libs.map((l) => l.id).join(', ')}.`);
          const names = Array.isArray(a.names) ? a.names.map((x) => String(x).toLowerCase()) : null, pick = lib.brushes.filter((b) => !names || names.includes(b.name.toLowerCase()));
          if (!pick.length) return fail(`${lib.name} has ${lib.brushes.map((b) => b.name).join(', ')}.`);
          const ids = e.addLibraryBrushes(pick.map((b, i) => ({ ...b, id: `l${i}` })));
          return text(`Loaded ${ids.length} brush${ids.length === 1 ? '' : 'es'} from ${lib.name}: ${pick.map((b) => b.name).join(', ')}.`, { ids });
        }
        case 'links': {
          if (!this.deps.links) return fail('Links are not available here.');
          const r = await this.deps.links(a);
          return r.ok ? text(r.text, r.data) : fail(r.text);
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
          if (act === 'make') { const id = e.makeLivePaint(this.ids(a)); return id ? text(`Fill Regions group ${id} with ${this.livePaintSummary(id)}.`, { id }) : fail('Select or pass paths to make a Fill Regions group.'); }
          const id = has('id') ? String(a.id) : e.livePaintTargets()[0];
          const g = id ? this.node(id) : null;
          if (!g || g.kind !== 'group' || !g.livePaint) return fail('Pass the id of a Fill Regions group (live_paint with action make returns one).');
          if (act === 'fill' || act === 'edge') {
            if (!has('x') || !has('y')) return fail('Give x and y in document points.');
            const paint = has('color') ? this.paint(a.color, 'color') : act === 'fill' ? e.fillPaint : e.strokePaint;
            const at = { x: num('x', 0), y: num('y', 0) };
            const ok = act === 'fill' ? e.livePaintFill(g.id, at, paint) : e.livePaintEdge(g.id, at, { paint, ...(has('width') ? { width: Math.max(0, num('width', 1)) } : {}) }, 6);
            return ok ? text(act === 'fill' ? `Filled the face at ${at.x}, ${at.y}; ${this.livePaintSummary(g.id)}.` : 'Painted the edge.', { id: g.id }) : fail(act === 'fill' ? 'No closed face there: pick a point inside an area the paths close, or set a gap.' : 'No edge within 6 points of that point.');
          }
          if (act === 'gap') return e.setLivePaintGap(num('gap', 0), [g.id]) ? text(`Gap detection ${num('gap', 0) > 0 ? `closes gaps up to ${num('gap', 0)} pt` : 'is off'}; ${this.livePaintSummary(g.id)}.`, { id: g.id }) : fail('Nothing changed.');
          if (act === 'expand') return e.expandLivePaint([g.id]) ? text(`Expanded into filled faces and strokes (group ${g.id}).`, { id: g.id }) : fail('Nothing changed.');
          if (act === 'release') return e.releaseLivePaint([g.id]) ? text(`Released to a plain group of the paths (${g.id}).`, { id: g.id }) : fail('Nothing changed.');
          return fail('action must be make, fill, edge, gap, expand or release.');
        }
        case 'intertwine': {
          const act = str('action');
          if (act === 'make') { const id = e.makeIntertwine(this.ids(a)); return id ? text(`Interlace ${id} made from ${(() => { const n = this.node(id); return n && n.kind === 'group' ? n.children.length : 0; })()} objects; flip the stacking at a point where they overlap.`, { id }) : fail('Select or pass two or more overlapping objects (not Fill Regions, Repeat or Shaper groups).'); }
          const id = has('id') ? String(a.id) : e.intertwineTargets()[0];
          const g = id ? this.node(id) : null;
          if (!g || g.kind !== 'group' || !g.intertwine) return fail('Pass the id of an intertwine object (intertwine with action make returns one).');
          const zones = (): number => { const n = this.node(g.id); return n?.kind === 'group' && n.intertwine ? n.intertwine.zones.length : 0; };
          if (act === 'flip') {
            if (!has('x') || !has('y')) return fail('Give x and y in document points inside an overlap.');
            return e.intertwineFlip(g.id, { x: num('x', 0), y: num('y', 0) }) ? text(`Flipped the stacking in the overlap at ${num('x', 0)}, ${num('y', 0)}; ${zones()} area(s) override the base order.`, { id: g.id }) : fail('No overlap of two or more of its objects at that point.');
          }
          if (act === 'area') {
            const pts = (Array.isArray(a.points) ? a.points : []).map((q) => (Array.isArray(q) ? { x: Number(q[0]), y: Number(q[1]) } : { x: NaN, y: NaN }));
            if (pts.length < 3 || pts.some((q) => !Number.isFinite(q.x) || !Number.isFinite(q.y))) return fail('points must be three or more [x, y] pairs encircling part of an overlap.');
            return e.intertwineZone(g.id, pts) ? text(`Defined the encircled area; ${zones()} area(s) override the base order.`, { id: g.id }) : fail('The loop does not enclose an overlap of two or more of its objects.');
          }
          if (act === 'release') return e.releaseIntertwine([g.id]) ? text(`Released into ${g.children.length} plain objects in their base order.`, { selection: e.selectedIds() }) : fail('Nothing changed.');
          if (act === 'expand') return e.expand('object', [g.id]) ? text('Expanded into plain objects with clipped copies for each area.', { selection: e.selectedIds() }) : fail('Nothing changed.');
          return fail('action must be make, flip, area, release or expand.');
        }
        case 'shaper': {
          const act = str('action');
          const pts = (Array.isArray(a.points) ? a.points : []).map((q) => (Array.isArray(q) ? { x: Number(q[0]), y: Number(q[1]) } : { x: NaN, y: NaN }));
          if ((act === 'draw' || act === 'scribble') && (pts.length < 2 || pts.some((q) => !Number.isFinite(q.x) || !Number.isFinite(q.y)))) return fail('points must be two or more [x, y] pairs in document points.');
          if (act === 'draw') {
            const r = e.addShaperShape(pts);
            if (!r) return fail('Not recognised: give a closed rough outline (rectangle, circle, ellipse, triangle, polygon) or a near-straight line, with a few dozen points.');
            const n = this.node(r.id);
            return text(`Recognised a ${r.kind}; drew live shape ${r.id}${n && n.kind === 'path' && n.live ? ` (${n.live.kind})` : ''}.`, { id: r.id, shape: r.kind });
          }
          if (act === 'scribble') {
            const op = str('operation');
            if (op !== 'merge' && op !== 'punch' && op !== 'delete') return fail('scribble needs operation: merge, punch or delete. The scribble only picks which regions or shapes; it never decides the operation.');
            const r = e.shaperScribble(pts, op);
            if (!r) return fail('The scribble touched no shape: zigzag over the shapes or their overlap.');
            if (r.action === 'none') return fail(op === 'merge' ? 'Nothing merged: the scribble must cross two or more regions.' : op === 'punch' ? 'Nothing punched: the scribble must pass over a region where two or more shapes overlap.' : 'Nothing deleted: scribble over the shape to delete.');
            return text(r.action === 'cut' ? `Punched out the region in Shaper Group ${r.id}.` : r.action === 'merge' ? `Merged the regions in Shaper Group ${r.id}.` : 'Deleted the shape.', { id: r.id, action: r.action });
          }
          const id = has('id') ? String(a.id) : e.shaperTargets()[0];
          const g = id ? this.node(id) : null;
          if (!g || g.kind !== 'group' || !g.shaper) return fail('Pass the id of a Shaper Group (a scribble over overlapping shapes makes one).');
          if (act === 'fill') {
            if (!has('x') || !has('y')) return fail('Give x and y inside a face.');
            const paint = has('color') ? this.paint(a.color, 'color') : e.fillPaint;
            return e.shaperFill(g.id, { x: num('x', 0), y: num('y', 0) }, paint) ? text('Filled the face.', { id: g.id }) : fail('No face of that Shaper Group at that point.');
          }
          if (act === 'expand') return e.expandShaper([g.id]) ? text(`Expanded Shaper Group ${g.id} into plain paths.`, { id: g.id }) : fail('Nothing changed.');
          return fail('action must be draw, scribble, fill or expand.');
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
          const ids = this.ids(a) ?? e.targetIds(), act = str('action', has('map') ? 'map' : has('palette') ? 'palette' : has('harmony') ? 'harmony' : has('group') ? 'group' : has('colors') ? 'reduce' : 'invert');
          let fn;
          if (act === 'reduce' || act === 'group' || act === 'harmony') {
            const cols = collectColors(ids.map((id) => findNode(p.doc, id) as VNode).filter(Boolean));
            if (!cols.length) return fail('Those objects have no solid or gradient colours.');
            let rows = has('colors') ? reduceRows(cols, Math.max(1, Math.round(num('colors', cols.length)))) : cols.map((c) => ({ from: [c], to: c, on: true }));
            if (act === 'group') {
              const g = str('group'), userLibs = this.deps.userLibraries?.().swatches ?? [];
              const [lid, ...rest] = g.split(':'), lib = swatchLibrary(lid, userLibs);
              const pal = p.doc.swatches.some((s) => s.group === g) ? p.doc.swatches.filter((s) => s.group === g && s.paint.type === 'color').map((s) => (s.paint as { color: Color }).color) : lib ? libraryColors(lib, rest.length ? rest.join(':') : undefined) : [];
              if (!pal.length) return fail(`group is a colour group of the document (${e.swatchGroups().join(', ') || 'none yet'}) or a swatch library id (${[...SWATCH_LIBRARIES, ...userLibs].map((l) => l.id).join(', ')}), optionally library:group.`);
              rows = fitRowsToPalette(rows, pal);
            }
            if (act === 'harmony') {
              const base = has('base') ? parseColor(str('base')) : rowReference(cols);
              if (!base) return fail('base is a colour such as #e8261d.');
              if (!has('colors') && rows.length > 5) rows = reduceRows(cols, 5);
              rows = fitRowsToPalette(rows, harmonyColors(base, (str('harmony') || 'complementary') as HarmonyRule));
            }
            const preserve = a.preserve_tints !== false && (has('colors') || act !== 'harmony');
            const before = cols.map(hex);
            e.edit('Recolor Art', (d) => recolorDoc(d, ids, rowsFn(rows, preserve)));
            const out = rows.map((r) => ({ from: r.from.map(hex), to: hex(r.to) })).sort((x, y) => oklab(parseColor(y.to) ?? BLACK)[0] - oklab(parseColor(x.to) ?? BLACK)[0]);
            return text(`Recoloured ${before.length} colour${before.length === 1 ? '' : 's'} into ${rows.length}: ${out.map((r) => r.to).join(' ')}.`, { colors_before: before, rows: out });
          }
          if (act === 'map') { const m = new Map<string, Color>(); for (const [k, v] of Object.entries((a.map ?? {}) as Record<string, string>)) { const from = parseColor(k), to = parseColor(String(v)); if (from && to) m.set(hex(from), to); } fn = mapFn(m); }
          else if (act === 'palette') { const pal = (Array.isArray(a.palette) ? a.palette : []).map((c) => parseColor(String(c))).filter((c): c is Color => !!c); if (!pal.length) return fail('Give palette colours.'); fn = nearestFn(pal); }
          else if (RECOLOR[act]) fn = RECOLOR[act](num('amount', 0));
          else return fail('action must be map, palette, invert, grayscale, cmyk, rgb or saturate.');
          const before = collectColors(ids.map((id) => findNode(p.doc, id) as VNode)).map(hex);
          e.edit('Recolor Art', (d) => recolorDoc(d, ids, fn));
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
          const pathKeys = ['path_effect', 'path_flip', 'path_align', 'path_spacing', 'path_start', 'path_end'].filter(has), areaKeys = ['area_rows', 'area_row_gutter', 'area_columns', 'area_gutter', 'area_inset', 'first_baseline', 'first_baseline_min', 'area_flow'].filter(has);
          if (pathKeys.length && n.mode !== 'path') return fail(`${pathKeys.join(', ')} only work on type on a path, and ${n.id} is ${n.mode} type.`);
          if (areaKeys.length && n.mode !== 'area') return fail(`${areaKeys.join(', ')} only work on area type, and ${n.id} is ${n.mode} type.`);
          const bad = ([['orientation', ['horizontal', 'vertical']], ['path_effect', ['rainbow', 'skew', 'ribbon', 'stair', 'gravity']], ['path_align', ['baseline', 'ascender', 'descender', 'center']], ['first_baseline', ['ascent', 'cap', 'leading', 'x', 'em', 'fixed', 'legacy']], ['area_flow', ['rows', 'columns']]] as const).find(([k, ok]) => has(k) && !(ok as readonly string[]).includes(str(k)));
          if (bad) return fail(`${bad[0]} is one of ${bad[1].join(', ')}.`);
          if (has('text')) e.setTextSpans(n.id, [{ text: str('text'), style: n.spans[0]?.style ?? DEFAULT_CHAR }], 'Edit Text');
          if (has('kerning') && !['auto', 'optical', 'none'].includes(str('kerning'))) return fail('kerning is auto, optical or none.');
          const notes: string[] = [];
          let axes: Record<string, number> | undefined | null = null;
          if (a.axes && typeof a.axes === 'object' && !Array.isArray(a.axes)) {
            const st0 = n.spans[0]?.style ?? DEFAULT_CHAR, fam = has('font') ? str('font') : st0.font, sty = has('style') ? str('style') : st0.style;
            const info = await variationOf(fam, sty), raw = Object.entries(a.axes as Record<string, unknown>).filter(([k, v]) => /^[A-Za-z0-9 ]{1,4}$/.test(k) && typeof v === 'number' && Number.isFinite(v)) as Array<[string, number]>;
            if (!info) notes.push(`${fam} ${sty} is not a variable font, so the axes do nothing until a variable font is set.`);
            const kept = raw.map(([k, v]) => { const ax = info?.axes.find((x) => x.tag === k); if (info && !ax) notes.push(`${fam} has no ${k} axis (it has ${info.axes.map((x) => x.tag).join(', ')}).`); return ax ? [k, Math.max(ax.min, Math.min(ax.max, v))] as const : info ? null : [k, v] as const; }).filter((x): x is readonly [string, number] => !!x);
            axes = kept.length ? Object.fromEntries(kept) : undefined;
          }
          const patch: Partial<typeof DEFAULT_CHAR> = { ...(has('font') ? { font: str('font') } : {}), ...(has('style') ? { style: str('style') } : {}), ...(has('size') ? { size: Math.max(0.1, num('size', 12)) } : {}), ...(has('color') ? { fill: this.paint(a.color, 'color') } : {}), ...(has('leading') ? { leading: num('leading', 14) } : {}), ...(has('tracking') ? { tracking: num('tracking', 0) } : {}), ...(Array.isArray(a.features) ? { features: a.features.filter((f): f is string => typeof f === 'string' && /^[a-z0-9]{4}$/.test(f)) } : {}), ...(has('caps') ? { caps: str('caps') as 'none' } : {}), ...(has('kerning') ? { kerning: str('kerning') as 'auto' } : {}), ...(axes !== null ? { axes } : {}), ...(has('rotation') ? { rotate: num('rotation', 0) || undefined } : {}) };
          if (Object.keys(patch).length) {
            const cur = e.nodeById(n.id) as TextNode, range: [number, number] | undefined = has('start') || has('end') ? [Math.max(0, Math.round(num('start', 0))), Math.round(num('end', plainText(cur).length))] : undefined;
            e.edit('Character', (d) => updateNodes(d, [n.id], (x) => (x.kind === 'text' ? { ...x, spans: range ? styleSpans(x.spans, range[0], range[1], patch) : x.spans.map((s) => ({ ...s, style: { ...s.style, ...patch } })) } : x)));
          }
          const pp: Partial<ParaStyle> = {}, para0 = (e.nodeById(n.id) as TextNode).para;
          if (has('align')) pp.align = str('align') as ParaStyle['align'];
          if (a.hyphenation && typeof a.hyphenation === 'object') {
            const h = a.hyphenation as Record<string, unknown>, cur = { ...DEFAULT_HYPH, ...(para0.hyph ?? {}) }, iv = (k: string, d: number): number => (typeof h[k] === 'number' && Number.isFinite(h[k]) ? Math.round(h[k] as number) : d);
            pp.hyph = { minWord: iv('min_word', cur.minWord), after: iv('after_first', cur.after), before: iv('before_last', cur.before), limit: iv('limit', cur.limit), zone: typeof h.zone === 'number' ? Math.max(0, h.zone) : cur.zone, caps: typeof h.capitalized === 'boolean' ? h.capitalized : cur.caps };
            pp.hyphenate = true;
          }
          if (typeof a.hyphenate === 'boolean') pp.hyphenate = a.hyphenate;
          if (a.justification && typeof a.justification === 'object') {
            const jv = a.justification as Record<string, unknown>, cur = { ...DEFAULT_JUST, ...(para0.just ?? {}) };
            const trio = (k: string, d: [number, number, number]): [number, number, number] => { const v = jv[k]; if (!Array.isArray(v) || v.length !== 3 || !v.every((x) => typeof x === 'number' && Number.isFinite(x))) return d; const [lo, de, hi] = v as number[]; const m = Math.max(lo, Math.min(hi, de)); return [Math.min(lo, m), m, Math.max(hi, m)]; };
            const [wordMin, wordDes, wordMax] = trio('word_spacing', [cur.wordMin, cur.wordDes, cur.wordMax]), [letterMin, letterDes, letterMax] = trio('letter_spacing', [cur.letterMin, cur.letterDes, cur.letterMax]), [glyphMin, glyphDes, glyphMax] = trio('glyph_scaling', [cur.glyphMin, cur.glyphDes, cur.glyphMax]);
            const single = typeof jv.single_word === 'string' && ['justify', 'left', 'center', 'right'].includes(jv.single_word) ? jv.single_word as Justification['single'] : cur.single;
            pp.just = { wordMin, wordDes, wordMax, letterMin, letterDes, letterMax, glyphMin, glyphDes, glyphMax: Math.max(glyphMax, 1), single };
          }
          if (Array.isArray(a.tabs)) {
            const tabs: TabStop[] = [];
            for (const t of a.tabs as Array<Record<string, unknown>>) {
              if (!t || typeof t.position !== 'number' || !Number.isFinite(t.position)) return fail('Each tab needs a position in points.');
              const al = typeof t.align === 'string' ? t.align : 'left';
              if (!['left', 'center', 'right', 'decimal'].includes(al)) return fail('A tab aligns left, center, right or decimal.');
              tabs.push({ pos: Math.max(0, t.position), align: al as TabStop['align'], ...(typeof t.leader === 'string' && t.leader ? { leader: t.leader.slice(0, 4) } : {}), ...(typeof t.align_on === 'string' && t.align_on ? { char: t.align_on.slice(0, 1) } : {}) });
            }
            pp.tabs = tabs.length ? tabs : undefined;
          }
          if (a.list && typeof a.list === 'object') {
            const l = a.list as Record<string, unknown>, kind = l.type === 'bullet' || l.type === 'number' ? l.type : l.type === 'none' ? null : para0.list?.kind ?? 'bullet';
            const fmt = typeof l.format === 'string' && ['1', '01', 'a', 'A', 'i', 'I'].includes(l.format) ? l.format as ListStyle['format'] : para0.list?.format ?? '1';
            pp.list = kind ? { kind, bullet: typeof l.bullet === 'string' && l.bullet ? l.bullet : para0.list?.bullet ?? '•', format: fmt, start: typeof l.start === 'number' ? Math.max(0, Math.round(l.start)) : para0.list?.start ?? 1, sep: typeof l.separator === 'string' ? l.separator : para0.list?.sep ?? '.' } : undefined;
          }
          if (Object.keys(pp).length) e.setParaStyle(pp, [n.id]);
          if (a.touch && typeof a.touch === 'object') {
            const t = a.touch as Record<string, unknown>, cur = e.nodeById(n.id) as TextNode, len = plainText(cur).length, idx = typeof t.index === 'number' ? Math.round(t.index) : -1;
            if (idx < 0 || idx >= len) return fail(`touch.index must be 0..${len - 1}, a character's position in the text.`);
            const was = { x: 0, y: 0, sx: 100, sy: 100, r: 0, ...(charStyleAt(cur.spans, idx).touch ?? {}) }, nv = (k: string, d: number): number => (typeof t[k] === 'number' && Number.isFinite(t[k]) ? t[k] as number : d);
            e.setCharTouch(n.id, idx, t.reset === true ? null : { x: nv('x', was.x), y: nv('y', was.y), sx: nv('h_scale', was.sx), sy: nv('v_scale', was.sy), r: nv('rotate', was.r) });
          }
          if (typeof a.upright_latin === 'boolean') {
            const cur = e.nodeById(n.id) as TextNode, range: [number, number] | undefined = has('start') || has('end') ? [Math.max(0, Math.round(num('start', 0))), Math.round(num('end', plainText(cur).length))] : undefined, up = { upright: a.upright_latin ? true : undefined };
            e.edit('Character', (d) => updateNodes(d, [n.id], (x) => (x.kind === 'text' ? { ...x, spans: range ? styleSpans(x.spans, range[0], range[1], up) : x.spans.map((s) => ({ ...s, style: { ...s.style, ...up } })) } : x)));
          }
          const node: Partial<TextNode> = {}, cur = e.nodeById(n.id) as TextNode;
          if (has('orientation')) node.vertical = str('orientation') === 'vertical' || undefined;
          if (has('path_effect')) node.pathEffect = str('path_effect') as TextNode['pathEffect'];
          if (typeof a.path_flip === 'boolean') node.pathFlip = a.path_flip || undefined;
          if (has('path_align')) node.pathAlign = str('path_align') as TextNode['pathAlign'];
          if (has('path_spacing')) node.pathSpacing = Math.max(0, num('path_spacing', 0));
          if (has('path_start')) node.pathStart = Math.max(0, Math.min(1, num('path_start', 0)));
          if (has('path_end')) node.pathEnd = Math.max(0, Math.min(1, num('path_end', 1)));
          if (areaKeys.length) {
            const area = { ...(cur.area ?? { columns: 1, rows: 1, gutter: 12, inset: 0, firstBaseline: 'ascent' as const }) };
            if (has('area_rows')) area.rows = Math.max(1, Math.round(num('area_rows', 1)));
            if (has('area_row_gutter')) area.rowGutter = Math.max(0, num('area_row_gutter', 12));
            if (has('area_columns')) area.columns = Math.max(1, Math.round(num('area_columns', 1)));
            if (has('area_gutter')) area.gutter = Math.max(0, num('area_gutter', 12));
            if (has('area_inset')) area.inset = Math.max(0, num('area_inset', 0));
            if (has('first_baseline')) area.firstBaseline = str('first_baseline') as typeof area.firstBaseline;
            if (has('first_baseline_min')) area.baselineMin = Math.max(0, num('first_baseline_min', 0));
            if (has('area_flow')) area.flow = str('area_flow') === 'columns' ? 'columns' : 'rows';
            node.area = area;
          }
          if (Object.keys(node).length) e.setTextNode(n.id, node, has('orientation') && Object.keys(node).length === 1 ? 'Type Orientation' : cur.mode === 'path' ? 'Type on a Path Options' : cur.mode === 'area' ? 'Area Type Options' : 'Type Options');
          return text(['Changed the type.', ...notes].join(' '), this.describe(this.node(n.id)));
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
          const convertTo = has('convert_to') ? str('convert_to') : '';
          if (convertTo && !CONVERT_KINDS.some(([k]) => k === convertTo)) return fail(`convert_to must be one of ${CONVERT_KINDS.map(([k]) => k).join(', ')}.`);
          e.beginStep();
          try {
            if (convertTo) e.convertLiveShape(convertTo as ConvertKind, live.map((n) => n.id));
            if (has('radius')) { for (const n of live) { const cur = this.node(n.id); e.editLiveShape(cur.kind === 'path' && cur.live?.kind === 'polygon' ? { ...patch, r: num('radius', 50) } : patch, [n.id]); } }
            else e.editLiveShape(patch, live.map((n) => n.id));
          } finally { e.endStep(); }
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
        default: return fail(`formpath has no tool named ${name}.`);
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

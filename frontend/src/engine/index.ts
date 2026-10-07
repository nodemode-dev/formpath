import { geomBounds, invalidateBounds, nodePath, selectionBounds, visualBounds } from './bounds';
import { defaultBrushes } from './brushes';
import { allNodes, ancestors, childrenOf, cloneNode, findNode, inDocOrder, insertInto, isContainer, isLocked, isVisible, layerOf, makeLayer, newDoc, newId, nodeAt, nodeLabel, pathOf, removeNodes, topObjects, topSelectable, updateNodes, walk, type IndexPath } from './doc';
import { EFFECT_IDS, effectDefaults, WIDTH_PROFILES } from './effects';
import { Emitter } from './events';
import { detachFrames, reflow, threadChains } from './flow';
import { harmonyColors, isNeutral } from './harmony';
import { apply, arcPath, ellipsePath, emptyRect, fitCurve, flarePath, insideFill, invert, isEmptyRect, linePath, mul, nearestOnPath, normRect, parseSvgD, pathBounds, piePath, polygonPath, rectPath, rectsTouch, reflectAbout, rotateAbout, scaleAbout, shearAbout, spiralPath, starPath, translate, unionRect } from './geometry';
import { hitTest, nodeTouchesRect, type Hit } from './hit';
import { liveChildren } from './live';
import { buildMesh } from './mesh';
import { align, arrange, duplicateNodes, groupNodes, makeClip, makeCompound, moveRelative, moveToParent, releaseClip, releaseCompound, setProps, transformNodes, ungroupNodes, type AlignAction, type ArrangeOrder, type OpResult } from './ops/objects';
import { expandAppearance } from './ops/expand';
import { editLive, type LivePatch } from './ops/live-shapes';
import { addTextStyle, applyCharStyle, applyParaStyle, deleteTextStyle, fontsUsed, redefineTextStyle, renameTextStyle, replaceFont, type FontUse, type TextStyleKind } from './ops/text-styles';
import { geometryOf, pathOperation, pathfinder, shapeBuild, type PathOp, type PathOpArgs, type PathfinderOp } from './ops/paths';
import { basicAppearance, BLACK, effect, emptyAppearance, fill, firstFill, firstStroke, freeformGradient, hex, NONE, resolvePaint, sameColor, solid, stroke, toRgb, WHITE, withFirstFill, withFirstStroke } from './paint';
import { intersections, splitAtOffsets } from './kernel';
import { edgePaths, faceContains, interiorOf, liveFaceNodes, liveFaces, type LiveFace } from './livepaint';
import { artChildren, sessionGeometry, type PatternGeometry, type PatternSession } from './pattern';
import { Project } from './project';
import { applySymbolism, bakedInstance, type SymbolismArgs, type SymbolismMethod, type SymbolismOp } from './symbolism';
import { DEFAULT_CHAR, DEFAULT_PARA, layoutText, plainText, styleSpans } from './text';
import { transformNode } from './transform';
import type { Appearance, Artboard, BlendMode, BrushDef, BrushKind, CharStyle, Color, Doc, EngineEvents, Mat, Notice, Paint, ParaStyle, PathData, PathNode, PatternDef, Pt, Rect, StrokeItem, SubPath, TextNode, TextWrap, ToolId, TraceView, Units, VNode, GroupNode } from './types';
import { Viewport } from './viewport';

export * from './types';
export { Project } from './project';
export type { SymbolismArgs, SymbolismMethod, SymbolismOp } from './symbolism';
export const SYMBOLISM_NAMES: Record<SymbolismOp, string> = { shift: 'Symbol Shifter', scrunch: 'Symbol Scruncher', size: 'Symbol Sizer', spin: 'Symbol Spinner', stain: 'Symbol Stainer', screen: 'Symbol Screener', style: 'Symbol Styler' };
export { Viewport } from './viewport';

export interface ViewFlags {
  outline: boolean; rulers: boolean; guides: boolean; guidesLocked: boolean; grid: boolean; smartGuides: boolean; snapGrid: boolean; snapPoint: boolean;
  boundingBox: boolean; edges: boolean; artboards: boolean; threads: boolean; transparencyGrid: boolean; previewBounds: boolean; scaleStrokes: boolean;
  transformPatterns: boolean; cornerWidget: boolean; gradientAnnotator: boolean; pixelPreview: boolean; snapPixel: boolean;
}
export interface ToolOptions {
  polygonSides: number; starPoints: number; starRatio: number; cornerRadius: number; spiralDecay: number; spiralSegments: number; flareRays: number;
  gridRows: number; gridCols: number; pencilFidelity: number; pencilSmooth: number; keepSelected: boolean; brushSize: number; blobSize: number;
  eraserSize: number; widthPreset: string; magicTolerance: number; symbolDensity: number; symbolIntensity: number; symbolMethod: SymbolismMethod; meshRows: number; meshCols: number; blendSteps: number;
  shapeMode: 'normal' | 'behind' | 'inside'; textMode: 'point' | 'area' | 'path'; vertical: boolean; arcConvex: boolean; liquifySize: number; liquifyKind: string;
}
export interface ClipboardData { stamp: string; nodes: VNode[]; symbols: Doc['symbols']; swatches: Doc['swatches']; patterns: Doc['patterns']; brushes: Doc['brushes']; images: Doc['images']; assets: Map<string, Blob>; bounds: Rect }

export type SelectMode = 'replace' | 'add' | 'subtract' | 'toggle';
export interface ErrorEntry { at: number; what: string; message: string }

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export class Engine extends Emitter<EngineEvents> {
  projects: Project[] = [];
  private currentId: string | null = null;
  tool: ToolId = 'selection';
  fillPaint: Paint = solid(WHITE);
  strokePaint: Paint = solid(BLACK);
  strokeWidth = 1;
  activeSlot: 'fill' | 'stroke' = 'fill';
  newArtBasic = true;
  view: ViewFlags = { outline: false, rulers: true, guides: true, guidesLocked: false, grid: false, smartGuides: true, snapGrid: false, snapPoint: true, boundingBox: true, edges: true, artboards: true, threads: true, transparencyGrid: false, previewBounds: false, scaleStrokes: true, transformPatterns: true, cornerWidget: true, gradientAnnotator: true, pixelPreview: false, snapPixel: false };
  options: ToolOptions = { polygonSides: 6, starPoints: 5, starRatio: 0.5, cornerRadius: 0, spiralDecay: 0.8, spiralSegments: 10, flareRays: 15, gridRows: 5, gridCols: 5, pencilFidelity: 0.5, pencilSmooth: 0.3, keepSelected: false, brushSize: 3, blobSize: 12, eraserSize: 12, widthPreset: 'uniform', magicTolerance: 32, symbolDensity: 5, symbolIntensity: 5, symbolMethod: 'user', meshRows: 4, meshCols: 4, blendSteps: 8, shapeMode: 'normal', textMode: 'point', vertical: false, arcConvex: true, liquifySize: 60, liquifyKind: 'warp' };
  currentBrush: string | null = null;
  currentSymbol: string | null = null;
  currentStyle: string | null = null;
  clipboard: ClipboardData | null = null;
  readonly failures: ErrorEntry[] = [];
  lastTransform: { m: Mat; copy: boolean } | null = null;
  lastEffect: { id: string; params: Record<string, number | string | boolean> } | null = null;
  overlay: { lines: Array<{ x1: number; y1: number; x2: number; y2: number }>; label: string | null; at: Pt | null } = { lines: [], label: null, at: null };
  private busy = 0;
  private gestureDepth = 0;
  private gestureEdits = 0;
  private dragBase: Doc | null = null;
  private dragName = '';

  get current(): Project | null { return this.projects.find((p) => p.id === this.currentId) ?? null; }
  get doc(): Doc | null { return this.current?.doc ?? null; }

  notice(text: string, kind: Notice['kind'] = 'info'): void {
    if (kind === 'error') { this.failures.push({ at: Date.now(), what: 'Engine', message: text }); if (this.failures.length > 100) this.failures.shift(); }
    this.emit('notice', { text, kind });
  }
  async task<T>(fn: () => Promise<T>): Promise<T> {
    this.busy++;
    if (this.busy === 1) this.emit('busy', true);
    try { return await fn(); } finally { this.busy--; if (!this.busy) this.emit('busy', false); }
  }
  get isBusy(): boolean { return this.busy > 0; }

  refresh(): void {
    invalidateBounds();
    for (const k of ['doc', 'selection', 'history', 'render', 'options'] as const) this.emit(k, null);
  }
  repaint(): void { this.emit('render', null); }

  newDocument(w: number, h: number, opts: { title?: string; units?: Units; colorMode?: 'rgb' | 'cmyk'; artboards?: number } = {}): Project {
    const d = newDoc(w, h, opts);
    d.brushes = defaultBrushes(newId);
    return this.addProject(d, opts.title ?? 'Untitled');
  }

  addProject(doc: Doc, name: string): Project {
    const p = new Project(newId('d'), reflow(doc), name);
    p.viewport.width = this.viewSize.w || p.viewport.width;
    p.viewport.height = this.viewSize.h || p.viewport.height;
    const ab = doc.artboards[0];
    if (ab) p.viewport.fitRect(ab.x, ab.y, ab.w, ab.h);
    this.projects.push(p);
    this.currentId = p.id;
    this.emit('projects', null);
    this.emit('active', null);
    this.emit('viewport', null);
    this.refresh();
    return p;
  }
  switchTo(id: string): void {
    if (id === this.currentId || !this.projects.some((p) => p.id === id)) return;
    this.cancelDrag();
    this.currentId = id;
    this.emit('projects', null); this.emit('active', null); this.emit('viewport', null); this.refresh();
  }
  closeProject(id: string): void {
    const i = this.projects.findIndex((p) => p.id === id);
    if (i < 0) return;
    this.projects.splice(i, 1);
    if (this.currentId === id) this.currentId = this.projects[Math.min(i, this.projects.length - 1)]?.id ?? null;
    this.emit('projects', null); this.emit('active', null); this.emit('viewport', null); this.refresh();
  }
  markSaved(p: Project, name: string, libraryName: string | null): void { p.name = name; p.libraryName = libraryName; p.history.markSaved(); this.emit('projects', null); this.emit('history', null); }

  edit(name: string, fn: (doc: Doc, p: Project) => Doc | { doc: Doc; select?: string[] | null }, opts: { keepAnchors?: boolean; merge?: boolean } = {}): boolean {
    const p = this.current;
    if (!p) return false;
    if (this.dragBase) this.cancelDrag();
    try {
      const r = fn(p.doc, p);
      const next = reflow('layers' in r ? r : r.doc), sel = 'layers' in r ? undefined : r.select;
      if (next === p.doc && sel === undefined) return false;
      p.doc = next;
      if (sel) p.selection = new Set(sel);
      this.pruneSelection(p, opts.keepAnchors);
      if (p.history.push(name, next, [...p.selection], opts.merge || (this.gestureDepth > 0 && this.gestureEdits > 0))) this.gestureEdits++;
      this.refresh();
      return true;
    } catch (err) {
      this.notice(`${name}: ${message(err)}`, 'error');
      return false;
    }
  }

  private pruneSelection(p: Project, keepAnchors = true): void {
    for (const id of [...p.selection]) if (!findNode(p.doc, id)) p.selection.delete(id);
    for (const id of [...p.anchors.keys()]) if (!findNode(p.doc, id) || !keepAnchors) p.anchors.delete(id);
    if (!findNode(p.doc, p.activeLayer) || layerOf(p.doc, p.activeLayer)?.id !== p.activeLayer) p.activeLayer = p.doc.layers[p.doc.layers.length - 1]?.id ?? '';
    if (p.isolation && !findNode(p.doc, p.isolation)) p.isolation = null;
    if (p.patternEdit && !findNode(p.doc, p.patternEdit.group)) { p.patternEdit = null; if (p.isolation) p.isolation = null; }
  }

  beginGesture(): void { if (this.gestureDepth++ === 0) this.gestureEdits = 0; }
  endGesture(): void { this.gestureDepth = Math.max(0, this.gestureDepth - 1); }
  private step: { p: Project; at: number } | null = null;
  beginStep(): void { const p = this.current; this.step = p ? { p, at: p.history.mark() } : null; }
  endStep(): void { const s = this.step; this.step = null; if (s && s.p.history.squash(s.at)) this.emit('history', null); }

  beginDrag(name: string): void { const p = this.current; if (!p) return; this.dragBase = p.doc; this.dragName = name; }
  dragTo(doc: Doc): void { const p = this.current; if (!p || !this.dragBase) return; p.doc = reflow(doc); invalidateBounds(); this.emit('render', null); }
  reflowAll(): void { for (const p of this.projects) { if (p.id === this.currentId && this.dragBase) continue; const d = reflow(p.doc); if (d !== p.doc) p.doc = d; } this.refresh(); }
  get dragging(): boolean { return this.dragBase !== null; }
  get dragOrigin(): Doc | null { return this.dragBase; }
  commitDrag(select?: string[]): boolean {
    const p = this.current;
    if (!p || !this.dragBase) return false;
    const changed = p.doc !== this.dragBase;
    this.dragBase = null;
    if (select) p.selection = new Set(select);
    this.pruneSelection(p);
    if (changed) p.history.push(this.dragName, p.doc, [...p.selection]);
    this.refresh();
    return changed;
  }
  cancelDrag(): void { const p = this.current; if (!p || !this.dragBase) return; p.doc = this.dragBase; this.dragBase = null; this.refresh(); }

  undo(steps = 1): boolean { const p = this.current; if (!p) return false; let s = null; for (let i = 0; i < steps; i++) s = p.history.undo() ?? s; if (!s) return false; this.restore(p, s.doc, s.selection); return true; }
  redo(steps = 1): boolean { const p = this.current; if (!p) return false; let s = null; for (let i = 0; i < steps; i++) s = p.history.redo() ?? s; if (!s) return false; this.restore(p, s.doc, s.selection); return true; }
  jumpHistory(i: number): void { const p = this.current; if (!p) return; const s = p.history.jump(i); if (s) this.restore(p, s.doc, s.selection); }
  get historySteps(): { names: string[]; current: number } { return this.current?.history.steps() ?? { names: [], current: 0 }; }
  private restore(p: Project, doc: Doc, sel: string[]): void { this.cancelDrag(); p.doc = reflow(doc); p.selection = new Set(sel); p.anchors.clear(); this.pruneSelection(p); this.refresh(); }

  private viewSize = { w: 0, h: 0 };
  setViewSize(w: number, h: number): void { this.viewSize = { w, h }; for (const p of this.projects) { if (p.viewport.width === w && p.viewport.height === h) continue; const ab = p.doc.artboards[p.activeArtboard]; const fitted = p.viewport.fitted; p.viewport.resize(w, h); if (fitted && ab) p.viewport.fitRect(ab.x, ab.y, ab.w, ab.h); } this.emit('viewport', null); }
  zoomTo(z: number, at?: Pt): void { const p = this.current; if (!p) return; const v = p.viewport; v.zoomAt(z, at?.x ?? v.centerX, at?.y ?? v.height / 2); this.emit('viewport', null); }
  zoomStep(dir: 1 | -1, at?: Pt): void {
    const p = this.current; if (!p) return;
    const steps = [0.0313, 0.0417, 0.0625, 0.0833, 0.125, 0.1667, 0.25, 0.3333, 0.5, 0.6667, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512, 640];
    const z = p.viewport.zoom, next = dir > 0 ? steps.find((s) => s > z * 1.001) ?? steps[steps.length - 1] : [...steps].reverse().find((s) => s < z / 1.001) ?? steps[0];
    this.zoomTo(next, at);
  }
  fit(): void { const p = this.current; if (!p) return; const ab = p.doc.artboards[p.activeArtboard] ?? p.doc.artboards[0]; if (ab) p.viewport.fitRect(ab.x, ab.y, ab.w, ab.h); this.emit('viewport', null); }
  fitAll(): void {
    const p = this.current; if (!p) return;
    let r = p.doc.artboards.reduce((a, b) => unionRect(a, { x: b.x, y: b.y, w: b.w, h: b.h }), emptyRect());
    for (const l of p.doc.layers) { const b = visualBounds(p.doc, l); if (!isEmptyRect(b)) r = unionRect(r, b); }
    if (!isEmptyRect(r)) p.viewport.fitRect(r.x, r.y, r.w, r.h);
    this.emit('viewport', null);
  }
  fitSelection(): void { const p = this.current; if (!p) return; const b = this.selectionBounds(); if (!b) return; p.viewport.fitRect(b.x, b.y, Math.max(b.w, 1), Math.max(b.h, 1), 80); this.emit('viewport', null); }
  pan(dx: number, dy: number): void { const p = this.current; if (!p) return; p.viewport.panBy(dx, dy); this.emit('viewport', null); }
  setViewRotation(deg: number): void { const p = this.current; if (!p) return; p.viewport.rotation = ((deg % 360) + 360) % 360; this.emit('viewport', null); }
  setView(patch: Partial<ViewFlags>): void { this.view = { ...this.view, ...patch }; this.emit('options', null); this.emit('render', null); this.emit('overlay', null); }
  update(patch: Partial<ToolOptions>): void { this.options = { ...this.options, ...patch }; this.emit('options', null); }
  setTool(id: ToolId): void { if (this.tool === id) return; this.tool = id; this.emit('tool', null); this.emit('overlay', null); }
  setOverlay(o: Partial<Engine['overlay']>): void { this.overlay = { ...this.overlay, ...o }; this.emit('overlay', null); }
  clearOverlay(): void { if (!this.overlay.lines.length && !this.overlay.label) return; this.overlay = { lines: [], label: null, at: null }; this.emit('overlay', null); }

  selectedIds(): string[] { const p = this.current; return p ? inDocOrder(p.doc, p.selection) : []; }
  selected(): VNode[] { const p = this.current; return p ? this.selectedIds().map((id) => findNode(p.doc, id)).filter((n): n is VNode => !!n) : []; }
  targetIds(ids?: string[] | null): string[] { const p = this.current; if (!p) return []; return ids && ids.length ? ids.filter((id) => !!findNode(p.doc, id)) : topObjects(p.doc, p.selection); }
  get hasSelection(): boolean { return (this.current?.selection.size ?? 0) > 0; }
  selectionBounds(preview = this.view.previewBounds): Rect | null {
    const p = this.current;
    if (!p || !p.selection.size) return null;
    const b = selectionBounds(p.doc, topObjects(p.doc, p.selection).map((id) => findNode(p.doc, id) as VNode).filter(Boolean), preview);
    return isEmptyRect(b) ? null : b;
  }
  select(ids: string[], mode: SelectMode = 'replace'): void {
    const p = this.current; if (!p) return;
    const valid = ids.filter((id) => { const n = findNode(p.doc, id); return !!n && n.kind !== 'layer' && !isLocked(p.doc, id) && isVisible(p.doc, id); });
    const s = mode === 'replace' ? new Set<string>() : new Set(p.selection);
    for (const id of valid) {
      if (mode === 'subtract') s.delete(id);
      else if (mode === 'toggle') { if (s.has(id)) s.delete(id); else s.add(id); }
      else s.add(id);
    }
    p.selection = s;
    for (const id of [...p.anchors.keys()]) if (!s.has(id)) p.anchors.delete(id);
    const first = valid[valid.length - 1];
    if (first) { const l = layerOf(p.doc, first); if (l) p.activeLayer = l.id; }
    p.history.noteSelection([...s]);
    this.emit('selection', null); this.emit('render', null); this.emit('overlay', null); this.emit('options', null);
  }
  deselect(): void { this.select([], 'replace'); }
  selectAll(onArtboard = false): void {
    const p = this.current; if (!p) return;
    const ab = p.doc.artboards[p.activeArtboard];
    const base = p.isolation ? (childrenOf(findNode(p.doc, p.isolation) as VNode) ?? []) : p.doc.layers.flatMap((l) => this.layerObjects(l));
    this.select(base.filter((n) => !n.locked && !n.hidden && (!onArtboard || !ab || rectsTouch(geomBounds(p.doc, n), { x: ab.x, y: ab.y, w: ab.w, h: ab.h }))).map((n) => n.id));
  }
  private layerObjects(l: VNode): VNode[] { if (l.hidden || l.locked) return []; return (childrenOf(l) ?? []).flatMap((c) => (c.kind === 'layer' ? this.layerObjects(c) : [c])); }
  selectInverse(): void {
    const p = this.current; if (!p) return;
    const all = p.doc.layers.flatMap((l) => this.layerObjects(l)).map((n) => n.id);
    this.select(all.filter((id) => !p.selection.has(id)));
  }
  selectInRect(r: Rect, mode: SelectMode, deep: boolean): void {
    const p = this.current; if (!p) return;
    const ids: string[] = [];
    const visit = (nodes: VNode[]): void => {
      for (const n of nodes) {
        if (n.hidden || n.locked) continue;
        if (n.kind === 'layer') { if (!n.template) visit(n.children); continue; }
        if (deep && (n.kind === 'group' || n.kind === 'compound')) { visit(n.kind === 'compound' ? n.children : n.children); continue; }
        if (nodeTouchesRect(p.doc, n, r)) ids.push(n.id);
      }
    };
    const base = p.isolation ? (childrenOf(findNode(p.doc, p.isolation) as VNode) ?? []) : p.doc.layers;
    visit(base);
    this.select(ids, mode);
  }
  hit(pt: Pt, tolPx = 4, exclude?: Set<string>): Hit | null { const p = this.current; if (!p) return null; return hitTest(p.doc, pt, { tol: tolPx / p.viewport.zoom, outline: this.view.outline, exclude }); }
  selectBehind(pt: Pt, skip: Set<string>): string | null {
    const p = this.current; if (!p) return null;
    for (const id of p.selection) skip.add(this.selectableFor(id));
    let h = this.hit(pt, 4, skip);
    if (!h) { skip.clear(); h = this.hit(pt, 4); }
    if (!h) return null;
    const id = this.selectableFor(h.id);
    this.select([id]);
    return id;
  }
  selectSimilar(refId: string, c: { fill?: number | null; stroke?: number | null; weight?: number | null; opacity?: number | null; blend?: boolean }, mode: SelectMode = 'replace'): number {
    const p = this.current; if (!p) return 0;
    const ref = findNode(p.doc, refId);
    if (!ref) return 0;
    const paintKey = (n: VNode, kind: 'fill' | 'stroke'): Paint | null => { if (n.kind === 'text') { const st = n.spans[0]?.style; return st ? (kind === 'fill' ? st.fill : st.stroke) : null; } const i = kind === 'fill' ? firstFill(n.ap) : firstStroke(n.ap); return i ? resolvePaint(p.doc, i.paint) : { type: 'none' }; };
    const near = (a: Paint | null, b: Paint | null, tol: number): boolean => {
      if (!a || !b) return a === b;
      const cols = (x: Paint): Color[] | null => (x.type === 'none' ? [] : x.type === 'color' ? [x.color] : x.type === 'gradient' ? (x.gradient.points?.length ? x.gradient.points.map((q) => q.color) : x.gradient.stops.map((s) => s.color)) : null);
      const ca = cols(a), cb = cols(b);
      if (!ca || !cb) return JSON.stringify(a) === JSON.stringify(b);
      if (a.type !== b.type || ca.length !== cb.length) return false;
      return ca.every((x, i) => { const u = toRgb(x), v = toRgb(cb[i]); return Math.max(Math.abs(u.r - v.r), Math.abs(u.g - v.g), Math.abs(u.b - v.b)) <= tol; });
    };
    const weight = (n: VNode): number => (n.kind === 'text' ? n.spans[0]?.style.strokeWidth ?? 0 : firstStroke(n.ap)?.width ?? 0);
    const rf = paintKey(ref, 'fill'), rs = paintKey(ref, 'stroke');
    const ok = (n: VNode): boolean =>
      (c.fill == null || near(paintKey(n, 'fill'), rf, c.fill)) && (c.stroke == null || near(paintKey(n, 'stroke'), rs, c.stroke)) &&
      (c.weight == null || Math.abs(weight(n) - weight(ref)) <= c.weight) && (c.opacity == null || Math.abs(n.opacity - ref.opacity) * 100 <= c.opacity) && (!c.blend || n.blend === ref.blend);
    const ids = allNodes(p.doc).filter((n) => n.kind !== 'layer' && !n.locked && !n.hidden && ancestors(p.doc, n.id).every((a) => a.kind === 'layer') && ok(n)).map((n) => n.id);
    this.select(ids, mode);
    return ids.length;
  }
  selectableFor(hitId: string): string { const p = this.current; return p ? topSelectable(p.doc, hitId, p.isolation) : hitId; }
  setAnchors(id: string, set: Set<number> | null): void { const p = this.current; if (!p) return; if (set && set.size) p.anchors.set(id, set); else p.anchors.delete(id); this.emit('overlay', null); this.emit('selection', null); }
  clearAnchors(): void { const p = this.current; if (!p || !p.anchors.size) return; p.anchors.clear(); this.emit('overlay', null); }

  selectSame(attr: string, refId?: string): void {
    const p = this.current; if (!p) return;
    const ref = refId ? findNode(p.doc, refId) : this.selected()[0];
    if (!ref) return;
    const key = (n: VNode): string => {
      const f = firstFill(n.ap), s = firstStroke(n.ap);
      switch (attr) {
        case 'fill_color': return f ? JSON.stringify(resolvePaint(p.doc, f.paint)) : 'none';
        case 'stroke_color': return s ? JSON.stringify(resolvePaint(p.doc, s.paint)) : 'none';
        case 'stroke_weight': return s ? String(s.width) : '0';
        case 'fill_and_stroke': return `${f ? JSON.stringify(f.paint) : ''}|${s ? JSON.stringify(s.paint) : ''}`;
        case 'opacity': return String(n.opacity);
        case 'blending_mode': return n.blend;
        case 'appearance': return JSON.stringify(n.ap);
        case 'graphic_style': return n.style ?? '';
        case 'shape': return n.kind === 'path' && n.live ? n.live.kind : n.kind;
        case 'font_family': return n.kind === 'text' ? n.spans[0]?.style.font ?? '' : '\u0000';
        case 'font_size': return n.kind === 'text' ? String(n.spans[0]?.style.size) : '\u0000';
        case 'symbol_instance': return n.kind === 'symbol' ? n.symbol : '\u0000';
        default: return n.kind;
      }
    };
    const want = key(ref);
    this.select(allNodes(p.doc).filter((n) => n.kind !== 'layer' && !n.locked && key(n) === want && !ancestors(p.doc, n.id).some((a) => a.kind !== 'layer')).map((n) => n.id));
  }
  selectByKind(kind: 'open_paths' | 'stray_points' | 'text' | 'point_text' | 'area_text' | 'clipping_masks' | 'brush_strokes' | 'same_layers' | 'direction_handles'): void {
    const p = this.current; if (!p) return;
    const nodes = allNodes(p.doc).filter((n) => {
      if (n.locked || n.hidden) return false;
      switch (kind) {
        case 'open_paths': return n.kind === 'path' && n.d.some((sp) => !sp.closed);
        case 'stray_points': return n.kind === 'path' && n.d.every((sp) => sp.pts.length < 2);
        case 'text': return n.kind === 'text';
        case 'point_text': return n.kind === 'text' && n.mode === 'point';
        case 'area_text': return n.kind === 'text' && n.mode === 'area';
        case 'clipping_masks': return n.kind === 'group' && n.clip;
        case 'brush_strokes': return n.ap.items.some((i) => i.kind === 'stroke' && !!i.brush);
        case 'same_layers': { const ls = new Set(this.selectedIds().map((id) => layerOf(p.doc, id)?.id)); return n.kind !== 'layer' && ls.has(layerOf(p.doc, n.id)?.id) && ancestors(p.doc, n.id).every((a) => a.kind === 'layer'); }
        case 'direction_handles': return false;
      }
    });
    this.select(nodes.map((n) => n.id));
  }

  get activeLayer(): string { return this.current?.activeLayer ?? ''; }
  setActiveLayer(id: string): void { const p = this.current; if (!p || !findNode(p.doc, id)) return; p.activeLayer = id; this.emit('selection', null); }
  private insertionPoint(doc: Doc, p: Project, opts: { layer?: string; above?: string } = {}): { parent: IndexPath; index: number } {
    if (opts.above) { const ap = pathOf(doc, opts.above); if (ap) return { parent: ap.slice(0, -1), index: ap[ap.length - 1] + 1 }; }
    if (p.isolation && !opts.layer) { const ip = pathOf(doc, p.isolation); const n = ip ? nodeAt(doc, ip) : null; if (ip && n) return { parent: ip, index: (childrenOf(n) ?? []).length }; }
    let lid = opts.layer ?? p.activeLayer;
    if (!findNode(doc, lid) || findNode(doc, lid)?.kind !== 'layer') lid = doc.layers[doc.layers.length - 1]?.id ?? '';
    const lp = pathOf(doc, lid) as IndexPath;
    const l = nodeAt(doc, lp) as VNode;
    if (this.options.shapeMode === 'behind' && !opts.layer) return { parent: lp, index: 0 };
    return { parent: lp, index: (childrenOf(l) ?? []).length };
  }

  addNodes(name: string, nodes: VNode[], opts: { layer?: string; above?: string; select?: boolean } = {}): string[] {
    const p = this.current;
    if (!p || !nodes.length) return [];
    if (!p.doc.layers.length) this.edit('New Layer', (d) => ({ ...d, layers: [makeLayer('Layer 1', 0)] }));
    if (this.options.shapeMode === 'inside' && p.selection.size === 1 && !opts.layer) {
      const target = this.selected()[0];
      if (target && (target.kind === 'path' || target.kind === 'compound')) {
        const ok = this.edit(name, (d) => { const r = makeClip(d, [target.id]); void r; return d; });
        void ok;
      }
    }
    this.edit(name, (d) => {
      const at = this.insertionPoint(d, p, opts);
      return { doc: insertInto(d, at.parent, at.index, nodes), select: opts.select === false ? undefined : nodes.map((n) => n.id) };
    });
    return nodes.map((n) => n.id);
  }

  newArtAppearance(closed = true): Appearance {
    return { items: [fill(closed ? this.fillPaint : this.fillPaint), stroke(this.strokePaint, this.strokeWidth)], effects: [] };
  }
  makePath(d: PathData, extra: Partial<PathNode> = {}): PathNode {
    return { id: newId('p'), kind: 'path', d, rule: 'nonzero', opacity: 1, blend: 'normal', ap: this.newArtAppearance(d.every((s) => s.closed)), ...extra };
  }
  shapePath(kind: string, x: number, y: number, w: number, h: number, extra: { radius?: number; sides?: number; points?: number; ratio?: number; turns?: number; x2?: number; y2?: number } = {}): PathNode {
    const I: Mat = [1, 0, 0, 1, 0, 0];
    switch (kind) {
      case 'rectangle': case 'rounded_rectangle': {
        const r = extra.radius ?? (kind === 'rounded_rectangle' ? Math.min(12, Math.min(Math.abs(w), Math.abs(h)) / 4) : this.options.cornerRadius);
        return this.makePath(rectPath(x, y, w, h, [r, r, r, r]), { live: { kind: 'rect', x, y, w, h, radii: [r, r, r, r], corner: 'round', xf: I } });
      }
      case 'ellipse': return this.makePath(ellipsePath(x, y, w, h), { live: { kind: 'ellipse', x, y, w, h, start: 0, end: 360, xf: I } });
      case 'polygon': { const sides = extra.sides ?? this.options.polygonSides, r = Math.min(w, h) / 2; return this.makePath(polygonPath(x + w / 2, y + h / 2, r, sides), { live: { kind: 'polygon', cx: x + w / 2, cy: y + h / 2, r, sides, radius: 0, xf: I } }); }
      case 'star': { const pts = extra.points ?? this.options.starPoints, r1 = Math.min(w, h) / 2, r2 = r1 * (extra.ratio ?? this.options.starRatio); return this.makePath(starPath(x + w / 2, y + h / 2, r1, r2, pts), { live: { kind: 'star', cx: x + w / 2, cy: y + h / 2, r1, r2, points: pts, xf: I } }); }
      case 'line': { const x2 = extra.x2 ?? x + w, y2 = extra.y2 ?? y + h; return { ...this.makePath(linePath(x, y, x2, y2), { live: { kind: 'line', x1: x, y1: y, x2, y2 } }), ap: { items: [stroke(this.strokePaint.type === 'none' ? solid(BLACK) : this.strokePaint, this.strokeWidth)], effects: [] } }; }
      case 'arc': { const x2 = extra.x2 ?? x + w, y2 = extra.y2 ?? y + h; return { ...this.makePath(arcPath(x, y, x2, y2, 0.5, this.options.arcConvex)), ap: { items: [fill(NONE), stroke(this.strokePaint.type === 'none' ? solid(BLACK) : this.strokePaint, this.strokeWidth)], effects: [] } }; }
      case 'spiral': { const segs = Math.round((extra.turns ?? this.options.spiralSegments / 4) * 4); return { ...this.makePath(spiralPath(x + w / 2, y + h / 2, Math.min(w, h) / 2, this.options.spiralDecay, Math.max(2, segs), true)), ap: { items: [fill(NONE), stroke(this.strokePaint.type === 'none' ? solid(BLACK) : this.strokePaint, this.strokeWidth)], effects: [] } }; }
      case 'flare': return { ...this.makePath(flarePath(x + w / 2, y + h / 2, Math.min(w, h) / 2, extra.points ?? this.options.flareRays)), ap: { items: [fill(NONE), stroke(this.strokePaint.type === 'none' ? solid(BLACK) : this.strokePaint, Math.max(0.5, this.strokeWidth))], effects: [] } };
      default: return this.makePath(rectPath(x, y, w, h));
    }
  }
  gridGroup(kind: 'rectangular' | 'polar', x: number, y: number, w: number, h: number, rows: number, cols: number): VNode {
    const st = { items: [fill(NONE), stroke(this.strokePaint.type === 'none' ? solid(BLACK) : this.strokePaint, this.strokeWidth)], effects: [] };
    const kids: VNode[] = [];
    const mk = (d: PathData): VNode => ({ id: newId('p'), kind: 'path', d, rule: 'nonzero', opacity: 1, blend: 'normal', ap: st });
    if (kind === 'rectangular') {
      kids.push(mk(rectPath(x, y, w, h)));
      for (let i = 1; i < cols; i++) kids.push(mk(linePath(x + (w * i) / cols, y, x + (w * i) / cols, y + h)));
      for (let j = 1; j < rows; j++) kids.push(mk(linePath(x, y + (h * j) / rows, x + w, y + (h * j) / rows)));
    } else {
      const cx = x + w / 2, cy = y + h / 2;
      for (let i = 1; i <= Math.max(1, rows); i++) { const k = i / Math.max(1, rows); kids.push(mk(ellipsePath(cx - (w / 2) * k, cy - (h / 2) * k, w * k, h * k))); }
      for (let j = 0; j < cols; j++) { const a = (j * 2 * Math.PI) / Math.max(1, cols); kids.push(mk(linePath(cx, cy, cx + Math.cos(a) * (w / 2), cy + Math.sin(a) * (h / 2)))); }
    }
    return { id: newId('g'), kind: 'group', clip: false, children: kids, opacity: 1, blend: 'normal', ap: emptyAppearance() };
  }
  pathFromPoints(points: Pt[], smooth: boolean, closed: boolean, fidelity = 2): PathData {
    if (!smooth) return [{ closed, pts: points.map((p) => ({ x: p.x, y: p.y, ix: p.x, iy: p.y, ox: p.x, oy: p.y })) }];
    return [{ closed, pts: fitCurve(closed ? [...points, points[0]] : points, fidelity).slice(0, closed ? -1 : undefined) }];
  }
  pathFromSvg(d: string): PathData { return parseSvgD(d); }

  applyToSelection(name: string, fn: (n: VNode) => VNode, ids?: string[]): boolean {
    const p = this.current; if (!p) return false;
    const targets = this.targetIds(ids);
    if (!targets.length) return false;
    return this.edit(name, (d) => updateNodes(d, targets, fn));
  }
  private paintDeep(n: VNode, fn: (ap: Appearance, n: VNode) => Appearance): VNode {
    if (n.kind === 'group' || n.kind === 'blend' || n.kind === 'repeat' || n.kind === 'envelope') return { ...n, children: n.children.map((c) => this.paintDeep(c, fn)) } as VNode;
    if (n.kind === 'text') {
      const ap0 = fn({ items: [fill(n.spans[0]?.style.fill ?? NONE), stroke(n.spans[0]?.style.stroke ?? NONE, n.spans[0]?.style.strokeWidth ?? 1)], effects: [] }, n);
      const f = firstFill(ap0), s = firstStroke(ap0);
      return { ...n, spans: n.spans.map((sp) => ({ ...sp, style: { ...sp.style, fill: f ? f.paint : sp.style.fill, stroke: s ? s.paint : sp.style.stroke, strokeWidth: s ? s.width : sp.style.strokeWidth } })) };
    }
    return { ...n, ap: fn(n.ap, n) };
  }
  setFill(paint: Paint, ids?: string[]): void {
    this.fillPaint = paint;
    this.emit('colors', null);
    const lps = ids ? null : this.livePaintSelected();
    if (lps) { if (lps.faces.length) this.livePaintFill(lps.group, lps.faces, paint); return; }
    if (!this.applyToSelection('Fill', (n) => (n.kind === 'group' && n.livePaint ? { ...n, livePaint: { ...n.livePaint, fills: liveFaces(n).map((f) => ({ at: interiorOf(f), paint })) } } : this.paintDeep(n, (ap) => withFirstFill(ap, paint))), ids)) this.emit('options', null);
  }
  editLiveShape(patch: LivePatch, ids?: string[], name = 'Shape'): boolean {
    return this.applyToSelection(name, (n) => (n.kind === 'path' && n.live ? editLive(n, patch) : n), ids);
  }
  setFreeform(mode: 'points' | 'lines' = 'points', ids?: string[], colors?: Color[]): boolean {
    const p = this.current; if (!p) return false;
    const fp = this.fillPaint, base = colors ?? (fp.type === 'gradient' ? (fp.gradient.points?.length ? fp.gradient.points.map((x) => x.color) : fp.gradient.stops.map((s) => s.color)) : fp.type === 'color' && !isNeutral(fp.color) ? ((h) => [h[2], h[3], h[1], h[4]])(harmonyColors(fp.color, 'analogous')) : []);
    let first: Paint | null = null;
    const ok = this.applyToSelection('Freeform Gradient', (n) => {
      if (n.kind === 'text' || n.kind === 'layer') return n;
      const g = freeformGradient(geomBounds(p.doc, n), base, mode), paint: Paint = { type: 'gradient', gradient: g };
      first ??= paint;
      return { ...n, ap: withFirstFill(n.ap, paint) };
    }, ids);
    if (first) { this.fillPaint = first; this.emit('colors', null); }
    return ok;
  }
  setStroke(patch: Partial<StrokeItem>, ids?: string[]): void {
    if (patch.paint) this.strokePaint = patch.paint;
    if (patch.width !== undefined) this.strokeWidth = patch.width;
    this.emit('colors', null);
    const lps = ids ? null : this.livePaintSelected();
    if (lps) { if (lps.edges.length) this.livePaintEdges(lps, patch); return; }
    if (!this.applyToSelection('Stroke', (n) => this.paintDeep(n, (ap) => withFirstStroke(ap, patch)), ids)) this.emit('options', null);
  }
  swapFillStroke(): void {
    const f = this.fillPaint, s = this.strokePaint;
    this.fillPaint = s; this.strokePaint = f;
    this.emit('colors', null);
    this.applyToSelection('Swap Fill and Stroke', (n) => this.paintDeep(n, (ap) => { const a = firstFill(ap), b = firstStroke(ap); return withFirstStroke(withFirstFill(ap, b ? b.paint : NONE), { paint: a ? a.paint : NONE }); }));
  }
  defaultFillStroke(): void { this.fillPaint = solid(WHITE); this.strokePaint = solid(BLACK); this.strokeWidth = 1; this.emit('colors', null); this.applyToSelection('Default Fill and Stroke', (n) => this.paintDeep(n, () => basicAppearance(solid(WHITE), solid(BLACK), 1))); }
  setActiveSlot(s: 'fill' | 'stroke'): void { this.activeSlot = s; this.emit('colors', null); }
  setActivePaint(paint: Paint): void { if (this.activeSlot === 'fill') this.setFill(paint); else this.setStroke({ paint }); }
  syncPaintFromSelection(): void {
    const n = this.selected()[0];
    if (!n || (n.kind === 'group' && (n.livePaint || n.trace))) return;
    if (n.kind === 'text') { const st = n.spans[0]?.style; if (st) { this.fillPaint = st.fill; this.strokePaint = st.stroke; this.strokeWidth = st.strokeWidth; } }
    else { const f = firstFill(n.ap), s = firstStroke(n.ap); this.fillPaint = f ? f.paint : NONE; this.strokePaint = s ? s.paint : NONE; if (s) this.strokeWidth = s.width; }
    this.emit('colors', null);
  }
  setAppearance(ap: Appearance, ids?: string[], name = 'Appearance'): void { this.applyToSelection(name, (n) => ({ ...n, ap }), ids); }
  editAppearance(name: string, fn: (ap: Appearance) => Appearance, ids?: string[]): void { this.applyToSelection(name, (n) => ({ ...n, ap: fn(n.ap) }), ids); }
  setObjectProps(patch: Partial<Pick<VNode, 'name' | 'hidden' | 'locked' | 'opacity' | 'blend' | 'isolate' | 'knockout' | 'note'>>, ids?: string[]): void {
    const p = this.current; if (!p) return;
    const t = ids && ids.length ? ids : this.targetIds();
    if (!t.length) return;
    this.edit(patch.opacity !== undefined ? 'Opacity' : patch.blend ? 'Blending Mode' : patch.name !== undefined ? 'Rename' : 'Object Options', (d) => setProps(d, t, patch));
  }

  makeOpacityMask(ids?: string[]): boolean {
    const t = this.targetIds(ids);
    if (t.length < 2) { this.notice('Select the artwork and, on top of it, the object to use as its opacity mask.'); return false; }
    return this.edit('Make Opacity Mask', (d) => {
      const top = findNode(d, t[t.length - 1]) as VNode, rest = t.slice(0, -1);
      let out = removeNodes(d, [top.id]), target = rest[0];
      if (rest.length > 1) { const g = groupNodes(out, rest); out = g.doc; target = g.ids[0]; }
      out = updateNodes(out, [target], (n) => ({ ...n, mask: { art: top, clip: true, invert: false, disabled: false, linked: true } }));
      return { doc: out, select: [target] };
    });
  }
  releaseOpacityMask(ids?: string[]): boolean {
    const t = this.targetIds(ids).filter((id) => !!this.nodeById(id)?.mask);
    if (!t.length) return false;
    return this.edit('Release Opacity Mask', (d) => {
      let out = d;
      const sel: string[] = [];
      for (const id of t) { const n = findNode(out, id); if (!n?.mask) continue; const art = n.mask.art; out = updateNodes(out, [id], (x) => [{ ...x, mask: null }, art]); sel.push(id, art.id); }
      return { doc: out, select: sel };
    });
  }
  setOpacityMask(patch: Partial<{ clip: boolean; invert: boolean; disabled: boolean; linked: boolean }>, ids?: string[]): boolean {
    return this.applyToSelection('Opacity Mask Options', (n) => (n.mask ? { ...n, mask: { ...n.mask, ...patch } } : n), ids);
  }

  addEffect(id: string, params?: Record<string, number | string | boolean>, ids?: string[]): boolean {
    if (!EFFECT_IDS.has(id)) { this.notice(`There is no effect called ${id}.`, 'error'); return false; }
    const prm = { ...effectDefaults(id), ...(params ?? {}) };
    this.lastEffect = { id, params: prm };
    return this.applyToSelection('Effect', (n) => ({ ...n, ap: { ...n.ap, effects: [...n.ap.effects, effect(id, prm)] } }), ids);
  }
  applyLastEffect(): void { if (this.lastEffect) this.addEffect(this.lastEffect.id, this.lastEffect.params); }

  deleteSelection(ids?: string[]): void {
    const p = this.current; if (!p) return;
    if (!ids && p.anchors.size) { this.deleteAnchors(); return; }
    const lps = ids ? null : this.livePaintSelected();
    if (lps) { this.beginStep(); if (lps.faces.length) this.livePaintFill(lps.group, lps.faces, NONE); if (lps.edges.length) this.livePaintEdges(lps, { paint: NONE }); this.endStep(); return; }
    const t = this.targetIds(ids);
    if (!t.length) return;
    this.edit('Clear', (d) => ({ doc: removeNodes(detachFrames(d, new Set(t)), t), select: [] }));
  }
  deleteAnchors(): void {
    const p = this.current; if (!p) return;
    const map = new Map(p.anchors);
    this.edit('Delete Anchor Points', (d) => {
      const r = pathOperation(d, [...map.keys()], 'remove_anchors', { anchors: map });
      return { doc: r.doc, select: [...p.selection].filter((id) => findNode(r.doc, id)) };
    });
    p.anchors.clear();
  }
  run(name: string, op: (doc: Doc, ids: string[]) => OpResult, ids?: string[]): boolean {
    const p = this.current; if (!p) return false;
    const t = this.targetIds(ids);
    return this.edit(name, (d) => { const r = op(d, t); return { doc: r.doc, select: r.ids.length ? r.ids : undefined }; });
  }
  group(ids?: string[]): boolean { return this.run('Group', groupNodes, ids); }
  ungroup(ids?: string[]): boolean { return this.run('Ungroup', ungroupNodes, ids); }
  arrange(order: ArrangeOrder, ids?: string[]): boolean { const t = this.targetIds(ids); return this.edit({ bring_to_front: 'Bring to Front', bring_forward: 'Bring Forward', send_backward: 'Send Backward', send_to_back: 'Send to Back' }[order], (d) => arrange(d, t, order)); }
  duplicate(dx = 0, dy = 0, ids?: string[]): boolean { return this.run('Duplicate', (d, t) => duplicateNodes(d, t, dx, dy), ids); }
  makeCompound(ids?: string[], rule?: 'nonzero' | 'evenodd'): boolean { return this.run('Make Compound Path', (d, t) => makeCompound(d, t, rule), ids); }
  releaseCompound(ids?: string[]): boolean { return this.run('Release Compound Path', releaseCompound, ids); }
  makeClip(ids?: string[]): boolean { return this.run('Make Clipping Mask', makeClip, ids); }
  releaseClip(ids?: string[]): boolean { return this.run('Release Clipping Mask', releaseClip, ids); }
  pathfinder(op: PathfinderOp, ids?: string[]): boolean { return this.run(`Pathfinder ${op.replace(/_/g, ' ')}`, (d, t) => pathfinder(d, t, op), ids); }
  pathOp(op: PathOp, args: PathOpArgs = {}, ids?: string[]): boolean {
    const p = this.current; if (!p) return false;
    const label: Record<PathOp, string> = { offset: 'Offset Path', outline_stroke: 'Outline Stroke', simplify: 'Simplify', smooth: 'Smooth', join: 'Join', average: 'Average', reverse: 'Reverse Path Direction', add_anchors: 'Add Anchor Points', remove_anchors: 'Remove Anchor Points', divide_objects_below: 'Divide Objects Below', split_into_grid: 'Split Into Grid', clean_up: 'Clean Up', close: 'Close Path', open: 'Open Path' };
    return this.run(label[op], (d, t) => pathOperation(d, t, op, { anchors: p.anchors, ...args }), ids);
  }
  shapeBuild(points: Pt[], erase: boolean, ids?: string[]): boolean { return this.run(erase ? 'Shape Builder Delete' : 'Shape Builder', (d, t) => shapeBuild(d, t, points, erase), ids); }
  align(action: AlignAction, to: 'selection' | 'artboard' | 'key' = 'selection', key: string | null = null, spacing: number | null = null, ids?: string[]): boolean {
    const p = this.current; if (!p) return false;
    const t = this.targetIds(ids);
    const ab = p.doc.artboards[p.activeArtboard];
    const target = to === 'artboard' && ab ? { x: ab.x, y: ab.y, w: ab.w, h: ab.h } : t.length === 1 && to === 'selection' && ab ? { x: ab.x, y: ab.y, w: ab.w, h: ab.h } : null;
    return this.edit(action.startsWith('distribute') ? 'Distribute' : 'Align', (d) => align(d, t, action, target, to === 'key' ? key : null, spacing, this.view.previewBounds));
  }
  transform(m: Mat, opts: { copy?: boolean; ids?: string[]; name?: string; each?: boolean } = {}): boolean {
    const p = this.current; if (!p) return false;
    const t = this.targetIds(opts.ids);
    if (!t.length) return false;
    this.lastTransform = { m, copy: !!opts.copy };
    const o = { strokes: this.view.scaleStrokes, patterns: this.view.transformPatterns, gradients: true };
    return this.edit(opts.name ?? 'Transform', (d) => { const r = transformNodes(d, t, m, opts.copy, o); return { doc: r.doc, select: r.ids }; });
  }
  transformEach(make: (b: Rect) => Mat, opts: { copy?: boolean; ids?: string[] } = {}): boolean {
    const p = this.current; if (!p) return false;
    const t = this.targetIds(opts.ids);
    const o = { strokes: this.view.scaleStrokes, patterns: this.view.transformPatterns, gradients: true };
    return this.edit('Transform Each', (d) => {
      let out = d;
      const sel: string[] = [];
      for (const id of t) { const n = findNode(out, id); if (!n) continue; const r = transformNodes(out, [id], make(geomBounds(out, n)), opts.copy, o); out = r.doc; sel.push(...r.ids); }
      return { doc: out, select: sel };
    });
  }
  transformAgain(): boolean { return this.lastTransform ? this.transform(this.lastTransform.m, { copy: this.lastTransform.copy, name: 'Transform Again' }) : false; }
  moveBy(dx: number, dy: number, copy = false): boolean { return this.transform(translate(dx, dy), { copy, name: copy ? 'Copy' : 'Move' }); }
  rotateBy(deg: number, origin?: Pt, copy = false): boolean { const b = this.selectionBounds(false); if (!b) return false; const o = origin ?? { x: b.x + b.w / 2, y: b.y + b.h / 2 }; return this.transform(rotateAbout(-deg, o.x, o.y), { copy, name: 'Rotate' }); }
  scaleBy(sx: number, sy: number, origin?: Pt, copy = false): boolean { const b = this.selectionBounds(false); if (!b) return false; const o = origin ?? { x: b.x + b.w / 2, y: b.y + b.h / 2 }; return this.transform(scaleAbout(sx, sy, o.x, o.y), { copy, name: 'Scale' }); }
  reflect(axis: 'horizontal' | 'vertical', origin?: Pt, copy = false): boolean { const b = this.selectionBounds(false); if (!b) return false; const o = origin ?? { x: b.x + b.w / 2, y: b.y + b.h / 2 }; return this.transform(reflectAbout(axis, o.x, o.y), { copy, name: 'Reflect' }); }
  shear(deg: number, axis: 'horizontal' | 'vertical', origin?: Pt, copy = false): boolean { const b = this.selectionBounds(false); if (!b) return false; const o = origin ?? { x: b.x + b.w / 2, y: b.y + b.h / 2 }; return this.transform(shearAbout(deg, axis, o.x, o.y), { copy, name: 'Shear' }); }
  setBounds(r: Partial<Rect>, ids?: string[]): boolean {
    const t = this.targetIds(ids), p = this.current;
    if (!p || !t.length) return false;
    const b = selectionBounds(p.doc, t.map((id) => findNode(p.doc, id) as VNode), this.view.previewBounds);
    if (isEmptyRect(b)) return false;
    const sx = r.w !== undefined && b.w > 1e-9 ? r.w / b.w : 1, sy = r.h !== undefined && b.h > 1e-9 ? r.h / b.h : 1;
    let m = scaleAbout(sx, sy, b.x, b.y);
    m = mul(translate((r.x ?? b.x) - b.x, (r.y ?? b.y) - b.y), m);
    return this.transform(m, { ids: t, name: 'Transform' });
  }

  lockSelection(): void { const t = this.targetIds(); if (t.length) this.edit('Lock', (d) => ({ doc: setProps(d, t, { locked: true }), select: [] })); }
  unlockAll(): void { const p = this.current; if (!p) return; const ids = allNodes(p.doc).filter((n) => n.locked && n.kind !== 'layer').map((n) => n.id); if (ids.length) this.edit('Unlock All', (d) => ({ doc: setProps(d, ids, { locked: false }), select: ids })); }
  hideSelection(): void { const t = this.targetIds(); if (t.length) this.edit('Hide', (d) => ({ doc: setProps(d, t, { hidden: true }), select: [] })); }
  showAll(): void { const p = this.current; if (!p) return; const ids = allNodes(p.doc).filter((n) => n.hidden && n.kind !== 'layer').map((n) => n.id); if (ids.length) this.edit('Show All', (d) => ({ doc: setProps(d, ids, { hidden: false }), select: ids })); }

  addLayer(name?: string, opts: { above?: string; sublayerOf?: string } = {}): string {
    const p = this.current; if (!p) return '';
    const l = makeLayer(name ?? `Layer ${allNodes(p.doc).filter((n) => n.kind === 'layer').length + 1}`, p.doc.layers.length);
    this.edit('New Layer', (d) => {
      if (opts.sublayerOf) { const lp = pathOf(d, opts.sublayerOf); if (lp) { const parent = nodeAt(d, lp) as VNode; return insertInto(d, lp, (childrenOf(parent) ?? []).length, [l]); } }
      if (opts.above) { const ap = pathOf(d, opts.above); if (ap) return insertInto(d, ap.slice(0, -1), ap[ap.length - 1] + 1, [l]); }
      return { ...d, layers: [...d.layers, l] };
    });
    p.activeLayer = l.id;
    this.emit('selection', null);
    return l.id;
  }
  setLayer(id: string, patch: Partial<{ name: string; hidden: boolean; locked: boolean; printable: boolean; template: boolean; color: string; opacity: number }>): void {
    this.edit('Layer Options', (d) => updateNodes(d, [id], (n) => (n.kind === 'layer' ? { ...n, ...patch } : { ...n, ...patch }) as VNode));
  }
  deleteLayer(id: string): void {
    const p = this.current; if (!p) return;
    if (p.doc.layers.length <= 1 && p.doc.layers[0]?.id === id) { this.edit('Delete Layer', (d) => ({ doc: { ...d, layers: [{ ...d.layers[0], children: [] }] }, select: [] })); return; }
    this.edit('Delete Layer', (d) => ({ doc: removeNodes(d, [id]), select: [] }));
  }
  moveToLayer(layerId: string, ids?: string[]): boolean { return this.run('Send to Layer', (d, t) => moveToParent(d, t, layerId), ids); }
  moveRelative(ids: string[], targetId: string, where: 'above' | 'below' | 'inside'): boolean { return this.edit('Move', (d) => { const r = moveRelative(d, ids, targetId, where); return { doc: r.doc, select: r.ids.filter((id) => findNode(r.doc, id)?.kind !== 'layer') }; }); }
  collectInNewLayer(ids?: string[]): void {
    const p = this.current; if (!p) return;
    const t = this.targetIds(ids);
    if (!t.length) return;
    const l = makeLayer(`Layer ${p.doc.layers.length + 1}`, p.doc.layers.length);
    this.edit('Collect in New Layer', (d) => { const withL = { ...d, layers: [...d.layers, l] }; const r = moveToParent(withL, t, l.id); return { doc: r.doc, select: r.ids }; });
  }
  isolate(id: string | null): void {
    const p = this.current; if (!p) return;
    if (p.patternEdit) { if (id === null) this.exitPatternEdit(true); return; }
    const n = id ? findNode(p.doc, id) : null;
    p.isolation = n && (isContainer(n) && n.kind !== 'layer' && n.kind !== 'compound') ? id : null;
    p.selection.clear();
    this.emit('selection', null); this.emit('render', null); this.emit('overlay', null); this.emit('options', null);
  }

  addArtboard(r: Rect, name?: string): void {
    const p = this.current; if (!p) return;
    const a: Artboard = { id: newId('a'), name: name ?? `Artboard ${p.doc.artboards.length + 1}`, x: r.x, y: r.y, w: Math.max(1, r.w), h: Math.max(1, r.h), bg: null };
    this.edit('New Artboard', (d) => ({ ...d, artboards: [...d.artboards, a] }));
    p.activeArtboard = p.doc.artboards.length - 1;
  }
  setArtboard(i: number, patch: Partial<Artboard>): void { this.edit('Artboard Options', (d) => ({ ...d, artboards: d.artboards.map((a, k) => (k === i ? { ...a, ...patch, w: Math.max(1, patch.w ?? a.w), h: Math.max(1, patch.h ?? a.h) } : a)) })); }
  deleteArtboard(i: number): void { const p = this.current; if (!p || p.doc.artboards.length < 2) return; this.edit('Delete Artboard', (d) => ({ ...d, artboards: d.artboards.filter((_, k) => k !== i) })); p.activeArtboard = Math.min(p.activeArtboard, p.doc.artboards.length - 1); }
  setActiveArtboard(i: number): void { const p = this.current; if (!p || i < 0 || i >= p.doc.artboards.length) return; p.activeArtboard = i; this.emit('options', null); this.emit('render', null); }
  fitArtboard(i: number, to: 'art' | 'selection'): void {
    const p = this.current; if (!p) return;
    let b: Rect | null = null;
    if (to === 'selection') b = this.selectionBounds(true);
    else { const all = p.doc.layers.reduce((r, l) => unionRect(r, visualBounds(p.doc, l)), emptyRect()); b = isEmptyRect(all) ? null : all; }
    if (b) this.setArtboard(i, { x: b.x, y: b.y, w: b.w, h: b.h });
  }
  rearrangeArtboards(columns: number, spacing: number): void {
    this.edit('Rearrange Artboards', (d) => {
      let x = 0, y = 0, rowH = 0;
      const moves: Array<{ dx: number; dy: number; a: Artboard }> = [];
      const boards = d.artboards.map((a, i) => { if (i % columns === 0 && i) { x = 0; y += rowH + spacing; rowH = 0; } const nb = { ...a, x, y }; moves.push({ dx: x - a.x, dy: y - a.y, a }); x += a.w + spacing; rowH = Math.max(rowH, a.h); return nb; });
      let out: Doc = { ...d, artboards: boards };
      for (const m of moves) {
        if (!m.dx && !m.dy) continue;
        const inside = allNodes(d).filter((n) => n.kind !== 'layer' && ancestors(d, n.id).every((a) => a.kind === 'layer')).filter((n) => { const b = geomBounds(d, n); const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 }; return c.x >= m.a.x && c.x <= m.a.x + m.a.w && c.y >= m.a.y && c.y <= m.a.y + m.a.h; });
        out = updateNodes(out, inside.map((n) => n.id), (n) => transformNode(n, translate(m.dx, m.dy)));
      }
      return out;
    });
  }

  addGuide(vertical: boolean, pos: number): void { this.edit('Add Guide', (d) => ({ ...d, guides: [...d.guides, { id: newId('u'), vertical, pos }] })); }
  moveGuide(id: string, pos: number): void { this.edit('Move Guide', (d) => ({ ...d, guides: d.guides.map((g) => (g.id === id ? { ...g, pos } : g)) })); }
  removeGuide(id: string): void { this.edit('Delete Guide', (d) => ({ ...d, guides: d.guides.filter((g) => g.id !== id) })); }
  clearGuides(): void { this.edit('Clear Guides', (d) => ({ ...d, guides: [] })); }
  makeGuides(ids?: string[]): void { const t = this.targetIds(ids); this.edit('Make Guides', (d) => updateNodes(d, t, (n) => (n.kind === 'path' ? { ...n, guide: true } : n))); }
  releaseGuides(): void { const p = this.current; if (!p) return; const ids = allNodes(p.doc).filter((n) => n.kind === 'path' && n.guide).map((n) => n.id); this.edit('Release Guides', (d) => ({ doc: updateNodes(d, ids, (n) => (n.kind === 'path' ? { ...n, guide: false } : n)), select: ids })); }

  addText(text: string, x: number, y: number, opts: { mode?: 'point' | 'area' | 'path'; width?: number; height?: number; path?: PathData; framePath?: PathData; style?: Partial<CharStyle>; para?: Partial<ParaStyle>; name?: string; layer?: string } = {}): string {
    const fillPaint = this.fillPaint.type === 'none' ? solid(BLACK) : this.fillPaint;
    const style: CharStyle = { ...DEFAULT_CHAR, fill: fillPaint, stroke: NONE, ...(opts.style ?? {}) };
    const mode = opts.mode ?? 'point';
    const node: TextNode = { id: newId('t'), kind: 'text', mode, spans: [{ text, style }], para: { ...DEFAULT_PARA, ...(opts.para ?? {}) }, xf: [1, 0, 0, 1, mode === 'area' ? 0 : x, mode === 'area' ? 0 : y], opacity: 1, blend: 'normal', ap: emptyAppearance(), ...(opts.name ? { name: opts.name } : {}) };
    if (mode === 'area') { node.frame = { x, y, w: opts.width ?? 200, h: opts.height ?? 100 }; node.area = { columns: 1, rows: 1, gutter: 12, inset: 0, firstBaseline: 'ascent' }; if (opts.framePath?.some((sp) => sp.closed)) node.framePath = opts.framePath; }
    if (mode === 'path') { node.path = opts.path; node.pathStart = 0; node.xf = [1, 0, 0, 1, 0, 0]; }
    return this.addNodes('Type', [node], { layer: opts.layer })[0] ?? '';
  }
  setTextSpans(id: string, spans: TextNode['spans'], name = 'Typing', merge = false): boolean { return this.edit(name, (d) => updateNodes(d, [id], (n) => (n.kind === 'text' ? { ...n, spans } : n)), { keepAnchors: true, merge }); }
  setCharStyle(patch: Partial<CharStyle>, ids?: string[], range?: [number, number]): boolean {
    return this.applyToSelection('Character', (n) => (n.kind === 'text' ? { ...n, spans: range ? styleSpans(n.spans, range[0], range[1], patch) : n.spans.map((s) => ({ ...s, style: { ...s.style, ...patch } })) } : n), ids);
  }
  setParaStyle(patch: Partial<ParaStyle>, ids?: string[]): boolean { return this.applyToSelection('Paragraph', (n) => (n.kind === 'text' ? { ...n, para: { ...n.para, ...patch } } : n), ids); }
  setTextNode(id: string, patch: Partial<TextNode>, name = 'Type Options'): boolean { return this.edit(name, (d) => updateNodes(d, [id], (n) => (n.kind === 'text' ? ({ ...n, ...patch } as TextNode) : n))); }
  textOf(id: string): string { const n = this.doc ? findNode(this.doc, id) : null; return n?.kind === 'text' ? plainText(n) : ''; }
  threadText(ids?: string[]): boolean {
    const p = this.current; if (!p) return false;
    const t = this.targetIds(ids).map((id) => findNode(p.doc, id)).filter((n): n is VNode => !!n);
    const ok = t.filter((n) => (n.kind === 'text' && n.mode === 'area') || ((n.kind === 'path' || n.kind === 'compound') && (nodePath(n) ?? []).some((sp) => sp.closed)));
    const head = ok.find((n): n is TextNode => n.kind === 'text');
    if (ok.length < 2 || !head) { this.notice('Select area type and at least one more area type object or closed path to thread into.'); return false; }
    return this.edit('Threaded Text', (d) => {
      const chains = threadChains(d), order: string[] = [];
      for (const n of ok) { if (order.includes(n.id)) continue; const c = chains.find((ch) => ch.some((x) => x.id === n.id)); if (c) order.push(...c.map((x) => x.id).filter((id) => !order.includes(id))); else order.push(n.id); }
      const st = head.spans[0]?.style ?? DEFAULT_CHAR;
      return updateNodes(d, order, (n) => {
        const next = order[order.indexOf(n.id) + 1];
        if (n.kind === 'text') return { ...n, next };
        const d0 = nodePath(n) ?? [], b = geomBounds(d, n);
        const frame: TextNode = { id: n.id, kind: 'text', mode: 'area', spans: [{ text: '', style: st }], para: head.para, xf: [1, 0, 0, 1, 0, 0], frame: b, framePath: d0, area: head.area ?? { columns: 1, rows: 1, gutter: 12, inset: 0, firstBaseline: 'ascent' }, opacity: 1, blend: 'normal', ap: emptyAppearance(), next, ...(n.name ? { name: n.name } : {}) };
        return frame;
      });
    });
  }
  releaseThread(ids?: string[], all = false): boolean {
    const p = this.current; if (!p) return false;
    const t = new Set(this.targetIds(ids));
    const hit = threadChains(p.doc).filter((c) => c.some((x) => t.has(x.id)));
    if (!hit.length) { this.notice('Select threaded type first.'); return false; }
    if (all) return this.edit('Remove Threading', (d) => updateNodes(d, hit.flat().map((x) => x.id), (n) => (n.kind === 'text' ? { ...n, next: undefined } : n)));
    return this.edit('Release Threaded Text', (d) => detachFrames(d, t));
  }
  private styleSource(): TextNode | null { return this.selected().find((n): n is TextNode => n.kind === 'text') ?? null; }
  addTextStyle(kind: TextStyleKind, name: string): string {
    let id = '';
    const from = this.styleSource();
    this.edit(kind === 'char' ? 'New Character Style' : 'New Paragraph Style', (d) => { const r = addTextStyle(d, kind, name, from); id = r.id; return r.doc; });
    return id;
  }
  applyTextStyle(kind: TextStyleKind, id: string | null, ids?: string[], range?: [number, number]): boolean {
    const p = this.current; if (!p) return false;
    const t = this.targetIds(ids).filter((x) => findNode(p.doc, x)?.kind === 'text');
    if (!t.length) return false;
    return this.edit(kind === 'char' ? 'Character Style' : 'Paragraph Style', (d) => (kind === 'char' ? applyCharStyle(d, t, id, range) : applyParaStyle(d, t, id)), { keepAnchors: true });
  }
  redefineTextStyle(kind: TextStyleKind, id: string, range?: [number, number]): boolean {
    const from = this.styleSource();
    if (!from) { this.notice('Select type with the attributes the style should take.'); return false; }
    return this.edit('Redefine Style', (d) => redefineTextStyle(d, kind, id, from, range));
  }
  fontsUsed(): FontUse[] { const d = this.doc; return d ? fontsUsed(d) : []; }
  replaceFont(from: { font: string; style?: string }, to: { font: string; style: string }, ids?: string[]): number {
    let count = 0;
    this.edit('Replace Font', (d) => { const r = replaceFont(d, from, to, ids); count = r.count; return r.doc; });
    return count;
  }
  deleteTextStyle(kind: TextStyleKind, id: string): boolean { return this.edit('Delete Style', (d) => deleteTextStyle(d, kind, id)); }
  renameTextStyle(kind: TextStyleKind, id: string, name: string): boolean { return this.edit('Style Options', (d) => renameTextStyle(d, kind, id, name)); }
  setTextWrap(wrap: TextWrap | null, ids?: string[]): boolean { return this.applyToSelection(wrap ? 'Text Wrap' : 'Release Text Wrap', (n) => (n.kind === 'layer' ? n : ({ ...n, wrap: wrap ?? undefined }) as VNode), ids); }
  async createOutlines(provider: (n: TextNode) => Promise<PathData | null>, ids?: string[]): Promise<boolean> {
    const p = this.current; if (!p) return false;
    const texts = this.targetIds(ids).map((id) => findNode(p.doc, id)).filter((n): n is TextNode => n?.kind === 'text');
    if (!texts.length) return false;
    const made = new Map<string, VNode>();
    for (const t of texts) {
      const d = await provider(t);
      if (!d || !d.length) { this.notice(`The outlines of “${plainText(t).slice(0, 30)}” need its font, ${t.spans[0]?.style.font}, which formpth could not load.`, 'error'); continue; }
      const st = t.spans[0]?.style ?? DEFAULT_CHAR;
      const items = [...(st.fill.type !== 'none' ? [fill(st.fill)] : []), ...(st.stroke.type !== 'none' ? [stroke(st.stroke, st.strokeWidth)] : []), ...t.ap.items];
      made.set(t.id, { id: newId('c'), kind: 'compound', rule: 'nonzero', children: d.map((sp) => ({ id: newId(), kind: 'path', d: [sp], rule: 'nonzero', opacity: 1, blend: 'normal', ap: emptyAppearance() })), opacity: t.opacity, blend: t.blend, ap: { items, effects: t.ap.effects }, name: t.name });
    }
    if (!made.size) return false;
    return this.edit('Create Outlines', (d) => ({ doc: updateNodes(d, [...made.keys()], (n) => made.get(n.id) ?? n), select: [...made.values()].map((n) => n.id) }));
  }

  addSwatch(name: string, paint: Paint, global = false, spot = false, group?: string): string {
    const id = newId('s');
    this.edit('New Swatch', (d) => ({ ...d, swatches: [...d.swatches, { id, name, paint, global, spot, ...(group ? { group } : {}) }] }));
    return id;
  }
  editSwatch(id: string, patch: Partial<{ name: string; paint: Paint; global: boolean; spot: boolean }>): void {
    this.edit('Swatch Options', (d) => {
      const sw = d.swatches.find((s) => s.id === id);
      let out: Doc = { ...d, swatches: d.swatches.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
      if (sw && sw.global && patch.paint && patch.paint.type === 'color' && sw.paint.type === 'color') {
        const ids = allNodes(out).filter((n) => n.ap.items.some((i) => i.paint.type === 'color' && i.paint.swatch === id)).map((n) => n.id);
        const newColor = patch.paint.color;
        out = updateNodes(out, ids, (n) => ({ ...n, ap: { ...n.ap, items: n.ap.items.map((i) => (i.paint.type === 'color' && i.paint.swatch === id ? { ...i, paint: { ...i.paint, color: newColor } } : i)) } }) as VNode);
      }
      return out;
    });
  }
  deleteSwatch(id: string): void { this.edit('Delete Swatch', (d) => ({ ...d, swatches: d.swatches.filter((s) => s.id !== id) })); }
  addUsedColors(): void {
    const p = this.current; if (!p) return;
    const found: Paint[] = [];
    for (const n of allNodes(p.doc)) for (const i of n.ap.items) { const pp = i.paint; if (pp.type === 'color' && !found.some((f) => f.type === 'color' && sameColor(f.color, pp.color)) && !p.doc.swatches.some((s) => s.paint.type === 'color' && sameColor(s.paint.color, pp.color))) found.push(pp); }
    if (!found.length) return;
    this.edit('Add Used Colors', (d) => ({ ...d, swatches: [...d.swatches, ...found.map((f) => ({ id: newId('s'), name: f.type === 'color' ? hex(f.color) : 'Color', paint: { ...f, swatch: undefined } as Paint, global: false, spot: false }))] }));
  }

  addGraphicStyle(name: string, fromId?: string): string {
    const p = this.current; if (!p) return '';
    const n = fromId ? findNode(p.doc, fromId) : this.selected()[0];
    if (!n) return '';
    const id = newId('g');
    this.edit('New Graphic Style', (d) => ({ ...d, styles: [...d.styles, { id, name, ap: n.ap, opacity: n.opacity, blend: n.blend }] }));
    return id;
  }
  applyGraphicStyle(id: string, ids?: string[]): void {
    const st = this.doc?.styles.find((s) => s.id === id || s.name === id);
    if (!st) return;
    this.currentStyle = st.id;
    this.applyToSelection('Graphic Style', (n) => (n.kind === 'text' ? { ...n, ap: st.ap, style: st.id } : { ...n, ap: st.ap, opacity: st.opacity, blend: st.blend, style: st.id }), ids);
  }

  makeSymbol(name: string, ids?: string[]): string {
    const p = this.current; if (!p) return '';
    const t = this.targetIds(ids);
    const nodes = t.map((id) => findNode(p.doc, id) as VNode).filter(Boolean);
    if (!nodes.length) return '';
    const b = selectionBounds(p.doc, nodes);
    const reg = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const art: VNode = nodes.length === 1 ? transformNode(cloneNode(nodes[0]), translate(-reg.x, -reg.y)) : { id: newId('g'), kind: 'group', clip: false, opacity: 1, blend: 'normal', ap: emptyAppearance(), children: nodes.map((n) => transformNode(cloneNode(n), translate(-reg.x, -reg.y))) };
    const sid = newId('y');
    const inst = { id: newId('i'), kind: 'symbol' as const, symbol: sid, xf: [1, 0, 0, 1, reg.x, reg.y] as Mat, opacity: 1, blend: 'normal' as BlendMode, ap: emptyAppearance() };
    this.edit('New Symbol', (d) => {
      const withSym = { ...d, symbols: [...d.symbols, { id: sid, name, art, reg: { x: 0, y: 0 } }] };
      const last = t[t.length - 1];
      const lp = pathOf(withSym, last) as IndexPath;
      let out = removeNodes(withSym, t.filter((x) => x !== last));
      out = updateNodes(out, [last], () => inst);
      void lp;
      return { doc: out, select: [inst.id] };
    });
    this.currentSymbol = sid;
    return sid;
  }
  placeSymbol(symbolId: string, at: Pt, scale = 1): string {
    const sym = this.doc?.symbols.find((s) => s.id === symbolId || s.name === symbolId);
    if (!sym) return '';
    return this.addNodes('Place Symbol Instance', [{ id: newId('i'), kind: 'symbol', symbol: sym.id, xf: [scale, 0, 0, scale, at.x, at.y], opacity: 1, blend: 'normal', ap: emptyAppearance() }])[0] ?? '';
  }
  symbolism(args: SymbolismArgs, ids?: string[]): number {
    const t = this.targetIds(ids);
    let touched = 0;
    this.edit(SYMBOLISM_NAMES[args.op], (d) => { const r = applySymbolism(d, t, args); touched = r.touched; return r.doc; });
    return touched;
  }
  traceTargets(ids?: string[]): string[] { const d = this.doc; return d ? this.targetIds(ids).filter((id) => { const n = findNode(d, id); return n?.kind === 'group' && !!n.trace; }) : []; }
  setTraceView(view: TraceView, ids?: string[]): boolean {
    const t = this.traceTargets(ids);
    return t.length > 0 && this.applyToSelection('Image Trace View', (n) => (n.kind === 'group' && n.trace ? { ...n, trace: { ...n.trace, view } } : n), t);
  }
  expandTrace(ids?: string[]): boolean {
    const t = this.traceTargets(ids);
    if (!t.length) return false;
    return this.applyToSelection('Expand Image Trace', (n) => (n.kind === 'group' && n.trace ? { ...n, trace: undefined, name: n.name === 'Image Tracing' ? 'Image Trace' : n.name } : n), t);
  }
  releaseTrace(ids?: string[]): boolean {
    const t = this.traceTargets(ids);
    if (!t.length) return false;
    return this.edit('Release Image Trace', (d) => {
      const out: string[] = [];
      let doc = d;
      for (const id of t) {
        const n = findNode(doc, id);
        if (n?.kind !== 'group' || !n.trace) continue;
        const src = findNode(doc, n.trace.src.id) ? { ...n.trace.src, id: newId('i') } : n.trace.src;
        out.push(src.id);
        doc = updateNodes(doc, [id], () => src);
      }
      return { doc, select: out };
    });
  }
  livePaintTargets(ids?: string[]): string[] { const d = this.doc; return d ? this.targetIds(ids).filter((id) => { const n = findNode(d, id); return n?.kind === 'group' && !!n.livePaint; }) : []; }
  makeLivePaint(ids?: string[]): string | null {
    const p = this.current; if (!p) return null;
    const nodes = topObjects(p.doc, this.targetIds(ids)).map((id) => findNode(p.doc, id)).filter((n): n is VNode => !!n && n.kind !== 'layer');
    const host = nodes.find((n): n is GroupNode => n.kind === 'group' && !!n.livePaint) ?? null;
    const adds = nodes.filter((n) => n !== host && (n.kind === 'path' || n.kind === 'compound' || n.kind === 'group') && edgePaths([n]).length > 0);
    if (!adds.length) { if (!host) this.notice('Select paths to make a Live Paint group.'); return host?.id ?? null; }
    const strip = (n: VNode): VNode => { const base = { ...n, ap: { ...n.ap, items: n.ap.items.filter((i) => i.kind !== 'fill') } } as VNode; const ch = base.kind === 'compound' ? null : childrenOf(base); return ch ? ({ ...base, children: ch.map(strip) } as VNode) : base; };
    const fillAt = (at: Pt): Paint | null => {
      let out: Paint | null = null;
      const walk = (n: VNode): void => {
        if (n.hidden) return;
        const f = n.ap.items.find((i) => i.kind === 'fill' && i.visible)?.paint;
        const d = n.kind === 'path' ? n.d : n.kind === 'compound' ? n.children.flatMap((c) => c.d) : null;
        if (d && f && f.type !== 'none' && insideFill(d, at, n.kind === 'path' || n.kind === 'compound' ? n.rule : 'nonzero')) out = f;
        if (n.kind !== 'compound') childrenOf(n)?.forEach(walk);
      };
      adds.forEach(walk);
      return out;
    };
    const lp = host?.livePaint ?? { fills: [], gap: 0 };
    const g: GroupNode = { id: host?.id ?? newId('g'), kind: 'group', clip: false, name: host?.name ?? 'Live Paint', children: [...(host?.children ?? []), ...adds.map(strip)], opacity: host?.opacity ?? 1, blend: host?.blend ?? 'normal', ap: host?.ap ?? emptyAppearance(), livePaint: lp };
    const fills = [...lp.fills];
    for (const f of liveFaces(g)) {
      if (lp.fills.some((s) => faceContains(f, s.at))) continue;
      const at = interiorOf(f);
      const paint = fillAt(at);
      if (paint) fills.push({ at, paint });
    }
    const made: GroupNode = { ...g, livePaint: { ...lp, fills } };
    const order = inDocOrder(p.doc, nodes.map((n) => n.id)), last = order[order.length - 1];
    this.edit(host ? 'Merge Live Paint' : 'Make Live Paint', (d) => ({ doc: updateNodes(removeNodes(d, order.filter((id) => id !== last)), [last], () => made), select: [made.id] }));
    return made.id;
  }
  livePaintFill(groupId: string, at: Pt | Pt[], paint: Paint): boolean {
    const n = this.doc ? findNode(this.doc, groupId) : null;
    if (n?.kind !== 'group' || !n.livePaint) return false;
    const faces = liveFaces(n), pts = Array.isArray(at) ? at : [at];
    const hits = pts.map((q) => ({ q, f: faces.find((f) => faceContains(f, q)) })).filter((x): x is { q: Pt; f: LiveFace } => !!x.f);
    if (!hits.length) { this.notice('Click inside an area closed by the Live Paint paths, or widen Gap Options.'); return false; }
    const fills = [...n.livePaint.fills.filter((s) => !hits.some((h) => faceContains(h.f, s.at))), ...hits.map((h) => ({ at: h.q, paint }))];
    return this.edit('Live Paint', (d) => updateNodes(d, [groupId], (x) => (x.kind === 'group' && x.livePaint ? { ...x, livePaint: { ...x.livePaint, fills } } : x)));
  }
  private edgePieces(groupId: string, at: Pt, tol: number): { c: PathNode; sub: number; pieces: SubPath[]; near: number } | null {
    const n = this.doc ? findNode(this.doc, groupId) : null;
    if (n?.kind !== 'group' || !n.livePaint) return null;
    const leaves: PathNode[] = [];
    walk(n.children, (c) => { if (c.kind === 'path' && !c.guide) leaves.push(c); });
    let best: { c: PathNode; sub: number; d: number } | null = null;
    for (const c of leaves) { const r = nearestOnPath(c.d, at); if (r && r.d <= tol && (!best || r.d < best.d)) best = { c, sub: r.sub, d: r.d }; }
    if (!best) return null;
    const { c, sub } = best, sp = c.d[sub];
    const offsets: number[] = [];
    for (const o of leaves) o.d.forEach((other, k) => { if (o.id === c.id && k === sub) return; try { for (const x of intersections(sp, other)) offsets.push(x.offsetA); } catch { } });
    let pieces: SubPath[] = [sp];
    try { if (offsets.length) pieces = splitAtOffsets(sp, offsets); } catch { pieces = [sp]; }
    if (!pieces.length) pieces = [sp];
    const near = pieces.reduce((bi, p, i) => ((nearestOnPath([p], at)?.d ?? Infinity) < (nearestOnPath([pieces[bi]], at)?.d ?? Infinity) ? i : bi), 0);
    return { c, sub, pieces, near };
  }
  livePaintEdgePiece(groupId: string, at: Pt, tol: number): SubPath | null { const r = this.edgePieces(groupId, at, tol); return r ? r.pieces[r.near] : null; }
  livePaintEdge(groupId: string, at: Pt, patch: Partial<StrokeItem>, tol: number): boolean {
    const found = this.edgePieces(groupId, at, tol);
    if (!found) return false;
    const { c, sub, pieces, near } = found;
    const styled = (ap: Appearance): Appearance => (ap.items.some((i) => i.kind === 'stroke') ? withFirstStroke(ap, patch) : { ...ap, items: [...ap.items, { ...stroke(patch.paint ?? this.strokePaint, this.strokeWidth || 1), ...patch }] });
    const rest = c.d.filter((_, k) => k !== sub);
    const made: VNode[] = pieces.map((p, i) => ({ ...c, id: i === 0 && !rest.length ? c.id : newId('p'), live: undefined, d: [p], ap: i === near ? styled(c.ap) : c.ap }));
    if (rest.length) made.unshift({ ...c, live: undefined, d: rest });
    return this.edit('Live Paint Edge', (d) => updateNodes(d, [c.id], () => made));
  }
  livePaintSelection: { group: string; faces: Pt[]; edges: Pt[] } | null = null;
  private livePaintSelected(): { group: string; faces: Pt[]; edges: Pt[] } | null {
    const s = this.livePaintSelection, n = s && this.doc ? findNode(this.doc, s.group) : null;
    return s && this.tool === 'livePaintSelect' && n?.kind === 'group' && n.livePaint && (s.faces.length || s.edges.length) ? s : null;
  }
  private livePaintEdges(s: { group: string; edges: Pt[] }, patch: Partial<StrokeItem>): void {
    this.beginStep();
    for (const q of s.edges) this.livePaintEdge(s.group, q, patch, 1);
    this.endStep();
  }
  setLivePaintGap(gap: number, ids?: string[]): boolean {
    const t = this.livePaintTargets(ids);
    return t.length > 0 && this.applyToSelection('Gap Options', (n) => (n.kind === 'group' && n.livePaint ? { ...n, livePaint: { ...n.livePaint, gap: Math.max(0, gap) } } : n), t);
  }
  private expandedLivePaint(n: GroupNode): GroupNode {
    const faces = liveFaceNodes(n).map((f) => ({ ...f, id: newId('p') }));
    const edges = n.children.map((c) => cloneNode(c)).filter((c) => c.ap.items.some((i) => i.kind === 'stroke' && i.paint.type !== 'none') || childrenOf(c));
    return { ...n, livePaint: undefined, children: [...(faces.length ? [{ id: newId('g'), kind: 'group', clip: false, name: 'Fills', children: faces, opacity: 1, blend: 'normal', ap: emptyAppearance() } as GroupNode] : []), ...(edges.length ? [{ id: newId('g'), kind: 'group', clip: false, name: 'Strokes', children: edges, opacity: 1, blend: 'normal', ap: emptyAppearance() } as GroupNode] : [])] };
  }
  expandLivePaint(ids?: string[]): boolean {
    const t = this.livePaintTargets(ids);
    return t.length > 0 && this.applyToSelection('Expand Live Paint', (n) => (n.kind === 'group' && n.livePaint ? this.expandedLivePaint(n) : n), t);
  }
  releaseLivePaint(ids?: string[]): boolean {
    const t = this.livePaintTargets(ids);
    return t.length > 0 && this.applyToSelection('Release Live Paint', (n) => (n.kind === 'group' && n.livePaint ? { ...n, livePaint: undefined, name: undefined } : n), t);
  }
  breakSymbolLink(ids?: string[]): void {
    const p = this.current; if (!p) return;
    this.run('Break Link to Symbol', (d, t) => {
      const ids2: string[] = [];
      const out = updateNodes(d, t, (n) => {
        if (n.kind !== 'symbol') return n;
        const baked = bakedInstance(d, n);
        if (!baked) return n;
        const art = transformNode(cloneNode(baked), n.xf);
        ids2.push(art.id);
        return art;
      });
      return { doc: out, ids: ids2 };
    }, ids);
  }

  makeBlend(steps?: number, spacing: 'smooth' | 'steps' | 'distance' = 'steps', distance = 10, ids?: string[]): boolean {
    const t = this.targetIds(ids);
    if (t.length < 2) { this.notice('Select two or more objects to blend.'); return false; }
    return this.edit('Make Blend', (d) => {
      const nodes = t.map((id) => findNode(d, id) as VNode);
      const blend: VNode = { id: newId('b'), kind: 'blend', children: nodes, spec: { spacing, steps: steps ?? this.options.blendSteps, distance, alignToPath: false, spine: null }, opacity: 1, blend: 'normal', ap: emptyAppearance() };
      const last = t[t.length - 1];
      let out = removeNodes(d, t.filter((x) => x !== last));
      out = updateNodes(out, [last], () => blend);
      return { doc: out, select: [blend.id] };
    });
  }
  setBlendSpec(patch: Partial<import('./types').BlendSpec>, ids?: string[]): boolean { return this.applyToSelection('Blend Options', (n) => (n.kind === 'blend' ? { ...n, spec: { ...n.spec, ...patch } } : n), ids); }
  releaseLive(ids?: string[]): boolean {
    return this.run('Release', (d, t) => {
      let out = d;
      const res: string[] = [];
      for (const id of t) {
        const n = findNode(out, id);
        if (!n || (n.kind !== 'blend' && n.kind !== 'envelope' && n.kind !== 'repeat')) { res.push(id); continue; }
        const kids = n.children;
        out = updateNodes(out, [id], () => (n.kind === 'envelope' ? [...kids, { id: newId('p'), kind: 'path', d: n.spec.kind === 'top' ? n.spec.shape : rectPath(n.frame.x, n.frame.y, n.frame.w, n.frame.h), rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items: [fill(NONE), stroke(NONE)], effects: [] } } as VNode] : kids));
        res.push(...kids.map((k) => k.id));
      }
      return { doc: out, ids: res };
    }, ids);
  }
  expand(what: 'appearance' | 'object' | 'all' = 'all', ids?: string[]): boolean {
    const p = this.current; if (!p) return false;
    return this.run('Expand', (d, t) => {
      let out = d;
      const res: string[] = [];
      for (const id of t) {
        const n = findNode(out, id);
        if (!n) continue;
        const rep = this.expandNode(out, n, what);
        out = updateNodes(out, [id], () => rep);
        res.push(...rep.map((r) => r.id));
      }
      return { doc: out, ids: res };
    }, ids);
  }
  private expandNode(doc: Doc, n: VNode, what: 'appearance' | 'object' | 'all'): VNode[] {
    const obj = what !== 'appearance', app = what !== 'object';
    if (obj && (n.kind === 'blend' || n.kind === 'envelope' || n.kind === 'repeat')) {
      const kids = liveChildren(doc, n).map((c) => ({ ...cloneNode(c) }));
      return [{ id: newId('g'), kind: 'group', clip: false, children: kids.flatMap((k) => this.expandNode(doc, k, what)), opacity: n.opacity, blend: n.blend, ap: emptyAppearance(), name: nodeLabel(n) }];
    }
    if (obj && n.kind === 'symbol') { const s = bakedInstance(doc, n); return s ? this.expandNode(doc, transformNode(cloneNode(s), n.xf), what) : [n]; }
    if (obj && n.kind === 'group' && n.trace) return this.expandNode(doc, { ...n, trace: undefined }, what);
    if (obj && n.kind === 'group' && n.livePaint) return this.expandNode(doc, this.expandedLivePaint(n), what);
    if (obj && n.kind === 'path' && n.live) return this.expandNode(doc, { ...n, live: undefined }, what);
    if (n.kind === 'group') return [{ ...n, children: n.children.flatMap((c) => this.expandNode(doc, c, what)) }];
    if (app && (n.kind === 'path' || n.kind === 'compound')) return expandAppearance(doc, n);
    return [n];
  }

  makeRepeat(kind: 'radial' | 'grid' | 'mirror', opts: { instances?: number; radius?: number; rows?: number; cols?: number; hs?: number; vs?: number; angle?: number } = {}, ids?: string[]): boolean {
    const p = this.current; if (!p) return false;
    const t = this.targetIds(ids);
    if (!t.length) return false;
    return this.edit(`Repeat ${kind}`, (d) => {
      const nodes = t.map((id) => findNode(d, id) as VNode);
      const b = selectionBounds(d, nodes);
      const spec = kind === 'radial' ? { kind, instances: opts.instances ?? 8, radius: opts.radius ?? Math.max(b.w, b.h), cx: b.x + b.w / 2, cy: b.y + b.h / 2 + (opts.radius ?? Math.max(b.w, b.h)), start: 0, end: 360, reverse: false } as const
        : kind === 'grid' ? { kind, rows: opts.rows ?? 3, cols: opts.cols ?? 3, hs: opts.hs ?? 10, vs: opts.vs ?? 10, flipRows: false, flipCols: false } as const
        : { kind, angle: opts.angle ?? 90, cx: b.x + b.w + 10, cy: b.y + b.h / 2 } as const;
      const node: VNode = { id: newId('r'), kind: 'repeat', children: nodes, spec, opacity: 1, blend: 'normal', ap: emptyAppearance() };
      const last = t[t.length - 1];
      let out = removeNodes(d, t.filter((x) => x !== last));
      out = updateNodes(out, [last], () => node);
      return { doc: out, select: [node.id] };
    });
  }
  setRepeatSpec(patch: Record<string, number | boolean>, ids?: string[]): boolean { return this.applyToSelection('Repeat Options', (n) => (n.kind === 'repeat' ? { ...n, spec: { ...n.spec, ...patch } as typeof n.spec } : n), ids); }

  makeEnvelope(spec: import('./types').EnvelopeSpec | 'top', ids?: string[]): boolean {
    const p = this.current; if (!p) return false;
    const t = this.targetIds(ids);
    if (!t.length) return false;
    return this.edit('Envelope Distort', (d) => {
      let ts = t, s = spec;
      if (spec === 'top') {
        if (t.length < 2) return d;
        const topNode = findNode(d, t[t.length - 1]) as VNode;
        const g = geometryOf(topNode);
        if (!g) return d;
        s = { kind: 'top', shape: g.d };
        ts = t.slice(0, -1);
        d = removeNodes(d, [topNode.id]);
      }
      const nodes = ts.map((id) => findNode(d, id) as VNode);
      const frame = selectionBounds(d, nodes);
      const real = s as import('./types').EnvelopeSpec;
      const finalSpec = real.kind === 'mesh' && !real.points.length ? { ...real, points: meshGridLocal(frame, real.rows, real.cols) } : real;
      const node: VNode = { id: newId('e'), kind: 'envelope', children: nodes, spec: finalSpec, frame, opacity: 1, blend: 'normal', ap: emptyAppearance() };
      const last = ts[ts.length - 1];
      let out = removeNodes(d, ts.filter((x) => x !== last));
      out = updateNodes(out, [last], () => node);
      return { doc: out, select: [node.id] };
    });
  }
  setEnvelopeSpec(spec: import('./types').EnvelopeSpec, ids?: string[]): boolean { return this.applyToSelection('Envelope Options', (n) => (n.kind === 'envelope' ? { ...n, spec } : n), ids); }

  createMesh(rows: number, cols: number, highlight: 'flat' | 'center' | 'edge' = 'flat', ids?: string[]): boolean {
    return this.run('Create Gradient Mesh', (d, t) => {
      const res: string[] = [];
      let out = d;
      for (const id of t) {
        const n = findNode(out, id);
        const g = n ? geometryOf(n) : null;
        if (!n || !g) continue;
        const f = firstFill(n.ap);
        const p0 = f ? resolvePaint(d, f.paint) : solid(WHITE);
        const color = p0.type === 'color' ? p0.color : WHITE;
        const m: VNode = { id: newId('m'), kind: 'mesh', ...buildMesh(g.d, rows, cols, color, highlight), opacity: n.opacity, blend: n.blend, ap: emptyAppearance() };
        out = updateNodes(out, [id], () => m);
        res.push(m.id);
      }
      return { doc: out, ids: res };
    }, ids);
  }

  makePattern(name: string, ids?: string[], type: 'grid' | 'brick_row' | 'brick_col' | 'hex_col' | 'hex_row' = 'grid', hs = 0, vs = 0): string {
    const p = this.current; if (!p) return '';
    const t = this.targetIds(ids);
    const nodes = t.map((id) => findNode(p.doc, id) as VNode).filter(Boolean);
    if (!nodes.length) return '';
    const b = selectionBounds(p.doc, nodes);
    const art: VNode = { id: newId('g'), kind: 'group', clip: false, children: nodes.map((n) => cloneNode(n)), opacity: 1, blend: 'normal', ap: emptyAppearance() };
    const id = newId('pt');
    this.edit('Make Pattern', (d) => ({ ...d, patterns: [...d.patterns, { id, name, tile: b, art, type, hs, vs }], swatches: [...d.swatches, { id: newId('s'), name, paint: { type: 'pattern', pattern: id, xf: [1, 0, 0, 1, 0, 0] }, global: false, spot: false }] }));
    return id;
  }

  get patternSession(): PatternSession | null { return this.current?.patternEdit ?? null; }
  patternGeometry(): PatternGeometry | null {
    const p = this.current, s = p?.patternEdit, g = s && p ? findNode(p.doc, s.group) : null;
    if (!p || !s || !g) return null;
    const b = selectionBounds(p.doc, [g]);
    return isEmptyRect(b) ? null : sessionGeometry(s, b);
  }
  enterPatternEdit(patternId?: string | null, ids?: string[]): boolean {
    const p = this.current; if (!p) return false;
    if (p.patternEdit) this.exitPatternEdit(true);
    const def = patternId ? p.doc.patterns.find((x) => x.id === patternId || x.name === patternId) ?? null : null;
    if (patternId && !def) { this.notice(`No pattern named ${patternId}.`); return false; }
    const kids = def ? artChildren(def.art).map((n) => cloneNode(n)) : this.targetIds(ids).map((id) => findNode(p.doc, id)).filter((n): n is VNode => !!n && n.kind !== 'layer').map((n) => cloneNode(n));
    if (!kids.length) { this.notice('Select the artwork for the pattern first.'); return false; }
    const g: VNode = { id: newId('g'), kind: 'group', name: 'Pattern Tile', clip: false, children: kids, opacity: 1, blend: 'normal', ap: emptyAppearance() };
    const mark = p.history.mark(), before = [...p.selection];
    const ok = this.edit(def ? 'Edit Pattern' : 'Make Pattern', (d) => { const at = this.insertionPoint(d, p, { layer: p.activeLayer }); return { doc: insertInto(d, at.parent, at.index, [g]), select: [] }; });
    if (!ok) return false;
    const b = selectionBounds(p.doc, [g]), fit = !def || (Math.abs(def.tile.w - b.w) < 0.01 && Math.abs(def.tile.h - b.h) < 0.01);
    p.patternEdit = {
      pattern: def?.id ?? null, group: g.id, name: def?.name ?? `New Pattern ${p.doc.patterns.length + 1}`, type: def?.type ?? 'grid',
      hs: fit ? def?.hs ?? 0 : 0, vs: fit ? def?.vs ?? 0 : 0, brick: def?.brick ?? 0.5, overlap: def?.overlap ?? ['left', 'top'],
      fit, w: def?.tile.w ?? b.w, h: def?.tile.h ?? b.h, copies: 3, dim: 0.7, edge: true, mark, before,
    };
    p.isolation = g.id;
    this.emit('selection', null); this.emit('render', null); this.emit('overlay', null); this.emit('options', null);
    return true;
  }
  setPatternSession(patch: Partial<Omit<PatternSession, 'pattern' | 'group' | 'mark' | 'before'>>): void {
    const p = this.current; if (!p?.patternEdit) return;
    p.patternEdit = { ...p.patternEdit, ...patch };
    this.emit('render', null); this.emit('overlay', null); this.emit('options', null);
  }
  exitPatternEdit(save: boolean, copy = false): string | null {
    const p = this.current, s = p?.patternEdit;
    if (!p || !s) return null;
    const g = findNode(p.doc, s.group), geo = this.patternGeometry();
    p.patternEdit = null;
    p.isolation = null;
    if (!save || !g || !geo || g.kind !== 'group' || !g.children.length) {
      const st = p.history.rewind(s.mark);
      if (st) this.restore(p, st.doc, s.before); else this.refresh();
      this.emit('history', null);
      return null;
    }
    const id = s.pattern && !copy ? s.pattern : newId('pt'), name = copy && s.pattern ? `${s.name} copy` : s.name;
    const def: PatternDef = { id, name, art: { ...cloneNode(g), name: undefined }, tile: geo.tile, type: geo.type, hs: geo.hs, vs: geo.vs, brick: s.brick, overlap: s.overlap };
    this.edit(s.pattern && !copy ? 'Edit Pattern' : 'Make Pattern', (d) => {
      const out = removeNodes(d, [s.group]), exists = out.patterns.some((x) => x.id === id);
      const patterns = exists ? out.patterns.map((x) => (x.id === id ? def : x)) : [...out.patterns, def];
      const swatches = exists ? out.swatches.map((w) => (w.paint.type === 'pattern' && w.paint.pattern === id ? { ...w, name } : w)) : [...out.swatches, { id: newId('s'), name, paint: { type: 'pattern' as const, pattern: id, xf: [1, 0, 0, 1, 0, 0] as Mat }, global: false, spot: false }];
      return { doc: { ...out, patterns, swatches }, select: s.before };
    });
    if (p.history.squash(s.mark)) this.emit('history', null);
    return id;
  }
  setPatternOptions(id: string, o: { name?: string; type?: PatternDef['type']; hs?: number; vs?: number; brick?: number; overlap?: PatternDef['overlap']; width?: number; height?: number }): boolean {
    const def = this.doc?.patterns.find((x) => x.id === id || x.name === id);
    if (!def) { this.notice(`No pattern named ${id}.`); return false; }
    const b = this.doc ? selectionBounds(this.doc, [def.art]) : def.tile, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const w = o.width && o.width > 0 ? o.width : def.tile.w, h = o.height && o.height > 0 ? o.height : def.tile.h;
    const tile = o.width || o.height ? { x: cx - w / 2, y: cy - h / 2, w, h } : def.tile;
    const next: PatternDef = { ...def, name: o.name ?? def.name, type: o.type ?? def.type, hs: o.hs ?? def.hs, vs: o.vs ?? def.vs, brick: o.brick ?? def.brick, overlap: o.overlap ?? def.overlap, tile };
    return this.edit('Pattern Options', (d) => ({ ...d, patterns: d.patterns.map((x) => (x.id === def.id ? next : x)), swatches: o.name ? d.swatches.map((sw) => (sw.paint.type === 'pattern' && sw.paint.pattern === def.id ? { ...sw, name: o.name as string } : sw)) : d.swatches }));
  }

  newBrush(name: string, kind: BrushKind['type'], o: Record<string, number | string | boolean> = {}, colorize: BrushDef['colorize'] = 'none', ids?: string[]): string {
    const p = this.current; if (!p) return '';
    const num = (k: string, d: number): number => (typeof o[k] === 'number' && Number.isFinite(o[k]) ? o[k] as number : d);
    let brush: BrushKind;
    if (kind === 'calligraphic') brush = { type: 'calligraphic', angle: num('angle', 0), roundness: Math.max(1, Math.min(100, num('roundness', 100))), size: Math.max(0.1, num('size', 3)) };
    else {
      const nodes = this.targetIds(ids).map((id) => findNode(p.doc, id)).filter((n): n is VNode => !!n);
      const flat = (n: VNode): VNode[] => (n.hidden ? [] : n.kind === 'group' || n.kind === 'layer' ? n.children.flatMap(flat) : expandAppearance(p.doc, n).flatMap((x) => (x.kind === 'group' ? x.children.flatMap(flat) : [x])));
      const parts = nodes.flatMap(flat).filter((n) => n.kind === 'path' || n.kind === 'compound');
      if (!parts.length) { this.notice('Select the artwork for the brush first: filled or stroked paths.'); return ''; }
      const b = selectionBounds(p.doc, parts);
      const art: VNode = { id: newId('b'), kind: 'group', clip: false, opacity: 1, blend: 'normal', ap: emptyAppearance(), children: parts.map((n) => transformNode(cloneNode(n), translate(-b.x, -b.y))) };
      brush = kind === 'scatter' ? { type: 'scatter', art, size: num('size', 100), spacing: num('spacing', 100), scatter: num('scatter', 0), rotation: num('rotation', 0), relative: o.relative === true }
        : kind === 'art' ? { type: 'art', art, stretch: o.stretch !== false, flip: o.flip === true, width: num('width', 100) }
        : { type: 'pattern', art, spacing: num('spacing', 0), fit: (['stretch', 'space', 'approximate'].includes(String(o.fit)) ? o.fit : 'stretch') as 'stretch' };
    }
    const id = newId('br');
    this.edit('New Brush', (d) => ({ ...d, brushes: [...d.brushes, { id, name: name || `Brush ${d.brushes.length + 1}`, brush, colorize }] }));
    this.currentBrush = id;
    this.emit('options', null);
    return id;
  }
  editBrush(id: string, patch: { name?: string; colorize?: BrushDef['colorize']; brush?: Partial<Record<string, number | string | boolean>> }): boolean {
    return this.edit('Brush Options', (d) => ({ ...d, brushes: d.brushes.map((b) => (b.id !== id ? b : { ...b, ...(patch.name ? { name: patch.name } : {}), ...(patch.colorize ? { colorize: patch.colorize } : {}), brush: { ...b.brush, ...(patch.brush ?? {}) } as BrushKind })) }));
  }
  deleteBrush(id: string): boolean {
    const p = this.current; if (!p) return false;
    const used = allNodes(p.doc).filter((n) => n.ap.items.some((i) => i.kind === 'stroke' && i.brush === id)).map((n) => n.id);
    if (this.currentBrush === id) this.currentBrush = null;
    return this.edit('Delete Brush', (d) => ({ ...updateNodes(d, used, (n) => ({ ...n, ap: { ...n.ap, items: n.ap.items.map((i) => (i.kind === 'stroke' && i.brush === id ? { ...i, brush: null } : i)) } }) as VNode), brushes: d.brushes.filter((b) => b.id !== id) }));
  }
  applyBrush(brush: string | null, ids?: string[]): boolean {
    const def = brush ? this.doc?.brushes.find((b) => b.id === brush || b.name === brush) : null;
    if (brush && !def) { this.notice(`There is no brush called ${brush}.`, 'error'); return false; }
    this.currentBrush = def?.id ?? null;
    return this.applyToSelection('Apply Brush', (n) => ({ ...n, ap: withFirstStroke(n.ap, { brush: def?.id ?? null, ...(def?.brush.type === 'calligraphic' ? {} : {}) }) }), ids);
  }
  setWidthProfile(name: string | null, ids?: string[]): boolean { const prof = name && name !== 'uniform' ? WIDTH_PROFILES[name] ?? null : null; return this.applyToSelection('Width Profile', (n) => ({ ...n, ap: withFirstStroke(n.ap, { profile: prof }) }), ids); }

  cut(): void { this.copy(); this.deleteSelection(); }
  copy(): void {
    const p = this.current; if (!p) return;
    const t = topObjects(p.doc, p.selection);
    if (!t.length) return;
    const nodes = t.map((id) => findNode(p.doc, id) as VNode);
    const syms = new Set<string>(), imgs = new Set<string>(), pats = new Set<string>();
    walk(nodes, (n) => { if (n.kind === 'symbol') syms.add(n.symbol); if (n.kind === 'image') imgs.add(n.src); if (n.kind === 'group' && n.trace) imgs.add(n.trace.src.src); for (const i of n.ap.items) if (i.paint.type === 'pattern') pats.add(i.paint.pattern); });
    const assets = new Map<string, Blob>();
    for (const k of imgs) { const b = p.assets.get(k); if (b) assets.set(k, b); }
    this.clipboard = {
      stamp: newId('cb'), nodes, symbols: p.doc.symbols.filter((s) => syms.has(s.id)), swatches: p.doc.swatches.filter((s) => nodes.some((n) => n.ap.items.some((i) => (i.paint.type === 'color' || i.paint.type === 'gradient') && i.paint.swatch === s.id))),
      patterns: p.doc.patterns.filter((x) => pats.has(x.id)), brushes: p.doc.brushes.filter((b) => nodes.some((n) => n.ap.items.some((i) => i.kind === 'stroke' && i.brush === b.id))),
      images: Object.fromEntries([...imgs].map((k) => [k, p.doc.images[k]]).filter(([, v]) => v)), assets, bounds: selectionBounds(p.doc, nodes),
    };
    this.emit('options', null);
  }
  paste(mode: 'center' | 'in_place' | 'front' | 'back' = 'center'): void {
    const p = this.current, c = this.clipboard;
    if (!p || !c) return;
    let nodes = c.nodes.map((n) => cloneNode(n));
    if (mode === 'center') {
      const v = p.viewport, ctr = v.toDoc(v.centerX, v.height / 2), b = c.bounds;
      nodes = nodes.map((n) => transformNode(n, translate(ctr.x - (b.x + b.w / 2), ctr.y - (b.y + b.h / 2))));
    }
    for (const [k, b] of c.assets) if (!p.assets.has(k)) p.assets.set(k, b);
    this.edit('Paste', (d) => {
      const merged: Doc = { ...d, symbols: [...d.symbols, ...c.symbols.filter((s) => !d.symbols.some((x) => x.id === s.id))], swatches: [...d.swatches, ...c.swatches.filter((s) => !d.swatches.some((x) => x.id === s.id))], patterns: [...d.patterns, ...c.patterns.filter((s) => !d.patterns.some((x) => x.id === s.id))], brushes: [...d.brushes, ...c.brushes.filter((s) => !d.brushes.some((x) => x.id === s.id))], images: { ...c.images, ...d.images } };
      const sel = topObjects(d, p.selection);
      if ((mode === 'front' || mode === 'back') && sel.length) {
        const ref = mode === 'front' ? sel[sel.length - 1] : sel[0];
        const rp = pathOf(merged, ref) as IndexPath;
        return { doc: insertInto(merged, rp.slice(0, -1), rp[rp.length - 1] + (mode === 'front' ? 1 : 0), nodes), select: nodes.map((n) => n.id) };
      }
      const at = this.insertionPoint(merged, p);
      return { doc: insertInto(merged, at.parent, mode === 'back' ? 0 : at.index, nodes), select: nodes.map((n) => n.id) };
    });
  }

  addImage(key: string, blob: Blob, w: number, h: number, at: Pt, width?: number, link?: string): string {
    const p = this.current; if (!p) return '';
    p.assets.set(key, blob);
    const s = width ? width / w : 1;
    const node: VNode = { id: newId('im'), kind: 'image', src: key, w, h, xf: [s, 0, 0, s, at.x, at.y], opacity: 1, blend: 'normal', ap: emptyAppearance(), ...(link ? { link } : {}) };
    this.edit('Place', (d) => ({ ...d, images: { ...d.images, [key]: { mime: blob.type || 'image/png', w, h } } }));
    return this.addNodes('Place', [node])[0] ?? '';
  }

  documentSetup(patch: Partial<Pick<Doc, 'units' | 'colorMode' | 'title' | 'rasterPpi'>>): void { this.edit('Document Setup', (d) => ({ ...d, ...patch })); }
  setGrid(spacing: number, subdivisions: number): void { this.edit('Grid', (d) => ({ ...d, grid: { spacing, subdivisions } })); }

  describe(depth = 8): Record<string, unknown> {
    const p = this.current;
    if (!p) return { open: false, documents: [] };
    const d = p.doc;
    const r = (v: number): number => Math.round(v * 100) / 100;
    const box = (b: Rect): Record<string, number> | null => (isEmptyRect(b) ? null : { x: r(b.x), y: r(b.y), width: r(b.w), height: r(b.h) });
    const paintDesc = (pp: Paint | undefined): string => (pp ? (pp.type === 'none' ? 'none' : pp.type === 'color' ? hex(pp.color) : pp.type === 'gradient' ? `${pp.gradient.kind} gradient` : 'pattern') : 'none');
    const node = (n: VNode, lvl: number): Record<string, unknown> => {
      const f = firstFill(n.ap), s = firstStroke(n.ap);
      const out: Record<string, unknown> = { id: n.id, kind: n.kind, name: nodeLabel(n), bounds: n.kind === 'layer' ? undefined : box(geomBounds(d, n)) };
      if (n.hidden) out.visible = false;
      if (n.locked) out.locked = true;
      if (n.opacity !== 1) out.opacity = r(n.opacity);
      if (n.blend !== 'normal') out.blend = n.blend;
      if (n.kind === 'path' || n.kind === 'compound' || n.kind === 'group' || n.kind === 'blend' || n.kind === 'repeat' || n.kind === 'envelope') {
        if (f) out.fill = paintDesc(f.paint);
        if (s) { out.stroke = paintDesc(s.paint); out.stroke_width = s.width; }
      }
      if (n.kind === 'path') { out.anchors = n.d.reduce((a, sp) => a + sp.pts.length, 0); out.closed = n.d.every((sp) => sp.closed); if (n.live) out.shape = n.live.kind; }
      if (n.kind === 'text') { out.text = plainText(n).slice(0, 400); out.mode = n.mode; const st = n.spans[0]?.style; if (st) { out.font = `${st.font} ${st.style}`; out.size = st.size; out.color = paintDesc(st.fill); } }
      if (n.kind === 'symbol') out.symbol = d.symbols.find((x) => x.id === n.symbol)?.name;
      if (n.kind === 'image') out.pixels = `${n.w}x${n.h}`;
      if (n.ap.effects.length) out.effects = n.ap.effects.map((e) => e.id);
      if (n.ap.items.length > 2) out.appearance_items = n.ap.items.length;
      if (n.kind === 'group' && n.clip) out.clipping = true;
      if (n.kind === 'group' && n.livePaint) out.live_paint = { faces: liveFaces(n).length, painted: liveFaceNodes(n).length, gap: n.livePaint.gap };
      if (n.kind === 'group' && n.trace) out.tracing = { view: n.trace.view, mode: n.trace.opts.mode, colors: n.trace.opts.colors, threshold: n.trace.opts.threshold };
      if (n.kind === 'symbol' && n.tint) out.tint = { color: hex(n.tint.color), amount: r(n.tint.amount) };
      const ch = childrenOf(n);
      if (ch && n.kind !== 'compound') out.children = lvl < depth ? [...ch].reverse().map((c) => node(c, lvl + 1)) : `${ch.length} objects`;
      return out;
    };
    return {
      name: p.name, title: d.title, units: d.units, color_mode: d.colorMode, modified: p.modified,
      artboards: d.artboards.map((a, i) => ({ index: i, name: a.name, x: r(a.x), y: r(a.y), width: r(a.w), height: r(a.h), active: i === p.activeArtboard })),
      layers: [...d.layers].reverse().map((l) => node(l, 0)),
      active_layer: p.activeLayer,
      selection: topObjects(d, p.selection),
      selection_bounds: this.selectionBounds() ? box(this.selectionBounds() as Rect) : null,
      swatches: d.swatches.map((s) => ({ name: s.name, paint: paintDesc(s.paint), global: s.global || undefined, spot: s.spot || undefined })),
      symbols: d.symbols.map((s) => s.name), graphic_styles: d.styles.map((s) => s.name), brushes: d.brushes.map((b) => b.name),
      documents: this.projects.map((x, i) => ({ index: i, name: x.name, active: x.id === p.id })),
    };
  }

  textLayout(id: string): ReturnType<typeof layoutText> | null { const n = this.doc ? findNode(this.doc, id) : null; return n?.kind === 'text' ? layoutText(n) : null; }
  nodeById(id: string): VNode | null { return this.doc ? findNode(this.doc, id) : null; }
  local(p: Pt, m: Mat): Pt { return apply(invert(m), p.x, p.y); }
  boundsOf(n: VNode): Rect { return this.doc ? (this.view.previewBounds ? visualBounds(this.doc, n) : geomBounds(this.doc, n)) : emptyRect(); }
}

function meshGridLocal(r: Rect, rows: number, cols: number): Pt[] {
  const out: Pt[] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) out.push({ x: r.x + (r.w * i) / cols, y: r.y + (r.h * j) / rows });
  return out;
}

export { pathBounds, normRect };

import { GRAPH_TYPES } from '../engine/graph';
import type { Engine, GraphSpec, GraphType, Pt } from '../engine';
import { registerTool, toolHost, type OptionSpec } from '../extensions/registry';
import { CURSORS } from '../ui/cursors';
import { dragRect, inView, measureHud, layerColor, unitLabel } from './util';

export const pendingGraph: { type: GraphType; at: Pt } = { type: 'column', at: { x: 0, y: 0 } };
const S = { on: false, start: { x: 0, y: 0 }, cur: { x: 0, y: 0 }, shift: false, alt: false };

const ICONS: Record<GraphType, string> = { column: 'vColumnGraph', stacked: 'vStackedColumnGraph', bar: 'vBarGraph', stackedBar: 'vStackedBarGraph', line: 'vLineGraph', area: 'vAreaGraph', scatter: 'vScatterGraph', pie: 'vPieGraph', radar: 'vRadarGraph' };
const IDS: Record<GraphType, string> = { column: 'columnGraph', stacked: 'stackedColumnGraph', bar: 'barGraph', stackedBar: 'stackedBarGraph', line: 'lineGraph', area: 'areaGraph', scatter: 'scatterGraph', pie: 'pieGraph', radar: 'radarGraph' };
export const graphToolId = (t: GraphType): string => IDS[t];

function setDefault(e: Engine, patch: Partial<GraphSpec>): void {
  e.update({ graph: { ...(e.options.graph ?? {}), ...patch } });
  if (e.graphTargets().length) e.setGraph(patch, undefined, 'Graph Type');
}

function options(e: Engine, label: string): OptionSpec[] {
  const g = (): Partial<GraphSpec> => { const id = e.graphTargets()[0], n = id ? e.nodeById(id) : null; return n?.kind === 'group' && n.graph ? n.graph : e.options.graph ?? {}; };
  return [
    { kind: 'title', text: label },
    { kind: 'button', label: 'Graph Data...', icon: 'vColumnGraph', run: () => toolHost.run('graph-data'), when: () => e.graphTargets().length > 0 },
    { kind: 'button', label: 'Graph Type...', run: () => toolHost.run('graph-type') },
    { kind: 'select', label: 'Legend', choices: [{ id: 'right', label: 'Right' }, { id: 'top', label: 'Top' }, { id: 'none', label: 'None' }], get: () => g().legend ?? 'right', set: (v) => setDefault(e, { legend: v as GraphSpec['legend'] }) },
    { kind: 'select', label: 'Ticks', choices: [{ id: 'none', label: 'None' }, { id: 'short', label: 'Short' }, { id: 'full', label: 'Full Width' }], get: () => g().valueTicks ?? 'short', set: (v) => setDefault(e, { valueTicks: v as GraphSpec['valueTicks'] }) },
    { kind: 'number', label: 'Label Size', min: 4, max: 72, step: 1, unit: 'pt', get: () => g().size ?? 9, set: (v) => setDefault(e, { size: Math.max(4, Math.min(72, v)) }) },
    { kind: 'toggle', label: 'Drop Shadow', get: () => !!g().shadow, set: (v) => setDefault(e, { shadow: v }) },
  ];
}

function graphTool(type: GraphType, order: number, shortcut?: string): void {
  const label = `${GRAPH_TYPES.find((t) => t[0] === type)?.[1] ?? 'Column'} Graph Tool`;
  registerTool({
    id: IDS[type], label, group: 'graph', order, shortcut,
    icon: () => ICONS[type],
    hint: () => 'Drag to set the size of the graph body (labels and legend sit outside it); Shift makes a square, Alt draws from the centre. Click for exact dimensions. The Graph Data window opens for the numbers.',
    cursor: () => CURSORS.graph,
    options: (e) => options(e, label.replace(/ Tool$/, '')),
    down: (ctx, p) => { S.on = true; S.start = ctx.snap(p.doc).p; S.cur = S.start; },
    move: (ctx, p) => { if (!S.on) return; S.cur = ctx.snap(p.doc, undefined, { from: S.start }).p; S.shift = p.shift; S.alt = p.alt; ctx.redraw(); },
    up: (ctx, p) => {
      if (!S.on) return;
      S.on = false;
      const e = ctx.engine, moved = Math.hypot(p.doc.x - S.start.x, p.doc.y - S.start.y) * ctx.view().zoom > 3;
      ctx.redraw();
      if (!moved) { pendingGraph.type = type; pendingGraph.at = S.start; toolHost.run('graph-size'); return; }
      const r = dragRect(S.start, S.cur, p.shift, p.alt);
      if (r.w < 2 || r.h < 2) return;
      if (e.addGraph(type, r)) toolHost.run('graph-data');
    },
    cancel: (ctx) => { S.on = false; ctx.redraw(); },
    overlay: (ctx, g) => {
      if (!S.on) return;
      const v = ctx.view(), r = dragRect(S.start, S.cur, S.shift, S.alt);
      inView(ctx, g, () => { g.strokeStyle = layerColor(ctx.engine); g.strokeRect(r.x, r.y, r.w, r.h); });
      measureHud(ctx, g, v.toScreen(S.cur), [`W: ${unitLabel(ctx.engine, r.w)}`, `H: ${unitLabel(ctx.engine, r.h)}`]);
    },
  });
}

graphTool('column', 76.2, 'Shift+G');
graphTool('stacked', 76.21);
graphTool('bar', 76.22);
graphTool('stackedBar', 76.23);
graphTool('line', 76.24);
graphTool('area', 76.25);
graphTool('scatter', 76.26);
graphTool('pie', 76.27);
graphTool('radar', 76.28);

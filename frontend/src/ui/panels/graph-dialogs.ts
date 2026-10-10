import { COMBINABLE, GRAPH_DEFAULTS, GRAPH_TYPES } from '../../engine/graph';
import type { Engine, GraphColumnDesign, GraphSeriesType, GraphSpec, GraphType } from '../../engine';
import { families } from '../../io/fonts';
import { Dialog, promptName } from '../dialogs';
import { el, patchList, q, setClass, setDisabled, setText } from '../dom';
import { askForm, type Field } from '../form-dialog';

const current = (e: Engine): { id: string | null; spec: Partial<GraphSpec> } => {
  const id = e.graphTargets()[0] ?? null, n = id ? e.nodeById(id) : null;
  return { id, spec: n?.kind === 'group' && n.graph ? n.graph : { ...GRAPH_DEFAULTS, ...(e.options.graph ?? {}) } };
};

export async function graphTypeDialog(e: Engine): Promise<void> {
  const { id, spec: s } = current(e), sel = e.graphSeriesSelected(), series = sel && sel.series.length ? sel.series : [];
  const horizontal = s.type === 'bar' || s.type === 'stackedBar';
  const st = series.length ? s.seriesTypes?.[series[0]] ?? '' : '';
  const fonts = [...new Set([s.font ?? 'Inter', ...families()])].map((f) => [f, f] as const);
  const fields: Field[] = [
    { kind: 'select', key: 'type', label: 'Type', value: s.type ?? 'column', choices: GRAPH_TYPES },
    ...(series.length && s.type && COMBINABLE.has(s.type) ? [{ kind: 'select', key: 'seriesType', label: `Selected series (${series.length})`, value: st, choices: [['', 'Same as the graph'], ['column', 'Column'], ['stacked', 'Stacked Column'], ['line', 'Line'], ['area', 'Area']] } as Field] : []),
    { kind: 'select', key: 'axis', label: 'Value Axis', value: s.axis ?? 'start', choices: horizontal ? [['start', 'On Bottom Side'], ['end', 'On Top Side'], ['both', 'On Both Sides']] : [['start', 'On Left Side'], ['end', 'On Right Side'], ['both', 'On Both Sides']] },
    { kind: 'check', key: 'shadow', label: 'Add Drop Shadow', value: !!s.shadow },
    { kind: 'select', key: 'legend', label: 'Legend', value: s.legend ?? 'right', choices: [['right', 'On the Right'], ['top', 'Across the Top'], ['none', 'No Legend']] },
    { kind: 'note', text: 'Value axis tick values' },
    { kind: 'check', key: 'manual', label: 'Override Calculated Values', value: s.auto === false },
    { kind: 'number', key: 'min', label: 'Min', value: s.min ?? 0 },
    { kind: 'number', key: 'max', label: 'Max', value: s.max ?? 100 },
    { kind: 'number', key: 'divisions', label: 'Divisions', value: s.divisions ?? 5, min: 1, max: 100, step: 1 },
    { kind: 'select', key: 'valueTicks', label: 'Tick Marks', value: s.valueTicks ?? 'short', choices: [['none', 'None'], ['short', 'Short'], ['full', 'Full Width']] },
    { kind: 'text', key: 'prefix', label: 'Prefix', value: s.prefix ?? '' },
    { kind: 'text', key: 'suffix', label: 'Suffix', value: s.suffix ?? '' },
    { kind: 'select', key: 'catTicks', label: 'Category Tick Marks', value: s.catTicks ?? 'short', choices: [['none', 'None'], ['short', 'Short'], ['full', 'Full Width']] },
    { kind: 'note', text: 'Columns and bars' },
    { kind: 'number', key: 'colWidth', label: 'Column Width', value: s.colWidth ?? 90, min: 1, max: 1000, unit: '%' },
    { kind: 'number', key: 'clusterWidth', label: 'Cluster Width', value: s.clusterWidth ?? 80, min: 1, max: 1000, unit: '%' },
    { kind: 'note', text: 'Line, scatter and radar' },
    { kind: 'check', key: 'mark', label: 'Mark Data Points', value: s.mark !== false },
    { kind: 'check', key: 'connect', label: 'Connect Data Points', value: s.connect !== false },
    { kind: 'check', key: 'edgeToEdge', label: 'Edge-to-Edge Lines', value: !!s.edgeToEdge },
    { kind: 'check', key: 'fillLines', label: 'Draw Filled Lines', value: !!s.fillLines },
    { kind: 'number', key: 'lineWidth', label: 'Line Width', value: s.lineWidth ?? 1, min: 0.1, max: 72, unit: 'pt' },
    { kind: 'number', key: 'markerSize', label: 'Marker Size', value: s.markerSize ?? 5, min: 1, max: 72, unit: 'pt' },
    { kind: 'note', text: 'Pie' },
    { kind: 'select', key: 'pieLegend', label: 'Legend', value: s.pieLegend ?? 'standard', choices: [['standard', 'Standard Legend'], ['wedges', 'Legends in Wedges'], ['none', 'No Legend']] },
    { kind: 'select', key: 'pieSort', label: 'Sort', value: s.pieSort ?? 'none', choices: [['none', 'None'], ['all', 'All'], ['first', 'First']] },
    { kind: 'select', key: 'piePosition', label: 'Position', value: s.piePosition ?? 'ratio', choices: [['ratio', 'Ratio'], ['even', 'Even'], ['stacked', 'Stacked']] },
    { kind: 'note', text: 'Labels' },
    { kind: 'select', key: 'font', label: 'Font', value: s.font ?? 'Inter', choices: fonts },
    { kind: 'number', key: 'size', label: 'Size', value: s.size ?? 9, min: 4, max: 72, unit: 'pt' },
  ];
  const v = await askForm(id ? 'Graph Type' : 'Graph Type (new graphs)', fields, { width: 460 });
  if (!v) return;
  const patch: Partial<GraphSpec> = {
    type: v.type as GraphType, axis: v.axis as GraphSpec['axis'], shadow: !!v.shadow, legend: v.legend as GraphSpec['legend'], auto: !v.manual,
    min: Number(v.min), max: Math.max(Number(v.max), Number(v.min) + 1e-6), divisions: Math.max(1, Math.round(Number(v.divisions))), valueTicks: v.valueTicks as GraphSpec['valueTicks'],
    prefix: String(v.prefix), suffix: String(v.suffix), catTicks: v.catTicks as GraphSpec['catTicks'], colWidth: Number(v.colWidth), clusterWidth: Number(v.clusterWidth),
    mark: !!v.mark, connect: !!v.connect, edgeToEdge: !!v.edgeToEdge, fillLines: !!v.fillLines, lineWidth: Number(v.lineWidth), markerSize: Number(v.markerSize),
    pieLegend: v.pieLegend as GraphSpec['pieLegend'], pieSort: v.pieSort as GraphSpec['pieSort'], piePosition: v.piePosition as GraphSpec['piePosition'],
  };
  const changed = (k: keyof GraphSpec): boolean => JSON.stringify(s[k]) !== JSON.stringify(patch[k]);
  const text: Partial<GraphSpec> = {};
  if (String(v.font) !== (s.font ?? 'Inter')) text.font = String(v.font);
  if (Number(v.size) !== (s.size ?? 9)) text.size = Number(v.size);
  const delta = Object.fromEntries(Object.keys(patch).filter((k) => changed(k as keyof GraphSpec)).map((k) => [k, patch[k as keyof GraphSpec]])) as Partial<GraphSpec>;
  if (!id) { e.update({ graph: { ...(e.options.graph ?? {}), ...delta, ...text } }); return; }
  e.beginStep();
  if (Object.keys(delta).length || Object.keys(text).length) e.setGraph({ ...delta, ...text }, [id]);
  if (series.length && 'seriesType' in v && String(v.seriesType) !== st) e.setGraphSeries(series, { type: v.seriesType ? (v.seriesType as GraphSeriesType) : null }, [id]);
  e.endStep();
}

export async function graphSizeDialog(e: Engine, type: GraphType, at: { x: number; y: number }): Promise<string | null> {
  const v = await askForm(`${GRAPH_TYPES.find((t) => t[0] === type)?.[1] ?? 'Column'} Graph`, [{ kind: 'number', key: 'w', label: 'Width', value: 200, min: 4, unit: 'pt' }, { kind: 'number', key: 'h', label: 'Height', value: 150, min: 4, unit: 'pt' }, { kind: 'check', key: 'center', label: 'From the center', value: false }]);
  if (!v) return null;
  const w = Number(v.w), h = Number(v.h);
  return e.addGraph(type, { x: v.center ? at.x - w / 2 : at.x, y: v.center ? at.y - h / 2 : at.y, w, h });
}

function targetSeries(e: Engine): { id: string; series: number[]; spec: GraphSpec } | null {
  const sel = e.graphSeriesSelected(), n = sel ? e.nodeById(sel.graph) : null;
  if (!sel || n?.kind !== 'group' || !n.graph) return null;
  const count = Math.max(n.graph.data.series.length, ...n.graph.data.values.map((r) => r.length));
  const all = Array.from({ length: n.graph.type === 'scatter' ? Math.floor(count / 2) : count }, (_, i) => i);
  return { id: sel.graph, series: sel.series.length ? sel.series : all, spec: n.graph };
}

export async function graphColumnDialog(e: Engine): Promise<void> {
  const t = targetSeries(e), designs = e.doc?.graphDesigns ?? [];
  if (!t) { e.notice('Select a graph, or one of its series with the Group Selection tool.'); return; }
  if (!designs.length) { e.notice('Make a design first: select some art and choose Object > Graph > Design, then New Design.'); return; }
  const cur = t.spec.columns?.[t.series[0]];
  const v = await askForm('Graph Column', [
    { kind: 'note', text: `Applies to ${t.series.length === 1 ? 'the selected series' : `${t.series.length} series`}.` },
    { kind: 'select', key: 'design', label: 'Column Design', value: cur?.design ?? '', choices: [['', 'None'], ...designs.map((d) => [d.id, d.name] as const)] },
    { kind: 'select', key: 'mode', label: 'Column Type', value: cur?.mode ?? 'vertical', choices: [['vertical', 'Vertically Scaled'], ['uniform', 'Uniformly Scaled'], ['repeat', 'Repeating']] },
    { kind: 'number', key: 'per', label: 'Each Design Represents', value: cur?.per ?? 10, min: 1e-6, unit: 'units' },
    { kind: 'select', key: 'fraction', label: 'For Fractions', value: cur?.fraction ?? 'chop', choices: [['chop', 'Chop Design'], ['scale', 'Scale Design']] },
  ]);
  if (!v) return;
  const col: GraphColumnDesign | null = v.design ? { design: String(v.design), mode: v.mode as GraphColumnDesign['mode'], per: Math.max(1e-6, Number(v.per)), fraction: v.fraction as 'chop' } : null;
  e.setGraphSeries(t.series, { column: col }, [t.id]);
}

export async function graphMarkerDialog(e: Engine): Promise<void> {
  const t = targetSeries(e), designs = e.doc?.graphDesigns ?? [];
  if (!t) { e.notice('Select a graph, or one of its series with the Group Selection tool.'); return; }
  if (!designs.length) { e.notice('Make a design first: select some art and choose Object > Graph > Design, then New Design.'); return; }
  const v = await askForm('Graph Marker', [
    { kind: 'note', text: `Markers of ${t.series.length === 1 ? 'the selected series' : `${t.series.length} series`} in line, scatter and radar graphs.` },
    { kind: 'select', key: 'design', label: 'Marker Design', value: t.spec.markers?.[t.series[0]] ?? '', choices: [['', 'None (squares)'], ...designs.map((d) => [d.id, d.name] as const)] },
  ]);
  if (!v) return;
  e.setGraphSeries(t.series, { marker: v.design ? String(v.design) : null }, [t.id]);
}

export class GraphDesignDialog extends Dialog {
  private readonly list = el('<div class="cv-gdd-list" role="listbox" aria-label="Designs"></div>');
  private readonly empty = el('<p class="cv-note">No designs yet. Select the art for a column or marker and click New Design.</p>');
  private picked: string | null = null;
  private readonly btns: Record<string, HTMLButtonElement> = {};

  constructor(private readonly engine: Engine) {
    super('Graph Design', 400);
    this.body.append(this.list, this.empty);
    const mk = (k: string, label: string, run: () => void): void => { const b = el<HTMLButtonElement>('<button class="cv-btn" type="button"></button>'); setText(b, label); b.addEventListener('click', run); this.btns[k] = b; };
    mk('new', 'New Design', () => { const n = (this.engine.doc?.graphDesigns?.length ?? 0) + 1; const id = this.engine.addGraphDesign(`Design ${n}`); if (id) this.picked = id; else this.engine.notice('Select the art to use for the design (not part of a graph).'); this.sync(); });
    mk('rename', 'Rename', () => { const d = this.design(); if (d) void promptName('Rename Design', d.name, 'Rename').then((nm) => { if (nm) { this.engine.renameGraphDesign(d.id, nm); this.open(); this.sync(); } }); });
    mk('paste', 'Paste Design', () => { const d = this.design(); if (d) { this.engine.pasteGraphDesign(d.id); this.close(); } });
    mk('delete', 'Delete Design', () => { const d = this.design(); if (d) { this.engine.deleteGraphDesign(d.id); this.picked = null; this.sync(); } });
    const row = el('<div class="cv-gdd-actions"></div>');
    row.append(this.btns.new, this.btns.rename, this.btns.paste, this.btns.delete);
    this.body.appendChild(row);
    this.button('Done', 'primary', () => this.close());
    this.list.addEventListener('click', (ev) => { const r = (ev.target as HTMLElement).closest<HTMLElement>('.cv-gdd-row'); if (r?.dataset.id) { this.picked = r.dataset.id; this.sync(); } });
    engine.on('doc', () => { if (this.isOpen) this.sync(); });
    void q;
  }

  private design() { return this.engine.doc?.graphDesigns?.find((d) => d.id === this.picked) ?? null; }

  show(): void { this.sync(); this.open(); }

  private sync(): void {
    const list = this.engine.doc?.graphDesigns ?? [];
    if (this.picked && !list.some((d) => d.id === this.picked)) this.picked = null;
    patchList(this.list, list, {
      key: (d) => d.id,
      create: (d) => { const r = el('<div class="cv-gdd-row" role="option"><span class="cv-gdd-name"></span></div>'); r.dataset.id = d.id; setText(q(r, '.cv-gdd-name'), d.name); setClass(r, 'is-picked', d.id === this.picked); return r; },
      update: (r, d) => { setText(q(r, '.cv-gdd-name'), d.name); setClass(r, 'is-picked', d.id === this.picked); r.setAttribute('aria-selected', String(d.id === this.picked)); },
    });
    this.empty.hidden = list.length > 0;
    for (const k of ['rename', 'paste', 'delete']) setDisabled(this.btns[k], !this.picked);
    setDisabled(this.btns.new, !this.engine.hasSelection);
  }
}

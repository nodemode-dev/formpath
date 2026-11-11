import { cleanData, parseGrid, parseNumber, parseTable } from '../../engine/graph';
import type { Engine, GraphData } from '../../engine';
import { el, patchList, q, setClass, setDisabled, setHidden, setText, setValue } from '../dom';
import { icon } from '../icons';

const MIN_ROWS = 14, MIN_COLS = 7;
const gridOf = (d: GraphData): string[][] => { const c = cleanData(d); return [['', ...c.series], ...c.cats.map((cat, i) => [cat, ...c.values[i].map((v) => (v === null ? '' : String(v)))])]; };
const btn = (ic: string, label: string): string => `<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(ic, 16)}</button>`;

export class GraphDataWindow {
  readonly el = el(`<section class="cv-floatwin cv-gdw" role="dialog" aria-label="Graph Data" hidden>
<header class="cv-floatwin-head"><span class="cv-floatwin-title">Graph Data</span><span class="cv-gdw-dirty"></span><button class="cv-icon-btn" type="button" data-close title="Close" aria-label="Close">${icon('close', 16)}</button></header>
<div class="cv-gdw-bar"><input class="cv-input cv-gdw-entry" type="text" spellcheck="false" aria-label="Cell entry"><span class="cv-gdw-tools">${btn('upload', 'Import Data (CSV or tab-separated text)')}${btn('gdTranspose', 'Transpose row and column')}${btn('gdSwapXY', 'Switch X and Y (scatter graphs)')}${btn('undo', 'Revert to the graph\'s data')}${btn('check', 'Apply')}</span></div>
<div class="cv-gdw-grid" role="grid"></div>
<footer class="cv-gdw-foot"><span class="cv-gdw-note"></span></footer>
<input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden>
</section>`);
  private readonly grid: HTMLElement;
  private readonly entry: HTMLInputElement;
  private readonly note: HTMLElement;
  private draft: string[][] = [];
  private graph: string | null = null;
  private dirty = false;
  private at = { r: 1, c: 1 };
  private frame = 0;

  constructor(private readonly engine: Engine) {
    document.body.appendChild(this.el);
    this.grid = q(this.el, '.cv-gdw-grid');
    this.entry = q<HTMLInputElement>(this.el, '.cv-gdw-entry');
    this.note = q(this.el, '.cv-gdw-note');
    const [imp, trans, swap, revert, apply] = Array.from(this.el.querySelectorAll<HTMLButtonElement>('.cv-gdw-tools button'));
    const file = q<HTMLInputElement>(this.el, 'input[type="file"]');
    imp.addEventListener('click', () => file.click());
    file.addEventListener('change', () => { const f = file.files?.[0]; file.value = ''; if (f) void f.text().then((t) => { this.draft = this.normal(gridOf(parseTable(t))); this.touch(); }); });
    trans.addEventListener('click', () => { const w = Math.max(...this.draft.map((r) => r.length)); this.draft = this.normal(Array.from({ length: w }, (_, c) => this.draft.map((r) => r[c] ?? ''))); this.touch(); });
    swap.addEventListener('click', () => { this.draft = this.draft.map((r) => [r[0] ?? '', ...this.swapPairs(r.slice(1))]); this.touch(); });
    revert.addEventListener('click', () => { this.load(true); });
    apply.addEventListener('click', () => this.apply());
    q(this.el, '[data-close]').addEventListener('click', () => this.close());
    this.entry.addEventListener('input', () => { this.set(this.at.r, this.at.c, this.entry.value); const cell = this.cell(this.at.r, this.at.c); if (cell) cell.value = this.entry.value; });
    this.entry.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.focus(this.at.r + (e.shiftKey ? -1 : 1), this.at.c); } });
    this.grid.addEventListener('input', (e) => { const t = e.target as HTMLInputElement; const r = Number(t.dataset.r), c = Number(t.dataset.c); this.set(r, c, t.value); setValue(this.entry, t.value); });
    this.grid.addEventListener('focusin', (e) => { const t = e.target as HTMLInputElement; if (!t.dataset.r) return; this.at = { r: Number(t.dataset.r), c: Number(t.dataset.c) }; this.entry.value = t.value; this.mark(); });
    this.grid.addEventListener('keydown', (e) => {
      const t = e.target as HTMLInputElement; if (!t.dataset.r) return;
      const r = Number(t.dataset.r), c = Number(t.dataset.c);
      if (e.key === 'Enter') { e.preventDefault(); if (e.ctrlKey || e.metaKey) { this.apply(); return; } this.focus(r + (e.shiftKey ? -1 : 1), c); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); this.focus(r + 1, c); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.focus(r - 1, c); }
      else if (e.key === 'Escape') { e.preventDefault(); t.blur(); }
      e.stopPropagation();
    });
    this.grid.addEventListener('paste', (e) => {
      const t = e.target as HTMLInputElement, txt = e.clipboardData?.getData('text/plain') ?? '';
      if (!t.dataset.r || !/[\t\n]/.test(txt.trim())) return;
      e.preventDefault();
      const g = parseGrid(txt), r0 = Number(t.dataset.r), c0 = Number(t.dataset.c);
      g.forEach((row, i) => row.forEach((v, j) => this.set(r0 + i, c0 + j, v)));
      this.touch();
    });
    const head = q(this.el, '.cv-floatwin-head');
    head.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      const r = this.el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      head.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent): void => { this.el.style.left = `${Math.max(0, Math.min(window.innerWidth - 120, ev.clientX - dx))}px`; this.el.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dy))}px`; };
      const up = (): void => { head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); };
      head.addEventListener('pointermove', move); head.addEventListener('pointerup', up);
    });
    for (const k of ['selection', 'doc', 'active'] as const) engine.on(k, () => this.queue());
    this.el.addEventListener('keydown', (e) => e.stopPropagation());
    void [setDisabled];
  }

  get isOpen(): boolean { return !this.el.hidden; }

  open(id?: string): void {
    const g = id ?? this.engine.graphTargets()[0];
    if (!g) { this.engine.notice('Select a graph to edit its data.'); return; }
    this.graph = g;
    setHidden(this.el, false);
    this.load(true);
    requestAnimationFrame(() => this.focus(1, 1));
  }

  close(): void { setHidden(this.el, true); this.graph = null; }

  private queue(): void { if (this.isOpen && !this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    if (!this.isOpen) return;
    const sel = this.engine.graphTargets()[0];
    if (sel && sel !== this.graph && !this.dirty) { this.graph = sel; this.load(true); return; }
    const n = this.graph ? this.engine.nodeById(this.graph) : null;
    if (!n || n.kind !== 'group' || !n.graph) { setText(this.note, 'The graph is gone: select a graph and choose Object > Graph > Data.'); return; }
    if (!this.dirty) this.load(false);
  }

  private data(): GraphData | null { const n = this.graph ? this.engine.nodeById(this.graph) : null; return n?.kind === 'group' && n.graph ? n.graph.data : null; }

  private normal(g: string[][]): string[][] { return g.map((r) => r.map((v) => v ?? '')); }

  private load(reset: boolean): void {
    const d = this.data();
    if (!d) return;
    const rows = gridOf(d);
    if (!reset && JSON.stringify(rows) === JSON.stringify(this.draft)) return;
    this.draft = rows;
    this.dirty = false;
    this.render();
  }

  private swapPairs(r: string[]): string[] { const out = [...r]; for (let i = 0; i + 1 < out.length; i += 2) [out[i], out[i + 1]] = [out[i + 1], out[i]]; return out; }

  private set(r: number, c: number, v: string): void {
    while (this.draft.length <= r) this.draft.push([]);
    const row = this.draft[r];
    while (row.length <= c) row.push('');
    if (row[c] === v) return;
    row[c] = v;
    if (!this.dirty) { this.dirty = true; this.mark(); }
    if (r >= this.rows() - 2 || c >= this.cols() - 2) this.render();
  }

  private touch(): void { this.dirty = true; this.render(); }

  private rows(): number { return Math.max(MIN_ROWS, this.draft.length + 3); }
  private cols(): number { return Math.max(MIN_COLS, ...this.draft.map((r) => r.length + 2)); }

  private cell(r: number, c: number): HTMLInputElement | null { return this.grid.querySelector<HTMLInputElement>(`input[data-r="${r}"][data-c="${c}"]`); }

  private focus(r: number, c: number): void { if (r < 0) return; if (r >= this.rows() - 1) { this.draft.length = Math.max(this.draft.length, r + 1); this.render(); } const x = this.cell(r, c); if (x) { x.focus(); x.select(); } }

  private render(): void {
    const R = this.rows(), C = this.cols(), list = Array.from({ length: R }, (_, r) => r);
    for (let r = 0; r < this.draft.length; r++) if (!this.draft[r]) this.draft[r] = [];
    patchList(this.grid, list, {
      key: (r) => `r${r}`,
      create: (r) => { const row = el('<div class="cv-gdw-row" role="row"></div>'); this.fillRow(row, r, C); return row; },
      update: (row, r) => this.fillRow(row, r, C),
    });
    this.mark();
  }

  private fillRow(row: HTMLElement, r: number, C: number): void {
    patchList(row, Array.from({ length: C }, (_, c) => c), {
      key: (c) => `c${c}`,
      create: (c) => { const i = el<HTMLInputElement>('<input class="cv-gdw-cell" type="text" spellcheck="false" autocomplete="off">'); i.dataset.r = String(r); i.dataset.c = String(c); i.value = this.draft[r]?.[c] ?? ''; setClass(i, 'is-head', r === 0 || c === 0); i.setAttribute('aria-label', r === 0 && c === 0 ? 'Corner' : r === 0 ? `Legend label ${c}` : c === 0 ? `Category label ${r}` : `Row ${r}, column ${c}`); return i; },
      update: (i, c) => { setValue(i as HTMLInputElement, this.draft[r]?.[c] ?? ''); },
    });
  }

  private mark(): void {
    setText(q(this.el, '.cv-gdw-dirty'), this.dirty ? 'Not applied' : '');
    for (const x of Array.from(this.grid.querySelectorAll<HTMLInputElement>('input.is-at'))) setClass(x, 'is-at', false);
    setClass(this.cell(this.at.r, this.at.c), 'is-at', true);
    const n = this.graph ? this.engine.nodeById(this.graph) : null;
    setText(this.note, n?.kind === 'group' && n.graph ? (n.graph.type === 'scatter' ? 'Scatter: each pair of columns is Y then X; Switch X and Y swaps them.' : n.graph.type === 'pie' ? 'Pie: each row is one pie, each column a wedge.' : 'Top row: legend labels. Left column: category labels. Paste cells from a spreadsheet anywhere.') : '');
  }

  apply(): boolean {
    if (!this.graph) return false;
    const g = this.draft, W = Math.max(0, ...g.map((r) => r.length));
    let lastRow = 0, lastCol = 0;
    g.forEach((r, i) => r.forEach((v, j) => { if (v.trim()) { lastRow = Math.max(lastRow, i); lastCol = Math.max(lastCol, j); } }));
    void W;
    const data = cleanData({
      series: Array.from({ length: lastCol }, (_, j) => g[0]?.[j + 1] ?? ''),
      cats: Array.from({ length: lastRow }, (_, i) => g[i + 1]?.[0] ?? ''),
      values: Array.from({ length: lastRow }, (_, i) => Array.from({ length: lastCol }, (_, j) => parseNumber(g[i + 1]?.[j + 1] ?? ''))),
    });
    const ok = this.engine.setGraphData(data, [this.graph]);
    this.dirty = false;
    this.mark();
    return ok;
  }
}

import { findNode } from '../../engine/doc';
import { boundLabel, kindFits, parseDataFile, VARIABLE_KINDS } from '../../engine/variables';
import type { Engine, Variable, VariableKind } from '../../engine';
import { exportDataSets, showDataSet } from '../../io/data-merge';
import { promptName } from '../dialogs';
import { el, patchList, q, setClass, setDisabled, setText, setTitle, setValue } from '../dom';
import { askForm } from '../form-dialog';
import { icon } from '../icons';

const KIND_ICON: Record<VariableKind, string> = { text: 'vType', image: 'image', visibility: 'eye', graph: 'vColumnGraph' };
const KIND_LABEL: Record<VariableKind, string> = Object.fromEntries(VARIABLE_KINDS) as Record<VariableKind, string>;

export interface VariablesHost { deliver(blob: Blob, name: string): Promise<void>; version: string; desktop(): boolean }

export class VariablesPanel {
  readonly body = el(`<div class="cv-kit-page cv-varp">
<div class="cv-varp-sets"><select class="cv-select cv-varp-set" aria-label="Data set"></select><span class="cv-varp-nav"></span></div>
<div class="cv-varp-count"></div>
<div class="cv-varp-list" role="listbox" aria-label="Variables"></div>
<div class="cv-varp-make"><span class="cv-varp-make-label">Make from selection</span><span class="cv-varp-kinds"></span></div>
<input type="file" accept=".csv,.json,.tsv,.txt,text/csv,application/json" hidden>
</div>`);
  private readonly list: HTMLElement;
  private readonly setSel: HTMLSelectElement;
  private readonly count: HTMLElement;
  private readonly b: Record<string, HTMLButtonElement> = {};
  private picked: string | null = null;
  private frame = 0;

  constructor(private readonly engine: Engine, private readonly host: VariablesHost) {
    this.list = q(this.body, '.cv-varp-list');
    this.setSel = q<HTMLSelectElement>(this.body, '.cv-varp-set');
    this.count = q(this.body, '.cv-varp-count');
    const iconBtn = (key: string, ic: string, label: string, run: () => void, into: HTMLElement): void => { const x = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(ic, 16)}</button>`); x.addEventListener('click', run); into.appendChild(x); this.b[key] = x; };
    const nav = q(this.body, '.cv-varp-nav');
    iconBtn('prev', 'dsPrev', 'Previous Data Set', () => this.step(-1), nav);
    iconBtn('next', 'dsNext', 'Next Data Set', () => this.step(1), nav);
    iconBtn('capture', 'dsCapture', 'Capture Data Set', () => { const i = engine.captureDataSet(); if (i < 0) engine.notice('Make a variable first: select an object and use the buttons below.'); }, nav);
    iconBtn('update', 'refresh', 'Update Data Set with the artboard as it is now', () => { engine.updateDataSet(); }, nav);
    iconBtn('dsdelete', 'delete', 'Delete Data Set', () => { const i = engine.doc?.dataSet ?? -1; if (i >= 0) engine.deleteDataSet(i); }, nav);
    const kinds = q(this.body, '.cv-varp-kinds');
    for (const [k, label] of VARIABLE_KINDS) iconBtn(`make-${k}`, KIND_ICON[k], `Make ${label} Variable${k === 'visibility' ? '' : ''} (bound to the selection, or unbound with nothing selected)`, () => this.make(k), kinds);
    const foot = el('<div class="cv-panel-foot"></div>');
    iconBtn('bind', 'link', 'Bind the selected variable to the selected object', () => this.bind(), foot);
    iconBtn('unbind', 'unlink', 'Unbind Variable', () => { if (this.picked) engine.bindVariable(this.picked, null); }, foot);
    iconBtn('selbound', 'search', 'Select Bound Object', () => this.selectBound(), foot);
    iconBtn('import', 'upload', 'Import Data Sets (CSV or JSON)', () => q<HTMLInputElement>(this.body, 'input[type="file"]').click(), foot);
    iconBtn('export', 'actBatch', 'Export Variations (one file per data set)', () => void this.export(), foot);
    iconBtn('delete', 'delete', 'Delete Variable', () => { if (this.picked) { engine.deleteVariable(this.picked); this.picked = null; } }, foot);
    this.body.appendChild(foot);
    const file = q<HTMLInputElement>(this.body, 'input[type="file"]');
    file.addEventListener('change', () => { const f = file.files?.[0]; file.value = ''; if (f) void this.importFile(f); });
    this.setSel.addEventListener('change', () => { const i = Number(this.setSel.value); if (i >= 0) void showDataSet(engine, i); });
    this.list.addEventListener('click', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-varp-row'); if (r?.dataset.id) { this.picked = r.dataset.id; this.queue(); } });
    this.list.addEventListener('dblclick', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-varp-row'); const v = r?.dataset.id ? this.vars().find((x) => x.id === r.dataset.id) : null; if (v) void promptName('Variable Options', v.name, 'Rename').then((nm) => { if (nm) engine.renameVariable(v.id, nm); }); });
    for (const k of ['doc', 'selection', 'active', 'projects'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private vars(): Variable[] { return this.engine.doc?.variables ?? []; }
  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private step(d: number): void {
    const sets = this.engine.doc?.dataSets ?? [], cur = this.engine.doc?.dataSet ?? -1;
    if (!sets.length) return;
    const i = Math.max(0, Math.min(sets.length - 1, (cur < 0 ? 0 : cur + d)));
    if (i !== cur) void showDataSet(this.engine, i);
  }

  private make(kind: VariableKind): void {
    const e = this.engine, sel = e.selected();
    const n = sel.length === 1 ? sel[0] : null;
    if (sel.length > 1) { e.notice('Select one object to bind, or none for an unbound variable.'); return; }
    if (n && !kindFits(kind, n)) { e.notice(kind === 'text' ? 'A text variable binds to type.' : kind === 'image' ? 'An image variable binds to a placed image.' : kind === 'graph' ? 'A graph data variable binds to a graph.' : 'Select an object.'); return; }
    const id = e.makeVariable(kind, n?.id ?? null);
    if (id) this.picked = id;
  }

  private bind(): void {
    const e = this.engine, v = this.vars().find((x) => x.id === this.picked), n = e.selected()[0];
    if (!v) { e.notice('Pick a variable in the list first.'); return; }
    if (!n || e.selected().length !== 1) { e.notice('Select the one object to bind it to.'); return; }
    if (!e.bindVariable(v.id, n.id)) e.notice(`${KIND_LABEL[v.kind]} variables cannot bind to that object.`);
  }

  private selectBound(): void { const v = this.vars().find((x) => x.id === this.picked); if (v?.node) this.engine.select([v.node]); }

  private async importFile(f: File): Promise<void> {
    const e = this.engine, d = e.doc;
    if (!d) return;
    try {
      const r = parseDataFile(d, await f.text(), /\.json$/i.test(f.name) ? 'json' : 'csv');
      if (!e.addDataSets(r.variables, r.sets)) { e.notice('That file has no data sets.', 'error'); return; }
      const unbound = r.variables.filter((v) => !v.node).length;
      e.notice(`Imported ${r.sets.length} data set${r.sets.length === 1 ? '' : 's'}.${unbound ? ` ${unbound} variable${unbound === 1 ? ' is' : 's are'} unbound: pick each and bind it to an object.` : ''}`);
      const first = (e.doc?.dataSets?.length ?? 0) - r.sets.length;
      if (first >= 0) await showDataSet(e, first);
    } catch (err) { e.notice(`${f.name}: ${err instanceof Error ? err.message : String(err)}`, 'error'); }
  }

  async export(): Promise<void> {
    const e = this.engine, p = e.current;
    if (!p) return;
    if (!(p.doc.dataSets ?? []).length) { e.notice('There are no data sets to export: capture or import some first.'); return; }
    const texts = this.vars().filter((v) => v.kind === 'text');
    const v = await askForm('Export Variations', [
      { kind: 'select', key: 'format', label: 'Format', value: 'png', choices: [['png', 'PNG'], ['svg', 'SVG'], ['pdf', 'PDF']] },
      { kind: 'select', key: 'artboard', label: 'Artboard', value: String(p.activeArtboard), choices: p.doc.artboards.map((a, i) => [String(i), a.name] as const) },
      { kind: 'number', key: 'scale', label: 'PNG scale', value: 2, min: 0.1, max: 8, unit: 'x' },
      { kind: 'check', key: 'fpth', label: 'Also save each as a .fpth project', value: false },
      { kind: 'select', key: 'name', label: 'Name files from', value: '', choices: [['', 'Data set name'], ...texts.map((t) => [t.name, t.name] as const)] },
      { kind: 'select', key: 'dest', label: 'Save to', value: this.host.desktop() ? 'folder' : 'zip', choices: [['zip', 'A zip download'], ['folder', 'A folder (through the engine)']] },
      { kind: 'text', key: 'folder', label: 'Folder', value: '', placeholder: '/Users/you/Documents/variations' },
    ], { ok: 'Export', width: 440 });
    if (!v) return;
    const folder = v.dest === 'folder' ? String(v.folder).trim() : '';
    if (v.dest === 'folder' && !folder) { e.notice('Give the folder as an absolute path, or choose a zip download.', 'error'); return; }
    await e.task(async () => {
      try {
        const r = await exportDataSets(e, { format: v.format as 'png', fpth: !!v.fpth, nameVar: String(v.name) || null, folder: folder || null, scale: Number(v.scale), artboard: Number(v.artboard) }, this.host.version);
        if (r.zip) await this.host.deliver(r.zip, `${p.name}-variations.zip`);
        e.notice(`Exported ${r.files.length} file${r.files.length === 1 ? '' : 's'}${r.folder ? ` to ${r.folder}` : ''}.${r.errors.length ? ` ${r.errors.length} problem${r.errors.length === 1 ? '' : 's'}: ${r.errors[0]}${r.folder ? ' (see formpath-data-merge-errors.txt)' : ''}` : ''}`, r.errors.length ? 'error' : 'info');
      } catch (err) { e.notice(err instanceof Error ? err.message : String(err), 'error'); }
    });
  }

  private sync(): void {
    const e = this.engine, d = e.doc, vars = this.vars(), sets = d?.dataSets ?? [], cur = d?.dataSet ?? -1;
    const sel = e.selected(), one = sel.length === 1 ? sel[0] : null;
    if (this.picked && !vars.some((v) => v.id === this.picked)) this.picked = null;
    if (one) { const hit = vars.find((v) => v.node === one.id); if (hit && hit.id !== this.picked) this.picked = hit.id; }
    patchList(this.setSel, [{ i: -1, name: sets.length ? 'Data Set' : 'No data sets' }, ...sets.map((s, i) => ({ i, name: s.name }))].filter((x) => x.i >= 0 || cur < 0), {
      key: (x) => `ds${x.i}`,
      create: (x) => { const o = document.createElement('option'); o.value = String(x.i); o.textContent = x.name; return o; },
      update: (o, x) => setText(o, x.name),
    });
    setValue(this.setSel, String(cur));
    setDisabled(this.setSel, !sets.length);
    setText(this.count, sets.length ? `${cur + 1} of ${sets.length} data sets · ${vars.length} variable${vars.length === 1 ? '' : 's'}` : `${vars.length} variable${vars.length === 1 ? '' : 's'}`);
    patchList(this.list, vars, {
      key: (v) => v.id,
      create: (v) => { const r = el(`<div class="cv-varp-row" role="option"><span class="cv-varp-kind"></span><span class="cv-varp-name"></span><span class="cv-varp-obj"></span></div>`); r.dataset.id = v.id; this.fill(r, v); return r; },
      update: (r, v) => this.fill(r, v),
    });
    const pv = vars.find((v) => v.id === this.picked);
    setDisabled(this.b.prev, cur <= 0);
    setDisabled(this.b.next, !sets.length || cur >= sets.length - 1);
    setDisabled(this.b.capture, !vars.length);
    setDisabled(this.b.update, cur < 0);
    setDisabled(this.b.dsdelete, cur < 0);
    setDisabled(this.b.bind, !pv || !one || !kindFits(pv.kind, one));
    setDisabled(this.b.unbind, !pv?.node);
    setDisabled(this.b.selbound, !pv?.node || !d || !findNode(d, pv.node));
    setDisabled(this.b.delete, !pv);
    setDisabled(this.b.export, !sets.length);
    setDisabled(this.b.import, !d);
    for (const [k] of VARIABLE_KINDS) setDisabled(this.b[`make-${k}`], !d || sel.length > 1 || (!!one && !kindFits(k, one)));
  }

  private fill(r: HTMLElement, v: Variable): void {
    const d = this.engine.doc, ic = KIND_ICON[v.kind];
    const kind = q(r, '.cv-varp-kind');
    if (kind.dataset.icon !== ic) { kind.dataset.icon = ic; kind.innerHTML = icon(ic, 14); }
    setText(q(r, '.cv-varp-name'), v.name);
    setText(q(r, '.cv-varp-obj'), d ? boundLabel(d, v) || 'unbound' : '');
    setClass(q(r, '.cv-varp-obj'), 'is-unbound', !v.node);
    setClass(r, 'is-picked', v.id === this.picked);
    r.setAttribute('aria-selected', String(v.id === this.picked));
    setTitle(r, `${KIND_LABEL[v.kind]} · double-click to rename`);
  }
}

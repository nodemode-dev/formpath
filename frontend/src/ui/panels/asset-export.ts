import { selectionBounds } from '../../engine/bounds';
import { findNode } from '../../engine/doc';
import { isEmptyRect } from '../../engine/geometry';
import { renderNode } from '../../engine/render';
import type { Engine, ExportAsset, VNode } from '../../engine';
import type { AssetItem } from '../../io/raster';
import { el, patchList, q, setClass, setDisabled, setHidden, setText, setTitle } from '../dom';
import { enhanceSelect } from '../dropdown';
import { askForm } from '../form-dialog';
import { icon } from '../icons';
import { empty, page, row, section } from './kit';

const SCALES: ReadonlyArray<readonly [string, string]> = [['0.5', '0.5x'], ['1', '1x'], ['1.5', '1.5x'], ['2', '2x'], ['3', '3x'], ['4', '4x']];
const FORMATS: ReadonlyArray<readonly [string, string]> = [['png', 'PNG'], ['jpg', 'JPG'], ['webp', 'WebP'], ['svg', 'SVG'], ['pdf', 'PDF']];

export class AssetExportPanel {
  readonly body = page('cv-assetp');
  private readonly grid = el('<div class="cv-assetp-grid" role="listbox" aria-label="Assets" aria-multiselectable="true"></div>');
  private readonly none = empty('Select art and press Add to collect it here. Each asset exports on its own, cropped to its art.');
  private readonly rows = el('<div class="cv-assetp-rows"></div>');
  private readonly exportBtn = el<HTMLButtonElement>('<button class="cv-btn cv-btn-primary" type="button">Export</button>');
  private readonly drawn = new WeakMap<HTMLElement, VNode[]>();
  private picked = new Set<string>();
  private frame = 0;
  private busy = false;

  constructor(private readonly engine: Engine, private readonly run: (assets: ExportAsset[], items: AssetItem[]) => Promise<void>) {
    const foot = el('<div class="cv-panel-foot"></div>');
    const mk = (name: string, label: string, act: () => void): void => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', act); foot.appendChild(b); };
    mk('layers', 'Add the selected art as one asset', () => { const ids = engine.addExportAssets(true); this.pick(ids); });
    mk('add', 'Add each selected object as its own asset', () => { const ids = engine.addExportAssets(false); this.pick(ids); });
    mk('delete', 'Remove the picked assets', () => { if (this.picked.size) { engine.removeExportAssets([...this.picked]); this.picked.clear(); } });
    const addRow = el<HTMLButtonElement>('<button type="button" class="cv-btn cv-btn-ghost">Add Scale</button>');
    addRow.addEventListener('click', () => this.addRow(2, 'png', '@2x'));
    this.exportBtn.addEventListener('click', () => void this.exportNow());
    this.grid.addEventListener('click', (ev) => {
      const t = (ev.target as HTMLElement).closest<HTMLElement>('.cv-assetp-tile');
      const id = t?.dataset.asset;
      if (!id) return;
      if (ev.shiftKey || ev.metaKey || ev.ctrlKey) { if (this.picked.has(id)) this.picked.delete(id); else this.picked.add(id); }
      else this.picked = new Set([id]);
      const doc = engine.doc, ids = engine.exportAssets.filter((a) => this.picked.has(a.id)).flatMap((a) => a.ids).filter((x) => doc && findNode(doc, x));
      if (ids.length) engine.select(ids);
      this.sync();
    });
    this.grid.addEventListener('dblclick', (ev) => {
      const id = (ev.target as HTMLElement).closest<HTMLElement>('.cv-assetp-tile')?.dataset.asset, a = engine.exportAssets.find((x) => x.id === id);
      if (a) void askForm('Rename Asset', [{ kind: 'text', key: 'name', label: 'Name', value: a.name }], { ok: 'Rename' }).then((v) => { if (v) engine.renameExportAsset(a.id, String(v.name)); });
    });
    this.body.append(this.grid, this.none, section('Export Settings'), this.rows, row(addRow, this.exportBtn), foot);
    this.addRow(1, 'png', '');
    this.addRow(2, 'png', '@2x');
    this.addRow(1, 'svg', '');
    for (const k of ['doc', 'active', 'projects', 'busy'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private pick(ids: string[]): void { if (ids.length) { this.picked = new Set(ids); this.sync(); } }

  private addRow(scale: number, format: string, suffix: string): void {
    const r = el('<div class="cv-screens-row"></div>');
    const sel = (opts: ReadonlyArray<readonly [string, string]>, v: string, label: string): HTMLSelectElement => { const s = el<HTMLSelectElement>(`<select class="cv-select" aria-label="${label}"></select>`); for (const [id, l] of opts) { const o = document.createElement('option'); o.value = id; o.textContent = l; s.appendChild(o); } s.value = v; return s; };
    const s = sel(SCALES, String(scale), 'Scale'), f = sel(FORMATS, format, 'Format'), x = el<HTMLInputElement>('<input class="cv-input" type="text" aria-label="Suffix" placeholder="suffix">');
    x.value = suffix;
    x.addEventListener('keydown', (e) => e.stopPropagation());
    const del = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" aria-label="Remove this format">${icon('close', 14)}</button>`);
    del.addEventListener('click', () => { if (this.rows.children.length > 1) r.remove(); });
    r.append(s, x, f, del);
    this.rows.appendChild(r);
    enhanceSelect(s); enhanceSelect(f);
  }

  private items(): AssetItem[] {
    return Array.from(this.rows.children).map((r) => { const s = q<HTMLSelectElement>(r, 'select[aria-label="Scale"]'), f = q<HTMLSelectElement>(r, 'select[aria-label="Format"]'), x = q<HTMLInputElement>(r, 'input'); return { scale: Number(s.value) || 1, format: f.value as AssetItem['format'], suffix: x.value }; });
  }

  private async exportNow(): Promise<void> {
    const all = this.engine.exportAssets, list = this.picked.size ? all.filter((a) => this.picked.has(a.id)) : all;
    if (!list.length || this.busy) return;
    this.busy = true; this.sync();
    try { await this.run(list, this.items()); } finally { this.busy = false; this.sync(); }
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const assets = this.engine.exportAssets;
    for (const id of [...this.picked]) if (!assets.some((a) => a.id === id)) this.picked.delete(id);
    patchList<ExportAsset>(this.grid, assets, {
      key: (a) => a.id,
      create: (a) => { const b = el('<button class="cv-assetp-tile" type="button" role="option"><canvas width="160" height="160"></canvas><span class="cv-assetp-name"></span></button>'); b.dataset.asset = a.id; this.fill(b, a); return b; },
      update: (b, a) => this.fill(b, a),
    });
    setHidden(this.none, assets.length > 0);
    setHidden(this.grid, !assets.length);
    setText(this.exportBtn, this.busy ? 'Exporting...' : this.picked.size ? `Export ${this.picked.size}` : 'Export All');
    setDisabled(this.exportBtn, this.busy || !assets.length);
  }

  private fill(b: HTMLElement, a: ExportAsset): void {
    const doc = this.engine.doc, nodes = doc ? a.ids.map((id) => findNode(doc, id)).filter((n): n is VNode => !!n) : [];
    setText(q(b, '.cv-assetp-name'), a.name);
    setTitle(b, nodes.length ? `${a.name}: double-click to rename` : `${a.name}: its art was deleted`);
    b.setAttribute('aria-selected', String(this.picked.has(a.id)));
    setClass(b, 'is-picked', this.picked.has(a.id));
    setClass(b, 'is-missing', !nodes.length);
    const last = this.drawn.get(b);
    if (last && last.length === nodes.length && last.every((n, i) => n === nodes[i])) return;
    this.drawn.set(b, nodes);
    const c = q<HTMLCanvasElement>(b, 'canvas'), g = c.getContext('2d');
    if (!g || !doc) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    if (!nodes.length) return;
    const r = selectionBounds(doc, nodes, true);
    if (isEmptyRect(r) || r.w <= 0 || r.h <= 0) return;
    const k = Math.min((c.width - 16) / r.w, (c.height - 16) / r.h);
    g.setTransform(k, 0, 0, k, (c.width - r.w * k) / 2 - r.x * k, (c.height - r.h * k) / 2 - r.y * k);
    const p = this.engine.current;
    try { for (const n of nodes) renderNode(g, n, { doc, scale: k, outline: false, assets: (key) => p?.bitmaps.get(key) ?? null, printing: true }); } catch { }
  }
}

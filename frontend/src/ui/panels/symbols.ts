import { allNodes } from '../../engine/doc';
import { geomBounds } from '../../engine/bounds';
import { renderNode } from '../../engine/render';
import type { Artboard, Engine, ImageNode, SymbolDef } from '../../engine';
import { el, patchList, q, setClass, setText, setTitle } from '../dom';
import { icon } from '../icons';
import { askForm } from '../form-dialog';

function thumb(engine: Engine, c: HTMLCanvasElement, s: SymbolDef): void {
  const g = c.getContext('2d'), doc = engine.doc;
  if (!g || !doc) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  const b = geomBounds(doc, s.art);
  if (!Number.isFinite(b.x) || b.w <= 0 && b.h <= 0) return;
  const k = Math.min((c.width - 8) / Math.max(1e-6, b.w), (c.height - 8) / Math.max(1e-6, b.h));
  g.setTransform(k, 0, 0, k, c.width / 2 - (b.x + b.w / 2) * k, c.height / 2 - (b.y + b.h / 2) * k);
  try { renderNode(g, s.art, { doc, scale: k, outline: false, assets: () => null }); } catch { }
}

export class SymbolsPanel {
  readonly body = el('<div class="cv-kit-page cv-symp"></div>');
  private readonly grid = el('<div class="cv-symp-grid" role="listbox" aria-label="Symbols"></div>');
  private frame = 0;

  constructor(private readonly engine: Engine) {
    const foot = el('<div class="cv-panel-foot"></div>');
    const mk = (name: string, label: string, run: () => void): void => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', run); foot.appendChild(b); };
    mk('download', 'Place Symbol Instance', () => this.place());
    mk('unlink', 'Break Link to Symbol', () => engine.breakSymbolLink());
    mk('add', 'New Symbol from the selection', () => void (async () => { if (!engine.hasSelection) { engine.notice('Select artwork to turn into a symbol.'); return; } const v = await askForm('Symbol Options', [{ kind: 'text', key: 'name', label: 'Name', value: `Symbol ${(engine.doc?.symbols.length ?? 0) + 1}` }], { ok: 'Make Symbol' }); if (v) engine.makeSymbol(String(v.name)); })());
    mk('delete', 'Delete Symbol', () => { const id = engine.currentSymbol; if (!id) return; const used = allNodes(engine.doc as never).some((n) => n.kind === 'symbol' && n.symbol === id); if (used) { engine.notice('The symbol is in use; break the links to its instances first.'); return; } engine.edit('Delete Symbol', (d) => ({ ...d, symbols: d.symbols.filter((s) => s.id !== id) })); engine.currentSymbol = null; });
    this.grid.addEventListener('click', (e) => { const t = (e.target as HTMLElement).closest<HTMLElement>('.cv-symp-tile'); if (!t?.dataset.key) return; engine.currentSymbol = t.dataset.key; engine.emit('options', null); this.sync(); });
    this.grid.addEventListener('dblclick', (e) => { if ((e.target as HTMLElement).closest('.cv-symp-tile')) this.place(); });
    this.body.append(this.grid, foot);
    for (const k of ['doc', 'active', 'projects', 'options'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private place(): void {
    const e = this.engine, p = e.current, id = e.currentSymbol ?? e.doc?.symbols[0]?.id;
    if (!p || !id) return;
    const v = p.viewport;
    e.placeSymbol(id, v.toDoc(v.centerX, v.height / 2));
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    patchList<SymbolDef>(this.grid, this.engine.doc?.symbols ?? [], {
      key: (s) => s.id,
      create: (s) => { const b = el('<button class="cv-symp-tile" type="button" role="option"><canvas width="64" height="64"></canvas></button>'); this.fill(b, s); return b; },
      update: (b, s) => this.fill(b, s),
    });
  }

  private fill(b: HTMLElement, s: SymbolDef): void {
    setTitle(b, s.name);
    b.setAttribute('aria-label', s.name);
    setClass(b, 'is-picked', this.engine.currentSymbol === s.id);
    if (b.dataset.sig !== s.art.id + JSON.stringify(s.art.ap).length) { b.dataset.sig = s.art.id + JSON.stringify(s.art.ap).length; thumb(this.engine, q<HTMLCanvasElement>(b, 'canvas'), s); }
  }
}

export const PRESET_SIZES: ReadonlyArray<readonly [string, string, number, number]> = [
  ['letter', 'Letter', 612, 792], ['a4', 'A4', 595.28, 841.89], ['a3', 'A3', 841.89, 1190.55], ['tabloid', 'Tabloid', 792, 1224], ['web', 'Web 1920 × 1080', 1920, 1080], ['mobile', 'iPhone 390 × 844', 390, 844], ['square', 'Post 1080 × 1080', 1080, 1080], ['icon', 'Icon 512 × 512', 512, 512],
];

export class ArtboardsPanel {
  readonly body = el('<div class="cv-kit-page cv-abp"></div>');
  private readonly list = el('<div class="cv-abp-list" role="listbox" aria-label="Artboards"></div>');
  private frame = 0;

  constructor(private readonly engine: Engine) {
    const foot = el('<div class="cv-panel-foot"></div>');
    const mk = (name: string, label: string, run: () => void): void => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', run); foot.appendChild(b); };
    mk('canvasGrid', 'Rearrange All Artboards', () => void (async () => { const v = await askForm('Rearrange All Artboards', [{ kind: 'number', key: 'cols', label: 'Columns', value: 2, min: 1, max: 50 }, { kind: 'number', key: 'gap', label: 'Spacing', value: 20, min: 0, max: 5000, unit: 'pt' }]); if (v) engine.rearrangeArtboards(Math.round(Number(v.cols)), Number(v.gap)); })());
    mk('chevronUp', 'Move Up', () => this.reorder(-1));
    mk('chevronDown', 'Move Down', () => this.reorder(1));
    mk('add', 'New Artboard', () => { const p = engine.current; if (!p) return; const a = p.doc.artboards[p.activeArtboard] ?? { x: 0, y: 0, w: 612, h: 792 }; const right = Math.max(...p.doc.artboards.map((x) => x.x + x.w)); engine.addArtboard({ x: right + 40, y: a.y, w: a.w, h: a.h }); });
    mk('delete', 'Delete Artboard', () => { const p = engine.current; if (p) engine.deleteArtboard(p.activeArtboard); });
    this.list.addEventListener('click', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-abp-row'); if (!r) return; const i = Number(r.dataset.i); if ((e.target as HTMLElement).closest('.cv-abp-opts')) { void this.options(i); return; } engine.setActiveArtboard(i); engine.fit(); });
    this.list.addEventListener('dblclick', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-abp-row'); if (r) void this.options(Number(r.dataset.i)); });
    this.body.append(this.list, foot);
    for (const k of ['doc', 'active', 'projects', 'options'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private reorder(d: number): void {
    const p = this.engine.current;
    if (!p) return;
    const i = p.activeArtboard, j = i + d;
    if (j < 0 || j >= p.doc.artboards.length) return;
    this.engine.edit('Reorder Artboards', (doc) => { const a = doc.artboards.slice(); [a[i], a[j]] = [a[j], a[i]]; return { ...doc, artboards: a }; });
    this.engine.setActiveArtboard(j);
  }

  async options(i: number): Promise<void> {
    const p = this.engine.current, a = p?.doc.artboards[i];
    if (!p || !a) return;
    const v = await askForm('Artboard Options', [
      { kind: 'text', key: 'name', label: 'Name', value: a.name },
      { kind: 'select', key: 'preset', label: 'Preset', value: PRESET_SIZES.find((x) => Math.abs(x[2] - a.w) < 0.5 && Math.abs(x[3] - a.h) < 0.5)?.[0] ?? 'custom', choices: [['custom', 'Custom'], ...PRESET_SIZES.map((x) => [x[0], x[1]] as const)] },
      { kind: 'number', key: 'x', label: 'X', value: a.x, unit: 'pt' }, { kind: 'number', key: 'y', label: 'Y', value: a.y, unit: 'pt' },
      { kind: 'number', key: 'w', label: 'Width', value: a.w, min: 1, unit: 'pt' }, { kind: 'number', key: 'h', label: 'Height', value: a.h, min: 1, unit: 'pt' },
      { kind: 'color', key: 'bg', label: 'Background', value: '#ffffff' },
      { kind: 'check', key: 'transparent', label: 'Transparent background', value: !a.bg },
    ]);
    if (!v) return;
    const pre = PRESET_SIZES.find((x) => x[0] === v.preset), presetChanged = v.preset !== 'custom' && pre && (Math.abs(pre[2] - a.w) > 0.5 || Math.abs(pre[3] - a.h) > 0.5);
    const hex = String(v.bg), bg = v.transparent ? null : { kind: 'rgb' as const, r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
    const patch: Partial<Artboard> = { name: String(v.name) || a.name, x: Number(v.x), y: Number(v.y), w: presetChanged && pre ? pre[2] : Number(v.w), h: presetChanged && pre ? pre[3] : Number(v.h), bg };
    this.engine.setArtboard(i, patch);
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const p = this.engine.current, list = (p?.doc.artboards ?? []).map((a, i) => ({ a, i }));
    patchList(this.list, list, {
      key: (x) => x.a.id,
      create: (x) => { const r = el(`<div class="cv-abp-row" role="option"><span class="cv-abp-n"></span><span class="cv-abp-name"></span><span class="cv-abp-size"></span><button class="cv-abp-opts" type="button" title="Artboard Options" aria-label="Artboard Options">${icon('pArtboards', 14)}</button></div>`); this.fill(r, x.a, x.i); return r; },
      update: (r, x) => this.fill(r, x.a, x.i),
    });
  }

  private fill(r: HTMLElement, a: Artboard, i: number): void {
    r.dataset.i = String(i);
    setText(q(r, '.cv-abp-n'), String(i + 1));
    setText(q(r, '.cv-abp-name'), a.name);
    setText(q(r, '.cv-abp-size'), `${Math.round(a.w)} × ${Math.round(a.h)}`);
    setClass(r, 'is-active', this.engine.current?.activeArtboard === i);
  }
}

export class LinksPanel {
  readonly body = el('<div class="cv-kit-page cv-linkp"></div>');
  private readonly list = el('<div class="cv-linkp-list" role="listbox" aria-label="Links"></div>');
  private frame = 0;

  constructor(private readonly engine: Engine, private readonly relink: (id: string) => void) {
    const foot = el('<div class="cv-panel-foot"></div>');
    const mk = (name: string, label: string, run: (id: string) => void): void => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', () => { const id = this.picked(); if (id) run(id); }); foot.appendChild(b); };
    mk('link', 'Relink', (id) => this.relink(id));
    mk('search', 'Go To Link', (id) => { engine.select([id]); engine.fitSelection(); });
    mk('download', 'Embed Image', (id) => engine.applyToSelection('Embed Image', (n) => (n.kind === 'image' ? { ...n, link: undefined } : n), [id]));
    this.list.addEventListener('click', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-linkp-row'); if (r?.dataset.key) engine.select([r.dataset.key]); });
    this.body.append(this.list, foot);
    for (const k of ['doc', 'active', 'selection'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private picked(): string | null { const s = this.engine.selected().find((n) => n.kind === 'image'); return s?.id ?? null; }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const doc = this.engine.doc, imgs = doc ? allNodes(doc).filter((n): n is ImageNode => n.kind === 'image') : [];
    const sel = new Set(this.engine.selectedIds());
    patchList<ImageNode>(this.list, imgs, {
      key: (n) => n.id,
      create: (n) => { const r = el(`<div class="cv-linkp-row" role="option">${icon('image', 14)}<span class="cv-linkp-name"></span><span class="cv-linkp-state"></span></div>`); this.fill(r, n, sel); return r; },
      update: (r, n) => this.fill(r, n, sel),
    });
  }

  private fill(r: HTMLElement, n: ImageNode, sel: Set<string>): void {
    setText(q(r, '.cv-linkp-name'), n.name ?? n.link ?? n.src);
    setText(q(r, '.cv-linkp-state'), n.link ? 'Linked' : 'Embedded');
    setTitle(r, `${n.w} × ${n.h} px`);
    setClass(r, 'is-active', sel.has(n.id));
  }
}

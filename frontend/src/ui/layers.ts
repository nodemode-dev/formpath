import { ancestors, childrenOf, findNode, isContainer, nodeLabel } from '../engine/doc';
import type { Engine, LayerNode, VNode } from '../engine';
import type { PopupMenu } from './menu';
import { el, patchList, q, setClass, setHtml, setStyleVar, setText, setTitle } from './dom';
import { icon } from './icons';
import { askForm } from './form-dialog';
import { LAYER_COLORS } from '../engine/doc';

interface Row { node: VNode; depth: number; layer: LayerNode; container: boolean; open: boolean }

const KIND_ICON: Record<string, string> = { layer: 'layers', group: 'folder', path: 'vPen', compound: 'pPathfinder', text: 'vType', image: 'image', symbol: 'pSymbols', blend: 'vBlend', envelope: 'envelope', mesh: 'vMesh', repeat: 'repeatRadial' };

export class LayersPanel {
  readonly body = el('<div class="cv-layers-page cv-lp"></div>');
  private readonly list = el('<div class="cv-layer-list cv-lp-list" role="tree" aria-label="Layers"></div>');
  private readonly rows = el('<div class="cv-lp-rows"></div>');
  private readonly line = el('<div class="cv-drop-line"></div>');
  private readonly count = el('<span class="cv-lp-count"></span>');
  private readonly open = new Set<string>();
  private readonly shut = new Set<string>();
  private frame = 0;
  private drag: { ids: string[]; y0: number; moving: boolean; target: { id: string; where: 'above' | 'below' | 'inside' } | null } | null = null;

  constructor(private readonly engine: Engine, private readonly menu: PopupMenu) {
    const search = el('<div class="cv-lp-search"><input class="cv-input" type="search" placeholder="Search layers" aria-label="Search layers"></div>');
    this.list.append(this.rows, this.line);
    const foot = el('<div class="cv-panel-foot cv-lp-foot"></div>');
    foot.appendChild(this.count);
    const mk = (name: string, label: string, run: () => void): void => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', run); foot.appendChild(b); };
    mk('search', 'Locate Object', () => this.locate());
    mk('clipMask', 'Make or Release Clipping Mask for the active layer', () => this.toggleLayerClip());
    mk('folder', 'Create New Sublayer', () => engine.addLayer(undefined, { sublayerOf: engine.activeLayer }));
    mk('add', 'Create New Layer', () => engine.addLayer(undefined, { above: engine.activeLayer || undefined }));
    mk('delete', 'Delete Selection', () => this.deleteSelected());
    this.body.append(search, this.list, foot);
    const input = q<HTMLInputElement>(search, 'input');
    input.addEventListener('keydown', (e) => e.stopPropagation());
    input.addEventListener('input', () => { this.filter = input.value.trim().toLowerCase(); this.sync(); });
    this.bind();
    for (const k of ['doc', 'selection', 'active', 'projects'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private filter = '';

  restyle(): void { this.queue(); }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private isOpen(n: VNode): boolean { return n.kind === 'layer' ? !this.shut.has(n.id) : this.open.has(n.id); }

  private flat(): Row[] {
    const doc = this.engine.doc;
    if (!doc) return [];
    const out: Row[] = [];
    const walk = (nodes: VNode[], depth: number, layer: LayerNode | null): void => {
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i], l = n.kind === 'layer' ? n : (layer as LayerNode);
        const kids = n.kind === 'compound' ? null : childrenOf(n), open = !!kids && (this.isOpen(n) || (!!this.filter && kids.length > 0));
        const name = nodeLabel(n).toLowerCase();
        if (!this.filter || name.includes(this.filter) || n.kind === 'layer') out.push({ node: n, depth, layer: l, container: !!kids && kids.length > 0, open });
        if (kids && open) walk(kids, depth + 1, l);
      }
    };
    walk(doc.layers, 0, null);
    return out;
  }

  private sync(): void {
    const p = this.engine.current;
    const sel = new Set(p?.selection ?? []);
    const anc = new Set<string>();
    if (p) for (const id of sel) for (const a of ancestors(p.doc, id)) anc.add(a.id);
    const rows = this.flat();
    patchList<Row>(this.rows, rows, {
      key: (r) => r.node.id,
      create: (r) => { const n = el(`<div class="cv-lrow" role="treeitem"><button class="cv-lrow-eye" type="button" aria-label="Toggle visibility"></button><button class="cv-lrow-lock" type="button" aria-label="Toggle lock"></button><span class="cv-lrow-indent"></span><button class="cv-lrow-disc" type="button" aria-label="Expand or collapse"></button><span class="cv-lrow-kind"></span><span class="cv-lrow-name"></span><button class="cv-lrow-target" type="button" aria-label="Select"></button><span class="cv-lrow-sel"></span></div>`); this.fill(n, r, sel, anc); return n; },
      update: (n, r) => this.fill(n, r, sel, anc),
    });
    const layers = p?.doc.layers.length ?? 0;
    setText(this.count, p ? `${layers} Layer${layers === 1 ? '' : 's'}` : '');
  }

  private fill(n: HTMLElement, r: Row, sel: Set<string>, anc: Set<string>): void {
    const node = r.node, isLayer = node.kind === 'layer', p = this.engine.current;
    setStyleVar(n, '--depth', String(r.depth));
    setStyleVar(n, '--lc', r.layer?.color ?? '#4f80ff');
    setHtml(q(n, '.cv-lrow-eye'), icon(node.hidden ? 'eyeOff' : 'eye', 14), node.hidden ? 'off' : 'on');
    setHtml(q(n, '.cv-lrow-lock'), node.locked ? icon('lock', 12) : '', node.locked ? 'l' : 'u');
    setHtml(q(n, '.cv-lrow-disc'), r.container ? icon(r.open ? 'chevronDown' : 'chevronRight', 12) : '', `${r.container}:${r.open}`);
    setHtml(q(n, '.cv-lrow-kind'), isLayer ? '' : icon(KIND_ICON[node.kind] ?? 'vPen', 14), isLayer ? 'L' : node.kind);
    setText(q(n, '.cv-lrow-name'), nodeLabel(node));
    setClass(n, 'is-layer', isLayer);
    setClass(n, 'is-hidden', !!node.hidden);
    setClass(n, 'is-locked', !!node.locked);
    setClass(n, 'is-selected', sel.has(node.id));
    setClass(n, 'has-selected', anc.has(node.id));
    setClass(n, 'is-active', isLayer && p?.activeLayer === node.id);
    setClass(n, 'is-template', isLayer && !!(node as LayerNode).template);
    setClass(n, 'has-appearance', isLayer ? node.ap.effects.length > 0 || node.ap.items.length > 0 || node.blend !== 'normal' : node.ap.effects.length > 0 || node.ap.items.length > 2 || node.opacity < 1 || node.blend !== 'normal');
    setClass(n, 'is-targeted', isLayer && p?.layerTarget === node.id);
    const tb = q(n, '.cv-lrow-target'), tl = isLayer ? 'Target the layer for its appearance' : 'Select';
    if (tb.getAttribute('aria-label') !== tl) { tb.setAttribute('aria-label', tl); setTitle(tb, tl); }
    setClass(n, 'is-clip', (node.kind === 'group' || node.kind === 'layer') && !!(node as { clip?: boolean }).clip);
    n.setAttribute('aria-level', String(r.depth + 1));
    n.setAttribute('aria-selected', String(sel.has(node.id)));
    if (r.container) n.setAttribute('aria-expanded', String(r.open)); else n.removeAttribute('aria-expanded');
    setTitle(n, `${nodeLabel(node)}${node.kind !== 'layer' ? ` · ${node.kind}` : ''}`);
  }

  private nodeOf(el0: Element | null): VNode | null {
    const row = el0?.closest<HTMLElement>('.cv-lrow');
    const id = row?.dataset.key;
    return id && this.engine.doc ? findNode(this.engine.doc, id) : null;
  }

  private bind(): void {
    const e = this.engine;
    this.rows.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement, n = this.nodeOf(t);
      if (!n) return;
      if (t.closest('.cv-lrow-eye')) { if (ev.altKey) this.solo(n); else if (n.kind === 'layer') e.setLayer(n.id, { hidden: !n.hidden }); else e.setObjectProps({ hidden: !n.hidden }, [n.id]); return; }
      if (t.closest('.cv-lrow-lock')) { if (n.kind === 'layer') e.setLayer(n.id, { locked: !n.locked }); else e.setObjectProps({ locked: !n.locked }, [n.id]); return; }
      if (t.closest('.cv-lrow-disc')) { this.toggleOpen(n, ev.altKey); return; }
      if (t.closest('.cv-lrow-target') && n.kind === 'layer' && !(ev.shiftKey || ev.metaKey || ev.ctrlKey)) { e.targetLayer(n.id); return; }
      if (t.closest('.cv-lrow-target') || t.closest('.cv-lrow-sel')) { this.selectNode(n, ev.shiftKey || ev.metaKey || ev.ctrlKey); return; }
      if (n.kind === 'layer') { e.setActiveLayer(n.id); this.sync(); if (ev.shiftKey || ev.metaKey || ev.ctrlKey) this.selectNode(n, true); return; }
      this.selectNode(n, ev.shiftKey || ev.metaKey || ev.ctrlKey);
    });
    this.rows.addEventListener('dblclick', (ev) => {
      const t = ev.target as HTMLElement, n = this.nodeOf(t);
      if (!n || t.closest('button')) return;
      if (n.kind === 'layer') void this.layerOptions(n);
      else this.rename(n, t.closest('.cv-lrow') as HTMLElement);
    });
    this.rows.addEventListener('contextmenu', (ev) => {
      const n = this.nodeOf(ev.target as HTMLElement);
      if (!n) return;
      ev.preventDefault();
      if (n.kind !== 'layer' && !e.current?.selection.has(n.id)) e.select([n.id]);
      if (n.kind === 'layer') e.setActiveLayer(n.id);
      this.menu.openAt(ev.clientX, ev.clientY);
    });
    this.rows.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0 || (ev.target as HTMLElement).closest('button, input')) return;
      const n = this.nodeOf(ev.target as HTMLElement);
      if (!n) return;
      const ids = n.kind === 'layer' ? [n.id] : e.current?.selection.has(n.id) ? e.targetIds() : [n.id];
      this.drag = { ids, y0: ev.clientY, moving: false, target: null };
      this.rows.setPointerCapture(ev.pointerId);
    });
    this.rows.addEventListener('pointermove', (ev) => {
      const d = this.drag;
      if (!d) return;
      if (!d.moving && Math.abs(ev.clientY - d.y0) < 5) return;
      d.moving = true;
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('.cv-lrow');
      if (!hit || !hit.dataset.key || d.ids.includes(hit.dataset.key)) { d.target = null; this.line.classList.remove('is-shown'); return; }
      const tn = findNode(e.doc as never, hit.dataset.key) as VNode | null;
      if (!tn) return;
      const r = hit.getBoundingClientRect(), y = (ev.clientY - r.top) / r.height, container = isContainer(tn) && tn.kind !== 'compound';
      const where = container && y > 0.3 && y < 0.7 ? 'inside' : y < 0.5 ? 'above' : 'below';
      const draggingLayers = d.ids.every((id) => findNode(e.doc as never, id)?.kind === 'layer');
      if (draggingLayers && tn.kind !== 'layer') { d.target = null; this.line.classList.remove('is-shown'); return; }
      d.target = { id: tn.id, where };
      const lr = this.list.getBoundingClientRect();
      this.line.style.top = `${Math.round((where === 'below' ? r.bottom : r.top) - lr.top + this.list.scrollTop - (where === 'inside' ? 0 : 1))}px`;
      this.line.classList.add('is-shown');
      this.line.classList.toggle('is-inside', where === 'inside');
    });
    const end = (): void => {
      const d = this.drag;
      this.drag = null;
      this.line.classList.remove('is-shown', 'is-inside');
      if (!d || !d.moving || !d.target) return;
      e.moveRelative(d.ids, d.target.id, d.target.where);
    };
    this.rows.addEventListener('pointerup', end);
    this.rows.addEventListener('pointercancel', () => { this.drag = null; this.line.classList.remove('is-shown'); });
  }

  private solo(n: VNode): void {
    const doc = this.engine.doc;
    if (!doc || n.kind !== 'layer') return;
    const others = doc.layers.filter((l) => l.id !== n.id), anyShown = others.some((l) => !l.hidden);
    this.engine.beginGesture();
    for (const l of others) this.engine.setLayer(l.id, { hidden: anyShown });
    this.engine.endGesture();
  }

  private toggleOpen(n: VNode, deep: boolean): void {
    const set = (x: VNode, on: boolean): void => {
      if (x.kind === 'layer') { if (on) this.shut.delete(x.id); else this.shut.add(x.id); } else if (on) this.open.add(x.id); else this.open.delete(x.id);
      if (deep) for (const c of childrenOf(x) ?? []) if (isContainer(c)) set(c, on);
    };
    set(n, !this.isOpen(n));
    this.sync();
  }

  private selectNode(n: VNode, add: boolean): void {
    const e = this.engine;
    if (n.kind === 'layer') { const ids = n.children.filter((c) => !c.locked && !c.hidden).map((c) => c.id); e.select(ids, add ? 'add' : 'replace'); e.setActiveLayer(n.id); return; }
    e.select([n.id], add ? 'toggle' : 'replace');
  }

  private rename(n: VNode, row: HTMLElement): void {
    const name = q(row, '.cv-lrow-name');
    const input = el<HTMLInputElement>('<input class="cv-layer-rename" type="text">');
    input.value = n.name ?? nodeLabel(n);
    name.replaceChildren(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (ok: boolean): void => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      name.textContent = nodeLabel(n);
      if (ok && v && v !== n.name) { if (n.kind === 'layer') this.engine.setLayer(n.id, { name: v }); else this.engine.setObjectProps({ name: v }, [n.id]); }
    };
    input.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') finish(true); if (ev.key === 'Escape') finish(false); });
    input.addEventListener('blur', () => finish(true));
  }

  async layerOptions(l: LayerNode): Promise<void> {
    const v = await askForm('Layer Options', [
      { kind: 'text', key: 'name', label: 'Name', value: l.name ?? 'Layer' },
      { kind: 'select', key: 'color', label: 'Color', value: LAYER_COLORS.includes(l.color) ? l.color : 'custom', choices: [...LAYER_COLORS.map((c, i) => [c, ['Light Blue', 'Red', 'Green', 'Blue', 'Yellow', 'Magenta', 'Cyan', 'Gray', 'Orange', 'Teal', 'Violet', 'Tan'][i] ?? c] as const), ['custom', 'Custom']] },
      { kind: 'color', key: 'custom', label: 'Custom color', value: l.color },
      { kind: 'check', key: 'template', label: 'Template', value: !!l.template },
      { kind: 'check', key: 'show', label: 'Show', value: !l.hidden },
      { kind: 'check', key: 'lock', label: 'Lock', value: !!l.locked },
      { kind: 'check', key: 'print', label: 'Print', value: l.printable !== false },
      { kind: 'number', key: 'dim', label: 'Dim images to', value: Math.round(l.opacity * 100), min: 0, max: 100, unit: '%' },
    ]);
    if (!v) return;
    this.engine.setLayer(l.id, { name: String(v.name) || l.name, color: v.color === 'custom' ? String(v.custom) : String(v.color), template: !!v.template, hidden: !v.show, locked: !!v.lock, printable: !!v.print, opacity: Number(v.dim) / 100 });
  }

  private locate(): void {
    const e = this.engine, p = e.current;
    if (!p) return;
    for (const id of p.selection) for (const a of ancestors(p.doc, id)) { if (a.kind === 'layer') this.shut.delete(a.id); else this.open.add(a.id); }
    this.sync();
    const first = [...p.selection][0];
    if (first) (this.rows.querySelector(`[data-key="${CSS.escape(first)}"]`) as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
  }

  private toggleLayerClip(): void {
    const e = this.engine, l = e.doc ? findNode(e.doc, e.activeLayer) : null;
    if (!l || l.kind !== 'layer') return;
    e.edit(l.clip ? 'Release Layer Clipping Mask' : 'Make Layer Clipping Mask', (d) => ({ ...d, layers: d.layers.map((x) => (x.id === l.id ? { ...x, clip: !x.clip } : x)) }));
  }

  private deleteSelected(): void {
    const e = this.engine;
    if (e.hasSelection) e.deleteSelection();
    else if (e.activeLayer) e.deleteLayer(e.activeLayer);
  }
}

import { cssColor, resolvePaint } from '../engine/paint';
import type { Engine, Paint } from '../engine';
import type { Tool } from '../extensions/registry';
import { el, q, setClass, setHidden, setHtml, setStyleVar, setText, setTitle } from './dom';
import { Dialog } from './dialogs';
import { icon } from './icons';
import { patternThumb } from './pattern-thumb';
import { rememberTool, slotTool, toolGroups, type ToolGroup } from './tool-groups';

export function paintCss(p: Paint, engine?: Engine): string {
  const pp = engine?.doc ? resolvePaint(engine.doc, p) : p;
  if (pp.type === 'none') return 'linear-gradient(to top right, #fff calc(50% - 1px), #e03030 calc(50% - 1px), #e03030 calc(50% + 1px), #fff calc(50% + 1px))';
  if (pp.type === 'color') return cssColor(pp.color);
  if (pp.type === 'gradient' && pp.gradient.kind === 'freeform') {
    const pts = pp.gradient.points ?? [];
    if (!pts.length) return 'conic-gradient(from 30deg, #ffc400, #ff4081, #4078ff, #00c8aa, #ffc400)';
    const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y), x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(1, Math.max(...xs) - x0), h = Math.max(1, Math.max(...ys) - y0);
    return [...pts.map((q) => `radial-gradient(circle at ${Math.round(((q.x - x0) / w) * 80 + 10)}% ${Math.round(((q.y - y0) / h) * 80 + 10)}%, ${cssColor(q.color)}, transparent 70%)`), cssColor(pts[0].color)].join(', ');
  }
  if (pp.type === 'gradient') {
    const stops = [...pp.gradient.stops].sort((a, b) => a.offset - b.offset).map((s) => `${cssColor(s.color, s.opacity)} ${Math.round(s.offset * 100)}%`).join(', ');
    return pp.gradient.kind === 'radial' ? `radial-gradient(circle, ${stops})` : `linear-gradient(${90 - pp.gradient.angle}deg, ${stops})`;
  }
  if (pp.type === 'pattern' && engine) { const t = patternThumb(engine, pp.pattern); if (t) return t; }
  return 'repeating-conic-gradient(#999 0% 25%, #ddd 0% 50%) 50% / 8px 8px';
}

export class Rail {
  private readonly slots: Array<{ group: ToolGroup; node: HTMLButtonElement }> = [];
  private readonly flyout: HTMLElement;
  private readonly fill: HTMLButtonElement;
  private readonly stroke: HTMLButtonElement;
  private readonly modeBtn: HTMLButtonElement;
  private suppressClick = false;
  private box: HTMLElement;
  private hidden = new Set<string>((() => { try { const v = JSON.parse(localStorage.getItem('formpth.railHidden') ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; } })());
  private editor: EditToolbar | null = null;

  constructor(root: HTMLElement, private readonly engine: Engine) {
    const box = q(root, '.cv-rail-tools');
    this.box = box;
    this.flyout = el('<div class="cv-flyout" role="menu" hidden></div>');
    document.getElementById('overlay-root')?.appendChild(this.flyout);
    const family = (order: number): number => (order < 20 ? 0 : order < 40 ? 1 : order < 50 ? 2 : order < 70 ? 3 : order < 85 ? 4 : 5);
    let lastFamily = -1;
    for (const group of toolGroups()) {
      const fam = family(group.tools[0].order);
      if (lastFamily !== -1 && fam !== lastFamily) box.appendChild(el('<span class="cv-rail-sep" aria-hidden="true"></span>'));
      lastFamily = fam;
      const many = group.tools.length > 1;
      const b = el<HTMLButtonElement>(`<button class="cv-tool${many ? ' has-group' : ''}" type="button" aria-haspopup="${many ? 'menu' : 'false'}"></button>`);
      b.addEventListener('click', () => { if (!this.suppressClick) engine.setTool(slotTool(group, engine.tool).id); this.suppressClick = false; });
      if (many) {
        let hold = 0;
        b.addEventListener('pointerdown', (e) => { if (e.button === 0) hold = window.setTimeout(() => { this.suppressClick = true; this.openFlyout(group, b); }, 350); });
        for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => window.clearTimeout(hold));
        b.addEventListener('contextmenu', (e) => { e.preventDefault(); this.openFlyout(group, b); });
      }
      box.appendChild(b);
      this.slots.push({ group, node: b });
    }
    const more = el<HTMLButtonElement>(`<button class="cv-tool cv-rail-more" type="button" title="More tools and Edit Toolbar" aria-label="More tools">${icon('more3', 18)}</button>`);
    more.addEventListener('click', () => this.openMore(more));
    box.appendChild(more);
    this.applyHidden();
    document.addEventListener('pointerdown', (e) => { if (!this.flyout.hidden && !this.flyout.contains(e.target as Node)) this.closeFlyout(); }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !this.flyout.hidden) { e.preventDefault(); this.closeFlyout(); } }, true);

    const colors = q(root, '.cv-colors');
    colors.classList.add('cv-fs');
    colors.insertAdjacentHTML('beforeend',
      '<button class="cv-fs-slot cv-fs-fill" type="button" title="Fill (double-click to choose a color)" aria-label="Fill"><span class="cv-fs-paint"></span></button>' +
      '<button class="cv-fs-slot cv-fs-stroke" type="button" title="Stroke (double-click to choose a color)" aria-label="Stroke"><span class="cv-fs-paint"></span><span class="cv-fs-hole"></span></button>' +
      `<button class="cv-fs-swap" type="button" title="Swap Fill and Stroke (Shift+X)" aria-label="Swap Fill and Stroke">${icon('fillStrokeSwap', 12)}</button>` +
      `<button class="cv-fs-default" type="button" title="Default Fill and Stroke (D)" aria-label="Default Fill and Stroke">${icon('fillStrokeDefault', 12)}</button>`);
    const kinds = el(`<div class="cv-fs-kinds" role="group" aria-label="Paint">
      <button type="button" data-kind="color" title="Color (,)" aria-label="Color">${icon('paintColor', 14)}</button>
      <button type="button" data-kind="gradient" title="Gradient (.)" aria-label="Gradient">${icon('paintGradient', 14)}</button>
      <button type="button" data-kind="none" title="None (/)" aria-label="None">${icon('paintNone', 14)}</button></div>`);
    colors.after(kinds);
    this.fill = q<HTMLButtonElement>(colors, '.cv-fs-fill');
    this.stroke = q<HTMLButtonElement>(colors, '.cv-fs-stroke');
    this.fill.addEventListener('click', () => engine.setActiveSlot('fill'));
    this.stroke.addEventListener('click', () => engine.setActiveSlot('stroke'));
    for (const [b, slot] of [[this.fill, 'fill'], [this.stroke, 'stroke']] as const) b.addEventListener('dblclick', () => b.dispatchEvent(new CustomEvent('cv-pick-color', { bubbles: true, detail: slot })));
    q(colors, '.cv-fs-swap').addEventListener('click', () => engine.swapFillStroke());
    q(colors, '.cv-fs-default').addEventListener('click', () => engine.defaultFillStroke());
    kinds.addEventListener('click', (e) => {
      const k = (e.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.kind;
      if (k) kinds.dispatchEvent(new CustomEvent('cv-paint-kind', { bubbles: true, detail: k }));
    });
    this.modeBtn = q<HTMLButtonElement>(root, '[data-cmd="draw-mode"]');
    engine.on('tool', () => this.sync());
    engine.on('options', () => { this.sync(); this.syncColors(); });
    engine.on('colors', () => this.syncColors());
    engine.on('selection', () => this.syncColors());
    this.sync();
    this.syncColors();
  }

  private applyHidden(): void {
    for (const { group, node } of this.slots) setHidden(node, this.hidden.has(group.key));
    let prevTool = false, pending: HTMLElement | null = null;
    for (const child of Array.from(this.box.children) as HTMLElement[]) {
      if (child.classList.contains('cv-rail-sep')) { setHidden(child, true); if (prevTool) pending = child; prevTool = false; continue; }
      if (child.classList.contains('cv-rail-more') || child.hidden) continue;
      if (pending) { setHidden(pending, false); pending = null; }
      prevTool = true;
    }
  }

  setHiddenGroups(keys: Iterable<string>): void {
    this.hidden = new Set(keys);
    try { localStorage.setItem('formpth.railHidden', JSON.stringify([...this.hidden])); } catch { }
    this.applyHidden();
  }

  private row(iconName: string, label: string, key: string, active: boolean, pick: () => void): void {
    const r = el<HTMLButtonElement>(`<button class="cv-flyout-item" role="menuitem" type="button">${icon(iconName, 18)}<span class="cv-flyout-label"></span><span class="cv-flyout-key"></span></button>`);
    setText(q(r, '.cv-flyout-label'), label);
    setText(q(r, '.cv-flyout-key'), key);
    setClass(r, 'is-active', active);
    r.addEventListener('click', () => { this.closeFlyout(); pick(); });
    this.flyout.appendChild(r);
  }

  private place(anchor: HTMLElement): void {
    const r = anchor.getBoundingClientRect();
    this.flyout.style.visibility = 'hidden';
    this.flyout.hidden = false;
    const h = this.flyout.offsetHeight;
    this.flyout.style.left = `${Math.round(r.right + 4)}px`;
    this.flyout.style.top = `${Math.round(Math.max(4, Math.min(r.top, window.innerHeight - h - 4)))}px`;
    this.flyout.style.visibility = '';
  }

  private openMore(anchor: HTMLElement): void {
    this.flyout.textContent = '';
    for (const { group } of this.slots.filter((s) => this.hidden.has(s.group.key))) for (const t of group.tools) this.row(t.icon(this.engine), t.label, t.shortcut ?? '', false, () => this.engine.setTool(t.id));
    if (this.flyout.childElementCount) this.flyout.appendChild(el('<div class="cv-menu-sep"></div>'));
    this.row('sliders', 'Edit Toolbar...', '', false, () => { this.editor ??= new EditToolbar(); this.editor.show(this.slots.map((s) => s.group), this.hidden, (keys) => this.setHiddenGroups(keys)); });
    this.place(anchor);
  }

  private openFlyout(group: ToolGroup, slot: HTMLElement): void {
    this.flyout.textContent = '';
    for (const t of group.tools) this.row(t.icon(this.engine), t.label, t.shortcut ?? '', this.engine.tool === t.id, () => this.engine.setTool(t.id));
    this.place(slot);
  }

  private closeFlyout(): void { this.flyout.hidden = true; }

  private sync(): void {
    rememberTool(this.engine);
    for (const { group, node } of this.slots) {
      const t: Tool = slotTool(group, this.engine.tool), key = t.icon(this.engine);
      setHtml(node, icon(key, 20), `${t.id}:${key}`);
      node.setAttribute('aria-label', t.label);
      const own = t.shortcut ? ` (${t.shortcut})` : '';
      setTitle(node, group.tools.length > 1 ? `${t.label}${own} · hold or right-click for more tools` : `${t.label}${own}`);
      setClass(node, 'is-active', group.tools.some((x) => x.id === this.engine.tool));
    }
    const mode = this.engine.options.shapeMode;
    if (this.modeBtn) {
      setHtml(this.modeBtn, icon(mode === 'behind' ? 'pTransparency' : mode === 'inside' ? 'clipMask' : 'pAppearance', 18), mode);
      setTitle(this.modeBtn, `Drawing mode: ${mode === 'normal' ? 'Draw Normal' : mode === 'behind' ? 'Draw Behind' : 'Draw Inside'} (Shift+D cycles)`);
      setClass(this.modeBtn, 'is-on', mode !== 'normal');
    }
  }

  private syncColors(): void {
    const e = this.engine;
    setStyleVar(q(this.fill, '.cv-fs-paint'), '--paint', paintCss(e.fillPaint, e));
    setStyleVar(q(this.stroke, '.cv-fs-paint'), '--paint', paintCss(e.strokePaint, e));
    setClass(this.fill, 'is-front', e.activeSlot === 'fill');
    setClass(this.stroke, 'is-front', e.activeSlot === 'stroke');
    const kinds = this.fill.parentElement?.nextElementSibling;
    const cur = e.activeSlot === 'fill' ? e.fillPaint : e.strokePaint;
    if (kinds) for (const b of Array.from(kinds.querySelectorAll<HTMLButtonElement>('button'))) setClass(b, 'is-on', b.dataset.kind === (cur.type === 'pattern' ? 'color' : cur.type));
  }
}

class EditToolbar extends Dialog {
  private readonly list = el('<div class="cv-edit-toolbar"></div>');
  private onChange: ((keys: Set<string>) => void) | null = null;
  constructor() {
    super('Edit Toolbar', 420);
    this.body.append(el('<p class="cv-note">Tools you hide stay one click away in the toolbar\'s ••• list.</p>'), this.list);
    this.button('Done', 'primary', () => this.close());
  }
  show(groups: ToolGroup[], hidden: Set<string>, onChange: (keys: Set<string>) => void): void {
    this.onChange = onChange;
    this.list.textContent = '';
    const now = new Set(hidden);
    for (const g of groups) {
      const r = el('<label class="cv-edit-tool"><input type="checkbox"><span class="cv-edit-tool-name"></span><span class="cv-flyout-key"></span></label>');
      const box = r.querySelector('input') as HTMLInputElement;
      box.checked = !now.has(g.key);
      setText(r.querySelector('.cv-edit-tool-name') as HTMLElement, g.tools.map((t) => t.label.replace(/ Tool$/, '')).join(', '));
      setText(r.querySelector('.cv-flyout-key') as HTMLElement, g.tools[0].shortcut ?? '');
      box.addEventListener('change', () => { if (box.checked) now.delete(g.key); else now.add(g.key); this.onChange?.(new Set(now)); });
      this.list.appendChild(r);
    }
    this.open();
  }
}

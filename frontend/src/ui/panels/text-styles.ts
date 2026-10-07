import type { Engine, TextNode } from '../../engine';
import { charOverridden, paraOverridden, type TextStyleKind } from '../../engine/ops/text-styles';
import { styleAt } from '../../engine/text';
import { el, patchList, q, setClass, setHidden, setText } from '../dom';
import { askForm } from '../form-dialog';
import { icon } from '../icons';
import { typing } from '../text-editor';

interface Row { id: string; name: string }

export class TextStylesPanel {
  readonly body = el('<div class="cv-kit-page cv-tsp"></div>');
  private readonly list = el('<div class="cv-tsp-list" role="listbox"></div>');
  private frame = 0;

  constructor(private readonly engine: Engine, private readonly kind: TextStyleKind) {
    const noun = kind === 'char' ? 'Character Style' : 'Paragraph Style';
    this.list.setAttribute('aria-label', `${noun}s`);
    const foot = el('<div class="cv-panel-foot"></div>');
    const mk = (name: string, label: string, run: () => void): void => { const b = el<HTMLButtonElement>(`<button class="cv-icon-btn" type="button" title="${label}" aria-label="${label}">${icon(name, 16)}</button>`); b.addEventListener('click', run); foot.appendChild(b); };
    mk('refresh', `Redefine ${noun} from the selected type`, () => { const id = this.current(); if (id) engine.redefineTextStyle(kind, id, typing.editor?.range() ?? undefined); });
    mk('add', `New ${noun} from the selected type`, () => void this.create(noun));
    mk('delete', `Delete ${noun}`, () => { const id = this.current(); if (id) engine.deleteTextStyle(kind, id); });
    this.list.addEventListener('click', (e) => {
      const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-tsp-row');
      if (!r) return;
      const id = r.dataset.style || null, ed = typing.editor, n = ed?.node();
      if (n) engine.applyTextStyle(kind, id, [n.id], kind === 'char' ? ed?.range() ?? undefined : undefined);
      else if (!engine.applyTextStyle(kind, id)) engine.notice(`Select type, or click into it, to apply a ${noun.toLowerCase()}.`);
    });
    this.list.addEventListener('dblclick', (e) => {
      const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-tsp-row'), id = r?.dataset.style;
      if (!id) return;
      const def = this.defs().find((d) => d.id === id);
      void askForm(`${noun} Options`, [{ kind: 'text', key: 'name', label: 'Style name', value: def?.name ?? '' }], { ok: 'OK' }).then((v) => { if (v && String(v.name).trim()) engine.renameTextStyle(kind, id, String(v.name).trim()); });
    });
    this.body.append(this.list, foot);
    for (const k of ['doc', 'selection', 'active'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private async create(noun: string): Promise<void> {
    const v = await askForm(`New ${noun}`, [{ kind: 'text', key: 'name', label: 'Style name', value: `${noun} ${this.defs().length + 1}` }], { ok: 'Add' });
    if (!v || !String(v.name).trim()) return;
    const id = this.engine.addTextStyle(this.kind, String(v.name).trim());
    const n = typing.editor?.node() ?? this.text();
    if (id && n) this.engine.applyTextStyle(this.kind, id, [n.id]);
  }

  private defs(): Row[] { const d = this.engine.doc; return d ? (this.kind === 'char' ? d.charStyles : d.paraStyles) : []; }
  private text(): TextNode | null { return typing.editor?.node() ?? this.engine.selected().find((n): n is TextNode => n.kind === 'text') ?? null; }
  private current(): string | null {
    const t = this.text();
    if (!t) return null;
    if (this.kind === 'para') return t.para.ps ?? null;
    const ed = typing.editor, at = ed?.node() ? Math.min(ed.caret, ed.anchor) : 0;
    return styleAt(t.spans, at).cs ?? null;
  }
  private overridden(id: string): boolean {
    const t = this.text(), d = this.engine.doc;
    if (!t || !d) return false;
    if (this.kind === 'para') { const def = d.paraStyles.find((s) => s.id === id); return !!def && paraOverridden(def, t); }
    const def = d.charStyles.find((s) => s.id === id), ed = typing.editor;
    return !!def && charOverridden(def, styleAt(t.spans, ed?.node() ? Math.min(ed.caret, ed.anchor) : 0));
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const cur = this.text() ? this.current() ?? '' : null;
    const rows: Row[] = [{ id: '', name: this.kind === 'char' ? '[Normal Character Style]' : '[Normal Paragraph Style]' }, ...this.defs()];
    patchList<Row>(this.list, rows, {
      key: (r) => r.id || 'normal',
      create: (r) => { const n = el('<div class="cv-tsp-row" role="option"><span class="cv-tsp-name"></span><span class="cv-tsp-plus" aria-label="has overrides">+</span></div>'); n.dataset.style = r.id; this.fill(n, r, cur); return n; },
      update: (n, r) => this.fill(n, r, cur),
    });
  }

  private fill(n: HTMLElement, r: Row, cur: string | null): void {
    setText(q(n, '.cv-tsp-name'), r.name);
    const on = cur !== null && cur === r.id;
    setClass(n, 'is-active', on);
    n.setAttribute('aria-selected', String(on));
    setHidden(q(n, '.cv-tsp-plus'), !(on && r.id && this.overridden(r.id)));
  }
}

import type { Engine, FillRule } from '../../engine';
import { el, setDisabled, setText, setValue } from '../dom';
import { iconButton, row, section, seg } from './kit';

const RULE_LABEL: Record<string, string> = { nonzero: 'Non-Zero Winding', evenodd: 'Even-Odd', mixed: 'Mixed', '': '' };

export class AttributesPanel {
  readonly body = el('<div class="cv-kit-page cv-attrp"></div>');
  private readonly rule;
  private readonly ruleName = el('<span class="cv-attrp-rule-name"></span>');
  private readonly reverse: HTMLButtonElement;
  private readonly note = el<HTMLTextAreaElement>('<textarea class="cv-input cv-attrp-note" rows="3" spellcheck="false" aria-label="Note" placeholder="A note kept with the object"></textarea>');
  private frame = 0;

  constructor(private readonly engine: Engine) {
    this.rule = seg([{ id: 'nonzero', label: 'Use Non-Zero Winding Fill Rule', icon: 'fillNonZero' }, { id: 'evenodd', label: 'Use Even-Odd Fill Rule', icon: 'fillEvenOdd' }], (v) => engine.setFillRule(v as FillRule), 'cv-attrp-rule');
    this.reverse = iconButton('reversePath', 'Reverse Path Direction', () => engine.pathOp('reverse'));
    this.note.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { this.note.blur(); this.sync(); } });
    this.note.addEventListener('change', () => { const v = this.note.value.trim(); engine.setObjectProps({ note: v || undefined }); });
    this.body.append(section('Fill Rule'), row(this.rule.el, this.ruleName, this.reverse), section('Note'), this.note);
    for (const k of ['selection', 'doc', 'active'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private sync(): void {
    const e = this.engine, rule = e.fillRuleOf(), sel = e.selected();
    this.rule.set(rule === 'nonzero' || rule === 'evenodd' ? rule : '');
    this.rule.enable(!!rule);
    setText(this.ruleName, RULE_LABEL[rule ?? '']);
    setDisabled(this.reverse, !rule);
    setDisabled(this.note, !sel.length);
    if (document.activeElement === this.note) return;
    const notes = new Set(sel.map((n) => n.note ?? ''));
    setValue(this.note, notes.size === 1 ? [...notes][0] : '');
    const hint = notes.size > 1 ? 'Mixed notes' : 'A note kept with the object';
    if (this.note.placeholder !== hint) this.note.placeholder = hint;
  }
}

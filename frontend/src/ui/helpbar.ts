import type { Engine } from '../engine';
import { getTool } from '../extensions/registry';
import { formatKeys } from './commands';
import { q, setHidden, setText } from './dom';

export class HelpBar {
  private frame = 0;
  private readonly name: HTMLElement;
  private readonly key: HTMLElement;
  private readonly text: HTMLElement;

  constructor(private readonly root: HTMLElement, private readonly engine: Engine) {
    this.name = q(root, '.fp-help-name');
    this.key = q(root, '.fp-help-key');
    this.text = q(root, '.fp-help-text');
    for (const k of ['tool', 'selection', 'options', 'active', 'doc'] as const) engine.on(k, () => this.schedule());
    this.update();
  }

  private schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.update(); });
  }

  update(): void {
    const t = getTool(this.engine.tool);
    setText(this.name, t?.label ?? '');
    setText(this.key, t?.shortcut ? formatKeys(t.shortcut) : '');
    setHidden(this.key, !t?.shortcut);
    setText(this.text, t ? t.hint(this.engine) : '');
  }
}

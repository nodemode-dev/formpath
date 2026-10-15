import { documentInfo, documentInfoText, type Engine } from '../../engine';
import { Dialog } from '../dialogs';
import { el, q, setText } from '../dom';

export class DocumentInfoDialog extends Dialog {
  private readonly text = el('<pre class="cv-docinfo" tabindex="0" aria-label="Document Info"></pre>');
  private frame = 0;

  constructor(private readonly engine: Engine) {
    super('Document Info', 520);
    q(this.scrim, '.cv-dialog').classList.add('cv-docinfo-dialog');
    this.body.append(this.text);
    this.button('Done', 'primary', () => this.close());
    for (const k of ['doc', 'active', 'projects'] as const) engine.on(k, () => this.queue());
  }

  show(): void {
    this.sync();
    this.open(this.text);
  }

  private queue(): void {
    if (this.frame || !this.isOpen) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); });
  }

  private sync(): void {
    const d = this.engine.doc;
    setText(this.text, d ? documentInfoText(documentInfo(d)) : '');
  }
}

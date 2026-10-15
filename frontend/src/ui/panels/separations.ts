import type { Engine } from '../../engine';
import { Dialog } from '../dialogs';
import { el, patchList, q, setClass, setText } from '../dom';

interface Plate { key: string; label: string; value: string | null; spot: boolean }

export class SeparationsDialog extends Dialog {
  private readonly list = el('<div class="cv-tsp-list cv-ffd-list cv-sep-list" role="listbox" aria-label="Plates"></div>');
  private frame = 0;

  constructor(private readonly engine: Engine) {
    super('Separations Preview', 300);
    this.scrim.classList.add('cv-scrim-through', 'cv-rc-scrim');
    q(this.scrim, '.cv-dialog').classList.add('cv-rc-dialog');
    this.body.append(this.list);
    this.button('Done', 'primary', () => this.close());
    this.list.addEventListener('click', (e) => {
      const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-tsp-row');
      if (!r) return;
      const plate = this.plates().find((x) => x.key === r.dataset.key);
      if (plate) this.engine.setView({ separation: plate.value });
    });
    for (const k of ['doc', 'options', 'active', 'projects'] as const) engine.on(k, () => this.queue());
    this.onClose = () => { this.engine.setView({ separation: null }); this.queue(); };
  }

  show(): void {
    this.sync();
    this.open(this.list);
  }

  private plates(): Plate[] {
    const spots = (this.engine.doc?.swatches ?? []).filter((s) => s.spot);
    return [
      { key: 'all', label: 'All', value: null, spot: false },
      { key: 'C', label: 'Cyan', value: 'C', spot: false },
      { key: 'M', label: 'Magenta', value: 'M', spot: false },
      { key: 'Y', label: 'Yellow', value: 'Y', spot: false },
      { key: 'K', label: 'Black', value: 'K', spot: false },
      ...spots.map((s) => ({ key: `spot:${s.id}`, label: s.name, value: s.name, spot: true })),
    ];
  }

  private queue(): void {
    if (this.frame || !this.isOpen) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); });
  }

  private sync(): void {
    const cur = this.engine.view.separation;
    const fill = (node: HTMLElement, p: Plate): void => {
      const on = p.value === cur;
      setClass(node, 'is-active', on);
      node.setAttribute('aria-selected', String(on));
      setText(node.children[0], p.label);
      setText(node.children[1], p.spot ? 'Spot' : '');
    };
    patchList(this.list, this.plates(), {
      key: (p) => p.key,
      create: (p) => { const n = el('<div class="cv-tsp-row" role="option"><span class="cv-tsp-name"></span><span class="cv-ffd-count"></span></div>'); fill(n, p); return n; },
      update: fill,
    });
  }
}

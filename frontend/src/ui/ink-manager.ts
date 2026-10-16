import type { Engine } from '../engine';
import { inkRows, setInkAlias, setInkPrint, setInkProcess, spotSwatches, withInks, type InkRow } from '../engine/inks';
import { cssColor } from '../engine/paint';
import { Dialog } from './dialogs';
import { el, patchList, q, setChecked, setClass, setDisabled, setStyleVar, setText } from './dom';

const PROCESS_CHIP: Record<string, string> = { C: '#00aeef', M: '#ec008c', Y: '#fff200', K: '#231f20' };
const NO_ALIAS = '';

export class InkManagerDialog extends Dialog {
  private readonly all = el<HTMLInputElement>('<input type="checkbox">');
  private readonly head = el('<div class="cv-ink-row cv-ink-head"><span>Print</span><span>Ink</span><span>Type</span><span>To process</span><span>Alias</span></div>');
  private readonly list = el('<div class="cv-tsp-list cv-ffd-list cv-ink-list" role="list" aria-label="Inks"></div>');
  private readonly note = el('<p class="cv-note cv-ink-note">Inks turned off do not print or show as plates. Converting a spot ink to process prints it as its CMYK equivalent. An alias prints the ink on the plate of another spot ink.</p>');
  private frame = 0;
  private after: (() => void) | null = null;

  constructor(private readonly engine: Engine) {
    super('Ink Manager', 640);
    q<HTMLElement>(this.scrim, '.cv-dialog').classList.add('cv-ink-dialog');
    const allRow = el('<label class="cv-check cv-ink-all"><span>All Spots to Process</span></label>');
    allRow.prepend(this.all);
    this.body.append(allRow, this.head, this.list, this.note);
    this.button('Done', 'primary', () => this.close());
    this.all.addEventListener('change', () => { const on = this.all.checked; this.engine.edit('Ink Manager', (d) => withInks(d, { allSpotsToProcess: on })); });
    this.list.addEventListener('change', (e) => {
      const t = e.target as HTMLInputElement | HTMLSelectElement, node = t.closest<HTMLElement>('.cv-ink-row');
      const name = node?.dataset.key;
      if (!name) return;
      if (t.dataset.role === 'print') { const on = (t as HTMLInputElement).checked; this.engine.edit('Ink Manager', (d) => setInkPrint(d, name, on)); }
      else if (t.dataset.role === 'process') { const on = (t as HTMLInputElement).checked; this.engine.edit('Ink Manager', (d) => setInkProcess(d, name, on)); }
      else if (t.dataset.role === 'alias') { const to = (t as HTMLSelectElement).value; this.engine.edit('Ink Manager', (d) => setInkAlias(d, name, to === NO_ALIAS ? null : to)); }
    });
    engine.on('doc', () => this.queue());
    engine.on('active', () => this.queue());
    this.onClose = () => { const a = this.after; this.after = null; a?.(); };
    this.reserve();
  }

  show(after?: () => void): void {
    this.after = after ?? null;
    this.sync();
    this.open(this.all);
  }

  private reserve(): void {
    this.list.style.height = '248px';
  }

  private queue(): void {
    if (this.frame || !this.isOpen) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); });
  }

  private sync(): void {
    const doc = this.engine.doc;
    if (!doc) return;
    setChecked(this.all, !!doc.inks?.allSpotsToProcess);
    const chip = new Map(spotSwatches(doc).map((s) => [s.name, s.paint.type === 'color' ? cssColor(s.paint.color) : '#808080']));
    const fill = (node: HTMLElement, r: InkRow): void => {
      const kids = node.children;
      setChecked(kids[0] as HTMLInputElement, r.print);
      setStyleVar(kids[1].children[0] as HTMLElement, '--cv-ink', r.spot ? chip.get(r.name) ?? '#808080' : PROCESS_CHIP[r.name] ?? '#808080');
      setText(kids[1].children[1], r.label);
      setText(kids[2], !r.spot ? 'Process' : r.process ? 'Converted' : r.plate ? 'Spot' : 'Alias');
      const proc = kids[3] as HTMLInputElement, alias = kids[4] as HTMLSelectElement;
      setChecked(proc, r.spot && (r.process || !!doc.inks?.allSpotsToProcess));
      setDisabled(proc, !r.spot || !!doc.inks?.allSpotsToProcess);
      setClass(proc, 'is-void', !r.spot);
      const key = r.aliasOptions.join('\n');
      if (alias.dataset.options !== key) {
        alias.dataset.options = key;
        alias.replaceChildren(...[NO_ALIAS, ...r.aliasOptions].map((v) => { const o = document.createElement('option'); o.value = v; o.textContent = v === NO_ALIAS ? 'None' : v; return o; }));
      }
      const want = r.alias ?? NO_ALIAS;
      if (alias.value !== want) alias.value = want;
      setDisabled(alias, !r.spot || r.process || !!doc.inks?.allSpotsToProcess || !r.aliasOptions.length);
      setClass(alias, 'is-void', !r.spot);
    };
    patchList(this.list, inkRows(doc), {
      key: (r) => r.name,
      create: (r) => {
        const n = el('<div class="cv-tsp-row cv-ink-row" role="listitem"><input type="checkbox" data-role="print" aria-label="Print this ink"><span class="cv-ink-name"><i class="cv-ink-chip"></i><span class="cv-tsp-name"></span></span><span class="cv-ffd-count cv-ink-type"></span><input type="checkbox" data-role="process" aria-label="Convert to process"><select class="cv-input cv-ink-alias" data-role="alias" aria-label="Alias"></select></div>');
        fill(n, r);
        return n;
      },
      update: fill,
    });
  }
}

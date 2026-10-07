import type { Engine } from '../../engine';
import type { FontUse } from '../../engine/ops/text-styles';
import { ensureFace, families, stylesOf } from '../../io/fonts';
import { Dialog } from '../dialogs';
import { el, patchList, q, setClass, setDisabled, setText } from '../dom';
import { enhanceSelect } from '../dropdown';

const keyOf = (u: { font: string; style: string }): string => `${u.font}\u0000${u.style}`;

export class FindFontDialog extends Dialog {
  private readonly list = el('<div class="cv-tsp-list cv-ffd-list" role="listbox" aria-label="Fonts in the document"></div>');
  private readonly family = el<HTMLSelectElement>('<select class="cv-select" aria-label="Replacement font family"></select>');
  private readonly style = el<HTMLSelectElement>('<select class="cv-select" aria-label="Replacement font style"></select>');
  private readonly findBtn: HTMLButtonElement;
  private readonly changeBtn: HTMLButtonElement;
  private picked = '';
  private uses: FontUse[] = [];

  constructor(private readonly engine: Engine) {
    super('Find Font', 460);
    this.body.append(el('<div class="cv-kit-section">Fonts in Document</div>'), this.list);
    this.field('Replace With', this.family);
    this.field('Style', this.style);
    this.findBtn = this.button('Find', 'ghost', () => this.find());
    this.changeBtn = this.button('Change All', '', () => this.change());
    this.button('Done', 'primary', () => this.close());
    this.list.addEventListener('click', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-tsp-row'); if (r?.dataset.font) { this.picked = r.dataset.font; this.sync(); } });
    this.family.addEventListener('change', () => this.fillStyles());
    enhanceSelect(this.family);
    enhanceSelect(this.style);
  }

  show(): void {
    this.picked = '';
    const fams = families();
    this.family.textContent = '';
    for (const f of fams) { const o = document.createElement('option'); o.value = f; o.textContent = f; this.family.appendChild(o); }
    this.family.value = fams[0] ?? 'Inter';
    this.fillStyles();
    this.sync();
    this.open(this.list);
  }

  private fillStyles(): void {
    this.style.textContent = '';
    for (const s of stylesOf(this.family.value)) { const o = document.createElement('option'); o.value = s; o.textContent = s; this.style.appendChild(o); }
    this.style.value = stylesOf(this.family.value).includes('Regular') ? 'Regular' : this.style.options[0]?.value ?? 'Regular';
  }

  private sync(): void {
    this.uses = this.engine.fontsUsed();
    if (!this.uses.some((u) => keyOf(u) === this.picked)) this.picked = this.uses[0] ? keyOf(this.uses[0]) : '';
    patchList<FontUse>(this.list, this.uses, {
      key: keyOf,
      create: (u) => { const n = el('<div class="cv-tsp-row" role="option"><span class="cv-tsp-name"></span><span class="cv-ffd-count"></span></div>'); n.dataset.font = keyOf(u); this.fill(n, u); return n; },
      update: (n, u) => this.fill(n, u),
    });
    setDisabled(this.findBtn, !this.picked);
    setDisabled(this.changeBtn, !this.picked);
  }

  private fill(n: HTMLElement, u: FontUse): void {
    setText(q(n, '.cv-tsp-name'), `${u.font} ${u.style}`);
    setText(q(n, '.cv-ffd-count'), `${u.ids.length} object${u.ids.length === 1 ? '' : 's'}`);
    const on = keyOf(u) === this.picked;
    setClass(n, 'is-active', on);
    n.setAttribute('aria-selected', String(on));
  }

  private find(): void {
    const u = this.uses.find((x) => keyOf(x) === this.picked);
    if (!u) return;
    this.engine.select(u.ids);
    this.close();
  }

  private change(): void {
    const u = this.uses.find((x) => keyOf(x) === this.picked);
    if (!u) return;
    const to = { font: this.family.value, style: this.style.value };
    void ensureFace(to.font, to.style);
    const n = this.engine.replaceFont({ font: u.font, style: u.style }, to);
    this.engine.notice(n ? `${u.font} ${u.style} is now ${to.font} ${to.style} in ${n} run${n === 1 ? '' : 's'}.` : 'Nothing to change.');
    this.picked = keyOf(to);
    this.sync();
  }
}

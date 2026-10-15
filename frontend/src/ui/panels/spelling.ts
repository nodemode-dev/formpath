import { api, type SpellHit } from '../../io/api';
import type { Engine } from '../../engine';
import type { TextNode } from '../../engine/types';
import { walk } from '../../engine/doc';
import { deleteText, insertText, plainText } from '../../engine/text';
import { Dialog } from '../dialogs';
import { el, patchList, q, setDisabled, setText } from '../dom';

export interface MisspelledRange { start: number; end: number; word: string; suggestions: string[] }

const WORD = /[\p{L}\p{M}][\p{L}\p{M}'’]*/gu;
const known = new Map<string, SpellHit | null>();

export function resetSpellCache(): void { known.clear(); }

export function wordsOf(text: string): Array<{ word: string; start: number; end: number }> {
  const out: Array<{ word: string; start: number; end: number }> = [];
  for (const m of text.matchAll(WORD)) {
    const word = m[0].replace(/['’]+$/, '');
    if (word) out.push({ word, start: m.index ?? 0, end: (m.index ?? 0) + word.length });
  }
  return out;
}

async function lookup(words: string[], lang: string): Promise<void> {
  const fresh = [...new Set(words)].filter((w) => !known.has(w));
  if (!fresh.length) return;
  let hits: SpellHit[] = [];
  try { hits = await api.spellCheck(fresh, lang); } catch { return; }
  const by = new Map(hits.map((h) => [h.word, h]));
  for (const w of fresh) known.set(w, by.get(w) ?? null);
}

export async function misspelledRanges(text: string, lang = 'en'): Promise<MisspelledRange[]> {
  const toks = wordsOf(text);
  await lookup(toks.map((t) => t.word), lang);
  const out: MisspelledRange[] = [];
  for (const t of toks) { const h = known.get(t.word); if (h) out.push({ start: t.start, end: t.end, word: t.word, suggestions: h.suggestions }); }
  return out;
}

interface Hit { id: string; order: number; start: number; end: number; word: string }

export class SpellingDialog extends Dialog {
  private readonly before = el('<span></span>');
  private readonly mark = el('<mark></mark>');
  private readonly after = el('<span></span>');
  private readonly status = el('<p class="cv-note"></p>');
  private readonly input = el<HTMLInputElement>('<input class="cv-input" type="text" aria-label="Change to" spellcheck="false">');
  private readonly list = el('<div class="cv-list" role="listbox" aria-label="Suggestions"></div>');
  private readonly btns: Record<'change' | 'changeAll' | 'ignore' | 'ignoreAll' | 'add', HTMLButtonElement>;
  private readonly ignored = new Set<string>();
  private hit: Hit | null = null;
  private pos = { order: -1, start: -1 };
  private busy = false;

  constructor(private readonly engine: Engine, private readonly lang = 'en') {
    super('Check Spelling', 640);
    this.body.append(el('<p class="cv-note">Not in dictionary</p>'), el('<p class="cv-spell-context"></p>'));
    const ctx = q(this.body, '.cv-spell-context');
    ctx.append(this.before, this.mark, this.after);
    this.field('Change To', this.input);
    this.body.append(el('<p class="cv-note">Suggestions</p>'), this.list, this.status);
    this.btns = {
      change: this.button('Change', 'primary', () => void this.change(false)),
      changeAll: this.button('Change All', 'ghost', () => void this.change(true)),
      ignore: this.button('Ignore', 'ghost', () => void this.skip(false)),
      ignoreAll: this.button('Ignore All', 'ghost', () => void this.skip(true)),
      add: this.button('Add to Dictionary', 'ghost', () => void this.addWord()),
    };
    this.button('Done', 'ghost', () => this.close()).classList.add('cv-btn-apart');
    this.list.addEventListener('click', (e) => { const r = (e.target as HTMLElement).closest<HTMLElement>('.cv-list-row'); if (r?.dataset.key) { this.input.value = r.dataset.key; this.markSelected(); } });
    this.list.addEventListener('dblclick', () => void this.change(false));
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void this.change(false); } });
  }

  async start(): Promise<void> {
    this.pos = { order: -1, start: -1 };
    this.ignored.clear();
    this.open(this.input);
    await this.advance();
  }

  private texts(): Array<{ node: TextNode; order: number }> {
    const doc = this.engine.current?.doc;
    if (!doc) return [];
    const out: Array<{ node: TextNode; order: number }> = [];
    walk(doc.layers, (n) => {
      if (n.hidden || n.locked) return false;
      if (n.kind === 'text') out.push({ node: n, order: out.length });
    });
    return out;
  }

  private async collect(): Promise<Hit[]> {
    const texts = this.texts(), all: Array<{ id: string; order: number; t: { word: string; start: number; end: number } }> = [];
    for (const { node, order } of texts) for (const t of wordsOf(plainText(node))) all.push({ id: node.id, order, t });
    await lookup(all.map((a) => a.t.word), this.lang);
    return all.filter((a) => known.get(a.t.word) && !this.ignored.has(a.t.word.toLowerCase())).map((a) => ({ id: a.id, order: a.order, start: a.t.start, end: a.t.end, word: a.t.word }));
  }

  private async advance(): Promise<void> {
    this.busy = true;
    this.sync();
    const hits = await this.collect();
    this.hit = hits.find((h) => h.order > this.pos.order || (h.order === this.pos.order && h.start >= this.pos.start)) ?? null;
    this.busy = false;
    this.show();
  }

  private show(): void {
    const h = this.hit, node = h ? this.texts().find((t) => t.node.id === h.id)?.node : null;
    if (!h || !node) {
      setText(this.before, ''); setText(this.mark, ''); setText(this.after, ''); this.input.value = '';
      patchList(this.list, [] as string[], { key: (s) => s, create: () => el('<span></span>'), update: () => undefined });
      setText(this.status, 'Spelling check is complete.');
      this.sync();
      return;
    }
    const text = plainText(node);
    setText(this.before, (h.start > 40 ? '…' : '') + text.slice(Math.max(0, h.start - 40), h.start));
    setText(this.mark, h.word);
    setText(this.after, text.slice(h.end, h.end + 40) + (text.length > h.end + 40 ? '…' : ''));
    const sug = known.get(h.word)?.suggestions ?? [];
    this.input.value = sug[0] ?? h.word;
    patchList(this.list, sug, {
      key: (s) => s,
      create: (s) => { const n = el(`<button class="cv-list-row" type="button" role="option"><span></span><span class="cv-list-name"></span></button>`); setText(q(n, '.cv-list-name'), s); return n; },
      update: () => undefined,
    });
    this.markSelected();
    setText(this.status, sug.length ? '' : 'No suggestions.');
    this.engine.select([h.id]);
    this.sync();
  }

  private markSelected(): void { for (const r of Array.from(this.list.children) as HTMLElement[]) r.classList.toggle('is-selected', r.dataset.key === this.input.value); }

  private sync(): void {
    const off = this.busy || !this.hit;
    for (const b of Object.values(this.btns)) setDisabled(b, off);
  }

  private async change(all: boolean): Promise<void> {
    const h = this.hit, to = this.input.value;
    if (!h || this.busy || !to) return;
    const targets = all ? (await this.collect()).filter((x) => x.word === h.word) : [h];
    const byNode = new Map<string, Hit[]>();
    for (const t of targets) byNode.set(t.id, [...(byNode.get(t.id) ?? []), t]);
    for (const [id, list] of byNode) {
      const node = this.texts().find((t) => t.node.id === id)?.node;
      if (!node) continue;
      let spans = node.spans;
      for (const x of [...list].sort((a, b) => b.start - a.start)) {
        if (plainText({ ...node, spans }).slice(x.start, x.end) !== x.word) continue;
        spans = insertText(deleteText(spans, x.start, x.end), x.start, to);
      }
      this.engine.setTextSpans(id, spans, 'Change Spelling');
    }
    this.pos = { order: h.order, start: h.start + to.length };
    await this.advance();
  }

  private async skip(all: boolean): Promise<void> {
    const h = this.hit;
    if (!h || this.busy) return;
    if (all) this.ignored.add(h.word.toLowerCase());
    this.pos = { order: h.order, start: h.end };
    await this.advance();
  }

  private async addWord(): Promise<void> {
    const h = this.hit;
    if (!h || this.busy) return;
    this.busy = true;
    this.sync();
    try { await api.spellDictionaryEdit([h.word]); resetSpellCache(); } catch { this.ignored.add(h.word.toLowerCase()); }
    this.pos = { order: h.order, start: h.end };
    await this.advance();
  }
}

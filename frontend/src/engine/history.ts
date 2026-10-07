import type { Doc } from './types';

export interface HistoryState { name: string; doc: Doc; selection: string[] }

export class History {
  static limit = 200;
  private states: HistoryState[];
  private at = 0;
  private savedDoc: Doc | null;
  private dirty = false;

  constructor(doc: Doc) {
    this.states = [{ name: 'Open', doc, selection: [] }];
    this.savedDoc = doc;
  }

  get current(): HistoryState { return this.states[this.at]; }
  get canUndo(): boolean { return this.at > 0; }
  get canRedo(): boolean { return this.at < this.states.length - 1; }
  get undoName(): string { return this.canUndo ? this.states[this.at].name : ''; }
  get redoName(): string { return this.canRedo ? this.states[this.at + 1].name : ''; }
  private rev = 0;
  get revision(): number { return this.rev; }
  get modified(): boolean { return this.dirty || this.current.doc !== this.savedDoc; }

  push(name: string, doc: Doc, selection: string[], merge = false): boolean {
    if (doc === this.current.doc) { this.states[this.at] = { ...this.current, selection }; return false; }
    if (merge && this.at > 0 && this.at === this.states.length - 1 && this.current.name === name) { this.states[this.at] = { name, doc, selection }; this.rev += 1; return true; }
    this.states = this.states.slice(0, this.at + 1);
    this.states.push({ name, doc, selection });
    if (this.states.length > History.limit + 1) {
      const drop = this.states.length - History.limit - 1;
      this.states.splice(0, drop);
    }
    this.at = this.states.length - 1;
    this.rev += 1;
    return true;
  }

  noteSelection(selection: string[]): void { this.states[this.at] = { ...this.current, selection }; }

  undo(): HistoryState | null { if (!this.canUndo) return null; this.at -= 1; this.rev += 1; return this.current; }
  redo(): HistoryState | null { if (!this.canRedo) return null; this.at += 1; this.rev += 1; return this.current; }
  jump(i: number): HistoryState | null { if (i < 0 || i >= this.states.length || i === this.at) return null; this.at = i; this.rev += 1; return this.current; }

  steps(): { names: string[]; current: number } { return { names: this.states.map((s) => s.name), current: this.at }; }
  markSaved(): void { this.savedDoc = this.current.doc; this.dirty = false; }
  markUnsaved(): void { this.dirty = true; }
  stamp(): string { return `${this.at}:${this.states.length}:${this.states[this.at].name}`; }
}

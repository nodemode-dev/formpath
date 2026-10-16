import type { Engine } from '../engine';
import type { Commands } from './commands';
import { el, setDisabled, setHidden, setText } from './dom';

const SETS: Record<string, string[]> = {
  path: ['simplify', 'offset-path', 'corners-dialog'],
  group: ['ungroup', 'isolate'],
  text: ['create-outlines'],
  multiple: ['group', 'panel-align', 'pf-unite'],
};
const ALL = ['simplify', 'offset-path', 'corners-dialog', 'ungroup', 'isolate', 'create-outlines', 'group', 'panel-align', 'pf-unite'];

export class TaskBar {
  enabled = true;
  private readonly root: HTMLElement;
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private frame = 0;
  private gesture = false;
  private kind = '';
  private width = 0;
  private height = 0;
  private at = '';

  constructor(host: HTMLElement, private readonly stage: HTMLElement, private readonly engine: Engine, private readonly commands: Commands) {
    this.root = el('<div class="fp-taskbar is-off" role="toolbar" aria-label="Contextual task bar"></div>');
    for (const id of ALL) {
      const b = el<HTMLButtonElement>('<button class="fp-task-btn" type="button" hidden></button>');
      b.dataset.task = id;
      this.buttons.set(id, b);
      this.root.appendChild(b);
    }
    this.root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-task]');
      if (b && !b.disabled) this.commands.run(b.dataset.task ?? '');
    });
    host.appendChild(this.root);
    stage.addEventListener('pointerdown', () => { this.gesture = true; this.schedule(); }, true);
    const end = (): void => { if (!this.gesture) return; this.gesture = false; this.schedule(); };
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
    for (const k of ['selection', 'viewport', 'doc', 'active', 'tool', 'options'] as const) engine.on(k, () => this.schedule());
    window.addEventListener('resize', () => this.schedule());
    this.schedule();
  }

  schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.update(); });
  }

  private kindOf(): string {
    const p = this.engine.current;
    if (!p || p.anchors.size || !this.engine.hasSelection || this.engine.tool === 'width') return '';
    const sel = this.engine.selected();
    if (!sel.length) return '';
    if (sel.length > 1) return 'multiple';
    const k = sel[0].kind;
    if (k === 'path' || k === 'compound') return 'path';
    if (k === 'group') return 'group';
    if (k === 'text') return 'text';
    return '';
  }

  private off(): void { if (!this.root.classList.contains('is-off')) this.root.classList.add('is-off'); }

  update(): void {
    const p = this.engine.current;
    const kind = this.enabled && !this.gesture ? this.kindOf() : '';
    const b = kind && p ? this.engine.selectionBounds(false) : null;
    if (!kind || !p || !b || !Number.isFinite(b.x)) { this.off(); return; }
    if (kind !== this.kind) {
      this.kind = kind;
      const set = SETS[kind] ?? [];
      for (const [id, btn] of this.buttons) {
        const cmd = this.commands.get(id);
        const on = set.includes(id) && !!cmd;
        setHidden(btn, !on);
        if (on && cmd) setText(btn, this.commands.label(cmd));
      }
      this.width = this.root.offsetWidth;
      this.height = this.root.offsetHeight;
    }
    for (const id of SETS[kind] ?? []) { const cmd = this.commands.get(id), btn = this.buttons.get(id); if (cmd && btn) setDisabled(btn, !this.commands.enabled(cmd)); }
    const r = this.stage.getBoundingClientRect(), v = p.viewport;
    const a = v.toScreen(b.x + b.w / 2, b.y + b.h), top = v.toScreen(b.x + b.w / 2, b.y);
    let x = r.left + a.x - this.width / 2;
    let y = r.top + a.y + 14;
    if (y + this.height > r.bottom - 8) y = r.top + top.y - this.height - 14;
    x = Math.min(Math.max(x, r.left + 8), Math.max(r.left + 8, r.right - this.width - 8));
    y = Math.min(Math.max(y, r.top + 8), Math.max(r.top + 8, r.bottom - this.height - 8));
    const t = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    if (t !== this.at) { this.at = t; this.root.style.transform = t; }
    if (this.root.classList.contains('is-off')) this.root.classList.remove('is-off');
  }
}

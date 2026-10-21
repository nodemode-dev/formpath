import type { Engine } from '../engine';
import { COMMAND_META } from './command-meta';
import { toolList } from '../extensions/registry';
import type { Command, CommandParam, Commands } from '../ui/commands';
import type { MenuDef, MenuItem } from '../ui/menu';

export interface CatalogueEntry {
  id: string;
  label: string;
  kind: 'command' | 'tool';
  group: string;
  path: string;
  description: string;
  when: string;
  params?: Record<string, CommandParam>;
  mutates: boolean;
  risky: boolean;
  keys?: string[];
  enabled: boolean;
  checked?: boolean;
  windowOnly?: boolean;
}

export interface RunResult { ok: boolean; id: string; message: string }

export const WINDOW_ONLY = new Set(['terminal-toggle', 'terminal-new', 'claude-code', 'claude-chat', 'quit', 'shortcuts', 'preferences']);
const READ_ONLY_GROUPS = new Set(['View', 'Window', 'Help']);
const RISKY = new Set(['delete-library', 'clear-recent', 'revert', 'close-all', 'batch']);

interface Deps { engine: Engine; commands: Commands; menus: () => MenuDef[] }

function walk(items: MenuItem[], trail: string[], out: Map<string, string[]>): void {
  for (const it of items) {
    if (it === '-') continue;
    if (typeof it === 'string') { if (!out.has(it)) out.set(it, trail); continue; }
    walk(it.items, [...trail, it.label], out);
  }
}

function placesOf(menus: MenuDef[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const m of menus) {
    try { walk(typeof m.items === 'function' ? m.items() : m.items, [m.label], out); } catch { continue; }
  }
  return out;
}

export class Catalogue {
  private timer = 0;
  private sent = '';

  constructor(private readonly deps: Deps) {}

  attach(): void {
    this.deps.commands.onChange = () => this.schedule();
    this.schedule();
    Object.assign(window, { formpath: { catalogue: {
      listCommands: (group?: string, text?: string) => this.list(group, text),
      describeCommand: (id: string) => this.describe(id),
      runCommand: (id: string, params?: Record<string, unknown>) => this.run(id, params),
      runCommands: (steps: Array<{ id: string; params?: Record<string, unknown> }>) => this.runMany(steps),
    } } });
  }

  build(): CatalogueEntry[] {
    const { commands, engine } = this.deps;
    const places = placesOf(this.deps.menus());
    const out: CatalogueEntry[] = [];
    for (const c of commands.all()) {
      if (c.id.startsWith('plugin:')) continue;
      const label = commands.label(c).replace(/\.\.\.$/, '').trim();
      if (!label) continue;
      const trail = places.get(c.id) ?? [];
      const group = c.group ?? trail[0] ?? 'Panels';
      const path = [...trail, label].join(' > ');
      out.push({
        id: c.id, label, kind: 'command', group, path,
        description: c.description ?? COMMAND_META[c.id]?.[0] ?? (trail.length ? `${label}, as in ${path}.` : `${label}, from a panel menu or shortcut.`),
        when: c.when ?? COMMAND_META[c.id]?.[1] ?? '',
        params: c.params,
        mutates: c.mutates ?? !READ_ONLY_GROUPS.has(group),
        risky: c.risky ?? RISKY.has(c.id),
        keys: c.keys?.length ? [...c.keys] : undefined,
        enabled: safe(() => commands.enabled(c), false),
        checked: c.checked ? safe(() => c.checked?.() ?? false, false) : undefined,
        windowOnly: WINDOW_ONLY.has(c.id) || undefined,
      });
    }
    for (const t of toolList()) {
      out.push({
        id: `tool.${t.id}`, label: t.label, kind: 'tool', group: 'Tools', path: `Tools > ${t.label}`,
        description: `Makes ${t.label} the active tool${t.shortcut ? ` (${t.shortcut})` : ''}; ${safe(() => t.hint(engine), '')}`.replace(/; $/, '.'),
        when: '', mutates: false, risky: false, keys: t.shortcut ? [t.shortcut] : undefined, enabled: true, checked: engine.tool === t.id,
      });
    }
    return out.sort((a, b) => a.id.localeCompare(b.id));
  }

  list(group?: string, text?: string): CatalogueEntry[] {
    const g = (group ?? '').toLowerCase(), needle = (text ?? '').toLowerCase();
    return this.build().filter((e) => (!g || e.group.toLowerCase() === g) && (!needle || e.id.includes(needle) || e.label.toLowerCase().includes(needle) || e.path.toLowerCase().includes(needle)));
  }

  describe(id: string): CatalogueEntry | { error: string; suggestions: string[] } {
    const all = this.build();
    const found = all.find((e) => e.id === id);
    if (found) return found;
    const needle = id.toLowerCase().replace(/^tool\./, '');
    const suggestions = all.filter((e) => e.id.includes(needle) || needle.includes(e.id) || e.label.toLowerCase().includes(needle)).slice(0, 8).map((e) => e.id);
    return { error: `There is no command ${id}.`, suggestions };
  }

  run(id: string, params?: Record<string, unknown>, outside = false): RunResult {
    const { commands, engine } = this.deps;
    if (id.startsWith('tool.')) {
      const t = toolList().find((x) => `tool.${x.id}` === id);
      if (!t) return { ok: false, id, message: `There is no tool ${id.slice(5)}; list_commands with group Tools lists them.` };
      engine.setTool(t.id);
      return { ok: true, id, message: `${t.label} is the active tool.` };
    }
    const c: Command | undefined = commands.get(id);
    if (!c) {
      const d = this.describe(id);
      return { ok: false, id, message: `There is no command ${id}.${'suggestions' in d && d.suggestions.length ? ` Did you mean ${d.suggestions.join(', ')}?` : ''}` };
    }
    if (outside && WINDOW_ONLY.has(id)) return { ok: false, id, message: `${commands.label(c)} belongs to the person at the window; agents cannot run it.` };
    const bad = validate(c, params);
    if (bad) return { ok: false, id, message: bad };
    if (!commands.enabled(c)) return { ok: false, id, message: `${commands.label(c)} is not available now (it may need a selection or an open document).` };
    commands.run(id, params);
    return { ok: true, id, message: `Ran ${commands.label(c).replace(/\.\.\.$/, '')}.` };
  }

  runMany(steps: Array<{ id: string; params?: Record<string, unknown> }>, outside = false): RunResult[] {
    const { engine } = this.deps;
    const out: RunResult[] = [];
    engine.beginStep();
    try {
      for (const s of steps) {
        const r = this.run(String(s.id ?? ''), s.params, outside);
        out.push(r);
        if (!r.ok) break;
      }
    } finally { engine.endStep(); }
    return out;
  }

  private schedule(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.mirror(), 600);
  }

  private async mirror(): Promise<void> {
    const entries = this.build().map(({ enabled: _e, checked: _c, ...rest }) => rest);
    const body = JSON.stringify({ size: entries.length, commands: entries });
    if (body === this.sent) return;
    try {
      const res = await fetch('/api/commands/catalogue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      if (res.ok) this.sent = body;
    } catch { return; }
  }
}

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

function validate(c: Command, params?: Record<string, unknown>): string {
  const spec = c.params ?? {};
  const given = params ?? {};
  for (const key of Object.keys(given)) if (!(key in spec)) return `${c.id} takes no parameter ${key}${Object.keys(spec).length ? `; it takes ${Object.keys(spec).join(', ')}` : ''}.`;
  for (const [key, p] of Object.entries(spec)) {
    const v = given[key];
    if (v === undefined) { if (p.required) return `${c.id} needs ${key}.`; continue; }
    const ok = p.type === 'string' ? typeof v === 'string' : p.type === 'boolean' ? typeof v === 'boolean'
      : p.type === 'number' ? typeof v === 'number' && Number.isFinite(v) : p.type === 'integer' ? Number.isInteger(v)
        : p.type === 'array' ? Array.isArray(v) : typeof v === 'object' && v !== null;
    if (!ok) return `${key} must be ${p.type === 'integer' ? 'an integer' : `a ${p.type}`}.`;
    if (p.enum && !p.enum.includes(v as string | number)) return `${key} must be one of ${p.enum.join(', ')}.`;
    if (typeof v === 'number' && ((p.min !== undefined && v < p.min) || (p.max !== undefined && v > p.max))) return `${key} must be between ${p.min ?? '-'} and ${p.max ?? '-'}.`;
  }
  return '';
}

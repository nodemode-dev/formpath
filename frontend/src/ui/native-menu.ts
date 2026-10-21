import type { Commands } from './commands';
import type { MenuDef, MenuItem as MenuSpec } from './menu';

export const wantsNativeMenus = (): boolean => '__TAURI_INTERNALS__' in window && /Mac/.test(navigator.platform);

export function accelerator(combo: string | undefined): string | null {
  if (!combo) return null;
  const parts = combo.endsWith('++') ? [...combo.slice(0, -2).split('+'), 'Plus'] : combo.split('+');
  const names: Record<string, string> = { Mod: 'CmdOrCtrl', Alt: 'Alt', Shift: 'Shift', Ctrl: 'Ctrl', '=': '=', '-': '-', '[': '[', ']': ']', Delete: 'Delete', Backspace: 'Backspace', Escape: 'Escape', Enter: 'Enter', Tab: 'Tab', Space: 'Space', Plus: 'Plus' };
  const out: string[] = [];
  for (const p of parts) {
    if (names[p]) out.push(names[p]);
    else if (/^[A-Za-z0-9]$/.test(p)) out.push(p.toUpperCase());
    else if (/^F([1-9]|1[0-2])$/.test(p)) out.push(p);
    else return null;
  }
  return out.join('+');
}

type Api = typeof import('@tauri-apps/api/menu');

export class NativeMenus {
  private items: Array<{ id: string; item: { setEnabled(on: boolean): Promise<void> } }> = [];
  private building = false;
  private again = false;
  private stateTimer = 0;

  constructor(private readonly commands: Commands, private readonly menus: () => MenuDef[]) {}

  async build(): Promise<void> {
    if (this.building) { this.again = true; return; }
    this.building = true;
    try {
      const api: Api = await import('@tauri-apps/api/menu');
      const items: typeof this.items = [];
      const make = async (spec: MenuSpec): Promise<unknown> => {
        if (spec === '-') return api.PredefinedMenuItem.new({ item: 'Separator' });
        if (typeof spec === 'object') return api.Submenu.new({ text: spec.label, items: (await Promise.all(spec.items.map(make))) as never[] });
        const cmd = this.commands.get(spec);
        if (!cmd) return null;
        const text = this.commands.label(cmd), acc = accelerator(cmd.keys?.[0]);
        const opts = { text, enabled: this.commands.enabled(cmd), action: () => { this.commands.run(spec); } };
        let item;
        try { item = await api.MenuItem.new(acc ? { ...opts, accelerator: acc } : opts); } catch { item = await api.MenuItem.new(opts); }
        items.push({ id: spec, item });
        return item;
      };
      const top = [];
      top.push(await api.Submenu.new({ text: 'formpath', items: [
        await api.PredefinedMenuItem.new({ item: { About: { name: 'formpath' } } }),
        await api.PredefinedMenuItem.new({ item: 'Separator' }),
        ...(this.commands.get('settings') ? [await make('settings')] : []),
        await api.PredefinedMenuItem.new({ item: 'Separator' }),
        await api.PredefinedMenuItem.new({ item: 'Hide' }),
        await api.PredefinedMenuItem.new({ item: 'Quit' }),
      ] as never[] }));
      for (const def of this.menus()) {
        const list = typeof def.items === 'function' ? def.items() : def.items;
        top.push(await api.Submenu.new({ text: def.label, items: (await Promise.all(list.map(make))).filter(Boolean) as never[] }));
      }
      const menu = await api.Menu.new({ items: top as never[] });
      await menu.setAsAppMenu();
      this.items = items;
      document.documentElement.classList.add('has-native-menus');
    } finally {
      this.building = false;
      if (this.again) { this.again = false; void this.build(); }
    }
  }

  refresh(): void {
    if (this.stateTimer) return;
    this.stateTimer = window.setTimeout(() => {
      this.stateTimer = 0;
      for (const { id, item } of this.items) {
        const cmd = this.commands.get(id);
        if (cmd) void item.setEnabled(this.commands.enabled(cmd)).catch(() => undefined);
      }
    }, 150);
  }
}

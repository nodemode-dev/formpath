import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import { DEFAULT_ACCENT, DEFAULT_THEME, THEMES } from '../src/ui/themes';

const NAMES = ['--bg-primary', '--bg-secondary', '--bg-tertiary', '--border-color', '--border-light', '--text-primary', '--text-secondary', '--text-muted', '--canvas-bg', '--grid-color'];

function bootProfiles(): Record<string, string[]> {
  const from = html.indexOf('var PROFILES = {');
  const block = html.slice(from, html.indexOf('};', from));
  const out: Record<string, string[]> = {};
  for (const m of block.matchAll(/'([a-z0-9-]+)':\s*\[([^\]]*)\]/g)) out[m[1]] = [...m[2].matchAll(/'([^']*)'/g)].map((v) => v[1]);
  return out;
}

function bootSet(name: 'LIGHT' | 'OLED'): string[] {
  const found = html.match(new RegExp(`var ${name} = \\{([^}]*)\\}`));
  return found ? [...found[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]).sort() : [];
}

describe('theme boot in index.html', () => {
  it('holds every theme in themes.ts with the same values, and no other', () => {
    const boot = bootProfiles();
    expect(Object.keys(boot).sort()).toEqual(Object.keys(THEMES).sort());
    for (const [id, theme] of Object.entries(THEMES)) {
      NAMES.forEach((name, i) => expect(`${id} ${name} ${boot[id][i]}`).toBe(`${id} ${name} ${theme.vars[name]}`));
      expect(`${id} --bg-node ${boot[id][10]}`).toBe(`${id} --bg-node ${theme.vars['--bg-node']}`);
    }
  });

  it('marks the same themes light and the same themes true black', () => {
    const light = Object.entries(THEMES).filter(([, t]) => t.light).map(([id]) => id).sort();
    const oled = Object.entries(THEMES).filter(([, t]) => t.oled).map(([id]) => id).sort();
    expect(bootSet('LIGHT')).toEqual(light);
    expect(bootSet('OLED')).toEqual(oled);
  });

  it('starts from the same default theme and accent as themes.ts', () => {
    expect(html).toContain(`var DEFAULT_THEME = '${DEFAULT_THEME}';`);
    expect(html).toContain(`var DEFAULT_ACCENT = '${DEFAULT_ACCENT}';`);
  });
});

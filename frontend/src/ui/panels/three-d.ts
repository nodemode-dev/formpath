import type { Effect, Engine, VNode } from '../../engine';
import { ROTATION_PRESETS } from '../../engine/threed';
import { el, setHidden, setValue } from '../dom';
import { check, empty, page, row, section, seg, selectCtl, slider } from './kit';

type Params = Effect['params'];
interface Settable { set(v: number | string | boolean): void }
const KINDS = [{ id: '3d.rotate', label: 'Plane' }, { id: '3d.extrude', label: 'Extrude' }, { id: '3d.revolve', label: 'Revolve' }, { id: '3d.inflate', label: 'Inflate' }];
const title = (s: string): string => s.split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
const PRESETS: ReadonlyArray<readonly [string, string]> = [['custom', 'Custom'], ...Object.keys(ROTATION_PRESETS).map((k) => [k, title(k)] as const)];
const LIGHTS: ReadonlyArray<readonly [string, string]> = ['top_left', 'top', 'top_right', 'left', 'front', 'right', 'bottom_left', 'bottom', 'bottom_right'].map((k) => [k, title(k)] as const);
const num = (p: Params, k: string, d: number): number => { const v = p[k]; return typeof v === 'number' ? v : d; };
const str = (p: Params, k: string, d: string): string => (typeof p[k] === 'string' ? (p[k] as string) : d);

export class ThreeDPanel {
  readonly body = page('cv-3dp');
  private readonly none = empty('Select an object, then choose Plane, Extrude, Revolve or Inflate to give it depth.');
  private readonly form = el('<div class="cv-3dp-form"></div>');
  private readonly parts = new Map<string, HTMLElement>();
  private readonly kind;
  private readonly ctl: Record<string, Settable> = {};
  private readonly shade = el<HTMLInputElement>('<input class="cv-color" type="color" aria-label="Shading color">');
  private readonly symbols: ReturnType<typeof selectCtl>;
  private frame = 0;

  constructor(private readonly engine: Engine, private readonly run: (cmd: string) => void) {
    const set = (patch: Params): void => { engine.set3d(null, patch); };
    const sl = (key: string, label: string, min: number, max: number, unit = ''): HTMLElement => { const c = slider(engine, label, min, max, (v) => set({ [key]: v }), { unit }); this.ctl[key] = c; return c.el; };
    const pick = (key: string, label: string, choices: ReadonlyArray<readonly [string, string]>): HTMLElement => { const c = selectCtl(label, choices, (v) => set({ [key]: v })); this.ctl[key] = c; return row(c.el); };
    const part = (name: string, ...kids: HTMLElement[]): HTMLElement => { const p = el('<div class="cv-3dp-part"></div>'); p.append(...kids); this.parts.set(name, p); return p; };
    this.kind = seg(KINDS, (id) => { if (engine.selected().length) engine.set3d(id, {}); }, 'cv-3dp-kind');
    const cap = check('Cap', (v) => set({ cap: v }));
    this.ctl.cap = cap;
    const material = seg([{ id: 'plastic', label: 'Plastic' }, { id: 'matte', label: 'Matte' }, { id: 'metal', label: 'Metal' }, { id: 'wireframe', label: 'Wire' }, { id: 'flat', label: 'Flat' }], (id) => set({ material: id }), 'cv-seg-small');
    this.ctl.material = material;
    const preset = selectCtl('Position', PRESETS, (v) => { const r = ROTATION_PRESETS[v]; if (r) set({ rx: r[0], ry: r[1], rz: r[2] }); });
    this.ctl.preset = preset;
    this.shade.addEventListener('input', () => set({ shading_color: this.shade.value }));
    const shadeRow = el('<label class="cv-props-field is-wide"><span class="cv-pf-label">Shading Color</span></label>');
    shadeRow.appendChild(this.shade);
    const inflate = slider(engine, 'Depth', 1, 200, (v) => set({ depth: v }), { unit: 'pt' });
    this.ctl.inflate_depth = inflate;
    const expand = el<HTMLButtonElement>('<button class="cv-btn" type="button">Expand</button>'), remove = el<HTMLButtonElement>('<button class="cv-btn" type="button">Remove 3D</button>');
    expand.addEventListener('click', () => this.run('expand-appearance'));
    remove.addEventListener('click', () => engine.set3d(null, {}));
    this.symbols = selectCtl('Symbol', [['', 'None']], (v) => set({ map_symbol: v }));
    this.ctl.map_symbol = this.symbols;
    const shadeArt = check('Shade Artwork', (v) => set({ shade_art: v })), shadow = check('Shadow', (v) => set({ shadow: v }));
    this.ctl.shade_art = shadeArt;
    this.ctl.shadow = shadow;
    this.form.append(
      part('extrude', section('Extrude'), sl('depth', 'Depth', 0, 500, 'pt'), row(cap.el), pick('bevel', 'Bevel', [['none', 'None'], ['classic', 'Classic'], ['rounded', 'Rounded']]), sl('bevel_height', 'Bevel Height', 0, 50, 'pt')),
      part('revolve', section('Revolve'), sl('angle', 'Angle', 1, 360, '°'), sl('offset', 'Offset', 0, 500, 'pt'), pick('from', 'From', [['left', 'Left Edge'], ['right', 'Right Edge']])),
      part('inflate', section('Inflate'), inflate.el, sl('volume', 'Volume', 10, 100, '%')),
      part('rotation', section('Rotation'), row(preset.el), sl('rx', 'X', -180, 180, '°'), sl('ry', 'Y', -180, 180, '°'), sl('rz', 'Z', -180, 180, '°'), part('perspective', sl('perspective', 'Perspective', 0, 160, '°'))),
      section('Material'), row(material.el),
      part('map', section('Map Art'), row(this.symbols.el), sl('map_scale', 'Scale', 5, 400, '%'), sl('map_x', 'Offset X', -500, 500, 'pt'), sl('map_y', 'Offset Y', -500, 500, 'pt'), row(shadeArt.el)),
      section('Lighting'), pick('light', 'Light', LIGHTS), sl('intensity', 'Intensity', 0, 200, '%'), sl('ambient', 'Ambient', 0, 100, '%'), sl('highlight', 'Highlight', 0, 100, '%'), row(shadeRow),
      part('shadow', section('Shadow'), row(shadow.el), pick('shadow_position', 'Position', [['behind', 'Behind Object'], ['below', 'Below Object']]), sl('shadow_distance', 'Distance', 0, 500, 'pt'), sl('shadow_softness', 'Softness', 0, 100, 'pt'), sl('shadow_opacity', 'Opacity', 0, 100, '%')),
      row(expand, remove),
    );
    this.body.append(row(this.kind.el), this.none, this.form);
    for (const k of ['selection', 'doc', 'active'] as const) engine.on(k, () => this.queue());
    this.sync();
  }

  private queue(): void { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.sync(); }); }

  private target(): { n: VNode; e: Effect | null } | null {
    const n = this.engine.selected()[0];
    return n ? { n, e: n.ap.effects.find((x) => x.id.startsWith('3d.')) ?? null } : null;
  }

  private sync(): void {
    const t = this.target(), e = t?.e ?? null, p = e?.params ?? {};
    this.kind.set(e?.id ?? '');
    this.kind.enable(!!t);
    setHidden(this.none, !!e);
    setHidden(this.form, !e);
    if (!e) return;
    const k = e.id;
    setHidden(this.parts.get('extrude') as HTMLElement, k !== '3d.extrude');
    setHidden(this.parts.get('revolve') as HTMLElement, k !== '3d.revolve');
    setHidden(this.parts.get('inflate') as HTMLElement, k !== '3d.inflate');
    setHidden(this.parts.get('perspective') as HTMLElement, k === '3d.inflate');
    setHidden(this.parts.get('map') as HTMLElement, k !== '3d.extrude' && k !== '3d.rotate');
    setHidden(this.parts.get('shadow') as HTMLElement, k === '3d.inflate');
    const c = this.ctl, syms = this.engine.doc?.symbols ?? [], ms = str(p, 'map_symbol', '');
    this.symbols.setChoices([['', 'None'], ...syms.map((s) => [s.id, s.name] as const)]);
    c.map_symbol?.set(syms.find((s) => s.id === ms || s.name === ms)?.id ?? '');
    c.map_scale?.set(num(p, 'map_scale', 100));
    c.shade_art?.set(p.shade_art !== false);
    c.shadow?.set(p.shadow === true);
    c.shadow_position?.set(str(p, 'shadow_position', 'behind'));
    c.shadow_distance?.set(num(p, 'shadow_distance', 20));
    c.shadow_softness?.set(num(p, 'shadow_softness', 8));
    c.shadow_opacity?.set(num(p, 'shadow_opacity', 40));
    for (const key of ['bevel_height', 'angle', 'offset', 'volume', 'rx', 'ry', 'rz', 'perspective', 'intensity', 'ambient', 'highlight', 'map_x', 'map_y']) c[key]?.set(num(p, key, 0));
    c.depth?.set(num(p, 'depth', 50));
    c.inflate_depth?.set(num(p, 'depth', 20));
    c.cap?.set(p.cap !== false);
    for (const key of ['bevel', 'from', 'light', 'material']) c[key]?.set(str(p, key, ''));
    const rx = num(p, 'rx', 0), ry = num(p, 'ry', 0), rz = num(p, 'rz', 0);
    c.preset?.set(Object.entries(ROTATION_PRESETS).find(([, r]) => Math.abs(r[0] - rx) < 0.01 && Math.abs(r[1] - ry) < 0.01 && Math.abs(r[2] - rz) < 0.01)?.[0] ?? 'custom');
    setValue(this.shade, str(p, 'shading_color', '#000000'));
  }
}

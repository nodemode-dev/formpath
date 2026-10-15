import type { Effect, Engine, VNode } from '../../engine';
import { LIGHT_LIMIT, LIGHTING_PRESETS, lightingPreset, lightSpecs, lightsToParam, ROTATION_PRESETS, type LightSpec } from '../../engine/threed';
import { el, setDisabled, setHidden, setValue } from '../dom';
import { check, empty, page, row, section, seg, selectCtl, slider } from './kit';

type Params = Effect['params'];
interface Settable { set(v: number | string | boolean): void; enable?(on: boolean): void }
const KINDS = [{ id: '3d.rotate', label: 'Plane' }, { id: '3d.extrude', label: 'Extrude' }, { id: '3d.revolve', label: 'Revolve' }, { id: '3d.inflate', label: 'Inflate' }];
const title = (s: string): string => s.split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
const PRESETS: ReadonlyArray<readonly [string, string]> = [['custom', 'Custom'], ...Object.keys(ROTATION_PRESETS).map((k) => [k, title(k)] as const)];
const MATERIALS: ReadonlyArray<readonly [string, string]> = [['plastic', 'Plastic'], ['matte', 'Matte'], ['metal', 'Metal'], ['brushed_metal', 'Brushed Metal'], ['wood', 'Wood'], ['rough', 'Rough'], ['wireframe', 'Wireframe'], ['flat', 'Flat']];
const TEXTURED = new Set(['brushed_metal', 'wood', 'rough']);
const LIGHT_PRESETS: ReadonlyArray<readonly [string, string]> = [...Object.entries(LIGHTING_PRESETS).map(([k, v]) => [k, v.label] as const), ['custom', 'Custom']];
const hexOr = (s: string): string => (/^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : '#ffffff');
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
  private readonly lightColor = el<HTMLInputElement>('<input class="cv-color" type="color" aria-label="Light color">');
  private readonly materials: ReturnType<typeof selectCtl>;
  private readonly lightPreset: ReturnType<typeof selectCtl>;
  private readonly lightPick: ReturnType<typeof selectCtl>;
  private readonly lctl: Record<string, Settable> = {};
  private readonly lbtn: { add: HTMLButtonElement; dup: HTMLButtonElement; del: HTMLButtonElement };
  private lightAt = 0;
  private frame = 0;

  constructor(private readonly engine: Engine, private readonly run: (cmd: string) => void) {
    const set = (patch: Params): void => { engine.set3d(null, patch); };
    const sl = (key: string, label: string, min: number, max: number, unit = ''): HTMLElement => { const c = slider(engine, label, min, max, (v) => set({ [key]: v }), { unit }); this.ctl[key] = c; return c.el; };
    const pick = (key: string, label: string, choices: ReadonlyArray<readonly [string, string]>): HTMLElement => { const c = selectCtl(label, choices, (v) => set({ [key]: v })); this.ctl[key] = c; return row(c.el); };
    const part = (name: string, ...kids: HTMLElement[]): HTMLElement => { const p = el('<div class="cv-3dp-part"></div>'); p.append(...kids); this.parts.set(name, p); return p; };
    this.kind = seg(KINDS, (id) => { if (engine.selected().length) engine.set3d(id, {}); }, 'cv-3dp-kind');
    const cap = check('Cap', (v) => set({ cap: v }));
    this.ctl.cap = cap;
    const material = selectCtl('Material', MATERIALS, (id) => set({ material: id }));
    this.materials = material;
    this.ctl.material = material;
    const preset = selectCtl('Position', PRESETS, (v) => { const r = ROTATION_PRESETS[v]; if (r) set({ rx: r[0], ry: r[1], rz: r[2] }); });
    this.ctl.preset = preset;
    const picking = (input: HTMLInputElement, apply: (v: string) => void): void => {
      let open = false;
      input.addEventListener('input', () => { if (!open) { open = true; engine.beginGesture(); } apply(input.value); });
      input.addEventListener('change', () => { if (open) { open = false; engine.endGesture(); } });
    };
    picking(this.shade, (v) => set({ shading_color: v }));
    picking(this.lightColor, (v) => this.patchLight('color', v));
    const edit = (fn: (list: LightSpec[], at: number) => LightSpec[], pick: (at: number, n: number) => number): void => {
      const list = this.specs(), at = Math.min(this.lightAt, list.length - 1), next = fn(list, at);
      this.lightAt = Math.max(0, Math.min(next.length - 1, pick(at, next.length)));
      set({ lights: lightsToParam(next) });
    };
    const addLight = el<HTMLButtonElement>('<button class="cv-btn" type="button">Add</button>'), dupLight = el<HTMLButtonElement>('<button class="cv-btn" type="button">Duplicate</button>'), delLight = el<HTMLButtonElement>('<button class="cv-btn" type="button">Delete</button>');
    addLight.addEventListener('click', () => edit((l) => (l.length >= LIGHT_LIMIT ? l : [...l, { color: '#ffffff', intensity: 60, rotation: 135, height: 35, softness: 40 }]), (_a, n) => n - 1));
    dupLight.addEventListener('click', () => edit((l, a) => (l.length >= LIGHT_LIMIT ? l : [...l.slice(0, a + 1), { ...l[a] }, ...l.slice(a + 1)]), (a) => a + 1));
    delLight.addEventListener('click', () => edit((l, a) => (l.length <= 1 ? l : l.filter((_, i) => i !== a)), (a) => a - 1));
    this.lbtn = { add: addLight, dup: dupLight, del: delLight };
    this.lightPreset = selectCtl('Preset', LIGHT_PRESETS, (v) => { const pr = LIGHTING_PRESETS[v]; this.lightAt = 0; set(pr ? { lights: lightsToParam(pr.lights), ambient: pr.ambient } : { lights: lightsToParam(this.specs()) }); });
    this.lightPick = selectCtl('Light', [['0', 'Light 1']], (v) => { this.lightAt = Number(v); this.sync(); });
    const lsl = (key: keyof LightSpec, label: string, min: number, max: number, unit: string): HTMLElement => { const c = slider(engine, label, min, max, (v) => this.patchLight(key, v), { unit }); this.lctl[key] = c; return c.el; };
    const lightColorRow = el('<label class="cv-props-field is-wide"><span class="cv-pf-label">Light Color</span></label>');
    lightColorRow.appendChild(this.lightColor);
    const rayTrace = check('Ray Tracing', (v) => set({ ray_trace: v }));
    this.ctl.ray_trace = rayTrace;
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
      section('Material'), row(material.el), sl('texture_scale', 'Texture Scale', 10, 400, '%'),
      part('map', section('Map Art'), row(this.symbols.el), sl('map_scale', 'Scale', 5, 400, '%'), sl('map_x', 'Offset X', -500, 500, 'pt'), sl('map_y', 'Offset Y', -500, 500, 'pt'), row(shadeArt.el)),
      section('Lighting'), row(this.lightPreset.el), row(this.lightPick.el), row(addLight, dupLight, delLight), row(lightColorRow), lsl('intensity', 'Intensity', 0, 200, '%'), lsl('rotation', 'Rotation', -180, 180, '°'), lsl('height', 'Height', 0, 90, '°'), lsl('softness', 'Softness', 0, 100, '%'),
      sl('ambient', 'Ambient', 0, 100, '%'), sl('highlight', 'Highlight', 0, 100, '%'), row(shadeRow),
      part('render', section('Render'), row(rayTrace.el), pick('quality', 'Quality', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']])),
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

  private specs(): LightSpec[] { return lightSpecs(this.target()?.e?.params ?? {}); }

  private patchLight(key: keyof LightSpec, v: number | string): void {
    const list = this.specs(), at = Math.min(this.lightAt, list.length - 1);
    if (at < 0) return;
    list[at] = { ...list[at], [key]: v };
    this.engine.set3d(null, { lights: lightsToParam(list) });
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
    setHidden(this.parts.get('render') as HTMLElement, false);
    this.materials.setChoices(MATERIALS.filter(([id]) => (k === '3d.inflate' ? id === 'plastic' || id === 'matte' || id === 'metal' : k === '3d.rotate' || id !== 'flat')));
    const list = lightSpecs(p), cur = list[Math.max(0, Math.min(this.lightAt, list.length - 1))];
    this.lightAt = Math.max(0, Math.min(this.lightAt, list.length - 1));
    this.lightPreset.set(lightingPreset(p));
    this.lightPick.setChoices(list.map((_, i) => [String(i), `Light ${i + 1}`] as const));
    this.lightPick.set(String(this.lightAt));
    setValue(this.lightColor, hexOr(cur.color));
    for (const key of ['intensity', 'rotation', 'height', 'softness'] as const) this.lctl[key]?.set(cur[key]);
    setDisabled(this.lbtn.add, list.length >= LIGHT_LIMIT);
    setDisabled(this.lbtn.dup, list.length >= LIGHT_LIMIT);
    setDisabled(this.lbtn.del, list.length <= 1);
    const ray = p.ray_trace === true;
    this.ctl.ray_trace?.set(ray);
    this.ctl.quality?.set(str(p, 'quality', 'medium'));
    this.ctl.quality?.enable?.(ray);
    this.ctl.texture_scale?.enable?.(ray && TEXTURED.has(str(p, 'material', 'plastic')));
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
    for (const key of ['bevel_height', 'angle', 'offset', 'volume', 'rx', 'ry', 'rz', 'perspective', 'ambient', 'highlight', 'map_x', 'map_y']) c[key]?.set(num(p, key, 0));
    c.texture_scale?.set(num(p, 'texture_scale', 100));
    c.depth?.set(num(p, 'depth', 50));
    c.inflate_depth?.set(num(p, 'depth', 20));
    c.cap?.set(p.cap !== false);
    for (const key of ['bevel', 'from', 'material']) c[key]?.set(str(p, key, ''));
    const rx = num(p, 'rx', 0), ry = num(p, 'ry', 0), rz = num(p, 'rz', 0);
    c.preset?.set(Object.entries(ROTATION_PRESETS).find(([, r]) => Math.abs(r[0] - rx) < 0.01 && Math.abs(r[1] - ry) < 0.01 && Math.abs(r[2] - rz) < 0.01)?.[0] ?? 'custom');
    setValue(this.shade, str(p, 'shading_color', '#000000'));
  }
}

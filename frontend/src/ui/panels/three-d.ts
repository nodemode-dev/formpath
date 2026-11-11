import type { Effect, Engine, VNode } from '../../engine';
import { LIGHT_LIMIT, LIGHTING_PRESETS, impliedSurface, lightingPreset, lightSpecs, lightsToParam, ROTATION_PRESETS, SURFACE_CHOICES, surfaceOf, surfaceSpecs, surfacesToParam, type LightSpec, type SurfSpec } from '../../engine/threed';
import { getMesh, isMeshMime } from '../../engine/modelmesh';
import { allNodes, newId } from '../../engine/doc';
import { imageAverage, textureAverage, textureName } from '../../engine/texture';
import { el, setDisabled, setHidden, setValue } from '../dom';
import { check, empty, page, row, section, seg, selectCtl, slider } from './kit';
import { ThreeDPreview } from './three-d-preview';

type Params = Effect['params'];
interface Settable { set(v: number | string | boolean): void; enable?(on: boolean): void }
const KINDS = [{ id: '3d.rotate', label: 'Plane' }, { id: '3d.extrude', label: 'Extrude' }, { id: '3d.revolve', label: 'Revolve' }, { id: '3d.inflate', label: 'Inflate' }];
const title = (s: string): string => s.split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
const PRESETS: ReadonlyArray<readonly [string, string]> = [['custom', 'Custom'], ...Object.keys(ROTATION_PRESETS).map((k) => [k, title(k)] as const)];
const MATERIALS: ReadonlyArray<readonly [string, string]> = [['plastic', 'Plastic'], ['matte', 'Matte'], ['metal', 'Metal'], ['brushed_metal', 'Brushed Metal'], ['wood', 'Wood'], ['rough', 'Rough'], ['wireframe', 'Wireframe'], ['flat', 'Flat']];
const TEXTURED = new Set(['brushed_metal', 'wood', 'rough']);
const SURF_KEYS = new Set(['material', 'roughness', 'metallic', 'texture', 'texture_color', 'texture_scale', 'texture_rotation', 'texture_offset_x', 'texture_offset_y', 'color']);
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
  private readonly textures: ReturnType<typeof selectCtl>;
  private readonly picker = el<HTMLInputElement>('<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>');
  private listed: { images: unknown; symbols: unknown; choices: Array<readonly [string, string]> } | null = null;
  private readonly lightColor = el<HTMLInputElement>('<input class="cv-color" type="color" aria-label="Light color">');
  private readonly materials: ReturnType<typeof selectCtl>;
  private readonly lightPreset: ReturnType<typeof selectCtl>;
  private readonly lightPick: ReturnType<typeof selectCtl>;
  private readonly lctl: Record<string, Settable> = {};
  private readonly lbtn: { add: HTMLButtonElement; dup: HTMLButtonElement; del: HTMLButtonElement };
  private lightAt = 0;
  private readonly view: ThreeDPreview;
  private frame = 0;
  private surface = 'all';
  private readonly surfaces: ReturnType<typeof selectCtl>;
  private readonly surfColor = el<HTMLInputElement>('<input class="cv-color" type="color" aria-label="Surface color">');
  private readonly surfBtn: { clear: HTMLButtonElement; reset: HTMLButtonElement };

  constructor(private readonly engine: Engine, private readonly run: (cmd: string) => void) {
    const set = (patch: Params): void => { engine.set3d(null, this.route(patch)); };
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
      let open = false, t = 0;
      const end = (): void => { window.clearTimeout(t); if (open) { open = false; engine.endGesture(); } };
      input.addEventListener('input', () => { if (!open) { open = true; engine.beginGesture(); } apply(input.value); window.clearTimeout(t); t = window.setTimeout(end, 800); });
      input.addEventListener('change', end);
      input.addEventListener('blur', end);
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
    this.textures = selectCtl('Source', [['', 'None']], (v) => { void this.pickTexture(v); });
    this.ctl.texture = this.textures;
    const fromFile = el<HTMLButtonElement>('<button class="cv-btn" type="button">Image from File</button>');
    fromFile.addEventListener('click', () => this.picker.click());
    this.picker.addEventListener('change', () => { const f = this.picker.files?.[0]; this.picker.value = ''; if (f) void this.addFile(f); });
    const fine = (key: string, label: string): HTMLElement => { const c = slider(engine, label, 0, 1, (v) => set({ [key]: Math.round(v * 100) / 100 }), { step: 0.01 }); this.ctl[key] = c; return c.el; };
    this.surfaces = selectCtl('Surface', [['all', 'All Surfaces']], (v) => { this.surface = v; this.sync(); });
    const surfColorRow = el('<label class="cv-props-field is-wide"><span class="cv-pf-label">Surface Color</span></label>');
    surfColorRow.appendChild(this.surfColor);
    picking(this.surfColor, (v) => set({ color: v }));
    const clearColor = el<HTMLButtonElement>('<button class="cv-btn" type="button">Clear Color</button>'), resetSurface = el<HTMLButtonElement>('<button class="cv-btn" type="button">Reset Surface</button>');
    clearColor.addEventListener('click', () => set({ color: '' }));
    resetSurface.addEventListener('click', () => this.resetSurface());
    this.surfBtn = { clear: clearColor, reset: resetSurface };
    const cull = check('Hide Back Faces', (v) => set({ cull: v }));
    this.ctl.cull = cull;
    const shadeArt = check('Shade Artwork', (v) => set({ shade_art: v })), shadow = check('Shadow', (v) => set({ shadow: v }));
    this.ctl.shade_art = shadeArt;
    this.ctl.shadow = shadow;
    this.view = new ThreeDPreview(engine, (i) => { this.lightAt = i; this.queue(); });
    this.form.append(
      this.view.el,
      part('extrude', section('Extrude'), sl('depth', 'Depth', 0, 500, 'pt'), row(cap.el), pick('bevel', 'Bevel', [['none', 'None'], ['classic', 'Classic'], ['rounded', 'Rounded']]), sl('bevel_height', 'Bevel Height', 0, 50, 'pt')),
      part('revolve', section('Revolve'), sl('angle', 'Angle', 1, 360, '°'), sl('offset', 'Offset', 0, 500, 'pt'), pick('from', 'From', [['left', 'Left Edge'], ['right', 'Right Edge']])),
      part('inflate', section('Inflate'), inflate.el, sl('volume', 'Volume', 10, 100, '%')),
      part('model', section('Model'), sl('max_faces', 'Vector Faces', 100, 60000), row(cull.el)),
      part('rotation', section('Rotation'), row(preset.el), sl('rx', 'X', -180, 180, '°'), sl('ry', 'Y', -180, 180, '°'), sl('rz', 'Z', -180, 180, '°'), part('perspective', sl('perspective', 'Perspective', 0, 160, '°'))),
      section('Material'), row(this.surfaces.el), row(material.el), row(surfColorRow), row(clearColor, resetSurface), fine('roughness', 'Roughness'), fine('metallic', 'Metallic'),
      part('graphic', section('Graphic'), row(this.textures.el), row(fromFile, this.picker), sl('texture_scale', 'Texture Scale', 10, 400, '%'), sl('texture_rotation', 'Texture Rotation', -180, 180, '°'), sl('texture_offset_x', 'Texture Offset X', -500, 500, 'pt'), sl('texture_offset_y', 'Texture Offset Y', -500, 500, 'pt')),
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

  private async pickTexture(ref: string): Promise<void> {
    const p = this.engine.current;
    if (!p) return;
    const avg = ref ? await textureAverage(p, ref) : null;
    this.engine.set3d(null, this.route({ texture: ref, texture_color: avg ?? '' }));
  }

  private route(patch: Params): Params {
    const id = this.surface, t = this.target();
    if (id === 'all' || !t?.e) return patch;
    const specs: Record<string, SurfSpec> = { ...(surfaceSpecs(t.e.params) ?? {}) }, cur: Record<string, string | number> = { ...(specs[id] ?? {}) } as Record<string, string | number>, out: Params = {};
    let touched = false;
    for (const [k, v] of Object.entries(patch)) {
      if (!SURF_KEYS.has(k)) { out[k] = v; continue; }
      touched = true;
      if (v === '' || typeof v === 'boolean') delete cur[k];
      else cur[k] = k === 'roughness' || k === 'metallic' || k.startsWith('texture_') && k !== 'texture_color' ? Number(v) : String(v);
    }
    if (!touched) return patch;
    if (Object.keys(patch).some((k) => k.startsWith('texture')) && cur.texture === undefined) { cur.texture = str(t.e.params, 'texture', ''); cur.texture_color = str(t.e.params, 'texture_color', ''); if (patch.texture !== undefined) { cur.texture = String(patch.texture); cur.texture_color = String(patch.texture_color ?? ''); } }
    if (patch.texture === '') cur.texture = '';
    if (Object.keys(cur).length) specs[id] = cur as SurfSpec; else delete specs[id];
    out.surfaces = surfacesToParam(specs);
    return out;
  }

  private resetSurface(): void {
    const t = this.target();
    if (!t?.e || this.surface === 'all') return;
    const specs: Record<string, SurfSpec> = { ...(surfaceSpecs(t.e.params) ?? {}) };
    delete specs[this.surface];
    this.engine.set3d(null, { surfaces: surfacesToParam(specs) });
  }

  private surfaceChoices(e: Effect): ReadonlyArray<readonly [string, string]> {
    const all: ReadonlyArray<readonly [string, string]> = [['all', 'All Surfaces']];
    if (e.id === '3d.model') return [...all, ...(getMesh(str(e.params, 'model', ''))?.groups ?? []).map((g, i) => [`g${i}`, `${i + 1}. ${g.name || 'Group'}`] as const)];
    return [...all, ...(SURFACE_CHOICES[e.id] ?? [])];
  }

  private async addFile(f: File): Promise<void> {
    const p = this.engine.current;
    if (!p) return;
    let bmp: ImageBitmap;
    try { bmp = await createImageBitmap(f); } catch { this.engine.notice(`${f.name} is not an image formpath can read.`, 'error'); return; }
    const ext = (f.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '') || 'png', base = f.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'image';
    const key = `img-tex${newId('').replace(/[^a-z0-9]/gi, '')}-${base}.${ext}`, avg = imageAverage(bmp, bmp.width, bmp.height);
    p.bitmaps.set(key, bmp);
    this.engine.beginGesture();
    this.engine.addImageAsset(key, f, bmp.width, bmp.height);
    this.engine.set3d(null, this.route({ texture: key, texture_color: avg ?? '' }));
    this.engine.endGesture();
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
    const k = e.id, choices = this.surfaceChoices(e);
    if (!choices.some(([id]) => id === this.surface)) this.surface = 'all';
    this.surfaces.setChoices(choices);
    this.surfaces.set(this.surface);
    this.surfaces.enable?.(choices.length > 1);
    const spec = this.surface === 'all' ? undefined : surfaceSpecs(p)?.[this.surface], m = (spec ? { ...p, ...spec } : p) as Params;
    setDisabled(this.surfColor, this.surface === 'all');
    setDisabled(this.surfBtn.clear, !spec?.color);
    setDisabled(this.surfBtn.reset, !spec);
    setValue(this.surfColor, hexOr(spec?.color ?? '#cccccc'));
    setHidden(this.parts.get('model') as HTMLElement, k !== '3d.model');
    setHidden(this.parts.get('graphic') as HTMLElement, k === '3d.model');
    this.ctl.max_faces?.set(num(p, 'max_faces', 4000));
    this.ctl.cull?.set(p.cull !== false);
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
    const doc = this.engine.doc, ref = str(m, 'texture', '').trim(), proj = this.engine.current;
    this.ctl.texture_scale?.enable?.(ref !== '' || (ray && TEXTURED.has(str(m, 'material', 'plastic'))));
    for (const key of ['texture_rotation', 'texture_offset_x', 'texture_offset_y']) this.ctl[key]?.enable?.(ref !== '');
    this.ctl.roughness?.enable?.(ray);
    this.ctl.metallic?.enable?.(ray);
    const surf = surfaceOf(m) ?? impliedSurface(str(m, 'material', 'plastic'));
    this.ctl.roughness?.set(surf.rough);
    this.ctl.metallic?.set(surf.metal);
    if (doc && proj) {
      if (!this.listed || this.listed.images !== doc.images || this.listed.symbols !== doc.symbols) {
        const names = new Map<string, string>();
        for (const x of allNodes(doc)) if (x.kind === 'image' && !names.has(x.src)) names.set(x.src, x.name ?? x.linked?.name ?? x.link ?? '');
        this.listed = { images: doc.images, symbols: doc.symbols, choices: [['', 'None'], ...Object.keys(doc.images).filter((k) => !isMeshMime(doc.images[k].mime)).map((k) => [k, `Image: ${names.get(k) || textureName(proj, k)}`] as const), ...doc.symbols.map((s) => [s.id, `Symbol: ${s.name}`] as const)] };
      }
      const pick = doc.symbols.find((s) => s.id === ref || s.name === ref)?.id ?? ref;
      this.textures.setChoices(!pick || this.listed.choices.some(([id]) => id === pick) ? this.listed.choices : [...this.listed.choices, [pick, 'Missing source']]);
      this.textures.set(pick);
    }
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
    for (const key of ['bevel_height', 'angle', 'offset', 'volume', 'rx', 'ry', 'rz', 'perspective', 'ambient', 'highlight', 'map_x', 'map_y', 'texture_rotation', 'texture_offset_x', 'texture_offset_y']) c[key]?.set(num(p, key, 0));
    for (const key of ['texture_rotation', 'texture_offset_x', 'texture_offset_y']) c[key]?.set(num(m, key, 0));
    c.texture_scale?.set(num(m, 'texture_scale', 100));
    c.depth?.set(num(p, 'depth', 50));
    c.inflate_depth?.set(num(p, 'depth', 20));
    c.cap?.set(p.cap !== false);
    for (const key of ['bevel', 'from']) c[key]?.set(str(p, key, ''));
    c.material?.set(str(m, 'material', ''));
    const rx = num(p, 'rx', 0), ry = num(p, 'ry', 0), rz = num(p, 'rz', 0);
    c.preset?.set(Object.entries(ROTATION_PRESETS).find(([, r]) => Math.abs(r[0] - rx) < 0.01 && Math.abs(r[1] - ry) < 0.01 && Math.abs(r[2] - rz) < 0.01)?.[0] ?? 'custom');
    setValue(this.shade, str(p, 'shading_color', '#000000'));
    this.view.sync(t?.n ?? null, e, this.lightAt);
  }
}

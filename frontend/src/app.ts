import { AgentBridge, regionOf } from './automation/agent-bridge';
import { Engine, type Color, type Doc, type Pt, type Units, type VNode } from './engine';
import { allNodes, findNode, nodeLabel, newId, updateNodes } from './engine/doc';
import { EFFECTS } from './engine/effects';
import { reflectAbout, rotateAbout, scaleAbout, shearAbout, translate, mul } from './engine/geometry';
import { transformNodes } from './engine/ops/objects';
import { pathOperation } from './engine/ops/paths';
import { collectColors, mapFn, RECOLOR, recolorDoc } from './engine/ops/recolor';
import { hex, parseColor, solid, defaultGradient, NONE } from './engine/paint';
import { fontsChanged, plainText } from './engine/text';
import { toolHost, toolList, type Tool } from './extensions/registry';
import { api, type Capabilities, type OpenedProject } from './io/api';
import { ensureFace, onFontsLoaded, outlineText, systemFonts } from './io/fonts';
import { exportPdf, readPdfNative } from './io/pdf';
import { docFromManifest, serialize } from './io/project-io';
import { canvasBlob, exportForScreens, exportRaster, renderRegion } from './io/raster';
import { recovery, type RecoveryRecord } from './io/recovery';
import { exportRegion, exportSvg, importSvg } from './io/svg';
import { DEFAULT_TRACE, TRACE_PRESETS, traceImage } from './io/trace';
import { unzip, zipFiles } from './io/zip';
import { PluginHost } from './plugins/host';
import { registerBuiltinTools } from './tools';
import { pendingShape, shapeAt } from './tools/draw';
import { typeDefaults } from './tools/type';
import { AboutDialog, ExportDialog, NewDocumentDialog, OpenDialog, ScreensDialog, SettingsDialog, ShortcutsDialog, type ExportChoice } from './ui/app-dialogs';
import { brandMark } from './ui/brand';
import { Commands } from './ui/commands';
import { anyDialogOpen, askSaveChanges, confirmAction, promptName } from './ui/dialogs';
import { Dock, ALL_PANELS } from './ui/dock';
import { el, mountOnce, q, revealApp, setDisabled, setHidden, setStyleVar, setText, setTitle } from './ui/dom';
import { enhanceAllSelects } from './ui/dropdown';
import { ErrorLog } from './ui/errors';
import { askForm, type FieldValue } from './ui/form-dialog';
import { HomeScreen } from './ui/home';
import { icon } from './ui/icons';
import { LayersPanel } from './ui/layers';
import { MenuBar, PopupMenu, type MenuDef, type MenuItem } from './ui/menu';
import { NativeMenus, wantsNativeMenus } from './ui/native-menu';
import { OptionsBar } from './ui/options';
import { invalidatePaint } from './ui/palette';
import { PanelGroup } from './ui/panel-group';
import { AppearancePanel, GraphicStylesPanel } from './ui/panels/appearance';
import { AgentConfirmDialog } from './ui/panels/agent-confirm';
import { AssistantPanel } from './ui/panels/assistant';
import { ColorPanel, GradientPanel, SwatchesPanel } from './ui/panels/color';
import { ColorPicker } from './ui/panels/color-picker';
import { HelpDialog } from './ui/panels/help';
import { ActionsPanel, HistoryPanel, InfoPanel, NavigatorPanel } from './ui/panels/navigator';
import { PluginsDialog } from './ui/panels/plugins-dialog';
import { effectDialog, previewEdit } from './ui/panels/preview-edit';
import { BrushesPanel, StrokePanel, TransparencyPanel } from './ui/panels/stroke';
import { ArtboardsPanel, LinksPanel, SymbolsPanel } from './ui/panels/symbols';
import { CharacterPanel, findReplaceDialog, GlyphsPanel, ParagraphPanel } from './ui/panels/type';
import { CHECKER_CELL, CHECKER_PAIR, applyPrefs, loadPrefs, savePrefs, type Prefs } from './ui/prefs';
import { AlignPanel, PathfinderPanel, PropertiesPanel, TransformPanel } from './ui/properties';
import { Rail } from './ui/rail';
import { Stage } from './ui/stage';
import { StatusBar } from './ui/status';
import { Tabs } from './ui/tabs';
import { TextEditor, typing as typingRef } from './ui/text-editor';
import { TitleTools } from './ui/titlebar-tools';
import { toast } from './ui/toast';
import { slotTool, toolGroups } from './ui/tool-groups';
import { Viewport } from './engine/viewport';
import { VERSION } from './version';

const LAYERS_W_KEY = 'formpth.layersW';
const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));
function stored(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function store(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { } }

const SHELL = `<div class="cv-app">
<header class="cv-titlebar">
<div class="cv-brand">${brandMark(18)}<span class="cv-brand-name">formpth</span></div>
<nav class="cv-menubar" aria-label="Main menu"></nav>
<div class="cv-zoom">
<button class="cv-icon-btn" type="button" data-cmd="undo">${icon('undo', 16)}</button>
<button class="cv-icon-btn" type="button" data-cmd="redo">${icon('redo', 16)}</button>
<span class="cv-sep"></span>
<button class="cv-icon-btn" type="button" data-cmd="zoom-out">${icon('zoomOut', 16)}</button>
<span class="cv-zoom-label"></span>
<button class="cv-icon-btn" type="button" data-cmd="zoom-in">${icon('zoomIn', 16)}</button>
<button class="cv-icon-btn" type="button" data-cmd="fit">${icon('fitView', 16)}</button>
<span class="cv-sep"></span>
<button class="cv-icon-btn" type="button" data-cmd="assistant">${icon('sparkle', 16)}</button>
<button class="cv-icon-btn" type="button" data-cmd="settings">${icon('settings', 16)}</button>
</div>
</header>
<div class="cv-main">
<div class="cv-options"></div>
<aside class="cv-rail" aria-label="Tools"><div class="cv-rail-tools"></div><div class="cv-colors"></div><div class="cv-rail-modes"><button class="cv-tool cv-mode-btn" type="button" data-cmd="draw-mode" aria-label="Drawing mode"></button><button class="cv-tool cv-mode-btn" type="button" data-cmd="screen-next" title="Change Screen Mode (F)" aria-label="Change Screen Mode">${icon('maximize', 18)}</button></div></aside>
<div class="cv-stage-col">
<div class="cv-doc-tabs"><div class="cv-tabs"><div class="cv-tab-strip" role="tablist"></div><button class="cv-icon-btn" type="button" data-cmd="new">${icon('add', 16)}</button></div></div>
<main class="cv-stage">
<canvas class="cv-canvas cv-scene"></canvas>
<canvas class="cv-canvas cv-overlay-canvas"></canvas>
<canvas class="cv-ruler cv-ruler-h" hidden></canvas>
<canvas class="cv-ruler cv-ruler-v" hidden></canvas>
<div class="cv-isolation" hidden><span class="cv-isolation-label"></span><button class="cv-btn" type="button" data-cmd="exit-isolation">${icon('exitIsolation', 14)}Exit Isolation Mode</button></div>
<div class="cv-welcome"><div class="cv-welcome-card">
<div class="cv-welcome-title">${brandMark(28)}formpth</div>
<div class="cv-welcome-sub">Vector illustration. Start a document, open a project, or drop an SVG anywhere on this stage.</div>
<div class="cv-welcome-actions"><button class="cv-btn cv-btn-primary" type="button" data-cmd="new">${icon('newFile', 14)}New Document</button><button class="cv-btn" type="button" data-cmd="open">${icon('load', 14)}Open</button></div>
</div></div>
<div class="cv-drop" hidden></div>
</main>
</div>
<section class="cv-props-col" aria-label="Properties"></section>
<div class="cv-resizer" role="separator" aria-orientation="vertical" aria-label="Resize the panels"></div>
<section class="cv-layers" aria-label="Panels"></section>
</div>
<footer class="cv-status"></footer>
</div>`;

const TAB_HOMES: Record<string, string> = { color: 'color-group', swatches: 'color-group', gradient: 'color-group', stroke: 'stroke-group', transparency: 'stroke-group', brushes: 'stroke-group', appearance: 'appearance-group', 'graphic-styles': 'appearance-group', symbols: 'symbols-group', artboards: 'symbols-group', links: 'symbols-group', navigator: 'navigator-group', info: 'navigator-group', history: 'navigator-group', actions: 'navigator-group', layers: 'layers-panel', properties: 'properties-group', transform: 'properties-group', align: 'properties-group', pathfinder: 'properties-group', character: 'type-group', paragraph: 'type-group', glyphs: 'type-group' };

export function startApp(): void {
  registerBuiltinTools();
  const appHost = document.getElementById('app');
  if (!appHost) return;
  mountOnce(appHost, SHELL);
  const root = q(appHost, '.cv-app');
  const savedWidth = Number(stored(LAYERS_W_KEY));
  if (savedWidth >= 220 && savedWidth <= 520) setStyleVar(root, '--cv-layers-w', `${savedWidth}px`);

  const engine = new Engine();
  engine.on('notice', (n) => toast(n.text, n.kind));
  const errorLog = new ErrorLog((t) => toast(t, 'error'), () => engine.failures);
  errorLog.install();
  const commands = new Commands();
  const contextMenu = new PopupMenu(commands, null, true);
  const panelMenu = new PopupMenu(commands, null, true);
  toolHost.run = (id) => { commands.run(id); };
  PanelGroup.menuHost = (anchor, ids) => { panelMenu.setItems(ids); const r = anchor.getBoundingClientRect(); panelMenu.openAt(r.right, r.bottom + 4); };

  let prefs = loadPrefs();
  applyPrefs(engine, prefs);
  const stageEl = q(root, '.cv-stage');
  const stage = new Stage(stageEl, engine);
  const typing = new TextEditor(stageEl, engine);
  typingRef.editor = typing;
  typing.redraw = () => stage.ctx.redraw();
  typing.style = () => ({ font: typeDefaults.font, style: typeDefaults.style, size: typeDefaults.size });
  stage.onType((r) => { if (!/^(type|areaType|typePath|typeVertical)$/.test(engine.tool)) engine.setTool('type'); typing.begin(r); });

  const applyUiPrefs = (pr: Prefs): void => {
    Stage.prefs = { ...Stage.prefs, zoomWheel: pr.zoomWheel, gridColor: pr.gridColor, guideColor: pr.guideColor, snapTol: pr.snapTolerance, gridInBack: pr.gridInBack, cell: CHECKER_CELL[pr.checkerSize] };
    const [a, b] = CHECKER_PAIR[pr.checkerColors];
    document.documentElement.style.setProperty('--cv-checker-a', a);
    document.documentElement.style.setProperty('--cv-checker-b', b);
    invalidatePaint();
    stage.restyle();
  };
  applyUiPrefs(prefs);

  const picker = new ColorPicker();
  const pickColor = (c: Color): Promise<Color | null> => picker.pick(c);

  const dockHost = q(root, '.cv-layers'), sideHost = q(root, '.cv-props-col');
  const colorP = new ColorPanel(engine), swatchesP = new SwatchesPanel(engine, pickColor), gradientP = new GradientPanel(engine, pickColor);
  const strokeP = new StrokePanel(engine), transP = new TransparencyPanel(engine), brushesP = new BrushesPanel(engine);
  const effectsMenu = new PopupMenu(commands, null, true);
  const appearanceP = new AppearancePanel(engine, pickColor, (anchor) => { effectsMenu.setItems(effectItems()); const r = anchor.getBoundingClientRect(); effectsMenu.openAt(r.left, r.top - 8); });
  const stylesP = new GraphicStylesPanel(engine);
  const symbolsP = new SymbolsPanel(engine), artboardsP = new ArtboardsPanel(engine);
  const relinkInput = el<HTMLInputElement>('<input type="file" accept="image/*" hidden>');
  document.body.appendChild(relinkInput);
  let relinkId: string | null = null;
  relinkInput.addEventListener('change', () => { const f = relinkInput.files?.[0]; relinkInput.value = ''; if (f && relinkId) void relink(relinkId, f); });
  const linksP = new LinksPanel(engine, (id) => { relinkId = id; relinkInput.click(); });
  const navP = new NavigatorPanel(engine), infoP = new InfoPanel(engine), historyP = new HistoryPanel(engine), actionsP = new ActionsPanel(commands, (t) => toast(t));
  const layersP = new LayersPanel(engine, contextMenu);
  const propsP = new PropertiesPanel(engine, (c) => { commands.run(c); });
  const xformP = new TransformPanel(engine), alignP = new AlignPanel(engine), pfP = new PathfinderPanel(engine);
  const charP = new CharacterPanel(engine), paraP = new ParagraphPanel(engine), glyphsP = new GlyphsPanel(engine);
  void historyP; void navP;
  new PanelGroup(dockHost, 'color-group', [{ id: 'color', label: 'Color', body: colorP.body }, { id: 'swatches', label: 'Swatches', body: swatchesP.body }, { id: 'gradient', label: 'Gradient', body: gradientP.body }], 'Color');
  new PanelGroup(dockHost, 'stroke-group', [{ id: 'stroke', label: 'Stroke', body: strokeP.body }, { id: 'transparency', label: 'Transparency', body: transP.body }, { id: 'brushes', label: 'Brushes', body: brushesP.body }], 'Stroke');
  new PanelGroup(dockHost, 'appearance-group', [{ id: 'appearance', label: 'Appearance', body: appearanceP.body }, { id: 'graphic-styles', label: 'Graphic Styles', body: stylesP.body }], 'Appearance');
  new PanelGroup(dockHost, 'symbols-group', [{ id: 'symbols', label: 'Symbols', body: symbolsP.body }, { id: 'artboards', label: 'Artboards', body: artboardsP.body }, { id: 'links', label: 'Links', body: linksP.body }], 'Symbols');
  new PanelGroup(dockHost, 'navigator-group', [{ id: 'navigator', label: 'Navigator', body: navP.body }, { id: 'info', label: 'Info', body: infoP.body }, { id: 'history', label: 'History', body: historyP.body }, { id: 'actions', label: 'Actions', body: actionsP.body }], 'Navigator');
  new PanelGroup(dockHost, 'layers-panel', [{ id: 'layers', label: 'Layers', body: layersP.body }], 'Layers');
  new PanelGroup(sideHost, 'properties-group', [{ id: 'properties', label: 'Properties', body: propsP.body }, { id: 'transform', label: 'Transform', body: xformP.body }, { id: 'align', label: 'Align', body: alignP.body }, { id: 'pathfinder', label: 'Pathfinder', body: pfP.body }], 'Properties');
  new PanelGroup(sideHost, 'type-group', [{ id: 'character', label: 'Character', body: charP.body }, { id: 'paragraph', label: 'Paragraph', body: paraP.body }, { id: 'glyphs', label: 'Glyphs', body: glyphsP.body }], 'Type');
  const dock = new Dock(dockHost, sideHost);
  const propsShown = (): boolean => stored('formpth.propsCol') !== 'hidden';
  const sideOpen = (): boolean => propsShown() && dock.sideShown() > 0;
  const syncPropsCol = (): void => { setHidden(sideHost, !sideOpen()); setStyleVar(root, '--cv-props-w', sideOpen() ? '46px' : '0px'); Viewport.insetRight = sideOpen() ? 238 : 0; };
  dock.onChange = () => syncPropsCol();
  syncPropsCol();
  PanelGroup.restoreHomes();
  PanelGroup.onMoved = () => dock.refresh();
  const syncDockWidth = (on: boolean): void => { const w = Number(stored(LAYERS_W_KEY)); setStyleVar(root, '--cv-layers-w', on ? '46px' : `${w >= 220 && w <= 520 ? w : 300}px`); q(root, '.cv-resizer').classList.toggle('is-inert', on); };
  dock.onCollapse = syncDockWidth;
  if (dock.collapsed) syncDockWidth(true);
  const showPanel = (tab: string): void => {
    const gid = [...PanelGroup.all.values()].find((g) => g.has(tab))?.id ?? TAB_HOMES[tab];
    const g = gid ? PanelGroup.all.get(gid) : null;
    const dockId = ALL_PANELS.find((x) => x.selector === `section.cv-${gid}`)?.id;
    if (dockId && !dock.isShown(dockId)) dock.toggle(dockId);
    if (gid === 'properties-group' || gid === 'type-group') { store('formpth.propsCol', 'shown'); syncPropsCol(); }
    g?.setMinimised(false);
    g?.show(tab);
  };

  enhanceAllSelects();
  new TitleTools(q(root, '.cv-titlebar'), {
    commands,
    arrange: (w) => { dock.arrange(w.order, w.hidden); store('formpth.propsCol', w.propsColumn ? 'shown' : 'hidden'); syncPropsCol(); },
    locked: () => dock.locked,
    setLocked: (on) => { dock.locked = on; },
  });
  dock.locked = dock.locked;
  new Rail(q(root, '.cv-rail'), engine);
  new OptionsBar(q(root, '.cv-options'), engine);
  const status = new StatusBar(q(root, '.cv-status'), engine);
  stage.onPointerDoc = (pt) => { status.setPointer(pt); infoP.setPointer(pt); };
  let caps: Capabilities | null = null;

  const RECENT_KEY = 'formpth.recent';
  let recent: string[] = [];
  try { const v: unknown = JSON.parse(stored(RECENT_KEY) ?? '[]'); if (Array.isArray(v)) recent = v.filter((n): n is string => typeof n === 'string' && !!n).slice(0, 10); } catch { recent = []; }
  const keepRecent = (next: string[]): void => { recent = next.slice(0, 10); store(RECENT_KEY, JSON.stringify(recent)); };
  const noteRecent = (name: string): void => keepRecent([name, ...recent.filter((n) => n !== name)]);

  async function deliver(blob: Blob, name: string): Promise<void> {
    if (caps?.desktop) { try { toast(`Saved to ${await api.exportFile(blob, name)}`); return; } catch (err) { toast(message(err), 'error'); } }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  const imageKey = (blob: Blob): string => `img-${newId('').replace(/[^a-z0-9]/gi, '')}.${(blob.type.split('/')[1] ?? 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg').replace(/[^a-z0-9]/g, '') || 'png'}`;

  function adopt(doc: Doc, name: string, assets: Map<string, Blob>, libraryName: string | null = null): void {
    const p = engine.addProject(doc, name);
    for (const [k, b] of assets) p.assets.set(k, b);
    engine.markSaved(p, name, libraryName);
    loadFaces(doc);
    engine.repaint();
  }

  function loadFaces(doc: Doc): void {
    const seen = new Set<string>();
    for (const n of allNodes(doc)) if (n.kind === 'text') for (const s of n.spans) { const k = `${s.style.font}|${s.style.style}`; if (!seen.has(k)) { seen.add(k); void ensureFace(s.style.font, s.style.style); } }
  }

  async function openFpth(data: ArrayBuffer, name: string, libraryName: string | null = null): Promise<void> {
    const files = await unzip(data);
    const mk = [...files.keys()].find((k) => /(^|\/)manifest\.json$/.test(k));
    if (!mk) throw new Error(`${name} is not a formpth project (no manifest.json).`);
    const prefix = mk.slice(0, -'manifest.json'.length);
    const manifest = JSON.parse(new TextDecoder().decode(files.get(mk))) as Record<string, unknown>;
    const doc = docFromManifest(manifest), assets = new Map<string, Blob>();
    for (const key of Object.keys(doc.images)) { const b = files.get(`${prefix}images/${key}`); if (b) assets.set(key, new Blob([b as Uint8Array<ArrayBuffer>], { type: doc.images[key].mime })); }
    adopt(doc, name.replace(/\.fpth$/i, ''), assets, libraryName);
  }

  async function openOpened(o: OpenedProject, libraryName: string | null): Promise<void> {
    const doc = docFromManifest(o.manifest), assets = new Map<string, Blob>();
    for (const key of Object.keys(doc.images)) { const url = o.images[key]; if (url) try { assets.set(key, await api.fetchAsset(url)); } catch { } }
    adopt(doc, o.name, assets, libraryName);
    const p = engine.current;
    if (p) p.libraryVersion = libraryName ? o.version ?? null : null;
  }

  async function openLibrary(name: string): Promise<boolean> {
    const existing = engine.projects.find((p) => p.libraryName === name && !p.modified);
    if (existing) { engine.switchTo(existing.id); return true; }
    return engine.task(async () => {
      try { await openOpened(await api.openLibrary(name), name); noteRecent(name); return true; }
      catch (err) { if (/not found/i.test(message(err))) keepRecent(recent.filter((n) => n !== name)); toast(message(err), 'error'); return false; }
    });
  }

  async function svgText(f: File): Promise<string> {
    if (/\.svgz$/i.test(f.name) && typeof DecompressionStream !== 'undefined') return new Response(f.stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return f.text();
  }

  async function imageSize(blob: Blob): Promise<{ w: number; h: number }> { const b = await createImageBitmap(blob); const s = { w: b.width, h: b.height }; b.close(); return s; }

  async function openFiles(files: File[]): Promise<void> {
    await engine.task(async () => {
      for (const f of files) {
        try {
          const lower = f.name.toLowerCase();
          if (lower.endsWith('.fpth')) await openFpth(await f.arrayBuffer(), f.name);
          else if (lower.endsWith('.svg') || lower.endsWith('.svgz')) { const r = await importSvg(await svgText(f), f.name.replace(/\.svgz?$/i, '')); adopt(r.doc, r.title, r.assets); if (!r.native) toast(`Opened ${f.name}. SVG brings paths, shapes, gradients, clipping, type and images; filters and masks it cannot match are left out.`); }
          else if (lower.endsWith('.pdf') || lower.endsWith('.ai')) {
            const native = await readPdfNative(await f.arrayBuffer());
            if (!native) { toast(`${f.name} was not saved by formpth with its editing data, and formpth reads only those PDFs so far. Place it as an image after exporting a PNG, or open its SVG.`, 'error'); continue; }
            adopt(docFromManifest(native.manifest), f.name.replace(/\.(pdf|ai)$/i, ''), native.assets);
          } else if (f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(lower)) {
            const s = await imageSize(f);
            const p = engine.newDocument(s.w, s.h, { title: f.name.replace(/\.[^.]+$/, ''), units: 'px' });
            const key = imageKey(f);
            engine.addImage(key, f, s.w, s.h, { x: 0, y: 0 }, undefined, f.name);
            p.history.markSaved();
          } else toast(`formpth cannot open ${f.name}.`, 'error');
        } catch (err) { toast(`${f.name}: ${message(err)}`, 'error'); }
      }
    });
  }

  async function placeFile(f: File, at: Pt | null, width: number | null): Promise<string | null> {
    const p = engine.current;
    if (!p) { await openFiles([f]); const opened = engine.current as { doc: Doc } | null; return opened?.doc.layers[0]?.children[0]?.id ?? null; }
    const v = p.viewport, center = v.toDoc(v.centerX, v.height / 2);
    if (/\.svgz?$/i.test(f.name) || f.type === 'image/svg+xml') {
      const r = await importSvg(await svgText(f), f.name);
      const kids = r.doc.layers.flatMap((l) => l.children);
      if (!kids.length) return null;
      for (const [k, b] of r.assets) p.assets.set(k, b);
      const g: VNode = { id: newId('g'), kind: 'group', clip: false, children: kids, opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, name: f.name };
      const bounds = engine.boundsOf(g);
      const dx = (at ? at.x : center.x - bounds.w / 2) - bounds.x, dy = (at ? at.y : center.y - bounds.h / 2) - bounds.y;
      const moved = transformNodes({ ...p.doc, layers: [{ ...p.doc.layers[0], children: [g] }] }, [g.id], translate(dx, dy)).doc.layers[0].children[0];
      engine.edit('Place', (d) => ({ ...d, images: { ...d.images, ...r.doc.images }, symbols: [...d.symbols, ...r.doc.symbols], patterns: [...d.patterns, ...r.doc.patterns] }));
      return engine.addNodes('Place', [moved])[0] ?? null;
    }
    const s = await imageSize(f), key = imageKey(f), w = width ?? s.w, h = (w / s.w) * s.h;
    return engine.addImage(key, f, s.w, s.h, at ?? { x: center.x - w / 2, y: center.y - h / 2 }, w, f.name) || null;
  }

  async function relink(id: string, f: File): Promise<void> {
    const s = await imageSize(f), key = imageKey(f), p = engine.current;
    if (!p) return;
    p.assets.set(key, f);
    engine.edit('Relink', (d) => ({ ...updateNodes(d, [id], (n) => (n.kind === 'image' ? { ...n, src: key, w: s.w, h: s.h, xf: [n.xf[0] * (n.w / s.w), n.xf[1] * (n.w / s.w), n.xf[2] * (n.h / s.h), n.xf[3] * (n.h / s.h), n.xf[4], n.xf[5]], link: f.name } : n)), images: { ...d.images, [key]: { mime: f.type || 'image/png', w: s.w, h: s.h } } }));
  }

  async function projectZip(): Promise<Blob | null> {
    const p = engine.current;
    if (!p) return null;
    const { manifest, files } = serialize(p);
    return zipFiles([{ name: 'manifest.json', blob: new Blob([JSON.stringify(manifest)], { type: 'application/json' }) }, ...files.map((f) => ({ name: `images/${f.name}`, blob: f.blob }))]);
  }

  async function save(saveAs: boolean): Promise<boolean> {
    const p = engine.current;
    if (!p) return false;
    typing.end();
    let name = saveAs ? null : p.libraryName;
    if (!name) {
      name = await promptName(saveAs ? 'Save As' : 'Save to Library', p.libraryName ?? p.name, 'Save');
      if (!name) return false;
      if (name !== p.libraryName) {
        const taken = (await api.library().catch(() => [])).some((i) => i.name === name);
        if (taken && !(await confirmAction('Replace project?', `${name} already exists in the library.`, 'Replace', true))) return false;
      }
    }
    const target = name;
    return engine.task(async () => {
      const revision = p.history.revision;
      try {
        const { manifest, files } = serialize(p);
        const res = await api.save(target, manifest, files, target === p.libraryName ? p.libraryVersion ?? '' : '');
        if (p.history.revision === revision) engine.markSaved(p, res.name, res.name);
        else { p.name = res.name; p.libraryName = res.name; engine.emit('projects', null); }
        p.libraryVersion = res.version ?? null;
        if (res.conflict) toast(`${res.kept ?? target} changed elsewhere since you opened it, so it was kept; yours was saved beside it as ${res.name}.`, 'info');
        else toast(`Saved ${res.name}.`);
        noteRecent(res.name);
        return true;
      } catch (err) {
        toast(`${message(err)} You can still keep your work with File > Download Project.`, 'error');
        return false;
      }
    });
  }

  async function exportBlob(c: ExportChoice): Promise<Blob | null> {
    const p = engine.current;
    if (!p) return null;
    typing.end();
    const scope = c.scope, ab = c.artboard;
    if (c.format === 'svg') {
      const ids = scope === 'selection' ? engine.targetIds() : undefined;
      return new Blob([await exportSvg(p, { artboard: scope === 'all' ? 'all' : scope === 'art' ? 'art' : ab, outlineText: c.outlineText, preserve: c.preserve, precision: 3, ids })], { type: 'image/svg+xml' });
    }
    if (c.format === 'pdf') return exportPdf(p, { artboards: scope === 'all' || scope === 'art' ? p.doc.artboards.map((_, i) => i) : [ab], preserve: c.preserve, ppi: p.doc.rasterPpi || 300, version: VERSION });
    const region = scope === 'selection' ? regionOf(engine, 'selection') : scope === 'art' ? exportRegion(p, 'art') : scope === 'all' ? exportRegion(p, 'all') : exportRegion(p, ab);
    if (!region) return null;
    const only = scope === 'selection' ? engine.targetIds().map((id) => findNode(p.doc, id)).filter((n): n is VNode => !!n) : undefined;
    const bg = scope === 'artboard' ? p.doc.artboards[ab]?.bg ?? null : null;
    return exportRaster(p, { region, scale: c.scale, format: c.format, quality: c.quality, transparent: c.transparent, bg, only });
  }

  const exportDialog = new ExportDialog(), screensDialog = new ScreensDialog();
  async function exportAs(format: ExportChoice['format']): Promise<void> {
    const p = engine.current;
    if (!p) return;
    const c = await exportDialog.ask(format, p.activeArtboard, engine.hasSelection);
    if (!c) return;
    await engine.task(async () => {
      try {
        const blob = await exportBlob(c);
        if (!blob) { toast('There is nothing to export there.', 'error'); return; }
        const suffix = c.scope === 'artboard' && p.doc.artboards.length > 1 ? `-${p.doc.artboards[c.artboard]?.name ?? ''}` : '';
        await deliver(blob, `${p.name}${suffix}.${c.format}`.replace(/[\\/:*?"<>|]+/g, '-'));
      } catch (err) { toast(message(err), 'error'); }
    });
  }
  async function exportScreens(): Promise<void> {
    const p = engine.current;
    if (!p) return;
    const v = await screensDialog.ask(p.doc.artboards.map((a) => a.name), p.activeArtboard);
    if (!v || !v.artboards.length || !v.items.length) return;
    await engine.task(async () => {
      try {
        const items = v.artboards.flatMap((artboard) => v.items.map((it) => ({ artboard, scale: it.scale, format: it.format as 'png', suffix: it.suffix })));
        const zip = await exportForScreens(p, items, (ab) => exportPdf(p, { artboards: ab, preserve: false, ppi: p.doc.rasterPpi || 300, version: VERSION }));
        await deliver(zip, `${p.name}-screens.zip`);
      } catch (err) { toast(message(err), 'error'); }
    });
  }

  async function makeOutlines(ids?: string[]): Promise<boolean> {
    return engine.task(() => engine.createOutlines(async (n) => { await ensureFace(n.spans[0]?.style.font ?? 'Inter', n.spans[0]?.style.style ?? 'Regular'); return outlineText(n); }, ids));
  }

  async function trace(id: string, a: Record<string, unknown>): Promise<string | null> {
    const p = engine.current, n = p ? findNode(p.doc, id) : null;
    if (!p || !n || n.kind !== 'image') return null;
    const blob = p.assets.get(n.src);
    if (!blob) return null;
    const presetKey = Object.keys(TRACE_PRESETS).find((k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === String(a.preset ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''));
    const o = { ...DEFAULT_TRACE, ...(presetKey ? TRACE_PRESETS[presetKey] : {}), ...(typeof a.colors === 'number' ? { colors: a.colors, mode: 'color' as const } : {}), ...(typeof a.threshold === 'number' ? { threshold: a.threshold, mode: 'bw' as const } : {}), ...(typeof a.paths === 'number' ? { detail: Math.max(0, Math.min(1, a.paths / 100)) } : {}), ...(typeof a.ignore_white === 'boolean' ? { ignoreWhite: a.ignore_white } : {}) };
    const g = await engine.task(() => traceImage(blob, n.xf, { w: n.w, h: n.h }, o));
    if (!g) return null;
    engine.edit('Image Trace', (d) => ({ doc: updateNodes(d, [id], () => g), select: [g.id] }));
    return g.id;
  }

  async function traceDialog(): Promise<void> {
    const n = engine.selected().find((x) => x.kind === 'image');
    if (!n) { toast('Select a placed image to trace.'); return; }
    const v = await askForm('Image Trace', [
      { kind: 'select', key: 'preset', label: 'Preset', value: '6 Colors', choices: Object.keys(TRACE_PRESETS).map((k) => [k, k] as const) },
      { kind: 'number', key: 'colors', label: 'Colors', value: 6, min: 2, max: 64 },
      { kind: 'number', key: 'threshold', label: 'Threshold (black and white)', value: 128, min: 1, max: 255 },
      { kind: 'number', key: 'paths', label: 'Paths fidelity', value: 50, min: 0, max: 100, unit: '%' },
      { kind: 'check', key: 'ignore_white', label: 'Ignore white', value: false },
    ], { ok: 'Trace' });
    if (!v) return;
    const preset = TRACE_PRESETS[String(v.preset)] ?? {};
    const args: Record<string, unknown> = { preset: v.preset, paths: v.paths, ignore_white: v.ignore_white };
    if (preset.mode === 'bw') args.threshold = v.threshold; else args.colors = v.colors;
    const id = await trace(n.id, args);
    if (!id) toast('The trace found no shapes: try another preset.', 'error');
  }

  const home = new HomeScreen(stageEl, { engine, autoShow: () => loadPrefs().autoShowHome, recent: () => recent, openRecent: (name) => { void openLibrary(name); }, run: (c) => { commands.run(c); }, preset: (id) => newDoc.createPreset(id) });
  const brand = q(root, '.cv-brand');
  brand.setAttribute('role', 'button'); brand.setAttribute('tabindex', '0'); brand.setAttribute('aria-label', 'Home'); brand.title = 'Home';
  brand.addEventListener('click', () => home.show());
  brand.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); home.show(); } });

  const newDoc = new NewDocumentDialog(engine);
  const openDialog = new OpenDialog({ openLibrary, openFiles });
  const settings = new SettingsDialog((pr) => { prefs = pr; applyPrefs(engine, pr); applyUiPrefs(pr); recoveryDelay = pr.recoverySeconds * 1000; home.sync(); });
  settings.workspaceLock = { get: () => dock.locked, set: (on) => { dock.locked = on; } };
  const shortcuts = new ShortcutsDialog(commands, () => toolList().filter((t) => t.shortcut).map((t) => ({ label: t.label, key: t.shortcut as string })));
  const about = new AboutDialog();
  const help = new HelpDialog();
  const agentConfirm = new AgentConfirmDialog();
  const placeInput = el<HTMLInputElement>('<input type="file" accept="image/*,.svg,.svgz" multiple hidden>');
  document.body.appendChild(placeInput);
  placeInput.addEventListener('change', () => { const fs = Array.from(placeInput.files ?? []); placeInput.value = ''; void engine.task(async () => { for (const f of fs) { try { await placeFile(f, null, null); } catch (err) { toast(`${f.name}: ${message(err)}`, 'error'); } } }); });

  const agents = new AgentBridge(engine, {
    ask: (title, text) => agentConfirm.ask(title, text),
    note: (t) => status.setEngine(t),
    allow: () => { savePrefs({ ...loadPrefs(), agentsAllowed: true }); window.dispatchEvent(new CustomEvent('formpth:agents', { detail: true })); },
    openFile: (f) => openFiles([f]),
    placeFile,
    projectBlob: projectZip,
    exportBlob: (format, o) => { const p = engine.current; if (!p) return Promise.resolve(null); const scope = o.scope === 'all_artboards' ? 'all' : o.scope === 'document' ? 'art' : o.scope === 'selection' ? 'selection' : 'artboard'; return exportBlob({ format: format === 'jpeg' ? 'jpg' : format, scope, artboard: o.artboard ?? p.activeArtboard, scale: o.scale, quality: o.quality, transparent: o.transparent, outlineText: o.outlineText, preserve: format === 'pdf' || format === 'svg' }); },
    image: async (scope, artboard, maxSize, outline) => {
      const p = engine.current;
      if (!p) return null;
      const r = regionOf(engine, scope, artboard ?? p.activeArtboard);
      if (!r) return null;
      const was = engine.view.outline;
      if (outline !== was) engine.view = { ...engine.view, outline };
      try { const c = await renderRegion(p, { region: r, scale: Math.min(8, maxSize / Math.max(r.w, r.h)), transparent: false }); return await canvasBlob(c, 'png', 1); }
      finally { if (outline !== was) engine.view = { ...engine.view, outline: was }; }
    },
    svg: async (scope, artboard, ids) => { const p = engine.current; if (!p) return ''; return exportSvg(p, { artboard: scope === 'document' ? 'all' : artboard ?? p.activeArtboard, outlineText: false, preserve: false, precision: 2, ids: ids ?? (scope === 'selection' ? engine.targetIds() : undefined) }); },
    outlines: (ids) => makeOutlines(ids),
    trace,
  });
  agents.commands = commands;
  agents.setEnabled(loadPrefs().agentsAllowed);
  window.addEventListener('formpth:agents', (ev) => agents.setEnabled((ev as CustomEvent<boolean>).detail === true));
  const assistant = new AssistantPanel(engine, agents);
  document.body.appendChild(assistant.el);
  const pluginHost = new PluginHost(engine, agents, commands, (t, kind) => toast(t, kind ?? 'info'));
  pluginHost.placeSvg = async (svgSrc, at) => { const f = new File([svgSrc], 'plugin.svg', { type: 'image/svg+xml' }); const id = await placeFile(f, at, null); return id ? [id] : []; };
  const pluginsDialog = new PluginsDialog(pluginHost, (title, text, ok) => confirmAction(title, text, ok));
  void pluginHost.loadAll();

  root.addEventListener('cv-pick-color', (ev) => {
    const slot = (ev as CustomEvent<'fill' | 'stroke'>).detail;
    engine.setActiveSlot(slot);
    const cur = slot === 'fill' ? engine.fillPaint : engine.strokePaint, start = cur.type === 'color' ? cur.color : cur.type === 'gradient' ? cur.gradient.stops[0].color : { kind: 'rgb' as const, r: 0, g: 0, b: 0 };
    void picker.pick(start).then((c) => { if (c) engine.setActivePaint(solid(c)); });
  });
  root.addEventListener('cv-paint-kind', (ev) => paintKind((ev as CustomEvent<string>).detail));
  function paintKind(k: string): void {
    const cur = engine.activeSlot === 'fill' ? engine.fillPaint : engine.strokePaint;
    if (k === 'none') engine.setActivePaint(NONE);
    else if (k === 'gradient') { engine.setActivePaint(cur.type === 'gradient' ? cur : { type: 'gradient', gradient: defaultGradient() }); showPanel('gradient'); }
    else engine.setActivePaint(cur.type === 'color' ? cur : solid(cur.type === 'gradient' ? cur.gradient.stops[0].color : { kind: 'rgb', r: 0, g: 0, b: 0 }));
  }

  const has = (): boolean => !!engine.current;
  const sel = (): boolean => engine.hasSelection;
  const many = (): boolean => engine.selected().length > 1;
  const kindSel = (...k: string[]): boolean => engine.selected().some((n) => k.includes(n.kind));
  const xfo = () => ({ strokes: engine.view.scaleStrokes, patterns: engine.view.transformPatterns, gradients: true });
  const centerOfSel = (): Pt => { const b = engine.selectionBounds(false); return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : { x: 0, y: 0 }; };

  async function transformDialog(kind: 'move' | 'rotate' | 'scale' | 'reflect' | 'shear'): Promise<void> {
    if (!sel()) return;
    const ids = engine.targetIds(), o = centerOfSel();
    const fields = {
      move: [{ kind: 'number', key: 'dx', label: 'Horizontal', value: 0, unit: 'pt' }, { kind: 'number', key: 'dy', label: 'Vertical', value: 0, unit: 'pt' }],
      rotate: [{ kind: 'number', key: 'angle', label: 'Angle', value: 0, unit: '°', min: -360, max: 360 }],
      scale: [{ kind: 'number', key: 'h', label: 'Horizontal', value: 100, unit: '%' }, { kind: 'number', key: 'v', label: 'Vertical', value: 100, unit: '%' }, { kind: 'check', key: 'uniform', label: 'Uniform', value: true }],
      reflect: [{ kind: 'select', key: 'axis', label: 'Axis', value: 'vertical', choices: [['vertical', 'Vertical'], ['horizontal', 'Horizontal']] }],
      shear: [{ kind: 'number', key: 'angle', label: 'Shear Angle', value: 0, unit: '°', min: -89, max: 89 }, { kind: 'select', key: 'axis', label: 'Axis', value: 'horizontal', choices: [['horizontal', 'Horizontal'], ['vertical', 'Vertical']] }],
    }[kind] as Parameters<typeof askForm>[1];
    const matrix = (v: Record<string, FieldValue>) => {
      switch (kind) {
        case 'move': return translate(Number(v.dx), Number(v.dy));
        case 'rotate': return rotateAbout(-Number(v.angle), o.x, o.y);
        case 'scale': { const h = Number(v.h) / 100, vv = v.uniform ? h : Number(v.v) / 100; return scaleAbout(h || 0.001, vv || 0.001, o.x, o.y); }
        case 'reflect': return v.axis === 'horizontal' ? reflectAbout('vertical', o.x, o.y) : reflectAbout('horizontal', o.x, o.y);
        default: return shearAbout(Number(v.angle), v.axis === 'vertical' ? 'vertical' : 'horizontal', o.x, o.y);
      }
    };
    let copied = false;
    const r = await previewEdit(engine, kind[0].toUpperCase() + kind.slice(1), fields, (origin, v) => { const res = transformNodes(origin, ids, matrix(v), false, xfo()); return { doc: res.doc, select: res.ids }; }, { extra: { label: 'Copy', build: (origin, v) => { copied = true; const res = transformNodes(origin, ids, matrix(v), true, xfo()); return { doc: res.doc, select: res.ids }; } } });
    if (r) engine.lastTransform = { m: matrix(r), copy: copied };
  }

  async function transformEachDialog(): Promise<void> {
    if (!sel()) return;
    const ids = engine.targetIds();
    await previewEdit(engine, 'Transform Each', [
      { kind: 'number', key: 'sh', label: 'Scale horizontal', value: 100, unit: '%' }, { kind: 'number', key: 'sv', label: 'Scale vertical', value: 100, unit: '%' },
      { kind: 'number', key: 'dx', label: 'Move horizontal', value: 0, unit: 'pt' }, { kind: 'number', key: 'dy', label: 'Move vertical', value: 0, unit: 'pt' },
      { kind: 'number', key: 'angle', label: 'Rotate', value: 0, unit: '°' }, { kind: 'check', key: 'rx', label: 'Reflect X', value: false }, { kind: 'check', key: 'ry', label: 'Reflect Y', value: false }, { kind: 'check', key: 'random', label: 'Random', value: false },
    ], (origin, v) => {
      let doc = origin;
      for (const id of ids) {
        const n = findNode(doc, id);
        if (!n) continue;
        const b = engine.boundsOf(n), cx = b.x + b.w / 2, cy = b.y + b.h / 2, rnd = v.random ? (k: number): number => k * Math.random() : (k: number): number => k;
        let m = scaleAbout(1 + rnd(Number(v.sh) / 100 - 1), 1 + rnd(Number(v.sv) / 100 - 1), cx, cy);
        m = mul(rotateAbout(-rnd(Number(v.angle)), cx, cy), m);
        if (v.rx) m = mul(reflectAbout('horizontal', cx, cy), m);
        if (v.ry) m = mul(reflectAbout('vertical', cx, cy), m);
        m = mul(translate(rnd(Number(v.dx)), rnd(Number(v.dy))), m);
        doc = transformNodes(doc, [id], m, false, xfo()).doc;
      }
      return doc;
    });
  }

  async function offsetPathDialog(): Promise<void> {
    if (!sel()) return;
    const ids = engine.targetIds();
    await previewEdit(engine, 'Offset Path', [{ kind: 'number', key: 'offset', label: 'Offset', value: 10, unit: 'pt' }, { kind: 'select', key: 'joins', label: 'Joins', value: 'miter', choices: [['miter', 'Miter'], ['round', 'Round'], ['bevel', 'Bevel']] }, { kind: 'number', key: 'miter', label: 'Miter limit', value: 4, min: 1, max: 500 }], (origin, v) => { const r = pathOperation(origin, ids, 'offset', { offset: Number(v.offset), joins: v.joins as 'miter', miterLimit: Number(v.miter) }); return { doc: r.doc, select: r.ids }; });
  }

  async function simplifyDialog(): Promise<void> {
    if (!sel()) return;
    const ids = engine.targetIds();
    await previewEdit(engine, 'Simplify', [{ kind: 'number', key: 'precision', label: 'Curve precision', value: 60, min: 0, max: 100, unit: '%' }], (origin, v) => { const r = pathOperation(origin, ids, 'simplify', { precision: Number(v.precision) }); return { doc: r.doc, select: r.ids }; });
  }

  async function splitGridDialog(): Promise<void> {
    if (!sel()) return;
    const ids = engine.targetIds();
    await previewEdit(engine, 'Split Into Grid', [{ kind: 'number', key: 'rows', label: 'Rows', value: 2, min: 1, max: 100 }, { kind: 'number', key: 'columns', label: 'Columns', value: 2, min: 1, max: 100 }, { kind: 'number', key: 'gutter', label: 'Gutter', value: 10, min: 0, unit: 'pt' }], (origin, v) => { const r = pathOperation(origin, ids, 'split_into_grid', { rows: Math.round(Number(v.rows)), columns: Math.round(Number(v.columns)), gutter: Number(v.gutter) }); return { doc: r.doc, select: r.ids }; });
  }

  async function blendOptions(): Promise<void> {
    const n = engine.selected().find((x) => x.kind === 'blend');
    const cur = n?.kind === 'blend' ? n.spec : { spacing: 'smooth' as const, steps: engine.options.blendSteps, distance: 10, alignToPath: false, spine: null };
    const v = await askForm('Blend Options', [{ kind: 'select', key: 'spacing', label: 'Spacing', value: cur.spacing, choices: [['smooth', 'Smooth Color'], ['steps', 'Specified Steps'], ['distance', 'Specified Distance']] }, { kind: 'number', key: 'steps', label: 'Steps', value: cur.steps, min: 1, max: 1000 }, { kind: 'number', key: 'distance', label: 'Distance', value: cur.distance, min: 0.1, unit: 'pt' }, { kind: 'check', key: 'align', label: 'Align to path', value: cur.alignToPath }]);
    if (!v) return;
    engine.update({ blendSteps: Math.round(Number(v.steps)) });
    if (n) engine.setBlendSpec({ spacing: v.spacing as 'smooth', steps: Math.round(Number(v.steps)), distance: Number(v.distance), alignToPath: !!v.align });
  }

  async function documentSetup(): Promise<void> {
    const p = engine.current;
    if (!p) return;
    const v = await askForm('Document Setup', [
      { kind: 'text', key: 'title', label: 'Title', value: p.doc.title },
      { kind: 'select', key: 'units', label: 'Units', value: p.doc.units, choices: [['pt', 'Points'], ['px', 'Pixels'], ['in', 'Inches'], ['mm', 'Millimeters'], ['cm', 'Centimeters'], ['pc', 'Picas']] },
      { kind: 'select', key: 'mode', label: 'Document color mode', value: p.doc.colorMode, choices: [['rgb', 'RGB Color'], ['cmyk', 'CMYK Color']] },
      { kind: 'number', key: 'ppi', label: 'Raster effects resolution', value: p.doc.rasterPpi, min: 72, max: 1200, unit: 'ppi' },
      { kind: 'number', key: 'grid', label: 'Gridline every', value: p.doc.grid.spacing, min: 1, unit: 'pt' },
      { kind: 'number', key: 'sub', label: 'Grid subdivisions', value: p.doc.grid.subdivisions, min: 1, max: 64 },
    ]);
    if (!v) return;
    engine.beginGesture();
    engine.documentSetup({ title: String(v.title) || p.doc.title, units: v.units as Units, colorMode: v.mode as 'rgb' | 'cmyk', rasterPpi: Number(v.ppi) });
    if (Number(v.grid) !== p.doc.grid.spacing || Number(v.sub) !== p.doc.grid.subdivisions) engine.setGrid(Number(v.grid), Math.round(Number(v.sub)));
    engine.endGesture();
  }

  async function recolorDialog(): Promise<void> {
    if (!sel()) return;
    const ids = engine.targetIds(), p = engine.current;
    if (!p) return;
    const colors = collectColors(ids.map((id) => findNode(p.doc, id) as VNode)).slice(0, 16);
    if (!colors.length) { toast('The selection has no colours to recolour.'); return; }
    await previewEdit(engine, 'Recolor Artwork', [
      { kind: 'note', text: 'Each current colour is listed with its new colour. Hue, saturation and brightness shift every colour at once.' },
      ...colors.map((c, i) => ({ kind: 'color' as const, key: `c${i}`, label: hex(c).toUpperCase(), value: hex(c) })),
      { kind: 'number', key: 'hue', label: 'Hue shift', value: 0, min: -180, max: 180, unit: '°' },
      { kind: 'number', key: 'sat', label: 'Saturation', value: 0, min: -100, max: 100, unit: '%' },
      { kind: 'number', key: 'bri', label: 'Brightness', value: 0, min: -100, max: 100, unit: '%' },
    ], (origin, v) => {
      const map = new Map<string, Color>();
      colors.forEach((c, i) => { const to = parseColor(String(v[`c${i}`])); if (to && hex(to) !== hex(c)) map.set(hex(c), c.kind === 'cmyk' ? to : to); });
      const base = mapFn(map), hue = RECOLOR.hue(Number(v.hue)), satF = RECOLOR.saturate(Number(v.sat)), bri = RECOLOR.brightness(Number(v.bri));
      return recolorDoc(origin, ids, (c) => { let x = base(c); if (Number(v.hue)) x = hue(x); if (Number(v.sat)) x = satF(x); if (Number(v.bri)) x = bri(x); return x; });
    });
  }

  async function rasterizeSel(): Promise<void> {
    const p = engine.current;
    if (!p || !sel()) return;
    const ids = engine.targetIds(), nodes = ids.map((id) => findNode(p.doc, id) as VNode);
    const b = engine.selectionBounds(true);
    if (!b) return;
    await engine.task(async () => {
      const c = await renderRegion(p, { region: b, scale: (p.doc.rasterPpi || 300) / 72, transparent: true, only: nodes });
      const blob = await canvasBlob(c, 'png', 1), key = imageKey(blob);
      p.assets.set(key, blob);
      const img: VNode = { id: newId('im'), kind: 'image', src: key, w: c.width, h: c.height, xf: [b.w / c.width, 0, 0, b.h / c.height, b.x, b.y], opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, name: 'Rasterized' };
      engine.edit('Rasterize', (d) => { let out: Doc = { ...d, images: { ...d.images, [key]: { mime: 'image/png', w: c.width, h: c.height } } }; const last = ids[ids.length - 1]; out = updateNodes(out, ids.filter((x) => x !== last), () => null); out = updateNodes(out, [last], () => img); return { doc: out, select: [img.id] }; });
    });
  }

  function changeCase(kind: 'upper' | 'lower' | 'title' | 'sentence'): void {
    const f = (s: string): string => kind === 'upper' ? s.toUpperCase() : kind === 'lower' ? s.toLowerCase() : kind === 'title' ? s.toLowerCase().replace(/(^|\s)(\S)/g, (_m, a: string, b: string) => a + b.toUpperCase()) : s.toLowerCase().replace(/(^\s*|[.!?]\s+)(\S)/g, (_m, a: string, b: string) => a + b.toUpperCase());
    const texts = engine.selected().filter((n) => n.kind === 'text');
    engine.beginGesture();
    for (const t of texts) if (t.kind === 'text') engine.setTextSpans(t.id, t.spans.map((s) => ({ ...s, text: f(s.text) })), 'Change Case');
    engine.endGesture();
  }

  async function shapeDialog(): Promise<void> {
    const k = pendingShape.kind;
    const v = await askForm(k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), [{ kind: 'number', key: 'w', label: 'Width', value: 100, min: 0.01, unit: 'pt' }, { kind: 'number', key: 'h', label: 'Height', value: 100, min: 0.01, unit: 'pt' }, { kind: 'check', key: 'center', label: 'From the center', value: false }]);
    if (v) shapeAt(engine, k, pendingShape.at, Number(v.w), Number(v.h), !!v.center);
  }

  type Screen = 'standard' | 'menu' | 'full';
  let screen: Screen = 'standard', panelsHidden = false;
  const applyScreen = (): void => { root.classList.toggle('is-screen-menu', screen === 'menu'); root.classList.toggle('is-screen-full', screen === 'full'); root.classList.toggle('is-panels-hidden', panelsHidden || screen === 'full'); window.dispatchEvent(new Event('resize')); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && screen === 'full' && !anyDialogOpen()) { screen = 'standard'; applyScreen(); e.preventDefault(); } }, true);

  const toolCmd = (id: string): string => `tool-${id}`;
  for (const t of toolList()) commands.add({ id: toolCmd(t.id), label: t.label, run: () => engine.setTool(t.id) });
  const viewFlag = (id: string, label: string, key: keyof Engine['view'], keys?: string[]) => ({ id, label, keys, enabled: has, checked: () => !!engine.view[key], run: () => engine.setView({ [key]: !engine.view[key] } as Partial<Engine['view']>) });
  const pfs = ['unite', 'minus_front', 'intersect', 'exclude', 'divide', 'trim', 'merge', 'crop', 'outline', 'minus_back'] as const;
  const PF_LABEL: Record<string, string> = { unite: 'Unite', minus_front: 'Minus Front', intersect: 'Intersect', exclude: 'Exclude', divide: 'Divide', trim: 'Trim', merge: 'Merge', crop: 'Crop', outline: 'Outline', minus_back: 'Minus Back' };
  const SAME: Array<[string, string]> = [['fill_color', 'Fill Color'], ['stroke_color', 'Stroke Color'], ['stroke_weight', 'Stroke Weight'], ['fill_and_stroke', 'Fill & Stroke'], ['opacity', 'Opacity'], ['blending_mode', 'Blending Mode'], ['appearance', 'Appearance'], ['graphic_style', 'Graphic Style'], ['shape', 'Shape'], ['font_family', 'Font Family'], ['font_size', 'Font Size'], ['symbol_instance', 'Symbol Instance']];
  const OBJ: Array<[Parameters<Engine['selectByKind']>[0], string]> = [['open_paths', 'All Open Paths'], ['stray_points', 'Stray Points'], ['clipping_masks', 'Clipping Masks'], ['brush_strokes', 'Brush Strokes'], ['text', 'All Text Objects'], ['point_text', 'Point Type Objects'], ['area_text', 'Area Type Objects'], ['same_layers', 'All on Same Layers']];
  const ALIGN: Array<[string, string, string]> = [['left', 'Horizontal Align Left', ''], ['horizontal_center', 'Horizontal Align Center', ''], ['right', 'Horizontal Align Right', ''], ['top', 'Vertical Align Top', ''], ['vertical_center', 'Vertical Align Center', ''], ['bottom', 'Vertical Align Bottom', ''], ['distribute_horizontal_space', 'Distribute Horizontal Space', ''], ['distribute_vertical_space', 'Distribute Vertical Space', '']];
  const nudge = (dx: number, dy: number, copy: boolean): void => {
    const p = engine.current;
    if (!p) return;
    const k = prefs.keyIncrement;
    if (p.anchors.size && !copy) {
      engine.edit('Nudge Anchors', (d) => { let out = d; for (const [id, set] of p.anchors) out = updateNodes(out, [id], (n) => { if (n.kind !== 'path') return n; let i = 0; return { ...n, live: undefined, d: n.d.map((sp) => ({ ...sp, pts: sp.pts.map((a) => (set.has(-1) || set.has(i++) ? { ...a, x: a.x + dx * k, y: a.y + dy * k, ix: a.ix + dx * k, iy: a.iy + dy * k, ox: a.ox + dx * k, oy: a.oy + dy * k } : a)) })) }; }); return out; }, { keepAnchors: true, merge: true });
      return;
    }
    if (sel()) engine.moveBy(dx * k, dy * k, copy);
  };

  commands.add(
    { id: 'new', label: 'New...', keys: ['Mod+N'], run: () => newDoc.show() },
    { id: 'open', label: 'Open...', keys: ['Mod+O'], run: () => void openDialog.show() },
    { id: 'open-file', label: 'Open from Disk...', keys: ['Shift+Mod+O'], run: () => openDialog.pickFiles() },
    ...Array.from({ length: 10 }, (_, i) => ({ id: `recent-${i}`, label: () => recent[i] ?? '', enabled: () => !!recent[i], run: () => { if (recent[i]) void openLibrary(recent[i]); } })),
    { id: 'clear-recent', label: 'Clear Recent', enabled: () => recent.length > 0, run: () => keepRecent([]) },
    { id: 'close-tab', label: 'Close', keys: ['Mod+W'], enabled: has, run: () => { const p = engine.current; if (p) void requestClose(p.id); } },
    { id: 'save', label: 'Save', keys: ['Mod+S'], enabled: has, run: () => void save(false) },
    { id: 'save-as', label: 'Save As...', keys: ['Shift+Mod+S'], enabled: has, run: () => void save(true) },
    { id: 'download-project', label: 'Download Project (.fpth)', keys: ['Alt+Mod+S'], enabled: has, run: () => void engine.task(async () => { const b = await projectZip(); const p = engine.current; if (b && p) await deliver(b, `${p.name}.fpth`); }) },
    { id: 'place', label: 'Place...', keys: ['Shift+Mod+P'], enabled: has, run: () => placeInput.click() },
    { id: 'export-screens', label: 'Export for Screens...', keys: ['Alt+Mod+E'], enabled: has, run: () => void exportScreens() },
    { id: 'export-as', label: 'Export As...', keys: ['Mod+E'], enabled: has, run: () => void exportAs('svg') },
    { id: 'export-svg', label: 'SVG...', enabled: has, run: () => void exportAs('svg') },
    { id: 'export-pdf', label: 'PDF...', enabled: has, run: () => void exportAs('pdf') },
    { id: 'export-png', label: 'PNG...', enabled: has, run: () => void exportAs('png') },
    { id: 'export-jpg', label: 'JPEG...', enabled: has, run: () => void exportAs('jpg') },
    { id: 'export-webp', label: 'WebP...', enabled: has, run: () => void exportAs('webp') },
    { id: 'print', label: 'Print...', keys: ['Mod+P'], enabled: has, run: () => void engine.task(async () => { const p = engine.current; if (!p) return; const b = await exportPdf(p, { artboards: p.doc.artboards.map((_, i) => i), preserve: false, ppi: 300, version: VERSION }); const url = URL.createObjectURL(b); const w = window.open(url, '_blank'); if (!w) await deliver(b, `${p.name}.pdf`); window.setTimeout(() => URL.revokeObjectURL(url), 120000); }) },
    { id: 'document-setup', label: 'Document Setup...', keys: ['Alt+Mod+P'], enabled: has, run: () => void documentSetup() },
    { id: 'mode-rgb', label: 'RGB Color', enabled: has, checked: () => engine.doc?.colorMode === 'rgb', run: () => engine.documentSetup({ colorMode: 'rgb' }) },
    { id: 'mode-cmyk', label: 'CMYK Color', enabled: has, checked: () => engine.doc?.colorMode === 'cmyk', run: () => engine.documentSetup({ colorMode: 'cmyk' }) },
    { id: 'send-nodemode', label: 'Send to NodeMode', enabled: has, run: () => void engine.task(async () => { const p = engine.current; if (!p) return; try { const r = exportRegion(p, p.activeArtboard); const b = await exportRaster(p, { region: r, scale: 2, format: 'png', quality: 1, transparent: true }); const res = await api.sendToNodeMode(loadPrefs().nodemodeUrl, p.name, [{ name: p.name, kind: 'image', width: Math.round(r.w * 2), height: Math.round(r.h * 2) }], [{ name: '0.png', blob: b }]); toast(res.placed ? 'Sent to NodeMode: the artwork is on its canvas.' : res.detail ?? 'Uploaded to NodeMode.'); } catch (err) { toast(message(err), 'error'); } }) },

    { id: 'undo', label: () => `Undo${engine.current?.history.undoName ? ` ${engine.current.history.undoName}` : ''}`, keys: ['Mod+Z'], enabled: () => !!engine.current?.history.canUndo, run: () => { typing.end(); engine.undo(); } },
    { id: 'redo', label: () => `Redo${engine.current?.history.redoName ? ` ${engine.current.history.redoName}` : ''}`, keys: ['Shift+Mod+Z'], enabled: () => !!engine.current?.history.canRedo, run: () => { typing.end(); engine.redo(); } },
    { id: 'cut', label: 'Cut', keys: ['Mod+X'], enabled: sel, run: () => { void copyToSystem(); engine.cut(); } },
    { id: 'copy', label: 'Copy', keys: ['Mod+C'], enabled: sel, run: () => { engine.copy(); void copyToSystem(); } },
    { id: 'paste', label: 'Paste', keys: ['Mod+V'], enabled: () => has() && !!engine.clipboard, run: () => engine.paste('center') },
    { id: 'paste-front', label: 'Paste in Front', keys: ['Mod+F'], enabled: () => has() && !!engine.clipboard, run: () => engine.paste('front') },
    { id: 'paste-back', label: 'Paste in Back', keys: ['Mod+B'], enabled: () => has() && !!engine.clipboard, run: () => engine.paste('back') },
    { id: 'paste-in-place', label: 'Paste in Place', keys: ['Shift+Mod+V'], enabled: () => has() && !!engine.clipboard, run: () => engine.paste('in_place') },
    { id: 'clear', label: 'Clear', keys: ['Delete', 'Backspace'], enabled: sel, run: () => engine.deleteSelection() },
    { id: 'find-replace', label: 'Find and Replace...', enabled: has, run: () => void findReplaceDialog(engine) },
    { id: 'recolor', label: 'Recolor Artwork...', enabled: sel, run: () => void recolorDialog() },
    ...(['invert', 'grayscale', 'cmyk', 'rgb'] as const).map((k) => ({ id: `colors-${k}`, label: { invert: 'Invert Colors', grayscale: 'Convert to Grayscale', cmyk: 'Convert to CMYK', rgb: 'Convert to RGB' }[k], enabled: sel, run: () => { const ids = engine.targetIds(); engine.edit({ invert: 'Invert Colors', grayscale: 'Convert to Grayscale', cmyk: 'Convert to CMYK', rgb: 'Convert to RGB' }[k], (d) => recolorDoc(d, ids, RECOLOR[k](0))); } })),
    { id: 'shortcuts', label: 'Keyboard Shortcuts...', keys: ['Alt+Shift+Mod+K'], run: () => shortcuts.show() },
    { id: 'settings', label: 'Preferences...', keys: ['Mod+K'], run: () => settings.show() },

    { id: 'transform-again', label: 'Transform Again', keys: ['Mod+D'], enabled: () => sel() && !!engine.lastTransform, run: () => engine.transformAgain() },
    { id: 'move-dialog', label: 'Move...', keys: ['Shift+Mod+M'], enabled: sel, run: () => void transformDialog('move') },
    { id: 'rotate-dialog', label: 'Rotate...', enabled: sel, run: () => void transformDialog('rotate') },
    { id: 'reflect-dialog', label: 'Reflect...', enabled: sel, run: () => void transformDialog('reflect') },
    { id: 'scale-dialog', label: 'Scale...', enabled: sel, run: () => void transformDialog('scale') },
    { id: 'shear-dialog', label: 'Shear...', enabled: sel, run: () => void transformDialog('shear') },
    { id: 'transform-each', label: 'Transform Each...', keys: ['Alt+Shift+Mod+D'], enabled: sel, run: () => void transformEachDialog() },
    { id: 'bring-to-front', label: 'Bring to Front', keys: ['Shift+Mod+]'], enabled: sel, run: () => engine.arrange('bring_to_front') },
    { id: 'bring-forward', label: 'Bring Forward', keys: ['Mod+]'], enabled: sel, run: () => engine.arrange('bring_forward') },
    { id: 'send-backward', label: 'Send Backward', keys: ['Mod+['], enabled: sel, run: () => engine.arrange('send_backward') },
    { id: 'send-to-back', label: 'Send to Back', keys: ['Shift+Mod+['], enabled: sel, run: () => engine.arrange('send_to_back') },
    { id: 'send-to-layer', label: 'Send to Current Layer', enabled: sel, run: () => engine.moveToLayer(engine.activeLayer) },
    ...ALIGN.map(([a, label]) => ({ id: `align-${a}`, label, enabled: sel, run: () => engine.align(a as 'left', many() ? 'selection' : 'artboard') })),
    { id: 'group', label: 'Group', keys: ['Mod+G'], enabled: sel, run: () => engine.group() },
    { id: 'ungroup', label: 'Ungroup', keys: ['Shift+Mod+G'], enabled: () => kindSel('group'), run: () => engine.ungroup() },
    { id: 'isolate', label: 'Isolate Selected Group', enabled: () => kindSel('group'), run: () => { const g = engine.selected().find((n) => n.kind === 'group'); if (g) engine.isolate(g.id); } },
    { id: 'exit-isolation', label: 'Exit Isolation Mode', enabled: () => !!engine.current?.isolation, run: () => engine.isolate(null) },
    { id: 'lock', label: 'Lock Selection', keys: ['Mod+2'], enabled: sel, run: () => engine.lockSelection() },
    { id: 'unlock-all', label: 'Unlock All', keys: ['Alt+Mod+2'], enabled: has, run: () => engine.unlockAll() },
    { id: 'hide', label: 'Hide Selection', keys: ['Mod+3'], enabled: sel, run: () => engine.hideSelection() },
    { id: 'show-all', label: 'Show All', keys: ['Alt+Mod+3'], enabled: has, run: () => engine.showAll() },
    { id: 'expand-object', label: 'Expand', enabled: sel, run: () => engine.expand('object') },
    { id: 'expand-appearance', label: 'Expand Appearance', enabled: sel, run: () => engine.expand('appearance') },
    { id: 'expand-shape', label: 'Expand Shape', enabled: sel, run: () => engine.applyToSelection('Expand Shape', (n) => (n.kind === 'path' ? { ...n, live: undefined } : n)) },
    { id: 'rasterize', label: 'Rasterize...', enabled: sel, run: () => void rasterizeSel() },
    { id: 'create-mesh', label: 'Create Gradient Mesh...', enabled: sel, run: () => void askForm('Create Gradient Mesh', [{ kind: 'number', key: 'rows', label: 'Rows', value: 4, min: 1, max: 50 }, { kind: 'number', key: 'cols', label: 'Columns', value: 4, min: 1, max: 50 }, { kind: 'select', key: 'hl', label: 'Appearance', value: 'flat', choices: [['flat', 'Flat'], ['center', 'To Center'], ['edge', 'To Edge']] }]).then((v) => { if (v) engine.createMesh(Math.round(Number(v.rows)), Math.round(Number(v.cols)), v.hl as 'flat'); }) },
    { id: 'join', label: 'Join', keys: ['Mod+J'], enabled: sel, run: () => engine.pathOp('join') },
    { id: 'average', label: 'Average...', keys: ['Alt+Mod+J'], enabled: sel, run: () => void askForm('Average', [{ kind: 'select', key: 'axis', label: 'Axis', value: 'both', choices: [['horizontal', 'Horizontal'], ['vertical', 'Vertical'], ['both', 'Both']] }]).then((v) => { if (v) engine.pathOp('average', { axis: v.axis as 'both' }); }) },
    { id: 'outline-stroke', label: 'Outline Stroke', enabled: sel, run: () => engine.pathOp('outline_stroke') },
    { id: 'offset-path', label: 'Offset Path...', enabled: sel, run: () => void offsetPathDialog() },
    { id: 'reverse-path', label: 'Reverse Path Direction', enabled: sel, run: () => engine.pathOp('reverse') },
    { id: 'simplify', label: 'Simplify...', enabled: sel, run: () => void simplifyDialog() },
    { id: 'smooth-path', label: 'Smooth', enabled: sel, run: () => engine.pathOp('smooth') },
    { id: 'add-anchors', label: 'Add Anchor Points', enabled: sel, run: () => engine.pathOp('add_anchors') },
    { id: 'remove-anchors', label: 'Remove Anchor Points', enabled: () => !!engine.current?.anchors.size, run: () => engine.deleteAnchors() },
    { id: 'divide-below', label: 'Divide Objects Below', enabled: sel, run: () => engine.pathOp('divide_objects_below') },
    { id: 'split-grid', label: 'Split Into Grid...', enabled: sel, run: () => void splitGridDialog() },
    { id: 'clean-up', label: 'Clean Up', enabled: has, run: () => engine.pathOp('clean_up', {}, allNodes(engine.doc as Doc).filter((n) => n.kind !== 'layer').map((n) => n.id)) },
    { id: 'close-path', label: 'Close Path', enabled: sel, run: () => engine.pathOp('close') },
    { id: 'make-pattern', label: 'Make Pattern...', enabled: sel, run: () => void askForm('Make Pattern', [{ kind: 'text', key: 'name', label: 'Name', value: `Pattern ${(engine.doc?.patterns.length ?? 0) + 1}` }, { kind: 'select', key: 'tile', label: 'Tile Type', value: 'grid', choices: [['grid', 'Grid'], ['brick_row', 'Brick by Row'], ['brick_col', 'Brick by Column'], ['hex_col', 'Hex by Column'], ['hex_row', 'Hex by Row']] }, { kind: 'number', key: 'hs', label: 'H Spacing', value: 0, unit: 'pt' }, { kind: 'number', key: 'vs', label: 'V Spacing', value: 0, unit: 'pt' }]).then((v) => { if (v) { engine.makePattern(String(v.name), undefined, v.tile as 'grid', Number(v.hs), Number(v.vs)); toast('The pattern is in the Swatches panel.'); } }) },
    { id: 'repeat-radial', label: 'Radial', enabled: sel, run: () => engine.makeRepeat('radial') },
    { id: 'repeat-grid', label: 'Grid', enabled: sel, run: () => engine.makeRepeat('grid') },
    { id: 'repeat-mirror', label: 'Mirror', enabled: sel, run: () => engine.makeRepeat('mirror') },
    { id: 'repeat-options', label: 'Repeat Options...', enabled: () => kindSel('repeat'), run: () => { const n = engine.selected().find((x) => x.kind === 'repeat'); if (n?.kind !== 'repeat') return; const s = n.spec; void askForm('Repeat Options', s.kind === 'radial' ? [{ kind: 'number', key: 'instances', label: 'Instances', value: s.instances, min: 2, max: 360 }, { kind: 'number', key: 'radius', label: 'Radius', value: s.radius, min: 0, unit: 'pt' }] : s.kind === 'grid' ? [{ kind: 'number', key: 'rows', label: 'Rows', value: s.rows, min: 1 }, { kind: 'number', key: 'cols', label: 'Columns', value: s.cols, min: 1 }, { kind: 'number', key: 'hs', label: 'Horizontal spacing', value: s.hs, unit: 'pt' }, { kind: 'number', key: 'vs', label: 'Vertical spacing', value: s.vs, unit: 'pt' }] : [{ kind: 'number', key: 'angle', label: 'Axis angle', value: s.angle, unit: '°' }]).then((v) => { if (v) engine.setRepeatSpec(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Number(x)]))); }); } },
    { id: 'release-live', label: 'Release', enabled: () => kindSel('blend', 'repeat', 'envelope'), run: () => engine.releaseLive() },
    { id: 'blend-make', label: 'Make Blend', keys: ['Alt+Mod+B'], enabled: many, run: () => engine.makeBlend() },
    { id: 'blend-release', label: 'Release Blend', keys: ['Alt+Shift+Mod+B'], enabled: () => kindSel('blend'), run: () => engine.releaseLive() },
    { id: 'blend-expand', label: 'Expand Blend', enabled: () => kindSel('blend'), run: () => engine.expand('object') },
    { id: 'blend-options', label: 'Blend Options...', run: () => void blendOptions() },
    { id: 'blend-spine', label: 'Replace Spine', enabled: () => kindSel('blend') && kindSel('path'), run: () => { const s = engine.selected(), b = s.find((n) => n.kind === 'blend'), pth = s.find((n) => n.kind === 'path'); if (b && pth?.kind === 'path') { engine.edit('Replace Spine', (d) => ({ doc: updateNodes(updateNodes(d, [pth.id], () => null), [b.id], (n) => (n.kind === 'blend' ? { ...n, spec: { ...n.spec, spine: pth.d } } : n)), select: [b.id] })); } } },
    { id: 'envelope-warp', label: 'Make with Warp...', keys: ['Alt+Shift+Mod+W'], enabled: sel, run: () => void askForm('Warp Options', [{ kind: 'select', key: 'style', label: 'Style', value: 'arc', choices: ['arc', 'arc_lower', 'arc_upper', 'arch', 'bulge', 'shell_lower', 'shell_upper', 'flag', 'wave', 'fish', 'rise', 'fisheye', 'inflate', 'squeeze', 'twist'].map((s) => [s, s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())] as const) }, { kind: 'number', key: 'bend', label: 'Bend', value: 50, min: -100, max: 100, unit: '%' }, { kind: 'number', key: 'h', label: 'Horizontal distortion', value: 0, min: -100, max: 100, unit: '%' }, { kind: 'number', key: 'v', label: 'Vertical distortion', value: 0, min: -100, max: 100, unit: '%' }, { kind: 'check', key: 'vertical', label: 'Vertical', value: false }]).then((v) => { if (v) engine.makeEnvelope({ kind: 'warp', style: String(v.style), bend: Number(v.bend), h: Number(v.h), v: Number(v.v), vertical: !!v.vertical }); }) },
    { id: 'envelope-mesh', label: 'Make with Mesh...', keys: ['Alt+Mod+M'], enabled: sel, run: () => void askForm('Envelope Mesh', [{ kind: 'number', key: 'rows', label: 'Rows', value: 2, min: 1, max: 20 }, { kind: 'number', key: 'cols', label: 'Columns', value: 2, min: 1, max: 20 }]).then((v) => { if (v) engine.makeEnvelope({ kind: 'mesh', rows: Math.round(Number(v.rows)), cols: Math.round(Number(v.cols)), points: [] }); }) },
    { id: 'envelope-top', label: 'Make with Top Object', keys: ['Alt+Mod+C'], enabled: many, run: () => engine.makeEnvelope('top') },
    { id: 'image-trace', label: 'Image Trace...', enabled: () => kindSel('image'), run: () => void traceDialog() },
    { id: 'embed-image', label: 'Embed Image', enabled: () => kindSel('image'), run: () => engine.applyToSelection('Embed Image', (n) => (n.kind === 'image' ? { ...n, link: undefined } : n)) },
    { id: 'make-clip', label: 'Make Clipping Mask', keys: ['Mod+7'], enabled: many, run: () => engine.makeClip() },
    { id: 'release-clip', label: 'Release Clipping Mask', keys: ['Alt+Mod+7'], enabled: () => engine.selected().some((n) => n.kind === 'group' && n.clip), run: () => engine.releaseClip() },
    { id: 'compound-make', label: 'Make Compound Path', keys: ['Mod+8'], enabled: sel, run: () => engine.makeCompound() },
    { id: 'compound-release', label: 'Release Compound Path', keys: ['Alt+Shift+Mod+8'], enabled: () => kindSel('compound'), run: () => engine.releaseCompound() },
    { id: 'opacity-mask', label: 'Make Opacity Mask', enabled: many, run: () => engine.makeOpacityMask() },
    { id: 'release-opacity-mask', label: 'Release Opacity Mask', enabled: () => engine.selected().some((n) => !!n.mask), run: () => engine.releaseOpacityMask() },
    { id: 'artboards-from-selection', label: 'Convert to Artboards', enabled: sel, run: () => { for (const n of engine.selected()) { const b = engine.boundsOf(n); engine.addArtboard(b, nodeLabel(n)); } } },
    { id: 'artboards-rearrange', label: 'Rearrange All Artboards...', enabled: has, run: () => void askForm('Rearrange All Artboards', [{ kind: 'number', key: 'cols', label: 'Columns', value: 2, min: 1, max: 50 }, { kind: 'number', key: 'gap', label: 'Spacing', value: 20, min: 0, unit: 'pt' }]).then((v) => { if (v) engine.rearrangeArtboards(Math.round(Number(v.cols)), Number(v.gap)); }) },
    { id: 'artboard-fit-art', label: 'Fit to Artwork Bounds', enabled: has, run: () => { const p = engine.current; if (p) engine.fitArtboard(p.activeArtboard, 'art'); } },
    { id: 'artboard-fit-selection', label: 'Fit to Selected Art', enabled: sel, run: () => { const p = engine.current; if (p) engine.fitArtboard(p.activeArtboard, 'selection'); } },
    { id: 'artboard-options', label: 'Artboard Options...', enabled: has, run: () => { const p = engine.current; if (p) void artboardsP.options(p.activeArtboard); } },
    { id: 'collect-layer', label: 'Collect in New Layer', enabled: sel, run: () => engine.collectInNewLayer() },
    { id: 'new-layer', label: 'New Layer', keys: ['Mod+L'], enabled: has, run: () => engine.addLayer(undefined, { above: engine.activeLayer || undefined }) },
    { id: 'new-symbol', label: 'New Symbol...', keys: ['F8'], enabled: sel, run: () => void askForm('Symbol Options', [{ kind: 'text', key: 'name', label: 'Name', value: `Symbol ${(engine.doc?.symbols.length ?? 0) + 1}` }]).then((v) => { if (v) engine.makeSymbol(String(v.name)); }) },
    { id: 'break-symbol', label: 'Break Link to Symbol', enabled: () => kindSel('symbol'), run: () => engine.breakSymbolLink() },

    { id: 'create-outlines', label: 'Create Outlines', keys: ['Shift+Mod+O'], enabled: () => kindSel('text'), run: () => void makeOutlines() },
    { id: 'edit-text', label: 'Edit Text', enabled: () => kindSel('text'), run: () => { const t = engine.selected().find((n) => n.kind === 'text'); if (t) { engine.setTool('type'); typing.begin({ id: t.id }); } } },
    { id: 'toggle-area-type', label: 'Convert Point and Area Type', enabled: () => kindSel('text'), run: () => { const t = engine.selected().find((n) => n.kind === 'text'); if (t?.kind !== 'text' || t.mode === 'path') return; const b = engine.boundsOf(t); if (t.mode === 'point') engine.setTextNode(t.id, { mode: 'area', frame: { x: b.x, y: b.y, w: Math.max(20, b.w + 4), h: Math.max(20, b.h + 4) }, xf: [1, 0, 0, 1, 0, 0], area: { columns: 1, rows: 1, gutter: 12, inset: 0, firstBaseline: 'ascent' } }, 'Convert to Area Type'); else { const first = t.spans[0]?.style.size ?? 12; engine.setTextNode(t.id, { mode: 'point', frame: undefined, xf: [1, 0, 0, 1, (t.frame?.x ?? b.x), (t.frame?.y ?? b.y) + first * 0.8] }, 'Convert to Point Type'); } } },
    { id: 'area-type-options', label: 'Area Type Options...', enabled: () => engine.selected().some((n) => n.kind === 'text' && n.mode === 'area'), run: () => showPanel('paragraph') },
    { id: 'type-on-path-options', label: 'Type on a Path Options...', enabled: () => engine.selected().some((n) => n.kind === 'text' && n.mode === 'path'), run: () => { const t = engine.selected().find((n) => n.kind === 'text'); if (t?.kind !== 'text') return; void askForm('Type on a Path Options', [{ kind: 'select', key: 'effect', label: 'Effect', value: t.pathEffect ?? 'rainbow', choices: [['rainbow', 'Rainbow'], ['skew', 'Skew'], ['ribbon', '3D Ribbon'], ['stair', 'Stair Step'], ['gravity', 'Gravity']] }, { kind: 'number', key: 'start', label: 'Start', value: Math.round((t.pathStart ?? 0) * 100), min: 0, max: 100, unit: '%' }, { kind: 'check', key: 'flip', label: 'Flip', value: !!t.pathFlip }]).then((v) => { if (v) engine.setTextNode(t.id, { pathEffect: v.effect as 'rainbow', pathStart: Number(v.start) / 100, pathFlip: !!v.flip }); }); } },
    { id: 'case-upper', label: 'UPPERCASE', enabled: () => kindSel('text'), run: () => changeCase('upper') },
    { id: 'case-lower', label: 'lowercase', enabled: () => kindSel('text'), run: () => changeCase('lower') },
    { id: 'case-title', label: 'Title Case', enabled: () => kindSel('text'), run: () => changeCase('title') },
    { id: 'case-sentence', label: 'Sentence case', enabled: () => kindSel('text'), run: () => changeCase('sentence') },
    { id: 'panel-character', label: 'Character', keys: ['Mod+T'], run: () => showPanel('character') },
    { id: 'panel-paragraph', label: 'Paragraph', keys: ['Alt+Mod+T'], run: () => showPanel('paragraph') },
    { id: 'panel-glyphs', label: 'Glyphs', run: () => showPanel('glyphs') },

    { id: 'select-all', label: 'All', keys: ['Mod+A'], enabled: has, run: () => engine.selectAll() },
    { id: 'select-artboard', label: 'All on Active Artboard', keys: ['Alt+Mod+A'], enabled: has, run: () => engine.selectAll(true) },
    { id: 'deselect', label: 'Deselect', keys: ['Shift+Mod+A'], enabled: sel, run: () => engine.deselect() },
    { id: 'inverse', label: 'Inverse', enabled: has, run: () => engine.selectInverse() },
    { id: 'select-above', label: 'Next Object Above', keys: ['Alt+Mod+]'], enabled: sel, run: () => stepSelection(1) },
    { id: 'select-below', label: 'Next Object Below', keys: ['Alt+Mod+['], enabled: sel, run: () => stepSelection(-1) },
    ...SAME.map(([k, label]) => ({ id: `same-${k}`, label, enabled: sel, run: () => engine.selectSame(k) })),
    ...OBJ.map(([k, label]) => ({ id: `select-${k}`, label, enabled: has, run: () => engine.selectByKind(k) })),

    { id: 'apply-last-effect', label: () => `Apply Last Effect${engine.lastEffect ? `: ${EFFECTS.find((x) => x.id === engine.lastEffect?.id)?.label ?? ''}` : ''}`, keys: ['Shift+Mod+E'], enabled: () => sel() && !!engine.lastEffect, run: () => engine.applyLastEffect() },
    { id: 'last-effect', label: 'Last Effect...', keys: ['Alt+Shift+Mod+E'], enabled: () => sel() && !!engine.lastEffect, run: () => { if (engine.lastEffect) void effectDialog(engine, engine.lastEffect.id); } },
    ...EFFECTS.map((fx) => ({ id: `fx-${fx.id}`, label: `${fx.label}...`, enabled: sel, run: () => void effectDialog(engine, fx.id) })),

    { id: 'outline', label: () => (engine.view.outline ? 'Preview' : 'Outline'), keys: ['Mod+Y'], enabled: has, checked: () => engine.view.outline, run: () => engine.setView({ outline: !engine.view.outline }) },
    { id: 'zoom-in', label: 'Zoom In', keys: ['Mod+=', 'Mod++'], enabled: has, run: () => engine.zoomStep(1) },
    { id: 'zoom-out', label: 'Zoom Out', keys: ['Mod+-'], enabled: has, run: () => engine.zoomStep(-1) },
    { id: 'fit', label: 'Fit Artboard in Window', keys: ['Mod+0'], enabled: has, run: () => engine.fit() },
    { id: 'fit-all', label: 'Fit All in Window', keys: ['Alt+Mod+0'], enabled: has, run: () => engine.fitAll() },
    { id: 'actual', label: 'Actual Size', keys: ['Mod+1'], enabled: has, run: () => engine.zoomTo(1) },
    { id: 'zoom-selection', label: 'Zoom to Selection', enabled: sel, run: () => engine.fitSelection() },
    viewFlag('toggle-edges', 'Show Edges', 'edges', ['Mod+H']),
    viewFlag('toggle-bbox', 'Show Bounding Box', 'boundingBox', ['Shift+Mod+B']),
    viewFlag('toggle-transparency', 'Show Transparency Grid', 'transparencyGrid', ['Shift+Mod+D']),
    viewFlag('toggle-rulers', 'Rulers', 'rulers', ['Mod+R']),
    viewFlag('toggle-guides', 'Show Guides', 'guides', ['Mod+;']),
    viewFlag('lock-guides', 'Lock Guides', 'guidesLocked', ['Alt+Mod+;']),
    { id: 'make-guides', label: 'Make Guides', keys: ['Mod+5'], enabled: sel, run: () => engine.makeGuides() },
    { id: 'release-guides', label: 'Release Guides', keys: ['Alt+Mod+5'], enabled: has, run: () => engine.releaseGuides() },
    { id: 'clear-guides', label: 'Clear Guides', enabled: () => !!engine.doc?.guides.length, run: () => engine.clearGuides() },
    viewFlag('toggle-smart', 'Smart Guides', 'smartGuides', ['Mod+U']),
    viewFlag('toggle-grid', 'Show Grid', 'grid', ["Mod+'"]),
    viewFlag('snap-grid', 'Snap to Grid', 'snapGrid', ["Shift+Mod+'"]),
    viewFlag('snap-point', 'Snap to Point', 'snapPoint', ["Alt+Mod+'"]),
    viewFlag('toggle-artboards', 'Show Artboards', 'artboards'),
    viewFlag('toggle-gradient-annotator', 'Show Gradient Annotator', 'gradientAnnotator', ['Alt+Mod+G']),
    { id: 'reset-rotation', label: 'Reset Rotate View', keys: ['Shift+Mod+1'], enabled: () => !!engine.current?.viewport.rotation, run: () => engine.setViewRotation(0) },
    { id: 'screen-standard', label: 'Normal Screen Mode', checked: () => screen === 'standard', run: () => { screen = 'standard'; applyScreen(); } },
    { id: 'screen-menu', label: 'Full Screen Mode with Menu Bar', checked: () => screen === 'menu', run: () => { screen = 'menu'; applyScreen(); } },
    { id: 'screen-full', label: 'Full Screen Mode', checked: () => screen === 'full', run: () => { screen = 'full'; applyScreen(); } },
    { id: 'screen-next', label: 'Change Screen Mode', keys: ['F'], run: () => { screen = screen === 'standard' ? 'menu' : screen === 'menu' ? 'full' : 'standard'; applyScreen(); } },
    { id: 'toggle-panels', label: 'Show or Hide Panels', keys: ['Tab'], checked: () => !panelsHidden, run: () => { panelsHidden = !panelsHidden; applyScreen(); } },

    { id: 'assistant', label: 'Assistant', keys: ['Alt+Mod+I'], run: () => assistant.toggle() },
    { id: 'manage-plugins', label: 'Manage Plugins...', run: () => void pluginsDialog.show() },
    ...Object.keys(TAB_HOMES).map((tab) => ({ id: `panel-${tab}`, label: tab.replace(/-/g, ' ').replace(/(^|\s)\w/g, (c) => c.toUpperCase()), run: () => showPanel(tab) })).filter((c) => !['panel-character', 'panel-paragraph', 'panel-glyphs'].includes(c.id)),
    { id: 'panel-properties-col', label: 'Properties Column', checked: () => propsShown(), run: () => { store('formpth.propsCol', propsShown() ? 'hidden' : 'shown'); syncPropsCol(); } },
    { id: 'reset-panels', label: 'Reset Essentials', run: () => { dock.reset(); PanelGroup.resetStates(); PanelGroup.resetHomes(TAB_HOMES); store('formpth.propsCol', 'shown'); syncPropsCol(); } },
    { id: 'help', label: 'formpth Help', keys: ['F1'], run: () => help.show() },
    { id: 'copy-error-log', label: 'Copy Error Log', run: () => { void navigator.clipboard?.writeText(errorLog.text()); toast('Copied the error log.'); } },
    { id: 'about', label: 'About formpth', run: () => about.show(caps) },

    { id: 'swap-fill-stroke', label: 'Swap Fill and Stroke', keys: ['Shift+X'], run: () => engine.swapFillStroke() },
    { id: 'default-fill-stroke', label: 'Default Fill and Stroke', keys: ['D'], run: () => engine.defaultFillStroke() },
    { id: 'toggle-fill-stroke', label: 'Fill or Stroke in Front', keys: ['X'], run: () => engine.setActiveSlot(engine.activeSlot === 'fill' ? 'stroke' : 'fill') },
    { id: 'paint-color', label: 'Color', keys: [','], run: () => paintKind('color') },
    { id: 'paint-gradient', label: 'Gradient', keys: ['.'], run: () => paintKind('gradient') },
    { id: 'paint-none', label: 'None', keys: ['/'], run: () => paintKind('none') },
    { id: 'draw-mode', label: 'Cycle Drawing Modes', keys: ['Shift+D'], run: () => engine.update({ shapeMode: engine.options.shapeMode === 'normal' ? 'behind' : engine.options.shapeMode === 'behind' ? 'inside' : 'normal' }) },
    { id: 'shape-dialog', label: 'Shape Size...', run: () => void shapeDialog() },
    { id: 'pf-unite', label: 'Unite', enabled: sel, run: () => engine.pathfinder('unite') },
    ...pfs.filter((x) => x !== 'unite').map((x) => ({ id: `pf-${x}`, label: PF_LABEL[x], enabled: sel, run: () => engine.pathfinder(x) })),
    { id: 'play-action', label: 'Play Action', run: () => actionsP.play() },
  );

  function stepSelection(dir: 1 | -1): void {
    const p = engine.current;
    if (!p) return;
    const flat = p.doc.layers.flatMap((l) => (l.hidden || l.locked ? [] : l.children.filter((c) => !c.hidden && !c.locked)));
    const cur = engine.targetIds()[0], i = flat.findIndex((n) => n.id === cur);
    const next = flat[Math.max(0, Math.min(flat.length - 1, i + dir))];
    if (next) engine.select([next.id]);
  }

  const lastSvg = { text: '' };
  async function copyToSystem(): Promise<void> {
    const p = engine.current;
    if (!p || !navigator.clipboard?.writeText) return;
    try { const s = await exportSvg(p, { artboard: p.activeArtboard, outlineText: false, preserve: false, precision: 3, ids: engine.targetIds() }); lastSvg.text = s; await navigator.clipboard.writeText(s); } catch { }
  }

  function effectItems(): MenuItem[] {
    const byMenu = new Map<string, string[]>();
    for (const fx of EFFECTS) byMenu.set(fx.menu, [...(byMenu.get(fx.menu) ?? []), `fx-${fx.id}`]);
    return [...byMenu.entries()].map(([label, items]) => ({ label, items }));
  }

  const menus: MenuDef[] = [
    { label: 'File', items: () => ['new', 'open', 'open-file', ...(recent.length ? [{ label: 'Open Recent', items: [...recent.map((_, i) => `recent-${i}`), '-', 'clear-recent'] }] : []), '-', 'close-tab', 'save', 'save-as', 'download-project', '-', 'place', '-', { label: 'Export', items: ['export-screens', 'export-as', '-', 'export-svg', 'export-pdf', 'export-png', 'export-jpg', 'export-webp'] }, '-', 'document-setup', { label: 'Document Color Mode', items: ['mode-rgb', 'mode-cmyk'] }, '-', 'send-nodemode', 'print'] },
    { label: 'Edit', items: ['undo', 'redo', '-', 'cut', 'copy', 'paste', 'paste-front', 'paste-back', 'paste-in-place', 'clear', '-', 'find-replace', '-', { label: 'Edit Colors', items: ['recolor', '-', 'colors-invert', 'colors-grayscale', 'colors-cmyk', 'colors-rgb'] }, '-', 'shortcuts', 'settings'] },
    { label: 'Object', items: [
      { label: 'Transform', items: ['transform-again', '-', 'move-dialog', 'rotate-dialog', 'reflect-dialog', 'scale-dialog', 'shear-dialog', '-', 'transform-each'] },
      { label: 'Arrange', items: ['bring-to-front', 'bring-forward', 'send-backward', 'send-to-back', '-', 'send-to-layer'] },
      { label: 'Align', items: ALIGN.map(([a]) => `align-${a}`) }, '-',
      'group', 'ungroup', 'isolate', '-', 'lock', 'unlock-all', 'hide', 'show-all', '-', 'expand-object', 'expand-appearance', 'rasterize', 'create-mesh', '-',
      { label: 'Path', items: ['join', 'average', '-', 'outline-stroke', 'offset-path', 'reverse-path', '-', 'simplify', 'smooth-path', 'add-anchors', 'remove-anchors', 'close-path', '-', 'divide-below', 'split-grid', 'clean-up'] },
      { label: 'Shape', items: ['expand-shape'] },
      { label: 'Pattern', items: ['make-pattern'] },
      { label: 'Repeat', items: ['repeat-radial', 'repeat-grid', 'repeat-mirror', '-', 'release-live', 'repeat-options'] },
      { label: 'Blend', items: ['blend-make', 'blend-release', '-', 'blend-options', '-', 'blend-expand', 'blend-spine'] },
      { label: 'Envelope Distort', items: ['envelope-warp', 'envelope-mesh', 'envelope-top', '-', 'release-live', 'expand-object'] },
      { label: 'Image Trace', items: ['image-trace', 'embed-image'] }, '-',
      { label: 'Clipping Mask', items: ['make-clip', 'release-clip'] },
      { label: 'Compound Path', items: ['compound-make', 'compound-release'] },
      { label: 'Opacity Mask', items: ['opacity-mask', 'release-opacity-mask'] },
      { label: 'Symbol', items: ['new-symbol', 'break-symbol'] },
      { label: 'Artboards', items: ['artboards-from-selection', 'artboards-rearrange', 'artboard-fit-art', 'artboard-fit-selection', '-', 'artboard-options'] }] },
    { label: 'Type', items: ['panel-character', 'panel-paragraph', 'panel-glyphs', '-', 'area-type-options', 'type-on-path-options', 'toggle-area-type', '-', 'create-outlines', 'edit-text', 'find-replace', '-', { label: 'Change Case', items: ['case-upper', 'case-lower', 'case-title', 'case-sentence'] }] },
    { label: 'Select', items: ['select-all', 'select-artboard', 'deselect', 'inverse', '-', 'select-above', 'select-below', '-', { label: 'Same', items: SAME.map(([k]) => `same-${k}`) }, { label: 'Object', items: OBJ.map(([k]) => `select-${k}`) }] },
    { label: 'Effect', items: () => ['apply-last-effect', 'last-effect', '-', ...effectItems()] },
    { label: 'View', items: ['outline', '-', 'zoom-in', 'zoom-out', 'fit', 'fit-all', 'actual', 'zoom-selection', 'reset-rotation', '-', 'toggle-edges', 'toggle-bbox', 'toggle-transparency', 'toggle-artboards', 'toggle-gradient-annotator', '-', 'toggle-rulers', { label: 'Guides', items: ['toggle-guides', 'lock-guides', 'make-guides', 'release-guides', 'clear-guides'] }, 'toggle-smart', '-', 'toggle-grid', 'snap-grid', 'snap-point', '-', { label: 'Screen Mode', items: ['screen-standard', 'screen-menu', 'screen-full'] }, 'toggle-panels'] },
    { label: 'Plugins', items: () => { const ids = pluginHost.commandIds(); return ['manage-plugins', ...(ids.length ? ['-', ...ids] : [])]; } },
    { label: 'Window', items: ['assistant', '-', ...Object.keys(TAB_HOMES).map((t) => `panel-${t}`), '-', 'panel-properties-col', 'reset-panels'] },
    { label: 'Help', items: ['help', '-', 'shortcuts', 'copy-error-log', 'about'] },
  ];
  const menubar = new MenuBar(q(root, '.cv-menubar'), commands, menus);
  if (wantsNativeMenus()) {
    const native = new NativeMenus(commands, () => menus);
    void native.build().catch(() => undefined);
    root.classList.add('has-native-menus');
    for (const ev of ['active', 'doc', 'selection', 'history', 'tool'] as const) engine.on(ev, () => native.refresh());
    engine.on('projects', () => { void native.build().catch(() => undefined); });
  }
  contextMenu.setItems(['undo', 'redo', '-', 'cut', 'copy', 'paste', 'paste-in-place', '-', 'group', 'ungroup', 'isolate', '-', { label: 'Transform', items: ['transform-again', '-', 'move-dialog', 'rotate-dialog', 'reflect-dialog', 'scale-dialog', 'shear-dialog', 'transform-each'] }, { label: 'Arrange', items: ['bring-to-front', 'bring-forward', 'send-backward', 'send-to-back', 'send-to-layer'] }, { label: 'Select', items: ['select-above', 'select-below'] }, '-', 'make-clip', 'release-clip', 'compound-make', 'create-outlines', 'outline-stroke', 'expand-appearance', '-', 'collect-layer', 'new-symbol']);
  stageEl.addEventListener('contextmenu', (e) => {
    const p = engine.current;
    if (!p || anyDialogOpen()) return;
    e.preventDefault();
    const pt = stage.docPoint(e.clientX, e.clientY), h = pt ? engine.hit(pt) : null;
    if (h) { const id = engine.selectableFor(h.id); if (!p.selection.has(id)) engine.select([id]); }
    contextMenu.openAt(e.clientX, e.clientY);
  });
  new Tabs(q(root, '.cv-tab-strip'), engine, (id) => void requestClose(id));

  async function requestClose(id: string): Promise<void> {
    const p = engine.projects.find((x) => x.id === id);
    if (!p) return;
    if (p.modified) {
      engine.switchTo(id);
      const answer = await askSaveChanges(p.name);
      if (answer === 'cancel') return;
      if (answer === 'save' && !(await save(false))) return;
    }
    typing.end();
    engine.closeProject(id);
    void recovery.drop(id);
  }

  const zoomLabel = q(root, '.cv-zoom-label');
  const isoBar = q(root, '.cv-isolation');
  let chromeFrame = 0;
  const syncChrome = (): void => {
    if (chromeFrame) return;
    chromeFrame = requestAnimationFrame(() => {
      chromeFrame = 0;
      for (const b of Array.from(root.querySelectorAll<HTMLButtonElement>('button[data-cmd]'))) {
        const cmd = commands.get(b.dataset.cmd ?? '');
        if (!cmd) continue;
        setDisabled(b, !commands.enabled(cmd));
        const label = commands.label(cmd).replace(/\.\.\.$/, ''), keys = commands.keyLabel(cmd);
        if (!b.classList.contains('cv-mode-btn') || b.dataset.cmd !== 'draw-mode') setTitle(b, keys ? `${label} (${keys})` : label);
        if (b.classList.contains('cv-icon-btn') && b.getAttribute('aria-label') !== label) b.setAttribute('aria-label', label);
      }
      const p = engine.current;
      setText(zoomLabel, p ? `${Math.round(p.viewport.zoom * 100)}%` : '');
      const iso = p?.isolation ? findNode(p.doc, p.isolation) : null;
      setHidden(isoBar, !iso);
      if (iso) setText(q(isoBar, '.cv-isolation-label'), `Isolation Mode: ${nodeLabel(iso)}`);
      root.classList.toggle('is-isolated', !!iso);
    });
  };
  for (const k of ['projects', 'history', 'active', 'doc', 'selection', 'viewport', 'options', 'tool'] as const) engine.on(k, syncChrome);
  syncChrome();
  engine.on('selection', () => { if (engine.hasSelection) engine.syncPaintFromSelection(); });

  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-cmd]');
    if (b && root.contains(b) && !b.disabled && !b.closest('.cv-group-head')) commands.run(b.dataset.cmd ?? '');
  });

  const resizer = q(root, '.cv-resizer');
  resizer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || dock.locked) return;
    e.preventDefault();
    resizer.setPointerCapture(e.pointerId);
    resizer.classList.add('is-dragging');
    const startX = e.clientX, startW = dockHost.getBoundingClientRect().width;
    const move = (ev: PointerEvent): void => setStyleVar(root, '--cv-layers-w', `${Math.round(Math.min(520, Math.max(220, startW - (ev.clientX - startX))))}px`);
    const up = (ev: PointerEvent): void => {
      if (resizer.hasPointerCapture(ev.pointerId)) resizer.releasePointerCapture(ev.pointerId);
      resizer.classList.remove('is-dragging');
      resizer.removeEventListener('pointermove', move); resizer.removeEventListener('pointerup', up); resizer.removeEventListener('pointercancel', up);
      store(LAYERS_W_KEY, String(Math.round(dockHost.getBoundingClientRect().width)));
      window.dispatchEvent(new Event('resize'));
    };
    resizer.addEventListener('pointermove', move); resizer.addEventListener('pointerup', up); resizer.addEventListener('pointercancel', up);
  });

  const toolFor = (combo: string): Tool | undefined => toolList().find((t) => t.shortcut === combo);
  window.addEventListener('keydown', (e) => {
    if (anyDialogOpen() || e.defaultPrevented) return;
    if (menubar.isOpen || contextMenu.isOpen) { if (e.key === 'Escape') { e.preventDefault(); menubar.close(); contextMenu.close(); } return; }
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (e.code === 'Space' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); if (!e.repeat) stage.setSpace(true); return; }
    if (stage.toolKeydown(e)) { e.preventDefault(); return; }
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const mod = /Mac/.test(navigator.platform) ? e.metaKey : e.ctrlKey;
    if (arrows[e.key] && !mod && engine.current) { e.preventDefault(); const [dx, dy] = arrows[e.key], k = e.shiftKey ? 10 : 1; nudge(dx * k, dy * k, e.altKey && !e.repeat); return; }
    if (e.key === 'Escape') {
      if (engine.current?.isolation) { engine.isolate(null); e.preventDefault(); return; }
      stage.cancelTool();
      return;
    }
    const cmd = commands.forEvent(e);
    if (cmd?.id === 'paste') return;
    if (cmd) { e.preventDefault(); if (!e.repeat || /^(undo|redo|zoom-in|zoom-out)$/.test(cmd.id)) commands.run(cmd.id); return; }
    if (e.metaKey || e.ctrlKey || e.repeat) return;
    const combo = comboOfTool(e), t = toolFor(combo);
    if (t) {
      e.preventDefault();
      const g = toolGroups().find((x) => x.tools.includes(t));
      engine.setTool(e.shiftKey || !g || t.shortcut?.startsWith('Shift+') ? t.id : slotTool(g, engine.tool).id === t.id ? t.id : t.id);
    }
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') stage.setSpace(false); });
  window.addEventListener('blur', () => stage.setSpace(false));
  function comboOfTool(e: KeyboardEvent): string {
    const k = e.code.startsWith('Key') ? e.code.slice(3) : e.code === 'Backslash' ? '\\' : e.code === 'Equal' ? '=' : e.code === 'Minus' ? '-' : e.code === 'Backquote' ? '~' : e.key;
    return `${e.altKey ? 'Alt+' : ''}${e.shiftKey ? 'Shift+' : ''}${k}`;
  }

  document.addEventListener('paste', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (anyDialogOpen() || target?.closest('input, textarea, [contenteditable="true"]')) return;
    const files = Array.from(e.clipboardData?.files ?? []);
    const txt = e.clipboardData?.getData('text/plain') ?? '';
    if (engine.clipboard && (txt === lastSvg.text || (!files.length && !/^\s*(<\?xml|<svg)/.test(txt)))) { e.preventDefault(); engine.paste('center'); return; }
    if (!engine.current) return;
    if (/^\s*(<\?xml|<svg)/.test(txt)) { e.preventDefault(); void placeFile(new File([txt], 'Pasted.svg', { type: 'image/svg+xml' }), null, null); return; }
    if (files.length) { e.preventDefault(); void engine.task(async () => { for (const f of files) await placeFile(f.name ? f : new File([f], 'Pasted.png', { type: f.type }), null, null); }); }
  });

  const drop = q(root, '.cv-drop');
  let dragDepth = 0;
  const hasFiles = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  root.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth += 1; setHidden(drop, false); });
  root.addEventListener('dragover', (e) => { if (!hasFiles(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
  root.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) setHidden(drop, true); });
  root.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    setHidden(drop, true);
    const files = Array.from(e.dataTransfer?.files ?? []), at = stage.docPoint(e.clientX, e.clientY);
    void (async () => {
      const docs = files.filter((f) => /\.(fpth|pdf|ai)$/i.test(f.name) || !engine.current);
      const places = files.filter((f) => !docs.includes(f));
      if (docs.length) await openFiles(docs);
      if (places.length) await engine.task(async () => { for (const f of places) { try { await placeFile(f, at, null); } catch (err) { toast(`${f.name}: ${message(err)}`, 'error'); } } });
    })();
  });

  let restyleFrame = 0;
  const syncThemeMarker = (): void => { const mode = document.body.classList.contains('theme-light') ? 'light' : 'dark'; if (document.documentElement.dataset.theme !== mode) document.documentElement.dataset.theme = mode; };
  const restyle = (): void => { if (restyleFrame) return; restyleFrame = requestAnimationFrame(() => { restyleFrame = 0; syncThemeMarker(); invalidatePaint(); stage.restyle(); layersP.restyle(); }); };
  new MutationObserver(restyle).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-theme'] });
  new MutationObserver(restyle).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('nm:ui-settings-changed', restyle);
  syncThemeMarker();

  window.addEventListener('beforeunload', (e) => { if (!engine.projects.some((p) => p.modified)) return; e.preventDefault(); e.returnValue = ''; });

  onFontsLoaded(() => { fontsChanged(); engine.reflowAll(); engine.emit('options', null); });
  void ensureFace(typeDefaults.font, typeDefaults.style);
  status.setEngine('Engine: checking');
  void api.capabilities().then((c) => {
    caps = c;
    status.setEngine(c ? `Engine ${c.version}${c.desktop ? ' · desktop' : ''}` : 'Engine offline');
    if (!c) toast('The formpth engine is offline. Drawing works; library saves, system fonts, the assistant and agents need it (./formpth boot).');
    else void systemFonts().then(() => engine.emit('options', null));
  });

  for (const [id, keys] of Object.entries(loadPrefs().shortcuts)) commands.setKeys(id, keys);
  if (import.meta.env.DEV) (window as unknown as { formpth: unknown }).formpth = { engine, commands, agents, stage };

  const SESSION = 'formpth.session';
  const keptAt = new Map<string, string>();
  let keepTimer = 0;
  async function keepModified(): Promise<void> {
    const whole = loadPrefs().restoreSession;
    for (const p of engine.projects) {
      if (!p.modified && !whole) { if (keptAt.delete(p.id)) await recovery.drop(p.id); continue; }
      const key = `${p.history.revision}:${p.modified}:${p.libraryName ?? ''}:${p.name}`;
      if (keptAt.get(p.id) === key) continue;
      try { const { manifest, files } = serialize(p); if (await recovery.keep({ id: p.id, name: p.name, savedAt: Date.now(), manifest, files, modified: p.modified, libraryName: p.libraryName })) keptAt.set(p.id, key); }
      catch (err) { errorLog.add('Recovery copy', message(err)); }
    }
    for (const id of [...keptAt.keys()]) if (!engine.projects.some((p) => p.id === id)) { keptAt.delete(id); await recovery.drop(id); }
    try { if (whole) localStorage.setItem(SESSION, JSON.stringify({ order: engine.projects.map((p) => p.id), active: engine.current?.id ?? null })); else localStorage.removeItem(SESSION); } catch { }
  }
  let recoveryDelay = loadPrefs().recoverySeconds * 1000;
  const keepSoon = (): void => { if (!keepTimer) keepTimer = window.setTimeout(() => { keepTimer = 0; void keepModified(); }, recoveryDelay); };
  engine.on('history', keepSoon);
  engine.on('projects', keepSoon);
  function reopen(r: RecoveryRecord, name: string): boolean {
    try {
      const byName = new Map(r.files.map((f) => [f.name, f.blob]));
      const doc = docFromManifest(r.manifest), assets = new Map<string, Blob>();
      for (const k of Object.keys(doc.images)) { const b = byName.get(k); if (b) assets.set(k, b); }
      adopt(doc, name, assets, r.libraryName ?? null);
      const p = engine.current;
      if (p && r.modified !== false) p.history.markUnsaved();
      engine.emit('projects', null);
      return true;
    } catch (err) { toast(`${r.name}: ${message(err)}`, 'error'); return false; }
  }
  async function offerRecovery(): Promise<void> {
    const found = await recovery.list();
    if (!found.length) return;
    if (loadPrefs().restoreSession && !engine.projects.length) {
      let meta: { order?: string[] } = {};
      try { meta = JSON.parse(localStorage.getItem(SESSION) ?? '{}') as typeof meta; } catch { }
      const at = (id: string): number => { const i = meta.order?.indexOf(id) ?? -1; return i < 0 ? 1e9 : i; };
      let n = 0;
      for (const r of [...found].sort((a, b) => at(a.id) - at(b.id) || a.savedAt - b.savedAt)) if (reopen(r, r.name)) n++;
      await recovery.clear();
      await keepModified();
      if (n) toast(`Reopened ${n === 1 ? 'the document' : `${n} documents`} from last time.`);
      return;
    }
    const lost = found.filter((r) => r.modified !== false);
    if (!lost.length) { await recovery.clear(); return; }
    if (!(await confirmAction('Recover unsaved work?', `formpth closed with unsaved changes in ${lost.map((r) => r.name).join(', ')}. Open them again?`, 'Recover'))) { await recovery.clear(); return; }
    for (const r of lost) reopen(r, `${r.name} (recovered)`);
    await recovery.clear();
  }

  const faces = Promise.all(['400', '500', '600'].map((w) => document.fonts.load(`${w} 12px Inter`))).catch(() => undefined);
  void Promise.race([faces, new Promise((r) => window.setTimeout(r, 2500))]).then(() => requestAnimationFrame(() => { revealApp(); void offerRecovery(); }));
  void plainText; void hex;
}

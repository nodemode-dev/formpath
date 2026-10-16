import { AgentBridge, regionOf } from './automation/agent-bridge';
import { CORNER_TYPES } from './engine/corners';
import { firstCorner, setCornersOp } from './engine/ops/corner-ops';
import { CONVERT_KINDS } from './engine/ops/live-shapes';
import { Engine, UNIT_PT, type Color, type CornerSpec, type Doc, type ExportAsset, type ImageNode, type Pt, type Rect, type TraceView, type Units, type VNode } from './engine';
import { allNodes, findNode, nodeLabel, newId, updateNodes } from './engine/doc';
import { EFFECTS } from './engine/effects';
import { reflectAbout, rotateAbout, scaleAbout, shearAbout, translate, mul, rectPath } from './engine/geometry';
import { transformNodes } from './engine/ops/objects';
import { anchorCount, mixPathfinder, objectOnPath, trapShapes, type OnPathArgs, type TrapArgs } from './engine/ops/illustrator';
import { pathOperation } from './engine/ops/paths';
import { RECOLOR, recolorDoc } from './engine/ops/recolor';
import { hex, solid, defaultGradient, NONE, toRgb, toCmyk, fill as fillItem, stroke as strokeItem, parseColor } from './engine/paint';
import { fontsChanged, plainText, textNode } from './engine/text';
import { toolHost, toolList, type Tool } from './extensions/registry';
import { api, type Capabilities, type OpenedProject } from './io/api';
import { ensureFace, installShaping, onFontsLoaded, outlineText, systemFonts } from './io/fonts';
import { exportPdf, readPdfNative } from './io/pdf';
import { buildPrintPdf, printPdf } from './io/print';
import { PrintDialog } from './ui/print-dialog';
import { DXF_UNITS, dxfToDoc, exportDxf, parseDxf, type DxfFile, type DxfImportOptions, type DxfUnit } from './io/dxf';
import { exportDwg } from './io/dwg-write';
import { DwgUnsupportedError, parseDwg } from './io/dwg';
import { exportEps, readEpsNative } from './io/eps';
import { readEpsVector } from './io/ps-read';
import { PdfPasswordError, readPdfVector } from './io/pdf-read';
import { isLegacyAi, readAiLegacy } from './io/ai-legacy';
import { importModel, MODEL_FILE, MODEL_PART } from './io/model';
import { docFromManifest, serialize } from './io/project-io';
import { bakeTraced, canvasBlob, exportAssetsZip, exportForScreens, exportRaster, renderRegion, type AssetItem } from './io/raster';
import { recovery, type RecoveryRecord } from './io/recovery';
import { exportRegion, exportSvg, importSvg } from './io/svg';
import { TRACE_VIEWS, traceImage, traceOptions, type TraceOpts, type TraceRun } from './io/trace';
import { unzip, zipFiles } from './io/zip';
import { PluginHost } from './plugins/host';
import { registerBuiltinTools } from './tools';
import { pendingShape, shapeAt } from './tools/draw';
import { typeDefaults } from './tools/type';
import { editWidthPoint } from './ui/width-point-dialog';
import { AboutDialog, ExportDialog, NewDocumentDialog, OpenDialog, ScreensDialog, SettingsDialog, ShortcutsDialog, type ExportChoice } from './ui/app-dialogs';
import { brandMark } from './ui/brand';
import { Commands } from './ui/commands';
import { anyDialogOpen, askPassword, askSaveChanges, confirmAction, promptName } from './ui/dialogs';
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
import { invalidatePaint, paint as paintOf } from './ui/palette';
import { smoothPath } from './engine/kernel';
import { PanelGroup } from './ui/panel-group';
import { AppearancePanel, GraphicStylesPanel } from './ui/panels/appearance';
import { AttributesPanel } from './ui/panels/attributes';
import { STYLE_LIBRARIES } from './engine/style-libraries';
import { envelopeOptions } from './engine/envelope';
import { AgentConfirmDialog } from './ui/panels/agent-confirm';
import { AssistantPanel } from './ui/panels/assistant';
import { ColorPanel, GradientPanel, SwatchesPanel } from './ui/panels/color';
import { BrushLibraryPanel, keepUserBrushLibrary, keepUserSwatchLibrary, keepUserSymbolLibrary, SwatchLibraryPanel, userBrushLibraries, userSwatchLibraries, userSymbolLibraries } from './ui/panels/libraries';
import { RecolorDialog } from './ui/panels/recolor';
import { libraryFromDoc, SWATCH_LIBRARIES, type SwatchLibrary } from './engine/swatch-libraries';
import { BRUSH_LIBRARIES, type BrushLibrary } from './engine/brush-libraries';
import { readAse, writeAse } from './io/ase';
import { newDoc as blankDoc } from './engine/doc';
import { Project } from './engine/project';
import { ColorPicker } from './ui/panels/color-picker';
import { HelpDialog } from './ui/panels/help';
import { HistoryPanel, InfoPanel, NavigatorPanel } from './ui/panels/navigator';
import { ActionsPanel } from './ui/panels/actions';
import { PluginsDialog } from './ui/panels/plugins-dialog';
import { effectDialog, previewEdit } from './ui/panels/preview-edit';
import { EffectGallery } from './ui/panels/effect-gallery';
import { ThreeDPanel } from './ui/panels/three-d';
import { BrushesPanel, StrokePanel, TransparencyPanel } from './ui/panels/stroke';
import { ArtboardsPanel, LinksPanel, SymbolLibraryPanel, SymbolsPanel } from './ui/panels/symbols';
import { SYMBOL_LIBRARIES, symbolLibraryFromDoc, type SymbolLibrary } from './engine/symbol-libraries';
import { SYMBOL_REGISTRATIONS, type SymbolRegistration } from './engine/symbols';
import { canLinkHandles, IMAGE_KINDS, LinkManager, linkKey, linkOf, pickLinkedFile, pickLinkFolder, saveLinkedFile, type LinkFile } from './io/links';
import { FilePathDialog } from './ui/file-dialog';
import { areaTypeOptionsDialog, CharacterPanel, findReplaceDialog, GlyphsPanel, hyphenationDialog, justificationDialog, ParagraphPanel, pathTypeOptionsDialog, TabsPanel } from './ui/panels/type';
import { TextStylesPanel } from './ui/panels/text-styles';
import { FindFontDialog } from './ui/panels/find-font';
import { ColorGuidePanel } from './ui/panels/color-guide';
import { PatternOptionsPanel } from './ui/panels/pattern-options';
import { ImageTracePanel } from './ui/panels/image-trace';
import { PatternGenPanel, RetypePanel, ShapeFillPanel } from './ui/panels/generative';
import { TextToVectorPanel } from './ui/panels/text-to-vector';
import { AssetExportPanel } from './ui/panels/asset-export';
import { GraphDataWindow } from './ui/panels/graph-data';
import { VariablesPanel } from './ui/panels/variables';
import { GraphDesignDialog, graphColumnDialog, graphMarkerDialog, graphSizeDialog, graphTypeDialog } from './ui/panels/graph-dialogs';
import { pendingGraph } from './tools/graph';
import { defineGrid, presetById, presetChoices, saveGridPreset } from './ui/panels/perspective-grid';
import { ANCHOR_SCALE, CHECKER_CELL, CHECKER_PAIR, SNAP_ANGLES, applyPrefs, loadPrefs, savePrefs, type Prefs } from './ui/prefs';
import { HelpBar } from './ui/helpbar';
import { TaskBar } from './ui/taskbar';
import { anchorUi } from './tools/util';
import { AlignPanel, PathfinderPanel, PropertiesPanel, TransformPanel } from './ui/properties';
import { Rail } from './ui/rail';
import { Stage } from './ui/stage';
import { StatusBar } from './ui/status';
import { TerminalDock } from './ui/terminal-dock';
import { Catalogue } from './automation/catalogue';
import { SpellingDialog, resetSpellCache } from './ui/panels/spelling';
import { SeparationsDialog } from './ui/panels/separations';
import { InkManagerDialog } from './ui/ink-manager';
import { assignPdfProfile } from './io/pdf-icc';
import { DocumentInfoDialog } from './ui/panels/document-info';
import { packageProject } from './io/package';
import { SpellMarks } from './ui/spell-marks';
import { Tabs } from './ui/tabs';
import { TextEditor, typing as typingRef } from './ui/text-editor';
import { TitleTools } from './ui/titlebar-tools';
import { toast } from './ui/toast';
import { activateDocument, isProofing, onColorChange } from './engine/color-management';
import { invalidateLayers } from './engine/render';
import { installColorBackend } from './io/color-ops';
import { assignProfileDialog, colorSettingsDialog, convertToProfileDialog, proofSetupDialog, toggleProofColors } from './ui/color-settings';
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
<div class="cv-isolation" hidden><span class="cv-isolation-label"></span><button class="cv-btn cv-iso-exit" type="button" data-cmd="exit-isolation">${icon('exitIsolation', 14)}Exit Isolation Mode</button><span class="cv-iso-pattern" hidden><button class="cv-btn cv-btn-primary" type="button" data-cmd="pattern-done">Done</button><button class="cv-btn" type="button" data-cmd="pattern-copy">Save a Copy</button><button class="cv-btn" type="button" data-cmd="pattern-cancel">Cancel</button></span><span class="cv-iso-pattern cv-iso-symbol" hidden><button class="cv-btn cv-btn-primary" type="button" data-cmd="symbol-exit">${icon('exitIsolation', 14)}Exit</button><button class="cv-btn" type="button" data-cmd="symbol-cancel">Cancel</button></span></div>
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
<div class="fp-helpbar" aria-label="Help bar"><span class="fp-help-name"></span><kbd class="fp-help-key" hidden></kbd><span class="fp-help-text"></span></div>
<footer class="cv-status"></footer>
</div>`;

const TAB_HOMES: Record<string, string> = { color: 'color-group', swatches: 'color-group', gradient: 'color-group', 'color-guide': 'color-group', stroke: 'stroke-group', transparency: 'stroke-group', brushes: 'stroke-group', attributes: 'stroke-group', 'swatch-library': 'color-group', 'brush-library': 'stroke-group', appearance: 'appearance-group', 'graphic-styles': 'appearance-group', 'three-d': 'appearance-group', symbols: 'symbols-group', artboards: 'symbols-group', links: 'symbols-group', 'image-trace': 'symbols-group', 'symbol-library': 'symbols-group', 'shape-fill': 'symbols-group', 'generate-patterns': 'symbols-group', 'text-to-vector': 'symbols-group', retype: 'type-group', navigator: 'navigator-group', info: 'navigator-group', history: 'navigator-group', actions: 'navigator-group', variables: 'navigator-group', 'asset-export': 'navigator-group', layers: 'layers-panel', properties: 'properties-group', transform: 'properties-group', align: 'properties-group', pathfinder: 'properties-group', 'pattern-options': 'properties-group', character: 'type-group', paragraph: 'type-group', 'character-styles': 'type-group', 'paragraph-styles': 'type-group', glyphs: 'type-group', tabs: 'type-group' };

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
  const spellMarks = new SpellMarks(engine, stage.painters);
  spellMarks.set(prefs.autoSpell);
  const typing = new TextEditor(stageEl, engine);
  typingRef.editor = typing;
  typing.redraw = () => stage.ctx.redraw();
  typing.style = () => ({ font: typeDefaults.font, style: typeDefaults.style, size: typeDefaults.size });
  stage.onType((r) => { if (!/^(type|areaType|typePath|typeVertical|areaTypeVertical|typePathVertical)$/.test(engine.tool)) engine.setTool('type'); typing.begin(r); });

  const late: { task: TaskBar | null } = { task: null };
  const GENERATIVE = ['generative-shape-fill', 'generate-patterns', 'retype', 'text-to-vector', 'generative-recolor', 'panel-shape-fill', 'panel-generate-patterns', 'panel-retype', 'panel-text-to-vector'];
  commands.gate = (cmd) => prefs.showGenerative || !GENERATIVE.includes(cmd.id);
  const applyUiPrefs = (pr: Prefs): void => {
    Stage.prefs = { ...Stage.prefs, zoomWheel: pr.zoomWheel, gridColor: pr.gridColor, guideColor: pr.guideColor, snapTol: pr.snapTolerance, gridInBack: pr.gridInBack, cell: CHECKER_CELL[pr.checkerSize], snapAngles: SNAP_ANGLES[pr.snapAngleSet] };
    anchorUi.scale = ANCHOR_SCALE[pr.anchorSize];
    for (const t of ['shape-fill', 'generate-patterns', 'retype', 'text-to-vector']) PanelGroup.setTabHidden(t, !pr.showGenerative);
    const rootEl = document.documentElement, helpOn = pr.helpBar ? 'on' : 'off';
    if (rootEl.getAttribute('data-fp-help') !== helpOn) rootEl.setAttribute('data-fp-help', helpOn);
    if (late.task) { late.task.enabled = pr.taskBar; late.task.schedule(); }
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
  const libMenu = new PopupMenu(commands, null, true);
  const openLibMenu = (anchor: HTMLElement, items: MenuItem[]): void => { libMenu.setItems(items); const r = anchor.getBoundingClientRect(); libMenu.openAt(r.left, r.top - 8); };
  const colorP = new ColorPanel(engine), swatchesP = new SwatchesPanel(engine, pickColor, (a) => openLibMenu(a, swatchLibItems()), () => void swatchInfo()), gradientP = new GradientPanel(engine, pickColor);
  const strokeP = new StrokePanel(engine), transP = new TransparencyPanel(engine), brushesP = new BrushesPanel(engine, (a) => openLibMenu(a, brushLibItems()));
  const swatchLibP = new SwatchLibraryPanel(engine, (a) => openLibMenu(a, swatchLibItems())), brushLibP = new BrushLibraryPanel(engine, (a) => openLibMenu(a, brushLibItems()));
  const recolorD = new RecolorDialog(engine, { pickColor: (c, live) => picker.pick(c, live), stagePoint: (x, y) => stage.docPoint(x, y), userLibraries: userSwatchLibraries, generative: () => prefs.showGenerative });
  const effectsMenu = new PopupMenu(commands, null, true);
  const appearanceP = new AppearancePanel(engine, pickColor, (anchor) => { effectsMenu.setItems(effectItems()); const r = anchor.getBoundingClientRect(); effectsMenu.openAt(r.left, r.top - 8); });
  const stylesP = new GraphicStylesPanel(engine);
  const symbolsP = new SymbolsPanel(engine, (c) => { commands.run(c); }, { library: (a) => openLibMenu(a, symbolLibItems()), panel: (a) => openLibMenu(a, ['symbol-edit', 'symbol-exit', '-', 'symbol-duplicate', 'symbol-redefine', 'symbol-replace', 'symbol-reset', '-', 'symbol-options', 'new-symbol', 'break-symbol', 'symbol-delete', '-', 'sym-lib-other', 'sym-lib-save']) }), artboardsP = new ArtboardsPanel(engine);
  const symbolLibP = new SymbolLibraryPanel(engine, (a) => openLibMenu(a, symbolLibItems()));
  const textToVectorP = new TextToVectorPanel(engine), shapeFillP = new ShapeFillPanel(engine), patternGenP = new PatternGenPanel(engine), retypeP = new RetypePanel(engine, ensureFace);
  const relinkInput = el<HTMLInputElement>('<input type="file" accept="image/*" hidden>');
  document.body.appendChild(relinkInput);
  let relinkIds: string[] = [];
  relinkInput.addEventListener('change', () => { const f = relinkInput.files?.[0]; relinkInput.value = ''; if (f && relinkIds.length) void relink(relinkIds, f); });
  let caps: Capabilities | null = null;
  const links = new LinkManager(engine, () => !!caps);
  links.notify = (t) => toast(t);
  const fileDialog = new FilePathDialog();
  const canLink = (): boolean => !!caps || canLinkHandles();
  const linksP = new LinksPanel(engine, links, (c) => { commands.run(c); }, (a) => openLibMenu(a, ['link-relink', 'link-relink-all', 'link-relink-folder', '-', 'link-update', 'link-update-all', '-', 'link-goto', 'link-info', '-', 'link-embed', 'link-unembed', '-', 'link-previews', 'place-linked']), canLink);
  const navP = new NavigatorPanel(engine), infoP = new InfoPanel(engine), historyP = new HistoryPanel(engine, () => void historyOptions());
  const actionsP = new ActionsPanel(engine, commands, { openFile: (f) => openFiles([f]), deliver: (b, n) => deliver(b, n), notify: (t, kind) => toast(t, kind ?? 'info'), version: VERSION, desktop: () => !!caps?.desktop });
  async function historyOptions(): Promise<void> {
    const v = await askForm('History Options', [{ kind: 'number', key: 'limit', label: 'Undo steps kept', value: engine.historyLimit, min: 10, max: 1000, step: 1 }, { kind: 'note', text: 'Older steps beyond the limit are dropped from every open document. The same setting is in Preferences > File Handling.' }]);
    if (!v) return;
    prefs = { ...prefs, historyStates: Math.round(Number(v.limit)) };
    savePrefs(prefs);
    applyPrefs(engine, prefs);
  }
  const layersP = new LayersPanel(engine, contextMenu);
  const propsP = new PropertiesPanel(engine, (c) => { commands.run(c); });
  const xformP = new TransformPanel(engine), alignP = new AlignPanel(engine), pfP = new PathfinderPanel(engine);
  const charP = new CharacterPanel(engine), paraP = new ParagraphPanel(engine), glyphsP = new GlyphsPanel(engine), tabsP = new TabsPanel(engine);
  typing.redraw = () => { stage.ctx.redraw(); glyphsP.caretMoved(); };
  const charStylesP = new TextStylesPanel(engine, 'char'), paraStylesP = new TextStylesPanel(engine, 'para');
  const graphData = new GraphDataWindow(engine);
  const variablesP = new VariablesPanel(engine, { deliver: (b, n) => deliver(b, n), version: VERSION, desktop: () => !!caps?.desktop });
  let graphDesign: GraphDesignDialog | null = null;
  void historyP; void navP;
  new PanelGroup(dockHost, 'color-group', [{ id: 'color', label: 'Color', body: colorP.body }, { id: 'swatches', label: 'Swatches', body: swatchesP.body }, { id: 'gradient', label: 'Gradient', body: gradientP.body }, { id: 'color-guide', label: 'Color Guide', body: new ColorGuidePanel(engine).body }, { id: 'swatch-library', label: 'Swatch Library', body: swatchLibP.body }], 'Color');
  new PanelGroup(dockHost, 'stroke-group', [{ id: 'stroke', label: 'Stroke', body: strokeP.body }, { id: 'transparency', label: 'Transparency', body: transP.body }, { id: 'brushes', label: 'Brushes', body: brushesP.body }, { id: 'attributes', label: 'Attributes', body: new AttributesPanel(engine).body }, { id: 'brush-library', label: 'Brush Library', body: brushLibP.body }], 'Stroke');
  new PanelGroup(dockHost, 'appearance-group', [{ id: 'appearance', label: 'Appearance', body: appearanceP.body }, { id: 'graphic-styles', label: 'Graphic Styles', body: stylesP.body }, { id: 'three-d', label: '3D and Materials', body: new ThreeDPanel(engine, (c) => { commands.run(c); }).body }], 'Appearance');
  new PanelGroup(dockHost, 'symbols-group', [{ id: 'symbols', label: 'Symbols', body: symbolsP.body }, { id: 'artboards', label: 'Artboards', body: artboardsP.body }, { id: 'links', label: 'Links', body: linksP.body }, { id: 'image-trace', label: 'Image Trace', body: new ImageTracePanel(engine, (id, a) => trace(id, a)).body }, { id: 'symbol-library', label: 'Symbol Library', body: symbolLibP.body }, { id: 'shape-fill', label: 'Generative Shape Fill', body: shapeFillP.body }, { id: 'generate-patterns', label: 'Generate Patterns', body: patternGenP.body }, { id: 'text-to-vector', label: 'Text to Vector Graphic', body: textToVectorP.body }], 'Symbols');
  new PanelGroup(dockHost, 'navigator-group', [{ id: 'navigator', label: 'Navigator', body: navP.body }, { id: 'info', label: 'Info', body: infoP.body }, { id: 'history', label: 'History', body: historyP.body }, { id: 'actions', label: 'Actions', body: actionsP.body }, { id: 'variables', label: 'Variables', body: variablesP.body }, { id: 'asset-export', label: 'Asset Export', body: new AssetExportPanel(engine, (list, items) => exportAssetList(list, items)).body }], 'Navigator');
  new PanelGroup(dockHost, 'layers-panel', [{ id: 'layers', label: 'Layers', body: layersP.body }], 'Layers');
  new PanelGroup(sideHost, 'properties-group', [{ id: 'properties', label: 'Properties', body: propsP.body }, { id: 'transform', label: 'Transform', body: xformP.body }, { id: 'align', label: 'Align', body: alignP.body }, { id: 'pathfinder', label: 'Pathfinder', body: pfP.body }, { id: 'pattern-options', label: 'Pattern Options', body: new PatternOptionsPanel(engine, (c) => { commands.run(c); }).body }], 'Properties');
  new PanelGroup(sideHost, 'type-group', [{ id: 'character', label: 'Character', body: charP.body }, { id: 'paragraph', label: 'Paragraph', body: paraP.body }, { id: 'character-styles', label: 'Character Styles', body: charStylesP.body }, { id: 'paragraph-styles', label: 'Paragraph Styles', body: paraStylesP.body }, { id: 'glyphs', label: 'Glyphs', body: glyphsP.body }, { id: 'tabs', label: 'Tabs', body: tabsP.body }, { id: 'retype', label: 'Retype', body: retypeP.body }], 'Type');
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
  const narrow = window.matchMedia('(max-width: 1099px)');
  let autoCollapsed = false;
  const fitDock = (): void => {
    if (narrow.matches && loadPrefs().narrowCollapse && !dock.collapsed) { autoCollapsed = true; dock.setCollapsed(true); }
    else if (!narrow.matches && autoCollapsed) { autoCollapsed = false; if (dock.collapsed) dock.setCollapsed(false); }
  };
  narrow.addEventListener('change', fitDock);
  fitDock();
  new Rail(q(root, '.cv-rail'), engine);
  new OptionsBar(q(root, '.cv-options'), engine);
  const status = new StatusBar(q(root, '.cv-status'), engine);
  new HelpBar(q(root, '.fp-helpbar'), engine);
  late.task = new TaskBar(q(document.body, '#overlay-root'), stageEl, engine, commands);
  applyUiPrefs(prefs);
  const termDock = new TerminalDock();
  root.insertBefore(termDock.root, q(root, '.cv-status'));
  termDock.onFail = (err) => toast(message(err), 'error');
  termDock.context = () => {
    const p = engine.current;
    if (!p) return 'formpth window: no document is open';
    const ids = engine.selectedIds();
    const where = `formpth window: document "${p.name}"`;
    return ids.length ? `${where}; selection: ${ids.length === 1 ? 'node id' : 'node ids'} ${ids.slice(0, 200).join(', ')}${ids.length > 200 ? ` and ${ids.length - 200} more` : ''}` : where;
  };
  termDock.note = () => { const n = engine.selectedIds().length; return n ? `with ${n} selected ${n === 1 ? 'object' : 'objects'}` : ''; };
  stage.onPointerDoc = (pt) => { status.setPointer(pt); infoP.setPointer(pt); };

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

  let modelParts: File[] = [], partsAt = 0;
  const partsNow = (): File[] => (Date.now() - partsAt < 120000 ? modelParts : []);
  const splitParts = (files: File[]): File[] => {
    if (!files.some((f) => MODEL_FILE.test(f.name))) return files;
    const own = files.filter((f) => MODEL_FILE.test(f.name) || !(MODEL_PART.test(f.name) || f.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(f.name)));
    if (own.length !== files.length) { modelParts = files; partsAt = Date.now(); }
    return own;
  };
  const modelNote = (m: Awaited<ReturnType<typeof importModel>>, verb: string): string => `${verb} ${m.name}: ${m.faces.toLocaleString('en-US')} triangles in ${m.mesh.groups.length} material group${m.mesh.groups.length === 1 ? '' : 's'}.${m.faces > 4000 ? ' The vector view shows up to 4,000 faces, ray tracing uses them all.' : ''}${m.notes.length ? ` Left out: ${m.notes.join('; ')}.` : ''}`;
  async function openModel(f: File, parts: File[]): Promise<void> {
    const m = await importModel(f, parts), s = 640;
    const p = engine.newDocument(s, s, { title: m.name, units: 'px' });
    engine.addModel(m.mesh, m.blob, m.key, m.textures, m.name, { x: s / 2, y: s / 2 }, 400);
    p.history.markSaved();
    toast(modelNote(m, 'Opened'));
  }
  async function placeModel(f: File, at: Pt | null, parts: File[], size: number | null = null): Promise<string | null> {
    const p = engine.current;
    if (!p) return null;
    const m = await importModel(f, parts), v = p.viewport, id = engine.addModel(m.mesh, m.blob, m.key, m.textures, m.name, at ?? v.toDoc(v.centerX, v.height / 2), size && size > 0 ? size : 260);
    toast(modelNote(m, 'Placed'));
    return id || null;
  }

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

  async function dxfOptions(file: DxfFile, given: Partial<DxfImportOptions> | null): Promise<DxfImportOptions | null> {
    const guess: DxfUnit = file.units !== 'unitless' ? file.units : file.metric ? 'mm' : 'in';
    const base: DxfImportOptions = { units: guess, scale: 1, layout: 'Model', merge: false, fit: 'actual' };
    if (given) return { ...base, ...Object.fromEntries(Object.entries(given).filter(([, v]) => v !== undefined)) } as DxfImportOptions;
    const v = await askForm('DXF Import Options', [
      { kind: 'note', text: `AutoCAD ${file.version ? `drawing (${file.version})` : 'drawing'}, ${file.layers.size} layer${file.layers.size === 1 ? '' : 's'}${file.units === 'unitless' ? ', no units saved in the file' : ''}.` },
      { kind: 'select', key: 'layout', label: 'Layout', value: 'Model', choices: file.layouts.map((l) => [l, l === 'Model' ? 'Model space' : l] as const) },
      { kind: 'select', key: 'fit', label: 'Scale', value: 'actual', choices: [['actual', 'Use the drawing units'], ['artboard', 'Fit to a Letter artboard']] },
      { kind: 'select', key: 'units', label: 'One drawing unit is', value: guess, choices: DXF_UNITS },
      { kind: 'number', key: 'scale', label: 'Scale factor', value: 1, min: 0.0001, max: 100000, step: 0.1 },
      { kind: 'check', key: 'merge', label: 'Merge all layers into one', value: false },
    ], { ok: 'Open' });
    if (!v) return null;
    return { units: String(v.units) as DxfUnit, scale: Math.max(1e-4, Number(v.scale) || 1), layout: String(v.layout), merge: v.merge === true, fit: v.fit === 'artboard' ? 'artboard' : 'actual' };
  }

  async function readForeign(f: File, dxf: Partial<DxfImportOptions> | null): Promise<{ doc: Doc; assets: Map<string, Blob>; title: string; note: string } | null> {
    const lower = f.name.toLowerCase(), title = f.name.replace(/\.[^.]+$/, '');
    const isDwg = lower.endsWith('.dwg');
    if (isDwg || lower.endsWith('.dxf')) {
      let file: DxfFile, how = '';
      if (isDwg) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        try { file = parseDwg(bytes); how = ' natively'; }
        catch (e) {
          // only a version the native reader does not cover goes to the installed converter; a damaged file reports its own error
          if (!(e instanceof DwgUnsupportedError)) throw e;
          const conv = await api.dwgToDxf(f);
          file = parseDxf(conv.text);
          how = ` through ${conv.converter}`;
        }
      } else file = parseDxf(await f.text());
      const o = await dxfOptions(file, dxf);
      if (!o) return null;
      const r = dxfToDoc(file, o, title);
      return { doc: r.doc, assets: new Map(), title, note: `Opened ${f.name}${how}: ${r.doc.layers.length} layer${r.doc.layers.length === 1 ? '' : 's'}.${r.skipped.length ? ` Left out: ${r.skipped.join(', ')}.` : ''}` };
    }
    const data = await f.arrayBuffer(), native = readEpsNative(data);
    if (native) return { doc: docFromManifest(native.manifest), assets: native.assets, title, note: '' };
    const r = await readEpsVector(data, title);
    return { doc: r.doc, assets: r.assets, title, note: `Opened ${f.name} by running its PostScript: paths, fills, strokes, clipping, gradients, images and text.${r.skipped.length ? ` Left out: ${r.skipped.join(', ')}.` : ''}` };
  }

  async function openFiles(files: File[], dxf: Partial<DxfImportOptions> | null = null, password?: string): Promise<void> {
    files = splitParts(files);
    await engine.task(async () => {
      for (const f of files) {
        try {
          const lower = f.name.toLowerCase();
          if (/\.(dxf|dwg|eps|epsf|ps)$/.test(lower)) { const r = await readForeign(f, dxf); if (r) { adopt(r.doc, r.title, r.assets); if (r.note) toast(r.note); } continue; }
          if (MODEL_FILE.test(lower)) { await openModel(f, partsNow()); continue; }
          if (lower.endsWith('.fpth')) await openFpth(await f.arrayBuffer(), f.name);
          else if (lower.endsWith('.ase')) await openLibraryFile(f, 'swatch');
          else if (lower.endsWith('.svg') || lower.endsWith('.svgz')) { const r = await importSvg(await svgText(f), f.name.replace(/\.svgz?$/i, '')); adopt(r.doc, r.title, r.assets); if (!r.native) toast(`Opened ${f.name}. SVG brings paths, shapes, gradients, patterns, masks, clipping, markers, type and images.${r.leftOut.length ? ` Left out: ${r.leftOut.slice(0, 4).join(' ')}` : ''}`); }
          else if (lower.endsWith('.pdf') || lower.endsWith('.ai')) {
            const data = await f.arrayBuffer(), title = f.name.replace(/\.(pdf|ai)$/i, '');
            if (lower.endsWith('.ai') && isLegacyAi(data)) {
              const r = await readAiLegacy(data, title);
              adopt(r.doc, title, r.assets);
              toast(`Opened ${f.name}: ${r.doc.layers.length} layer${r.doc.layers.length === 1 ? '' : 's'}.${r.kept.length ? ` Brought in ${r.kept.join(', ')}.` : ''}${r.skipped.length ? ` Left out: ${r.skipped.join(', ')}.` : ''}`);
              continue;
            }
            const native = await readPdfNative(data);
            if (native) { adopt(docFromManifest(native.manifest), title, native.assets); continue; }
            let r: Awaited<ReturnType<typeof readPdfVector>> | null = null, pw = password;
            while (!r) {
              try { r = await readPdfVector(data, title, pw); } catch (err) {
                if (!(err instanceof PdfPasswordError) || password !== undefined) throw err;
                const next = await askPassword(f.name, err.wrong);
                if (next === null) throw err;
                pw = next;
              }
            }
            const tagged = await assignPdfProfile(r.doc, data);
            adopt(tagged.doc, title, r.assets);
            if (tagged.name) toast(`The PDF colours use the CMYK profile ${tagged.name}; it is now this document's CMYK working space.`);
            const subs =r.fonts.slice(0, 4).map(([from, to]) => `${from} as ${to}`).join(', ') + (r.fonts.length > 4 ? ` and ${r.fonts.length - 4} more` : '');
            toast(`Opened ${f.name}: ${r.pages === 1 ? 'one page as an artboard' : `${r.pages} pages as artboards`}.${r.fonts.length ? ` Fonts not installed, set in their nearest match: ${subs}.` : ''}${r.skipped.length ? ` Left out: ${r.skipped.join(', ')}.` : ''}`);
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

  async function placeFile(f: File, at: Pt | null, width: number | null, dxf: Partial<DxfImportOptions> | null = null): Promise<string | null> {
    const p = engine.current;
    if (!p) { await openFiles([f], dxf); const opened = engine.current as { doc: Doc } | null; return opened?.doc.layers[0]?.children[0]?.id ?? null; }
    if (MODEL_FILE.test(f.name)) return placeModel(f, at, partsNow(), width);
    const v = p.viewport, center = v.toDoc(v.centerX, v.height / 2);
    const foreign = /\.(dxf|dwg|eps|epsf|ps)$/i.test(f.name);
    if (foreign || /\.svgz?$/i.test(f.name) || f.type === 'image/svg+xml') {
      const r = foreign ? await readForeign(f, dxf) : await importSvg(await svgText(f), f.name);
      if (!r) return null;
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

  async function relink(ids: string[], f: File): Promise<void> {
    const s = await imageSize(f), key = imageKey(f), p = engine.current;
    if (!p) return;
    p.assets.set(key, f);
    engine.setImageSource('Relink', ids, { key, mime: f.type || 'image/png', w: s.w, h: s.h }, null);
    toast(`Replaced the image with ${f.name}. This browser cannot keep links to files, so it is embedded.`);
  }

  const pickedImage = (): ImageNode | null => (engine.selected().find((n) => n.kind === 'image') as ImageNode | undefined) ?? null;
  const sameLink = (n: ImageNode): string[] => links.images().filter((x) => (n.linked && x.linked ? linkKey(x.linked) === linkKey(n.linked) : x.src === n.src)).map((x) => x.id);

  async function chooseLinkFile(title: string): Promise<LinkFile | null> {
    if (caps) {
      const path = await fileDialog.choose({ title, mode: 'file', kinds: IMAGE_KINDS, ok: 'Link', note: 'formpth keeps the path and reads the file again when it changes.' });
      if (!path) return null;
      try { return await links.readPath(path); } catch (err) { toast(message(err), 'error'); return null; }
    }
    return canLinkHandles() ? pickLinkedFile() : null;
  }

  async function linkFileTo(ids: string[], f: LinkFile, name: string): Promise<boolean> {
    const p = engine.current;
    if (!p || !ids.length) return false;
    const s = await imageSize(f.blob), key = imageKey(f.blob);
    p.assets.set(key, f.blob);
    const ok = engine.setImageSource(name, ids, { key, mime: f.blob.type || 'image/png', w: s.w, h: s.h }, linkOf(f));
    void links.preview(p, key, f.blob);
    void links.check();
    return ok;
  }

  async function placeLinked(f: LinkFile | null, at: Pt | null = null, width: number | null = null): Promise<string | null> {
    const p = engine.current;
    if (!p || !f) return null;
    const s = await imageSize(f.blob), key = imageKey(f.blob), v = p.viewport, center = v.toDoc(v.centerX, v.height / 2);
    const w = width ?? s.w, h = (w / s.w) * s.h;
    const id = engine.addImage(key, f.blob, s.w, s.h, at ?? { x: center.x - w / 2, y: center.y - h / 2 }, w, undefined, linkOf(f)) || null;
    void links.preview(p, key, f.blob);
    void links.check();
    return id;
  }

  async function relinkFolder(): Promise<{ done: number; total: number }> {
    const p = engine.current;
    const missing = links.images().filter((n) => n.linked && links.state(n) === 'missing');
    const groups = new Map<string, ImageNode[]>();
    for (const n of missing) { const k = linkKey(n.linked as NonNullable<ImageNode['linked']>); groups.set(k, [...(groups.get(k) ?? []), n]); }
    if (!p || !groups.size) { toast('No links are missing.'); return { done: 0, total: 0 }; }
    let find: ((name: string) => Promise<LinkFile | null>) | null = null;
    if (caps) {
      const folder = await fileDialog.choose({ title: 'Relink Missing Links from a Folder', mode: 'folder', kinds: IMAGE_KINDS, note: '' });
      if (!folder) return { done: 0, total: groups.size };
      const list = await api.listFolder(folder, IMAGE_KINDS);
      const byName = new Map(list.files.map((f) => [f.name.toLowerCase(), f.path]));
      find = async (name) => { const path = byName.get(name.toLowerCase()); return path ? links.readPath(path) : null; };
    } else if (canLinkHandles()) {
      const dir = await pickLinkFolder();
      if (!dir) return { done: 0, total: groups.size };
      find = async (name) => { const get = dir.get(name.toLowerCase()); return get ? get() : null; };
    } else { toast('This browser cannot keep links to files.', 'error'); return { done: 0, total: groups.size }; }
    let done = 0;
    engine.beginStep();
    try {
      for (const [, nodes] of groups) {
        const f = await find(nodes[0].linked?.name ?? '').catch(() => null);
        if (f && await linkFileTo(nodes.map((n) => n.id), f, 'Relink Missing Links')) done++;
      }
    } finally { engine.endStep(); }
    toast(`Relinked ${done} of ${groups.size} missing ${groups.size === 1 ? 'link' : 'links'}.`, done < groups.size ? 'error' : 'info');
    return { done, total: groups.size };
  }

  async function updateLinks(nodes: ImageNode[]): Promise<number> {
    const groups = new Map<string, ImageNode[]>();
    for (const n of nodes) if (n.linked) { const k = linkKey(n.linked); groups.set(k, [...(groups.get(k) ?? []), n]); }
    let done = 0;
    engine.beginStep();
    try {
      for (const [, ns] of groups) {
        const f = await links.read(ns[0].linked as NonNullable<ImageNode['linked']>, true);
        if (f && await linkFileTo(ns.map((n) => n.id), f, 'Update Link')) done++;
      }
    } finally { engine.endStep(); }
    return done;
  }

  function embedLinks(nodes: ImageNode[]): number {
    const t = nodes.filter((n) => n.linked);
    if (!t.length) return 0;
    if (t.some((n) => links.state(n) === 'missing')) toast('A missing file can only be embedded from its cached preview, at a lower resolution.', 'error');
    engine.setImageSource('Embed Image', t.map((n) => n.id), null, null);
    return t.length;
  }

  async function unembed(n: ImageNode): Promise<boolean> {
    const p = engine.current, raw = p?.assets.get(n.src);
    if (!p || !raw || n.linked) return false;
    const ext = raw.type === 'image/jpeg' ? 'jpg' : raw.type === 'image/webp' ? 'webp' : 'png';
    const blob = ext === 'png' && raw.type !== 'image/png' ? await (async () => { const b = await createImageBitmap(raw), c = new OffscreenCanvas(b.width, b.height); c.getContext('2d')?.drawImage(b, 0, 0); b.close(); return c.convertToBlob({ type: 'image/png' }); })() : raw;
    const base = (n.name ?? n.link ?? 'Image').replace(/\.[a-z0-9]+$/i, '').replace(/[^A-Za-z0-9 ._()-]+/g, '_').trim() || 'Image', fname = `${base}.${ext}`;
    let f: LinkFile | null = null;
    if (caps) {
      const lib = (await api.libraryFolder())?.folder ?? caps.libraryDir;
      const folder = `${lib.replace(/[\\/]$/, '')}/${p.name.replace(/[\\/:*?"<>|]+/g, '_')} Links`;
      try { f = await links.readPath(await api.writeFile(folder, fname, blob)); } catch (err) { toast(message(err), 'error'); return false; }
    } else if (canLinkHandles()) f = await saveLinkedFile(blob, fname);
    else { await deliver(blob, fname); toast('Saved a copy of the image. This browser cannot link files, so the image stays embedded.'); return false; }
    if (!f) return false;
    const ok = await linkFileTo([n.id], f, 'Unembed Image');
    if (ok) toast(`Wrote ${f.path ?? f.name} and linked the image to it.`);
    return ok;
  }

  async function linkInfo(n: ImageNode): Promise<void> {
    const st = links.state(n), l = n.linked, sc = Math.hypot(n.xf[0], n.xf[1]), sy = Math.hypot(n.xf[2], n.xf[3]);
    const ppi = (k: number): number => Math.round(72 / Math.max(1e-9, k));
    const when = (t?: number): string => (t ? new Date(t).toLocaleString() : 'unknown');
    await askForm('Link Info', [
      { kind: 'note', text: `Name: ${l?.name ?? n.name ?? n.src}` },
      { kind: 'note', text: `State: ${st === 'embedded' ? 'Embedded in the document' : st === 'modified' ? 'Modified on disk (update available)' : st === 'missing' ? 'Missing' : 'Linked'}` },
      { kind: 'note', text: `Location: ${l?.path ?? (l?.handle ? 'A file chosen in this browser (kept by permission)' : 'Inside the document')}` },
      ...(l ? [{ kind: 'note' as const, text: `File size: ${l.size !== undefined ? `${Math.round(l.size / 1024)} KB` : 'unknown'} · modified ${when(l.mtime)}` }] : []),
      { kind: 'note', text: `Pixels: ${n.w} × ${n.h} · effective PPI ${ppi(sc)} × ${ppi(sy)}` },
      { kind: 'note', text: `Placed at ${Math.round(n.xf[4])}, ${Math.round(n.xf[5])} pt · scale ${Math.round(sc * 1000) / 10}% × ${Math.round(sy * 1000) / 10}% · angle ${Math.round((Math.atan2(n.xf[1], n.xf[0]) * 1800) / Math.PI) / 10}°` },
    ], { ok: 'Close' });
  }

  async function linkTool(a: Record<string, unknown>): Promise<{ ok: boolean; text: string; data?: Record<string, unknown> }> {
    const act = String(a.action ?? 'list'), p = engine.current;
    if (!p) return { ok: false, text: 'Open a document first.' };
    const node = typeof a.id === 'string' ? (findNode(p.doc, a.id) as ImageNode | null) : pickedImage();
    if (act === 'list') {
      await links.check();
      const list = links.images().map((n) => ({ id: n.id, name: n.linked?.name ?? n.name ?? n.src, state: links.state(n), path: n.linked?.path ?? null, pixels: `${n.w}x${n.h}` }));
      return { ok: true, text: list.map((x) => `${x.id}: ${x.name} (${x.state}${x.path ? `, ${x.path}` : ''})`).join('\n') || 'No placed images.', data: { links: list } };
    }
    if (act === 'relink_folder') {
      if (typeof a.folder !== 'string' || !caps) return { ok: false, text: 'Pass folder: an absolute folder path (the engine service reads it).' };
      const list = await api.listFolder(a.folder, IMAGE_KINDS), byName = new Map(list.files.map((f) => [f.name.toLowerCase(), f.path]));
      const miss = [...new Map(links.images().filter((n) => n.linked && links.state(n) === 'missing').map((n) => [linkKey(n.linked as NonNullable<ImageNode['linked']>), n])).values()];
      let done = 0;
      engine.beginStep();
      try { for (const n of miss) { const path = byName.get((n.linked?.name ?? '').toLowerCase()); if (path && await linkFileTo(sameLink(n), await links.readPath(path), 'Relink Missing Links')) done++; } } finally { engine.endStep(); }
      return { ok: true, text: `Relinked ${done} of ${miss.length} missing links from ${list.folder}.`, data: { relinked: done, missing: miss.length } };
    }
    if (act === 'update' && a.all === true) { const n = await updateLinks(links.images().filter((x) => links.state(x) === 'modified')); return { ok: true, text: `Updated ${n} modified links.` }; }
    if (!node || node.kind !== 'image') return { ok: false, text: 'Pass id: a placed image (see links with action list).' };
    if (act === 'relink') {
      if (typeof a.path !== 'string' || !caps) return { ok: false, text: 'Pass path: the absolute path of the new image file.' };
      const ids = a.all === true ? sameLink(node) : [node.id];
      const ok = await linkFileTo(ids, await links.readPath(a.path), a.all === true ? 'Relink All Instances' : 'Relink');
      return { ok, text: ok ? `Linked ${ids.length} ${ids.length === 1 ? 'image' : 'images'} to ${a.path}.` : 'Nothing changed.' };
    }
    if (act === 'update') { const n = await updateLinks([node]); return { ok: n > 0, text: n ? 'Updated the link from its file.' : 'Could not read the linked file.' }; }
    if (act === 'embed') { const n = embedLinks(sameLink(node).map((id) => findNode(p.doc, id) as ImageNode)); return { ok: n > 0, text: n ? `Embedded ${n} ${n === 1 ? 'image' : 'images'}.` : 'The image is already embedded.' }; }
    if (act === 'unembed') { const ok = await unembed(node); return { ok, text: ok ? `Wrote the image next to the project and linked it (${(findNode(engine.current?.doc as Doc, node.id) as ImageNode | null)?.linked?.path ?? ''}).` : 'Could not unembed the image.' }; }
    return { ok: false, text: 'action is list, relink, relink_folder, update, embed or unembed.' };
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
    if (c.format === 'pdf' || c.format === 'ai') return exportPdf(p, { artboards: scope === 'all' || scope === 'art' ? p.doc.artboards.map((_, i) => i) : c.artboards ?? [ab], preserve: c.format === 'ai' || c.preserve, ppi: p.doc.rasterPpi || 300, version: VERSION, marks: c.format === 'pdf' ? c.marks : undefined, liveText: c.liveText, standard: c.format === 'pdf' ? c.standard : 'none', layers: c.format === 'pdf' ? c.layers : true, compression: c.compression, security: c.format === 'pdf' ? c.security : undefined });
    if (c.format === 'eps') {
      const one = (region: Rect, title: string): Promise<Blob> => exportEps(p, { region, cmyk: c.cmyk ?? p.doc.colorMode === 'cmyk', preserve: c.preserve, ppi: p.doc.rasterPpi || 300, title, version: VERSION });
      if (scope === 'all' && p.doc.artboards.length > 1) {
        const files: Array<{ name: string; blob: Blob }> = [];
        for (const a of p.doc.artboards) files.push({ name: `${p.name}-${a.name}.eps`.replace(/[\\/:*?"<>|]+/g, '-'), blob: await one(a, `${p.name} ${a.name}`) });
        return zipFiles(files);
      }
      const r = scope === 'selection' ? regionOf(engine, 'selection') : scope === 'art' ? exportRegion(p, 'art') : exportRegion(p, ab);
      return r ? one(r, p.name) : null;
    }
    if (c.format === 'dxf' || c.format === 'dwg') {
      const cad = c.cad ?? { version: '2000', units: 'mm', scale: 1, text: 'text', lineweights: false };
      const region = scope === 'selection' ? regionOf(engine, 'selection') : scope === 'art' ? exportRegion(p, 'art') : scope === 'all' ? exportRegion(p, 'all') : exportRegion(p, ab);
      if (!region) return null;
      return (c.format === 'dwg' ? exportDwg : exportDxf)(p, { region, ...cad, ids: scope === 'selection' ? engine.targetIds() : undefined }, async (n) => { await ensureFace(n.spans[0]?.style.font ?? 'Inter', n.spans[0]?.style.style ?? 'Regular'); return outlineText(n); });
    }
    const region = scope === 'selection' ? regionOf(engine, 'selection') : scope === 'art' ? exportRegion(p, 'art') : scope === 'all' ? exportRegion(p, 'all') : exportRegion(p, ab);
    if (!region) return null;
    const only = scope === 'selection' ? engine.targetIds().map((id) => findNode(p.doc, id)).filter((n): n is VNode => !!n) : undefined;
    const bg = scope === 'artboard' ? p.doc.artboards[ab]?.bg ?? null : null;
    return exportRaster(p, { region, scale: c.scale, format: c.format, quality: c.quality, transparent: c.transparent, bg, only, tiff: c.format === 'tiff' ? c.tiff : undefined, icc: c.icc });
  }

  const exportDialog = new ExportDialog(), screensDialog = new ScreensDialog();
  let printDialog: PrintDialog | null = null;
  let inkManager: InkManagerDialog | null = null;
  function openInkManager(after?: () => void): void {
    if (!engine.doc) return;
    inkManager ??= new InkManagerDialog(engine);
    inkManager.show(after);
  }
  async function printDocument(): Promise<void> {
    const p = engine.current;
    if (!p) return;
    typing.end();
    printDialog ??= new PrintDialog(openInkManager);
    const s = await printDialog.ask(p);
    if (!s) return;
    await engine.task(async () => {
      try {
        const blob = await buildPrintPdf(p, s, VERSION);
        const how = await printPdf(blob, async (b) => { await deliver(b, `${p.name}.pdf`); toast('This computer could not open its print dialog from here, so the PDF was saved instead. Open it and print from there.'); });
        if (how === 'printed') toast('Sent to the print dialog.');
      } catch (err) { toast(message(err), 'error'); }
    });
  }
  async function exportAs(format: ExportChoice['format']): Promise<void> {
    const p = engine.current;
    if (!p) return;
    const c = await exportDialog.ask(format, p.activeArtboard, engine.hasSelection, p.doc.colorMode === 'cmyk', p.doc.artboards.length, !!p.doc.cm);
    if (!c) return;
    await engine.task(async () => {
      try {
        if (c.artboards && c.artboards.length > 1 && c.format !== 'pdf' && c.format !== 'ai') {
          const files: Array<{ name: string; blob: Blob }> = [];
          for (const i of c.artboards) {
            const one = await exportBlob({ ...c, artboard: i, artboards: undefined });
            if (one) files.push({ name: `${p.name}-${i + 1}.${c.format}`.replace(/[\\/:*?"<>|]+/g, '-'), blob: one });
          }
          if (!files.length) { toast('There is nothing to export there.', 'error'); return; }
          await deliver(await zipFiles(files), `${p.name}.zip`.replace(/[\\/:*?"<>|]+/g, '-'));
          return;
        }
        const blob = await exportBlob(c);
        if (!blob) { toast('There is nothing to export there.', 'error'); return; }
        const suffix = c.scope === 'artboard' && p.doc.artboards.length > 1 ? `-${p.doc.artboards[c.artboard]?.name ?? ''}` : '';
        const ext = c.format === 'eps' && c.scope === 'all' && p.doc.artboards.length > 1 ? 'zip' : c.format;
        await deliver(blob, `${p.name}${suffix}.${ext}`.replace(/[\\/:*?"<>|]+/g, '-'));
      } catch (err) { toast(message(err), 'error'); }
    });
  }
  async function exportAssetList(list: ExportAsset[], items: AssetItem[]): Promise<void> {
    const p = engine.current;
    if (!p || !list.length || !items.length) return;
    await engine.task(async () => {
      try {
        const zip = await exportAssetsZip(p, list, items, (q) => exportPdf(q, { artboards: [0], preserve: false, ppi: p.doc.rasterPpi || 300, version: VERSION }));
        if (!zip) { toast('Those assets have no art left to export.', 'error'); return; }
        await deliver(zip, `${p.name}-assets.zip`);
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

  const traceRuns = new Map<string, AbortController>();
  async function trace(id: string, a: Record<string, unknown>): Promise<string | null> {
    const p = engine.current, n = p ? findNode(p.doc, id) : null;
    let live = n?.kind === 'group' && n.trace ? n : null;
    const src = n?.kind === 'image' ? n : live?.trace?.src ?? null;
    if (!p || !n || !src) return null;
    const blob = p.assets.get(src.src);
    if (!blob) return null;
    const o = traceOptions(live?.trace?.opts as Partial<TraceOpts> | undefined ?? {}, a);
    const library = p.doc.swatches.flatMap((s) => (s.paint.type === 'color' && !s.name.startsWith('[') ? [toRgb(s.paint.color)] : [])).map((c) => [c.r, c.g, c.b] as [number, number, number]);
    if (o.palette === 'library' && !library.length) { toast('The document has no colour swatches for the Document Library palette.', 'error'); return null; }
    const view = TRACE_VIEWS.some(([v]) => v === a.view) ? a.view as TraceView : live?.trace?.view ?? 'result';
    const placeholder = !live;
    if (!live) {
      const ph: VNode = { id: newId('g'), kind: 'group', name: 'Image Tracing', clip: false, children: [{ ...src, id: newId('im') }], opacity: 1, blend: 'normal', ap: { items: [], effects: [] }, trace: { src, opts: { ...o }, view } };
      if (!engine.edit('Image Trace', (d) => (findNode(d, id) ? { doc: updateNodes(d, [id], () => ph), select: [ph.id] } : d))) return null;
      live = ph as typeof live & object;
      id = ph.id;
    }
    traceRuns.get(id)?.abort();
    const ctl = new AbortController();
    traceRuns.set(id, ctl);
    const revert = (): void => { if (placeholder) engine.edit('Image Trace', (d) => (findNode(d, id) ? { doc: updateNodes(d, [id], () => src), select: [src.id] } : d), { merge: true }); };
    let res: TraceRun;
    try { res = await engine.task(() => traceImage(blob, src.xf, { w: src.w, h: src.h }, o, library, ctl.signal)); }
    catch (err) { if (err instanceof DOMException && err.name === 'AbortError') return null; traceRuns.delete(id); revert(); throw err; }
    if (traceRuns.get(id) !== ctl) return null;
    traceRuns.delete(id);
    const g = res.node;
    if (!g || g.kind !== 'group') { revert(); return null; }
    const cur = findNode(engine.current?.doc as Doc, id);
    if (!cur || cur.kind !== 'group' || !cur.trace) return null;
    const info = { src, opts: { ...o, traced: `${res.w}x${res.h}`, found: res.colors }, view: TRACE_VIEWS.some(([v]) => v === a.view) ? view : cur.trace.view };
    const next: VNode = { ...cur, children: g.children, trace: info };
    engine.edit(placeholder ? 'Image Trace' : 'Image Trace Options', (d) => (findNode(d, id) ? { doc: updateNodes(d, [id], () => next), select: [next.id] } : d), { merge: true });
    if (a.expand === true) engine.expandTrace([next.id]);
    return next.id;
  }

  async function gapOptions(): Promise<void> {
    const n = engine.selected().find((x) => x.kind === 'group' && !!x.livePaint);
    if (n?.kind !== 'group' || !n.livePaint) return;
    const gap = n.livePaint.gap, sizes: Record<string, number> = { small: 3, medium: 6, large: 12 };
    const pick = gap <= 0 ? 'off' : Object.keys(sizes).find((k) => sizes[k] === gap) ?? 'custom';
    const v = await askForm('Gap Options', [
      { kind: 'select', key: 'stop', label: 'Paint stops at', value: pick, choices: [['off', 'No gap detection'], ['small', 'Small gaps (3 pt)'], ['medium', 'Medium gaps (6 pt)'], ['large', 'Large gaps (12 pt)'], ['custom', 'Custom']] },
      { kind: 'number', key: 'custom', label: 'Custom gap', value: gap > 0 ? gap : 6, min: 0.5, max: 72, unit: 'pt' },
    ], { ok: 'Apply' });
    if (!v) return;
    const s = String(v.stop);
    engine.setLivePaintGap(s === 'off' ? 0 : s === 'custom' ? Number(v.custom) : sizes[s] ?? 0, [n.id]);
  }

  async function makeTrace(expand: boolean): Promise<void> {
    const imgs = engine.selected().filter((x) => x.kind === 'image');
    if (!imgs.length) { toast('Select a placed image to trace.'); return; }
    if (!expand) showPanel('image-trace');
    let found = 0;
    for (const n of imgs) if (await trace(n.id, { preset: '6 Colors', expand })) found++;
    if (!found) toast('The trace found no shapes: try another preset.', 'error');
  }

  const home = new HomeScreen(root, { engine, autoShow: () => loadPrefs().autoShowHome, recent: () => recent, openRecent: (name) => { void openLibrary(name); }, run: (c) => { commands.run(c); }, preset: (id) => newDoc.createPreset(id) });
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
  const placeInput = el<HTMLInputElement>('<input type="file" accept="image/*,.svg,.svgz,.eps,.epsf,.dxf,.dwg,.obj,.mtl,.glb,.gltf,.bin" multiple hidden>');
  document.body.appendChild(placeInput);
  placeInput.addEventListener('change', () => { const fs = splitParts(Array.from(placeInput.files ?? [])); placeInput.value = ''; void engine.task(async () => { for (const f of fs) { try { await placeFile(f, null, null); } catch (err) { toast(`${f.name}: ${message(err)}`, 'error'); } } }); });

  const agents = new AgentBridge(engine, {
    userLibraries: () => ({ swatches: userSwatchLibraries(), brushes: userBrushLibraries(), symbols: userSymbolLibraries() }),
    ask: (title, text) => agentConfirm.ask(title, text),
    note: (t) => status.setEngine(t),
    allow: () => { savePrefs({ ...loadPrefs(), agentsAllowed: true }); window.dispatchEvent(new CustomEvent('formpth:agents', { detail: true })); },
    openFile: (f, dxf, password) => openFiles([f], dxf ?? { merge: false }, password),
    placeFile: (f, at, w, dxf) => placeFile(f, at, w, dxf ?? { merge: true }),
    placeLinked: async (path, at, width) => placeLinked(await links.readPath(path), at, width),
    links: (a) => linkTool(a),
    projectBlob: projectZip,
    exportBlob: (format, o) => { const p = engine.current; if (!p) return Promise.resolve(null); const scope = o.scope === 'all_artboards' ? 'all' : o.scope === 'document' ? 'art' : o.scope === 'selection' ? 'selection' : 'artboard'; return exportBlob({ format: format === 'jpeg' ? 'jpg' : format, scope, artboard: o.artboard ?? p.activeArtboard, scale: o.scale, quality: o.quality, transparent: o.transparent, outlineText: o.outlineText, preserve: format === 'pdf' || format === 'svg' || format === 'eps', liveText: o.liveText, standard: o.standard, layers: o.layers, compression: o.compression, security: o.security, cmyk: o.cmyk, cad: o.cad }); },
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
    ensureFace,
  });
  agents.commands = commands;
  agents.actions = actionsP;
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

  const setPref = (patch: Partial<Prefs>): void => { prefs = { ...prefs, ...patch }; savePrefs(prefs); applyPrefs(engine, prefs); applyUiPrefs(prefs); };
  const pasteCommand = (): void => {
    const p = engine.current, c = engine.clipboard;
    if (!p || !c || !prefs.pasteOnArtboards || p.doc.artboards.length < 2) { engine.paste('center'); return; }
    const abs = p.doc.artboards, cx = c.bounds.x + c.bounds.w / 2, cy = c.bounds.y + c.bounds.h / 2;
    let ref = abs.findIndex((a) => cx >= a.x && cx <= a.x + a.w && cy >= a.y && cy <= a.y + a.h);
    if (ref < 0) ref = Math.min(p.activeArtboard, abs.length - 1);
    engine.paste('in_place');
    let prev = abs[ref];
    for (const a of abs) { if (a === abs[ref]) continue; engine.duplicate(a.x - prev.x, a.y - prev.y); prev = a; }
  };
  const has = (): boolean => !!engine.current;
  const sel = (): boolean => engine.hasSelection;
  const wrapDefaults = { offset: 6, invert: false };
  let findFont: FindFontDialog | null = null;
  let gallery: EffectGallery | null = null;
  const many = (): boolean => engine.selected().length > 1;
  const kindSel = (...k: string[]): boolean => engine.selected().some((n) => k.includes(n.kind));
  const selectedPattern = (): string | null => { for (const n of engine.selected()) for (const i of n.ap.items) if (i.paint.type === 'pattern') return i.paint.pattern; return null; };
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

  async function transformEachDialog(params?: Record<string, unknown>): Promise<void> {
    if (!sel()) return;
    const ids = engine.targetIds(), unit = UNIT_PT[engine.current?.doc.units ?? 'pt'];
    const build = (origin: Doc, v: Record<string, unknown>): Doc => {
      let doc = origin;
      const abs = v.mode === 'absolute', num = (key: string, d: number): number => (v[key] === undefined ? d : Number(v[key]));
      for (const id of ids) {
        const n = findNode(doc, id);
        if (!n) continue;
        const b = engine.boundsOf(n), cx = b.x + b.w / 2, cy = b.y + b.h / 2, rnd = v.random ? (k: number): number => k * Math.random() : (k: number): number => k;
        const sh = num('sh', abs ? 0 : 100), sv = num('sv', abs ? 0 : 100);
        const fx = abs ? (sh > 0 && b.w > 1e-9 ? (sh * unit) / b.w : 1) : sh / 100, fy = abs ? (sv > 0 && b.h > 1e-9 ? (sv * unit) / b.h : 1) : sv / 100;
        let m = scaleAbout(1 + rnd(fx - 1), 1 + rnd(fy - 1), cx, cy);
        m = mul(rotateAbout(-rnd(num('angle', 0)), cx, cy), m);
        if (v.rx) m = mul(reflectAbout('horizontal', cx, cy), m);
        if (v.ry) m = mul(reflectAbout('vertical', cx, cy), m);
        m = mul(translate(rnd(num('dx', 0)), rnd(num('dy', 0))), m);
        doc = transformNodes(doc, [id], m, false, xfo()).doc;
      }
      return doc;
    };
    if (params && Object.keys(params).length) { engine.edit('Transform Each', (d) => build(d, params)); return; }
    await previewEdit(engine, 'Transform Each', [
      { kind: 'select', key: 'mode', label: 'Scale mode', value: 'relative', choices: [['relative', 'Relative'], ['absolute', 'Absolute']] },
      { kind: 'number', key: 'sh', label: 'Scale horizontal', value: 100, unit: '% / size' }, { kind: 'number', key: 'sv', label: 'Scale vertical', value: 100, unit: '% / size' },
      { kind: 'number', key: 'dx', label: 'Move horizontal', value: 0, unit: 'pt' }, { kind: 'number', key: 'dy', label: 'Move vertical', value: 0, unit: 'pt' },
      { kind: 'number', key: 'angle', label: 'Rotate', value: 0, unit: '°' }, { kind: 'check', key: 'rx', label: 'Reflect X', value: false }, { kind: 'check', key: 'ry', label: 'Reflect Y', value: false }, { kind: 'check', key: 'random', label: 'Random', value: false },
    ], build);
  }

  async function softMixDialog(params?: Record<string, unknown>): Promise<void> {
    if (!sel()) return;
    if (params && 'rate' in params) { engine.mixPathfinder('soft', Number(params.rate)); return; }
    const ids = engine.targetIds();
    await previewEdit(engine, 'Soft Mix', [{ kind: 'number', key: 'rate', label: 'Mixing rate', value: 50, min: 0, max: 100, unit: '%' }], (origin, v) => { const r = mixPathfinder(origin, ids, 'soft', Number(v.rate)); return { doc: r.doc, select: r.ids }; });
  }

  async function pathfinderOptionsDialog(params?: Record<string, unknown>): Promise<void> {
    const cur = engine.pathfinderOptions();
    if (params && Object.keys(params).length) {
      setPref({ pfPrecision: Number(params.precision ?? cur.precision), pfRemoveRedundant: params.remove_redundant_points === undefined ? cur.removeRedundant : params.remove_redundant_points === true, pfRemoveUnpainted: params.remove_unpainted === undefined ? cur.removeUnpainted : params.remove_unpainted === true });
      return;
    }
    const v = await askForm('Pathfinder Options', [
      { kind: 'number', key: 'precision', label: 'Precision', value: cur.precision, min: 0.001, max: 100, step: 0.001, unit: 'pt' },
      { kind: 'check', key: 'redundant', label: 'Remove Redundant Points', value: cur.removeRedundant },
      { kind: 'check', key: 'unpainted', label: 'Divide and Outline Will Remove Unpainted Artwork', value: cur.removeUnpainted },
    ], { ok: 'OK' });
    if (!v) return;
    setPref({ pfPrecision: Number(v.precision), pfRemoveRedundant: v.redundant === true, pfRemoveUnpainted: v.unpainted === true });
  }

  async function trapDialog(params?: Record<string, unknown>): Promise<void> {
    const p = engine.current;
    if (!p || !sel()) return;
    const unit = UNIT_PT[p.doc.units], ids = engine.targetIds();
    const args = (v: Record<string, unknown>): TrapArgs => ({ thickness: Number(v.thickness ?? 0.25) * unit, heightWidth: Number(v.height_width ?? 100), tintReduction: Number(v.tint_reduction ?? 40), process: v.process_color === true, reverse: v.reverse === true });
    if (params && Object.keys(params).length) { engine.trap(args(params)); return; }
    await previewEdit(engine, 'Trap', [
      { kind: 'number', key: 'thickness', label: 'Thickness', value: 0.25, min: 0.01, unit: p.doc.units },
      { kind: 'number', key: 'height_width', label: 'Height/Width', value: 100, min: 5, max: 400, unit: '%' },
      { kind: 'number', key: 'tint_reduction', label: 'Tint reduction', value: 40, min: 0, max: 100, unit: '%' },
      { kind: 'check', key: 'process_color', label: 'Traps with process color', value: false },
      { kind: 'check', key: 'reverse', label: 'Reverse traps', value: false },
    ], (origin, v) => { const r = trapShapes(origin, ids, args(v)); return { doc: r.doc, select: r.ids }; });
  }

  async function objectOnPathDialog(params?: Record<string, unknown>): Promise<void> {
    if (!sel()) return;
    const args = (v: Record<string, unknown>): OnPathArgs => ({ rotate: v.rotate !== false, offset: Number(v.offset ?? 0), flip: v.flip === true });
    if (params && Object.keys(params).length) { engine.objectOnPath(args(params)); return; }
    const ids = engine.targetIds();
    await previewEdit(engine, 'Object on Path', [
      { kind: 'check', key: 'rotate', label: 'Rotate along path', value: true },
      { kind: 'number', key: 'offset', label: 'Offset', value: 0, min: 0, max: 100, unit: '%' },
      { kind: 'check', key: 'flip', label: 'Flip side', value: false },
    ], (origin, v) => { const r = objectOnPath(origin, ids, args(v)); return { doc: r.doc, select: r.ids }; });
  }

  async function offsetPathDialog(): Promise<void> {
    if (!sel()) return;
    const ids = engine.targetIds();
    await previewEdit(engine, 'Offset Path', [{ kind: 'number', key: 'offset', label: 'Offset', value: 10, unit: 'pt' }, { kind: 'select', key: 'joins', label: 'Joins', value: 'miter', choices: [['miter', 'Miter'], ['round', 'Round'], ['bevel', 'Bevel']] }, { kind: 'number', key: 'miter', label: 'Miter limit', value: 4, min: 1, max: 500 }], (origin, v) => { const r = pathOperation(origin, ids, 'offset', { offset: Number(v.offset), joins: v.joins as 'miter', miterLimit: Number(v.miter) }); return { doc: r.doc, select: r.ids }; });
  }

  async function simplifyDialog(params?: Record<string, unknown>): Promise<void> {
    const p = engine.current;
    if (!p || !sel()) return;
    const ids = engine.targetIds();
    const args = (v: Record<string, unknown>) => ({ precision: Number(v.precision ?? 60), straight: v.straight === true, angle: Number(v.angle ?? 0) });
    if (params && ('precision' in params || 'straight' in params || 'angle' in params)) { engine.pathOp('simplify', args(params), ids); return; }
    const before = engine.anchorCount(ids), readout = (m: number): string => `Original: ${before} points · Current: ${m} points`;
    let showOrig = true;
    const originals = ids.map((id) => findNode(p.doc, id)).flatMap((n) => (n?.kind === 'path' ? [n.d] : n?.kind === 'compound' ? n.children.map((c) => c.d) : []));
    const outline = (g: CanvasRenderingContext2D, pr: Project): void => {
      if (!showOrig) return;
      g.save();
      g.strokeStyle = paintOf().accent;
      g.globalAlpha = 0.7;
      g.setLineDash([4, 3]);
      g.lineWidth = 1;
      g.beginPath();
      for (const d of originals) for (const sp of d) {
        const n = sp.pts.length, to = (x: number, y: number): Pt => pr.viewport.toScreen(x, y);
        if (!n) continue;
        const f = to(sp.pts[0].x, sp.pts[0].y);
        g.moveTo(f.x, f.y);
        for (let i = 1; i < (sp.closed ? n + 1 : n); i++) {
          const a = sp.pts[i - 1], b = sp.pts[i % n], c1 = to(a.ox, a.oy), c2 = to(b.ix, b.iy), e = to(b.x, b.y);
          g.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, e.x, e.y);
        }
      }
      g.stroke();
      g.restore();
    };
    stage.painters.add(outline);
    engine.emit('overlay', null);
    try {
    await previewEdit(engine, 'Simplify', [
      { kind: 'number', key: 'precision', label: 'Curve precision', value: 60, min: 0, max: 100, unit: '%' },
      { kind: 'number', key: 'angle', label: 'Angle threshold', value: 0, min: 0, max: 180, unit: '°' },
      { kind: 'check', key: 'straight', label: 'Straight lines', value: false },
      { kind: 'check', key: 'original', label: 'Show original', value: true },
      { kind: 'note', text: readout(anchorCount(pathOperation(p.doc, ids, 'simplify', args({})).doc, ids)) },
    ], (origin, v) => {
      const r = pathOperation(origin, ids, 'simplify', args(v));
      if (showOrig !== (v.original !== false)) { showOrig = v.original !== false; engine.emit('overlay', null); }
      const note = [...document.querySelectorAll<HTMLElement>('.cv-dialog .cv-note')].filter((e) => (e.textContent ?? '').includes('·')).pop();
      if (note) setText(note, readout(anchorCount(r.doc, ids)));
      return { doc: r.doc, select: r.ids };
    });
    } finally { stage.painters.delete(outline); engine.emit('overlay', null); }
  }

  async function smoothDialog(params?: Record<string, unknown>): Promise<void> {
    const p = engine.current, ids = engine.targetIds();
    if (!p || !ids.length) return;
    const run = (origin: Doc, amount: number): { doc: Doc; select: string[] } => ({ doc: updateNodes(origin, ids, (n) => (n.kind === 'path' ? { ...n, d: smoothPath(n.d, Math.max(0, Math.min(100, amount)) / 100), live: undefined } : n)), select: ids });
    if (params && 'smoothness' in params) { engine.edit('Smooth', (d) => run(d, Number(params.smoothness))); return; }
    await previewEdit(engine, 'Smooth', [{ kind: 'number', key: 'smoothness', label: 'Smoothness', value: 40, min: 0, max: 100, unit: '%' }], (origin, v) => run(origin, Number(v.smoothness)));
  }

  async function swatchInfo(): Promise<void> {
    const p = engine.current, a = p?.doc.artboards[p.activeArtboard];
    if (!p || !a) return;
    const all = p.doc.swatches.filter((s) => !s.name.startsWith('['));
    const picked = new Set(swatchesP.pickedIds());
    const list = picked.size ? all.filter((s) => picked.has(s.id)) : all;
    if (!list.length) { toast('There are no swatches to describe.', 'error'); return; }
    const cols = 4, cw = 150, ch = 70, pitch = 170, rowH = 170, x0 = a.x + a.w + 60, y0 = a.y;
    const cards: VNode[] = list.map((s, i) => {
      const x = x0 + (i % cols) * pitch, y = y0 + Math.floor(i / cols) * rowH;
      const lines = [s.name];
      if (s.paint.type === 'color') {
        const c = s.paint.color, v = toRgb(c), k = toCmyk(c);
        lines.push(`HEX ${hex(c).toUpperCase()}`, `RGB ${Math.round(v.r)} ${Math.round(v.g)} ${Math.round(v.b)}`);
        if (k.kind === 'cmyk') lines.push(`CMYK ${Math.round(k.c)} ${Math.round(k.m)} ${Math.round(k.y)} ${Math.round(k.k)}`);
        if (s.spot) lines.push(`Spot ${s.name}`);
      } else lines.push(s.paint.type === 'gradient' ? 'Gradient' : 'Pattern');
      const rect = { id: newId('p'), kind: 'path', name: `${s.name} Swatch`, d: rectPath(x, y, cw, ch), rule: 'nonzero', opacity: 1, blend: 'normal', ap: { items: [fillItem(s.paint), strokeItem(solid({ kind: 'rgb', r: 0, g: 0, b: 0 }), 0.5)], effects: [] } } as VNode;
      const text = { ...textNode(lines.join('\n'), x, y + ch + 14, { size: 9, leading: 11 }), id: newId('t'), name: `${s.name} Info` } as VNode;
      return { id: newId('g'), kind: 'group', name: s.name, clip: false, children: [rect, text], opacity: 1, blend: 'normal', ap: { items: [], effects: [] } } as VNode;
    });
    const group: VNode = { id: newId('g'), kind: 'group', name: 'Swatch Info', clip: false, children: cards, opacity: 1, blend: 'normal', ap: { items: [], effects: [] } };
    engine.addNodes('Swatch Info', [group], { select: true });
  }

  async function cornersDialog(params?: Record<string, unknown>): Promise<void> {
    const p = engine.current;
    if (!p || !sel()) return;
    const targets = engine.cornerTargets(), k = UNIT_PT[p.doc.units], cur = firstCorner(p.doc, targets);
    const make = (v: Record<string, unknown>): Partial<CornerSpec> => {
      const mode = v.mode === 'relative' ? 'relative' : v.mode === 'absolute' ? 'absolute' : undefined, r = Number(v.radius);
      const type = CORNER_TYPES.find((t) => t === v.type);
      const patch: Partial<CornerSpec> = {};
      if (type) patch.type = type;
      if (mode) patch.mode = mode;
      if (v.radius !== undefined && Number.isFinite(r)) patch.r = Math.max(0, (mode ?? cur?.mode) === 'relative' ? r / 100 : r * k);
      return patch;
    };
    if (params && ('type' in params || 'radius' in params || 'mode' in params)) { engine.setCorners(make(params), targets); return; }
    const rel = cur?.mode === 'relative';
    await previewEdit(engine, 'Corners', [
      { kind: 'select', key: 'type', label: 'Type', value: cur?.type ?? 'round', choices: [['round', 'Round'], ['inverted', 'Inverted Round'], ['chamfer', 'Chamfer']] },
      { kind: 'number', key: 'radius', label: 'Radius', value: cur ? Math.round((rel ? cur.r * 100 : cur.r / k) * 1000) / 1000 : 0, min: 0, unit: rel ? '%' : p.doc.units },
      { kind: 'select', key: 'mode', label: 'Rounding', value: cur?.mode ?? 'absolute', choices: [['absolute', 'Absolute'], ['relative', 'Relative']] },
    ], (origin, v) => ({ doc: setCornersOp(origin, targets, make(v)) }));
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
      { kind: 'number', key: 'bleedT', label: 'Bleed Top', value: p.doc.bleed?.t ?? 0, min: 0, max: 720, step: 0.25, unit: 'pt' },
      { kind: 'number', key: 'bleedB', label: 'Bleed Bottom', value: p.doc.bleed?.b ?? 0, min: 0, max: 720, step: 0.25, unit: 'pt' },
      { kind: 'number', key: 'bleedL', label: 'Bleed Left', value: p.doc.bleed?.l ?? 0, min: 0, max: 720, step: 0.25, unit: 'pt' },
      { kind: 'number', key: 'bleedR', label: 'Bleed Right', value: p.doc.bleed?.r ?? 0, min: 0, max: 720, step: 0.25, unit: 'pt' },
    ]);
    if (!v) return;
    engine.beginStep();
    const bleed ={ t: Math.max(0, Number(v.bleedT) || 0), b: Math.max(0, Number(v.bleedB) || 0), l: Math.max(0, Number(v.bleedL) || 0), r: Math.max(0, Number(v.bleedR) || 0) };
    const old = p.doc.bleed ?? { t: 0, b: 0, l: 0, r: 0 };
    if (bleed.t !== old.t || bleed.b !== old.b || bleed.l !== old.l || bleed.r !== old.r) engine.edit('Bleed', (d) => ({ ...d, bleed }));
    engine.documentSetup({ title: String(v.title) || p.doc.title, units: v.units as Units, colorMode: v.mode as 'rgb' | 'cmyk', rasterPpi: Number(v.ppi) });
    if (Number(v.grid) !== p.doc.grid.spacing || Number(v.sub) !== p.doc.grid.subdivisions) engine.setGrid(Number(v.grid), Math.round(Number(v.sub)));
    engine.endStep();
  }

  async function recolorDialog(): Promise<void> {
    if (!sel()) return;
    await recolorD.run();
  }

  const libInput = el<HTMLInputElement>('<input type="file" accept=".ase,.fpth" hidden>');
  document.body.appendChild(libInput);
  let libKind: 'swatch' | 'brush' | 'symbol' = 'swatch';
  libInput.addEventListener('change', () => { const f = libInput.files?.[0]; libInput.value = ''; if (f) void openLibraryFile(f, libKind); });

  async function libraryDoc(f: File): Promise<Doc> {
    const files = await unzip(await f.arrayBuffer());
    const mk = [...files.keys()].find((k) => /(^|\/)manifest\.json$/.test(k));
    if (!mk) throw new Error(`${f.name} is not a formpth project.`);
    return docFromManifest(JSON.parse(new TextDecoder().decode(files.get(mk))) as Record<string, unknown>);
  }

  async function openLibraryFile(f: File, kind: 'swatch' | 'brush' | 'symbol'): Promise<void> {
    try {
      const name = f.name.replace(/\.(ase|fpth)$/i, '');
      if (kind === 'symbol') {
        if (!/\.fpth$/i.test(f.name)) throw new Error('Symbol libraries are formpth projects (.fpth).');
        const d = await libraryDoc(f);
        if (!d.symbols.length) throw new Error(`${f.name} holds no symbols.`);
        showSymbolLib(symbolLibraryFromDoc(d, name, `file_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`));
        return;
      }
      if (kind === 'brush') {
        if (!/\.fpth$/i.test(f.name)) throw new Error('Brush libraries are formpth projects (.fpth).');
        const d = await libraryDoc(f);
        if (!d.brushes.length) throw new Error(`${f.name} holds no brushes.`);
        showBrushLib({ id: `file_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, name, brushes: d.brushes.map(({ id: _id, ...b }) => { void _id; return b; }), user: true });
        return;
      }
      const lib = /\.ase$/i.test(f.name) ? readAse(await f.arrayBuffer(), f.name) : libraryFromDoc(await libraryDoc(f), name, `file_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`);
      if (!lib.groups.length) throw new Error(`${f.name} holds no swatches.`);
      showSwatchLib(lib);
    } catch (err) { toast(message(err), 'error'); }
  }

  function showSwatchLib(lib: SwatchLibrary): void { showPanel('swatch-library'); swatchLibP.show(lib); }
  function showBrushLib(lib: BrushLibrary): void { showPanel('brush-library'); brushLibP.show(lib); }
  function showSymbolLib(lib: SymbolLibrary): void { showPanel('symbol-library'); symbolLibP.show(lib); }

  async function saveSymbolLibrary(): Promise<void> {
    const p = engine.current;
    if (!p || !p.doc.symbols.length) { toast('The document has no symbols to save.', 'error'); return; }
    const v = await askForm('Save Symbols', [{ kind: 'text', key: 'name', label: 'Library name', value: `${p.name} Symbols` }, { kind: 'note', text: 'Saves the document’s symbols as a formpth project to open later with Open Symbol Library; it also appears under User Defined.' }], { ok: 'Save' });
    if (!v) return;
    const name = String(v.name).trim() || 'Symbols';
    keepUserSymbolLibrary(symbolLibraryFromDoc(p.doc, name));
    await deliver(await libraryProject(name, { symbols: p.doc.symbols }), `${name}.fpth`);
  }
  function symbolLibItems(): MenuItem[] {
    const users = userSymbolLibraries();
    return [...SYMBOL_LIBRARIES.map((l) => `sym-lib-${l.id}`), '-', { label: 'User Defined', items: users.length ? users.slice(0, 12).map((_, i) => `sym-user-${i}`) : ['sym-user-none'] }, '-', 'sym-lib-other', 'sym-lib-save'];
  }
  async function symbolOptions(make: boolean): Promise<void> {
    const s = make ? null : engine.symbolDef();
    if (!make && !s) { toast('Pick a symbol in the Symbols panel first.'); return; }
    if (make && !engine.hasSelection) { toast('Select artwork to turn into a symbol.'); return; }
    const v = await askForm(make ? 'New Symbol' : 'Symbol Options', [
      { kind: 'text', key: 'name', label: 'Name', value: s?.name ?? `Symbol ${(engine.doc?.symbols.length ?? 0) + 1}` },
      { kind: 'select', key: 'type', label: 'Symbol Type', value: s ? s.type ?? 'static' : 'dynamic', choices: [['dynamic', 'Dynamic Symbol'], ['static', 'Static Symbol']] },
      ...(make ? [{ kind: 'select' as const, key: 'reg', label: 'Registration', value: 'c', choices: SYMBOL_REGISTRATIONS }] : []),
      { kind: 'check', key: 'slice', label: 'Enable Guides for 9-Slice Scaling', value: !!s?.slice },
      { kind: 'note', text: 'A dynamic symbol lets each instance keep its own fill, stroke and opacity on parts picked with the Direct Selection tool. 9-slice scaling keeps the corners of a scaled instance; drag the guides in symbol editing mode.' },
    ], { ok: make ? 'Make Symbol' : 'OK' });
    if (!v) return;
    const type = v.type === 'static' ? 'static' as const : 'dynamic' as const;
    if (make) engine.makeSymbol(String(v.name), undefined, { type, reg: String(v.reg) as SymbolRegistration, slice: !!v.slice });
    else if (s) engine.setSymbolOptions(s.id, { name: String(v.name), type, slice: !!v.slice });
  }

  async function libraryProject(name: string, part: Partial<Doc>): Promise<Blob> {
    const d: Doc = { ...blankDoc(612, 792, { title: name }), ...part };
    const { manifest, files } = serialize(new Project(newId('lib'), d, name));
    return zipFiles([{ name: 'manifest.json', blob: new Blob([JSON.stringify(manifest)], { type: 'application/json' }) }, ...files.map((x) => ({ name: `images/${x.name}`, blob: x.blob }))]);
  }

  async function saveSwatchLibrary(format: 'ase' | 'fpth'): Promise<void> {
    const p = engine.current;
    if (!p) return;
    const v = await askForm(format === 'ase' ? 'Save Swatch Library as ASE' : 'Save Swatch Library as formpth', [{ kind: 'text', key: 'name', label: 'Library name', value: `${p.name} Swatches` }, { kind: 'note', text: format === 'ase' ? 'ASE keeps solid colours (process, global and spot) and their groups; gradients and patterns are left out. The library also appears under User Defined.' : 'A formpth project holding the swatches, groups, gradients and patterns. The library also appears under User Defined.' }], { ok: 'Save' });
    if (!v) return;
    const name = String(v.name).trim() || 'Swatches', lib = libraryFromDoc(p.doc, name);
    if (!lib.groups.length) { toast('The document has no swatches to save.', 'error'); return; }
    keepUserSwatchLibrary(lib);
    if (format === 'ase') { const { blob, skipped } = writeAse(lib); await deliver(blob, `${name}.ase`); if (skipped) toast(`${skipped} gradient or pattern swatch${skipped === 1 ? '' : 'es'} left out of the ASE file.`); }
    else await deliver(await libraryProject(name, { swatches: p.doc.swatches, patterns: p.doc.patterns }), `${name}.fpth`);
  }

  async function saveBrushLibrary(): Promise<void> {
    const p = engine.current;
    if (!p || !p.doc.brushes.length) { toast('The document has no brushes to save.', 'error'); return; }
    const v = await askForm('Save Brushes', [{ kind: 'text', key: 'name', label: 'Library name', value: `${p.name} Brushes` }, { kind: 'note', text: 'Saves the document’s brushes as a formpth project to open later with Open Brush Library; it also appears under User Defined.' }], { ok: 'Save' });
    if (!v) return;
    const name = String(v.name).trim() || 'Brushes';
    keepUserBrushLibrary({ id: `user_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, name, brushes: p.doc.brushes.map(({ id: _id, ...b }) => { void _id; return b; }) });
    await deliver(await libraryProject(name, { brushes: p.doc.brushes }), `${name}.fpth`);
  }

  const LIB_FOLDERS = [...new Set(SWATCH_LIBRARIES.map((l) => l.folder ?? 'Other'))];
  function swatchLibItems(): MenuItem[] {
    const users = userSwatchLibraries();
    return [
      ...LIB_FOLDERS.map((f): MenuItem => { const libs = SWATCH_LIBRARIES.filter((l) => (l.folder ?? 'Other') === f); return libs.length === 1 && libs[0].name === f ? `sw-lib-${libs[0].id}` : { label: f, items: libs.map((l) => `sw-lib-${l.id}`) }; }),
      '-', { label: 'User Defined', items: users.length ? users.slice(0, 12).map((_, i) => `sw-user-${i}`) : ['sw-user-none'] },
      '-', 'sw-lib-other', 'sw-lib-save-ase', 'sw-lib-save-fpth',
    ];
  }
  function brushLibItems(): MenuItem[] {
    const users = userBrushLibraries();
    return [...BRUSH_LIBRARIES.map((l) => `br-lib-${l.id}`), '-', { label: 'User Defined', items: users.length ? users.slice(0, 12).map((_, i) => `br-user-${i}`) : ['br-user-none'] }, '-', 'br-lib-other', 'br-lib-save'];
  }

  let spelling: SpellingDialog | null = null;
  let separations: SeparationsDialog | null = null;
  let docInfo: DocumentInfoDialog | null = null;
  async function packageDialog(): Promise<void> {
    const p = engine.current;
    if (!p) return;
    const v = await askForm('Package', [
      { kind: 'text', key: 'folder', label: 'Folder', value: '', placeholder: 'Full path, or empty for the Exports folder' },
      { kind: 'check', key: 'links', label: 'Copy Linked Images', value: true },
      { kind: 'check', key: 'fonts', label: 'Copy Fonts', value: true },
      { kind: 'check', key: 'separate', label: 'Collect Links in Separate Folder', value: true },
      { kind: 'check', key: 'relink', label: 'Relink to Copied Images', value: true },
      { kind: 'check', key: 'report', label: 'Create Report', value: true },
    ], { ok: 'Package' });
    if (!v) return;
    await engine.task(async () => {
      try {
        const r = await packageProject(p, { folder: String(v.folder).trim(), copyLinks: !!v.links, copyFonts: !!v.fonts, separateLinks: !!v.separate, relink: !!v.relink, report: !!v.report });
        const miss = r.missingLinks.length + r.missingFonts.length;
        toast(`Packaged ${r.links} ${r.links === 1 ? 'link' : 'links'} and ${r.fonts} ${r.fonts === 1 ? 'font' : 'fonts'} to ${r.folder ?? 'the Exports folder'}${miss ? `. Missing: ${[...r.missingLinks, ...r.missingFonts].join(', ')}` : '.'}`, miss ? 'error' : 'info');
      } catch (err) { toast(message(err), 'error'); }
    });
  }
  async function editDictionary(): Promise<void> {
    const words = await api.spellDictionary().catch(() => [] as string[]);
    const v = await askForm('Edit Custom Dictionary', [
      { kind: 'note', text: words.length ? `Words added: ${words.join(', ')}` : 'No words have been added yet. Add to Dictionary in Check Spelling adds them.' },
      { kind: 'text', key: 'remove', label: 'Remove words', value: '', placeholder: 'word, another' },
    ], { ok: 'Remove' });
    const remove = String(v?.remove ?? '').split(/[,\s]+/).filter(Boolean);
    if (!remove.length) return;
    try { await api.spellDictionaryEdit([], remove); resetSpellCache(); spellMarks.reset(); toast(`Removed ${remove.length} ${remove.length === 1 ? 'word' : 'words'}.`); } catch (err) { toast(message(err), 'error'); }
  }

  async function rasterizeSel(): Promise<void> {
    const p = engine.current;
    if (!p || !sel()) return;
    const ids = engine.targetIds(), nodes = ids.map((id) => findNode(p.doc, id) as VNode);
    const b = engine.selectionBounds(true);
    if (!b) return;
    const v = await askForm('Rasterize', [
      { kind: 'select', key: 'model', label: 'Color model', value: 'color', choices: [['color', 'Color'], ['grayscale', 'Grayscale'], ['bitmap', 'Bitmap'], ['palette', 'Palette']] },
      { kind: 'select', key: 'method', label: 'Dither', value: 'diffusion', choices: [['none', 'None'], ['diffusion', 'Diffusion'], ['bayer', 'Pattern']] },
      { kind: 'color', key: 'fg', label: 'Foreground', value: '#000000' },
      { kind: 'color', key: 'bg', label: 'Background', value: '#ffffff' },
      { kind: 'number', key: 'levels', label: 'Gray levels', value: 4, min: 2, max: 256 },
      { kind: 'note', text: 'Bitmap maps every pixel to the foreground or background colour, Palette to the foreground, the background, black and white; Grayscale keeps the given number of levels.' },
    ], { ok: 'Rasterize' });
    if (!v) return;
    const model = String(v.model), col = (s: string, d: string): Color => parseColor(s) ?? parseColor(d) as Color;
    const fg = col(String(v.fg), '#000000'), bg = col(String(v.bg), '#ffffff');
    const dither = model === 'color' ? undefined : { model: model as 'bitmap' | 'grayscale' | 'palette', method: String(v.method) as 'none' | 'diffusion' | 'bayer', fg, bg, levels: Number(v.levels), palette: [fg, bg, col('#000000', '#000000'), col('#ffffff', '#ffffff')] };
    await engine.task(async () => {
      const c = await renderRegion(p, { region: b, scale: (p.doc.rasterPpi || 300) / 72, transparent: true, only: nodes, dither });
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
    { id: 'collect-single', label: 'Collect for Export as Single Asset', enabled: sel, run: () => { if (engine.addExportAssets(true).length) showPanel('asset-export'); } },
    { id: 'collect-multiple', label: 'Collect for Export as Multiple Assets', enabled: sel, run: () => { if (engine.addExportAssets(false).length) showPanel('asset-export'); } },
    { id: 'export-as', label: 'Export As...', keys: ['Mod+E'], enabled: has, run: () => void exportAs('svg') },
    { id: 'export-svg', label: 'SVG...', enabled: has, run: () => void exportAs('svg') },
    { id: 'export-pdf', label: 'PDF...', enabled: has, run: () => void exportAs('pdf') },
    { id: 'export-png', label: 'PNG...', enabled: has, run: () => void exportAs('png') },
    { id: 'export-jpg', label: 'JPEG...', enabled: has, run: () => void exportAs('jpg') },
    { id: 'export-webp', label: 'WebP...', enabled: has, run: () => void exportAs('webp') },
    { id: 'export-eps', label: 'EPS...', enabled: has, run: () => void exportAs('eps') },
    { id: 'export-dxf', label: 'AutoCAD Interchange (DXF)...', enabled: has, run: () => void exportAs('dxf') },
    { id: 'export-dwg', label: 'AutoCAD Drawing (DWG)...', enabled: has, run: () => void exportAs('dwg') },
    { id: 'print', label: 'Print...', keys: ['Mod+P'], enabled: has, run: () => void printDocument() },
    { id: 'document-setup', label: 'Document Setup...', keys: ['Alt+Mod+P'], enabled: has, run: () => void documentSetup() },
    { id: 'mode-rgb', label: 'RGB Color', enabled: has, checked: () => engine.doc?.colorMode === 'rgb', run: () => engine.documentSetup({ colorMode: 'rgb' }) },
    { id: 'mode-cmyk', label: 'CMYK Color', enabled: has, checked: () => engine.doc?.colorMode === 'cmyk', run: () => engine.documentSetup({ colorMode: 'cmyk' }) },
    { id: 'color-settings', label: 'Color Settings...', enabled: has, run: () => void colorSettingsDialog(engine) },
    { id: 'assign-profile', label: 'Assign Profile...', enabled: has, run: () => void assignProfileDialog(engine) },
    { id: 'convert-to-profile', label: 'Convert to Profile...', enabled: has, run: () => void convertToProfileDialog(engine) },
    { id: 'proof-setup', label: 'Customize...', enabled: has, run: () => void proofSetupDialog(engine) },
    { id: 'ink-manager', label: 'Ink Manager...', group: 'Window', description: 'Opens the Ink Manager to choose which process and spot inks print, convert spot inks to process, or alias one spot ink to another; the choices drive separations, Separations Preview and PDF export.', enabled: has, run: () => openInkManager() },
    { id: 'proof-colors', label: 'Proof Colors', enabled: has, checked: () => isProofing(), run: () => void toggleProofColors(engine) },
    { id: 'send-nodemode', label: 'Send to NodeMode', enabled: has, run: () => void engine.task(async () => { const p = engine.current; if (!p) return; try { const r = exportRegion(p, p.activeArtboard); const b = await exportRaster(p, { region: r, scale: 2, format: 'png', quality: 1, transparent: true }); const res = await api.sendToNodeMode(loadPrefs().nodemodeUrl, p.name, [{ name: p.name, kind: 'image', width: Math.round(r.w * 2), height: Math.round(r.h * 2) }], [{ name: '0.png', blob: b }]); toast(res.placed ? 'Sent to NodeMode: the artwork is on its canvas.' : res.detail ?? 'Uploaded to NodeMode.'); } catch (err) { toast(message(err), 'error'); } }) },

    { id: 'undo', label: () => `Undo${engine.current?.history.undoName ? ` ${engine.current.history.undoName}` : ''}`, keys: ['Mod+Z'], enabled: () => !!engine.current?.history.canUndo, run: () => { typing.end(); engine.undo(); } },
    { id: 'redo', label: () => `Redo${engine.current?.history.redoName ? ` ${engine.current.history.redoName}` : ''}`, keys: ['Shift+Mod+Z'], enabled: () => !!engine.current?.history.canRedo, run: () => { typing.end(); engine.redo(); } },
    { id: 'cut', label: 'Cut', keys: ['Mod+X'], enabled: sel, run: () => { void copyToSystem(); engine.cut(); } },
    { id: 'copy', label: 'Copy', keys: ['Mod+C'], enabled: sel, run: () => { engine.copy(); void copyToSystem(); } },
    { id: 'paste', label: 'Paste', keys: ['Mod+V'], enabled: () => has() && !!engine.clipboard, run: () => pasteCommand() },
    { id: 'paste-front', label: 'Paste in Front', keys: ['Mod+F'], enabled: () => has() && !!engine.clipboard, run: () => engine.paste('front') },
    { id: 'paste-back', label: 'Paste in Back', keys: ['Mod+B'], enabled: () => has() && !!engine.clipboard, run: () => engine.paste('back') },
    { id: 'paste-in-place', label: 'Paste in Place', keys: ['Shift+Mod+V'], enabled: () => has() && !!engine.clipboard, run: () => engine.paste('in_place') },
    { id: 'clear', label: 'Clear', keys: ['Delete', 'Backspace'], enabled: sel, run: () => engine.deleteSelection() },
    { id: 'find-replace', label: 'Find and Replace...', enabled: has, run: () => void findReplaceDialog(engine) },
    { id: 'check-spelling', label: 'Check Spelling...', keys: ['Mod+I'], enabled: has, group: 'Edit', description: 'Walks every text object in the document and offers corrections for words the dictionary does not know, with Change, Change All, Ignore and Add to Dictionary; each change is one undo step.', run: () => { spelling ??= new SpellingDialog(engine); void spelling.start(); } },
    { id: 'auto-spell-check', label: 'Auto Spell Check', group: 'Edit', description: 'Draws red wavy underlines under misspelled words in the text objects in view; the setting is saved and off by default.', checked: () => prefs.autoSpell, run: () => { setPref({ autoSpell: !prefs.autoSpell }); spellMarks.set(prefs.autoSpell); } },
    { id: 'spelling-dictionary', label: 'Edit Custom Dictionary...', group: 'Edit', description: 'Shows the words added to the personal spelling dictionary and removes the ones typed here.', run: () => void editDictionary() },
    { id: 'find-font', label: 'Find Font...', enabled: () => engine.fontsUsed().length > 0, run: () => { findFont ??= new FindFontDialog(engine); findFont.show(); } },
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
    { id: 'width-point-edit', label: 'Width Point Edit...', enabled: () => engine.widthSel.idx.length > 0, run: () => void editWidthPoint(engine) },
    { id: 'width-flip-along', label: 'Flip Width Profile Along', enabled: sel, run: () => { engine.flipWidthProfile(true, false); } },
    { id: 'width-flip-across', label: 'Flip Width Profile Across', enabled: sel, run: () => { engine.flipWidthProfile(false, true); } },
    { id: 'transform-each', label: 'Transform Each...', keys: ['Alt+Shift+Mod+D'], group: 'Object', description: 'Transforms each selected object about its own centre; absolute mode takes target sizes in document units, relative mode percentages.', enabled: sel, mutates: true, params: { mode: { type: 'string', enum: ['relative', 'absolute'], description: 'Scale as percent of each object, or to a target size in document units (0 keeps the size)' }, sh: { type: 'number', min: 0, description: 'Scale horizontal: percent, or target width when absolute' }, sv: { type: 'number', min: 0, description: 'Scale vertical: percent, or target height when absolute' }, dx: { type: 'number', description: 'Move horizontal in points' }, dy: { type: 'number', description: 'Move vertical in points' }, angle: { type: 'number', min: -360, max: 360, description: 'Rotate in degrees' }, rx: { type: 'boolean', description: 'Reflect X' }, ry: { type: 'boolean', description: 'Reflect Y' }, random: { type: 'boolean', description: 'Randomise the amounts' } }, run: (params) => void transformEachDialog(params) },
    { id: 'toggle-scale-corners', label: 'Scale Corners', group: 'Object', description: 'Toggles whether scaling a live rectangle or a path with corner radii scales the radii; off keeps them.', enabled: has, mutates: false, checked: () => engine.view.scaleCorners, run: () => setPref({ scaleCorners: !engine.view.scaleCorners }) },
    { id: 'toggle-generative', label: 'Generative Features', group: 'View', description: 'Shows or hides every generative feature: the Generative menu, Generate Patterns, Retype and their panels.', checked: () => prefs.showGenerative, run: () => setPref({ showGenerative: !prefs.showGenerative }) },
    { id: 'toggle-help-bar', label: 'Help Bar', group: 'View', description: 'Shows or hides the slim bar under the stage that names the active tool, its shortcut and its hint.', checked: () => prefs.helpBar, run: () => setPref({ helpBar: !prefs.helpBar }) },
    { id: 'toggle-task-bar', label: 'Contextual Task Bar', group: 'Window', description: 'Shows or hides the floating bar of next-step buttons below the selection.', checked: () => prefs.taskBar, run: () => setPref({ taskBar: !prefs.taskBar }) },
    { id: 'paste-on-selected-artboards', label: 'Paste on Selected Artboards', group: 'Edit', description: 'When on, Paste places a copy on every artboard at the same relative position; artboards have no multi-selection, so all artboards are used.', checked: () => prefs.pasteOnArtboards, run: () => setPref({ pasteOnArtboards: !prefs.pasteOnArtboards }) },
    { id: 'bring-to-front', label: 'Bring to Front', keys: ['Shift+Mod+]'], enabled: sel, run: () => engine.arrange('bring_to_front') },
    { id: 'bring-forward', label: 'Bring Forward', keys: ['Mod+]'], enabled: sel, run: () => engine.arrange('bring_forward') },
    { id: 'send-backward', label: 'Send Backward', keys: ['Mod+['], enabled: sel, run: () => engine.arrange('send_backward') },
    { id: 'send-to-back', label: 'Send to Back', keys: ['Shift+Mod+['], enabled: sel, run: () => engine.arrange('send_to_back') },
    { id: 'send-to-layer', label: 'Send to Current Layer', enabled: sel, run: () => engine.moveToLayer(engine.activeLayer) },
    ...ALIGN.map(([a, label]) => ({ id: `align-${a}`, label, enabled: sel, run: () => engine.align(a as 'left', many() ? 'selection' : 'artboard') })),
    { id: 'group', label: 'Group', keys: ['Mod+G'], enabled: sel, run: () => engine.group() },
    { id: 'ungroup', label: 'Ungroup', keys: ['Shift+Mod+G'], enabled: () => kindSel('group'), run: () => engine.ungroup() },
    { id: 'ungroup-all', label: 'Ungroup All', group: 'Object', description: 'Ungroups every nested group in the selection in one step.', enabled: () => kindSel('group'), mutates: true, run: () => engine.ungroupAll() },
    { id: 'object-on-path-attach', label: 'Attach to Path', group: 'Object', description: 'Places the selected objects at even spacing along the topmost selected path, optionally rotated to the path direction.', enabled: () => sel() && engine.targetIds().length > 1, mutates: true, params: { rotate: { type: 'boolean', description: 'Rotate objects along the path (default true)' }, offset: { type: 'number', min: 0, max: 100, description: 'Start offset along the path in percent' }, flip: { type: 'boolean', description: 'Flip to the other side of the path' } }, run: (params) => void objectOnPathDialog(params) },
    { id: 'object-on-path-arrange', label: 'Arrange on Path...', group: 'Object', description: 'Changes spacing, offset, rotation and side for objects placed along a path.', enabled: () => sel() && engine.targetIds().length > 1, mutates: true, params: { rotate: { type: 'boolean', description: 'Rotate objects along the path (default true)' }, offset: { type: 'number', min: 0, max: 100, description: 'Start offset along the path in percent' }, flip: { type: 'boolean', description: 'Flip to the other side of the path' } }, run: (params) => void objectOnPathDialog(params) },
    { id: 'object-on-path-release', label: 'Release from Path', group: 'Object', description: 'Leaves the objects where they are; there is no live link to release.', enabled: sel, mutates: false, run: () => toast('The objects stay where they are; there is no live link to release.') },
    { id: 'isolate', label: 'Isolate Selected Group', enabled: () => kindSel('group'), run: () => { const g = engine.selected().find((n) => n.kind === 'group'); if (g) engine.isolate(g.id); } },
    { id: 'exit-isolation', label: 'Exit Isolation Mode', enabled: () => !!engine.current?.isolation, run: () => engine.isolate(null) },
    { id: 'lock', label: 'Lock Selection', keys: ['Mod+2'], enabled: sel, run: () => engine.lockSelection() },
    { id: 'unlock-all', label: 'Unlock All', keys: ['Alt+Mod+2'], enabled: has, run: () => engine.unlockAll() },
    { id: 'hide', label: 'Hide Selection', keys: ['Mod+3'], enabled: sel, run: () => engine.hideSelection() },
    { id: 'show-all', label: 'Show All', keys: ['Alt+Mod+3'], enabled: has, run: () => engine.showAll() },
    { id: 'expand-object', label: 'Expand', enabled: sel, run: () => engine.expand('object') },
    { id: 'expand-appearance', label: 'Expand Appearance', enabled: sel, run: () => void engine.task(async () => { engine.expand('appearance', undefined, await bakeTraced(engine)); }) },
    { id: 'expand-shape', label: 'Expand Shape', enabled: sel, run: () => engine.applyToSelection('Expand Shape', (n) => (n.kind === 'path' ? { ...n, live: undefined } : n)) },
    ...CONVERT_KINDS.map(([kind, label]) => ({ id: `convert-to-${kind.replace('_', '-')}`, label: `Convert to ${label}`, group: 'Object', description: `Turns each selected live shape into a live ${label.toLowerCase()} with the same bounds and paint, as one undo step.`, when: 'Use when a rectangle, ellipse, polygon or star should become another kind of live shape without redrawing it.', enabled: () => engine.selected().some((n) => n.kind === 'path' && n.live && n.live.kind !== 'line'), mutates: true, run: () => engine.convertLiveShape(kind) })),
    { id: 'rasterize', label: 'Rasterize...', enabled: sel, run: () => void rasterizeSel() },
    { id: 'create-mesh', label: 'Create Gradient Mesh...', enabled: sel, run: () => void askForm('Create Gradient Mesh', [{ kind: 'number', key: 'rows', label: 'Rows', value: 4, min: 1, max: 50 }, { kind: 'number', key: 'cols', label: 'Columns', value: 4, min: 1, max: 50 }, { kind: 'select', key: 'hl', label: 'Appearance', value: 'flat', choices: [['flat', 'Flat'], ['center', 'To Center'], ['edge', 'To Edge']] }]).then((v) => { if (v) engine.createMesh(Math.round(Number(v.rows)), Math.round(Number(v.cols)), v.hl as 'flat'); }) },
    { id: 'join', label: 'Join', keys: ['Mod+J'], enabled: sel, run: () => engine.pathOp('join') },
    { id: 'average', label: 'Average...', keys: ['Alt+Mod+J'], enabled: sel, run: () => void askForm('Average', [{ kind: 'select', key: 'axis', label: 'Axis', value: 'both', choices: [['horizontal', 'Horizontal'], ['vertical', 'Vertical'], ['both', 'Both']] }]).then((v) => { if (v) engine.pathOp('average', { axis: v.axis as 'both' }); }) },
    { id: 'outline-stroke', label: 'Outline Stroke', enabled: sel, run: () => engine.pathOp('outline_stroke') },
    { id: 'offset-path', label: 'Offset Path...', enabled: sel, run: () => void offsetPathDialog() },
    { id: 'reverse-path', label: 'Reverse Path Direction', enabled: sel, run: () => engine.pathOp('reverse') },
    { id: 'simplify', label: 'Simplify...', group: 'Object', description: 'Reduces anchor points; straight lines replaces curves with straight segments and the angle threshold keeps sharp corners.', enabled: sel, mutates: true, params: { precision: { type: 'number', min: 0, max: 100, description: 'Curve precision in percent' }, straight: { type: 'boolean', description: 'Replace curves with straight segments' }, angle: { type: 'number', min: 0, max: 180, description: 'Corner points that turn more than this many degrees are kept' } }, run: (params) => void simplifyDialog(params) },
    { id: 'smooth-path', label: 'Smooth...', group: 'Object', description: 'Smooths the selected paths with a Smoothness amount from 0 to 100 percent, previewed live.', enabled: sel, mutates: true, params: { smoothness: { type: 'number', min: 0, max: 100, description: 'Smoothness in percent' } }, run: (params) => void smoothDialog(params) },
    { id: 'swatch-info', label: 'Create Swatch Info', group: 'Window', description: 'Places a card beside the artboard for each selected swatch, or every swatch when none is selected, with its colour and its name, HEX, RGB, CMYK and spot name, as one group named Swatch Info.', enabled: has, mutates: true, run: () => void swatchInfo() },
    { id: 'overprint-preview', label: 'Overprint Preview', keys: ['Alt+Shift+Mod+Y'], group: 'View', description: 'Shows how objects marked to overprint multiply onto the art beneath them, as a printing plate would; off by default and never applied to exports.', enabled: has, checked: () => engine.view.overprintPreview, run: () => engine.setView({ overprintPreview: !engine.view.overprintPreview }) },
    { id: 'separations-preview', label: 'Separations Preview', group: 'Window', description: 'Opens a window to show a single ink plate in gray: All, Cyan, Magenta, Yellow, Black or one spot color; closing it returns to the full color view.', enabled: has, params: { plate: { type: 'string', description: 'Plate to show: All, C, M, Y, K or the name of a spot swatch' } }, run: (params) => { separations ??= new SeparationsDialog(engine, () => openInkManager()); separations.show(); if (typeof params?.plate === 'string') engine.setView({ separation: /^all$/i.test(params.plate) ? null : params.plate }); } },
    { id: 'document-info', label: 'Document Info', group: 'Window', description: 'Opens a read-only window with the counts for the document: artboards, objects, paths and anchors, fonts, linked images, swatches, spot colors, gradients, patterns, symbols and brushes.', enabled: has, run: () => { docInfo ??= new DocumentInfoDialog(engine); docInfo.show(); } },
    { id: 'package', label: 'Package...', group: 'File', description: 'Collects the document, its linked images and the fonts it uses into one folder with a report, optionally relinking the document to the copied images; an existing folder is refused.', enabled: has, params: { folder: { type: 'string', description: 'Full path of the new package folder; empty writes inside the Exports folder' }, links: { type: 'boolean', description: 'Copy linked images' }, fonts: { type: 'boolean', description: 'Copy fonts' }, separate: { type: 'boolean', description: 'Collect links in a separate folder' }, relink: { type: 'boolean', description: 'Relink the document to the copied images' }, report: { type: 'boolean', description: 'Create a report' } }, run: () => void packageDialog() },
    { id: 'corners-dialog', label: 'Corners...', group: 'Object', enabled: sel, mutates: true, params: { type: { type: 'string', enum: ['round', 'inverted', 'chamfer'], description: 'Corner type' }, radius: { type: 'number', min: 0, description: 'Radius in document units, or percent when mode is relative' }, mode: { type: 'string', enum: ['absolute', 'relative'], description: 'Rounding mode' } }, run: (params) => void cornersDialog(params) },
    { id: 'expand-corners', label: 'Expand Corners', group: 'Object', enabled: sel, mutates: true, run: () => engine.expandCorners() },
    { id: 'add-anchors', label: 'Add Anchor Points', enabled: sel, run: () => engine.pathOp('add_anchors') },
    { id: 'remove-anchors', label: 'Remove Anchor Points', enabled: () => !!engine.current?.anchors.size, run: () => engine.deleteAnchors() },
    { id: 'divide-below', label: 'Divide Objects Below', enabled: sel, run: () => engine.pathOp('divide_objects_below') },
    { id: 'split-grid', label: 'Split Into Grid...', enabled: sel, run: () => void splitGridDialog() },
    { id: 'clean-up', label: 'Clean Up', enabled: has, run: () => engine.pathOp('clean_up', {}, allNodes(engine.doc as Doc).filter((n) => n.kind !== 'layer').map((n) => n.id)) },
    { id: 'close-path', label: 'Close Path', enabled: sel, run: () => engine.pathOp('close') },
    { id: 'make-pattern', label: 'Make Pattern', enabled: () => sel() && !engine.patternSession, run: () => { if (engine.enterPatternEdit(null)) showPanel('pattern-options'); } },
    { id: 'generate-patterns', label: 'Generate Patterns...', enabled: has, run: () => showPanel('generate-patterns') },
    { id: 'generative-shape-fill', label: 'Shape Fill...', enabled: has, run: () => showPanel('shape-fill') },
    { id: 'text-to-vector', label: 'Text to Vector Graphic...', group: 'Object', description: 'Opens the Text to Vector Graphic panel: describe art, pick Subject, Scene, Icon or Pattern, and place one of up to three variations as editable vector art fitted to the selection or the artboard.', enabled: has, run: () => showPanel('text-to-vector') },
    { id: 'generative-recolor', label: 'Generative Recolor...', group: 'Edit', description: 'Opens Recolor Artwork with a prompt field: the language model proposes colour palettes for a mood or scene and one is applied to the selected artwork.', enabled: sel, run: () => void recolorD.run({ generative: true }) },
    { id: 'retype', label: 'Retype...', enabled: has, run: () => showPanel('retype') },
    { id: 'edit-pattern', label: 'Edit Pattern', enabled: () => !!selectedPattern() && !engine.patternSession, run: () => { const id = selectedPattern(); if (id && engine.enterPatternEdit(id)) showPanel('pattern-options'); } },
    { id: 'pattern-done', label: 'Exit Pattern Editing Mode', enabled: () => !!engine.patternSession, run: () => { if (engine.exitPatternEdit(true)) toast('The pattern is in the Swatches panel.'); } },
    { id: 'pattern-copy', label: 'Save Pattern as a Copy', enabled: () => !!engine.patternSession, run: () => { if (engine.exitPatternEdit(true, true)) toast('The copy is in the Swatches panel.'); } },
    { id: 'pattern-cancel', label: 'Cancel Pattern Editing', enabled: () => !!engine.patternSession, run: () => engine.exitPatternEdit(false) },
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
    { id: 'envelope-options', label: 'Envelope Options...', enabled: () => engine.selectedEnvelopes().length > 0, run: () => { const n = engine.selectedEnvelopes()[0]; if (!n) return; const o = envelopeOptions(n.opts); void askForm('Envelope Options', [{ kind: 'number', key: 'fidelity', label: 'Fidelity', value: o.fidelity, min: 0, max: 100 }, { kind: 'check', key: 'antiAlias', label: 'Anti-Alias images', value: o.antiAlias }, { kind: 'check', key: 'appearance', label: 'Distort Appearance', value: o.appearance }, { kind: 'check', key: 'gradients', label: 'Distort Linear Gradients', value: o.gradients }, { kind: 'check', key: 'patterns', label: 'Distort Pattern Fills', value: o.patterns }]).then((v) => { if (v) engine.setEnvelopeOptions({ fidelity: Math.max(0, Math.min(100, Number(v.fidelity))), antiAlias: !!v.antiAlias, appearance: !!v.appearance, gradients: !!v.gradients, patterns: !!v.patterns }); }); } },
    { id: 'envelope-edit-contents', label: 'Edit Contents', enabled: () => engine.selectedEnvelopes().some((n) => !n.editContents), run: () => engine.envelopeContents(true) },
    { id: 'envelope-edit-envelope', label: 'Edit Envelope', enabled: () => engine.selectedEnvelopes().some((n) => !!n.editContents), run: () => engine.envelopeContents(false) },
    { id: 'envelope-reset-mesh', label: 'Reset with Mesh...', enabled: () => engine.selectedEnvelopes().length > 0, run: () => { const n = engine.selectedEnvelopes()[0], s = n?.spec; void askForm('Reset Envelope Mesh', [{ kind: 'number', key: 'rows', label: 'Rows', value: s?.kind === 'mesh' ? s.rows : 4, min: 1, max: 50 }, { kind: 'number', key: 'cols', label: 'Columns', value: s?.kind === 'mesh' ? s.cols : 4, min: 1, max: 50 }, { kind: 'check', key: 'keep', label: 'Maintain Envelope Shape', value: true }]).then((v) => { if (v) engine.resetEnvelope({ kind: 'mesh', rows: Number(v.rows), cols: Number(v.cols), keepShape: !!v.keep }); }); } },
    { id: 'envelope-reset-warp', label: 'Reset with Warp...', enabled: () => engine.selectedEnvelopes().length > 0, run: () => { const s = engine.selectedEnvelopes()[0]?.spec, w = s?.kind === 'warp' ? s : null; void askForm('Warp Options', [{ kind: 'select', key: 'style', label: 'Style', value: w?.style ?? 'arc', choices: ['arc', 'arc_lower', 'arc_upper', 'arch', 'bulge', 'shell_lower', 'shell_upper', 'flag', 'wave', 'fish', 'rise', 'fisheye', 'inflate', 'squeeze', 'twist'].map((x) => [x, x.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())] as const) }, { kind: 'number', key: 'bend', label: 'Bend', value: w?.bend ?? 50, min: -100, max: 100, unit: '%' }, { kind: 'number', key: 'h', label: 'Horizontal distortion', value: w?.h ?? 0, min: -100, max: 100, unit: '%' }, { kind: 'number', key: 'v', label: 'Vertical distortion', value: w?.v ?? 0, min: -100, max: 100, unit: '%' }, { kind: 'check', key: 'vertical', label: 'Vertical', value: w?.vertical ?? false }]).then((v) => { if (v) engine.resetEnvelope({ kind: 'warp', style: String(v.style), bend: Number(v.bend), h: Number(v.h), v: Number(v.v), vertical: !!v.vertical }); }); } },
    { id: 'reset-bounding-box', label: 'Reset Bounding Box', enabled: () => engine.selected().some((n) => n.bbox !== undefined), run: () => engine.resetBoundingBox() },
    { id: 'persp-show', label: () => (engine.perspView.show ? 'Hide Grid' : 'Show Grid'), keys: ['Shift+Mod+I'], enabled: has, run: () => engine.setPerspView({ show: !engine.perspView.show }) },
    { id: 'persp-lock', label: 'Lock Grid', enabled: has, checked: () => engine.perspView.lock, run: () => engine.setPerspView({ lock: !engine.perspView.lock }) },
    { id: 'persp-snap', label: 'Snap to Grid', enabled: has, checked: () => engine.perspView.snap, run: () => engine.setPerspView({ snap: !engine.perspView.snap }) },
    { id: 'persp-define', label: 'Define Grid...', enabled: has, run: () => void defineGrid(engine) },
    { id: 'persp-1p', label: '[1P-Normal View]', enabled: has, run: () => engine.perspPreset(1) },
    { id: 'persp-2p', label: '[2P-Normal View]', enabled: has, run: () => engine.perspPreset(2) },
    { id: 'persp-3p', label: '[3P-Normal View]', enabled: has, run: () => engine.perspPreset(3) },
    { id: 'persp-presets', label: 'Grid Presets...', enabled: has, run: () => void askForm('Perspective Grid Presets', [{ kind: 'select', key: 'preset', label: 'Preset', value: '2p', choices: presetChoices() }]).then((v) => { const d = engine.doc, g = v && d ? presetById(d, String(v.preset)) : null; if (g) engine.perspPreset(g); }) },
    { id: 'persp-save-preset', label: 'Save Grid as Preset...', enabled: has, run: () => void saveGridPreset(engine) },
    ...(['left', 'floor', 'right', 'none'] as const).map((pl, i) => ({ id: `persp-plane-${pl}`, label: `${pl === 'none' ? 'No Active Plane' : `${pl === 'floor' ? 'Horizontal' : pl[0].toUpperCase() + pl.slice(1)} Grid Plane`}`, keys: [String(i + 1)], enabled: () => engine.perspView.show, checked: () => engine.perspView.show && engine.perspView.plane === pl, run: () => engine.setPerspView({ plane: pl }) })),
    { id: 'persp-attach', label: 'Attach to Active Plane', enabled: () => sel() && engine.perspView.plane !== 'none', run: () => { engine.attachToPlane(); engine.setPerspView({ show: true }); } },
    { id: 'persp-release', label: 'Release with Perspective', enabled: () => engine.perspTargets().length > 0, run: () => engine.releasePerspective() },
    { id: 'persp-match-plane', label: 'Move Plane to Match Object', enabled: () => engine.perspTargets().length > 0, run: () => engine.movePlaneToObject() },
    { id: 'persp-edit-text', label: 'Edit Text', enabled: () => !!engine.perspTextOf(), run: () => { const id = engine.perspEditText(); if (id) { engine.setTool('type'); typing.begin({ id }); } } },
    { id: 'image-trace', label: 'Make Image Trace', enabled: () => kindSel('image'), run: () => void makeTrace(false) },
    { id: 'image-trace-expand', label: 'Make Image Trace and Expand', enabled: () => kindSel('image'), run: () => void makeTrace(true) },
    { id: 'live-paint-make', label: 'Make Live Paint', keys: ['Mod+Alt+X'], enabled: () => sel() && !engine.livePaintTargets().length, run: () => { if (engine.makeLivePaint()) engine.setTool('livePaint'); } },
    { id: 'live-paint-merge', label: 'Merge Live Paint', enabled: () => engine.livePaintTargets().length > 0 && engine.selected().length > 1, run: () => engine.makeLivePaint() },
    { id: 'live-paint-release', label: 'Release Live Paint', enabled: () => engine.livePaintTargets().length > 0, run: () => engine.releaseLivePaint() },
    { id: 'live-paint-gap', label: 'Live Paint Gap Options...', enabled: () => engine.livePaintTargets().length > 0, run: () => void gapOptions() },
    { id: 'live-paint-expand', label: 'Expand Live Paint', enabled: () => engine.livePaintTargets().length > 0, run: () => engine.expandLivePaint() },
    { id: 'intertwine-make', label: 'Make Intertwine', enabled: () => engine.selected().length > 1 && !engine.intertwineTargets().length, run: () => { if (engine.makeIntertwine()) engine.setTool('intertwine'); } },
    { id: 'intertwine-release', label: 'Release Intertwine', enabled: () => engine.intertwineTargets().length > 0, run: () => engine.releaseIntertwine() },
    { id: 'intertwine-edit', label: 'Edit Intertwine', enabled: () => engine.intertwineTargets().length > 0, run: () => { const t = engine.intertwineTargets()[0]; if (t) { engine.select([t]); engine.setTool('intertwine'); } } },
    { id: 'shaper-expand', label: 'Expand Shaper Group', enabled: () => engine.shaperTargets().length > 0, run: () => engine.expandShaper() },
    { id: 'graph-type', label: 'Type...', enabled: has, run: () => void graphTypeDialog(engine) },
    { id: 'graph-data', label: 'Data...', keys: ['Alt+Shift+Mod+G'], enabled: () => engine.graphTargets().length > 0, run: () => graphData.open() },
    { id: 'graph-design', label: 'Design...', enabled: has, run: () => (graphDesign ??= new GraphDesignDialog(engine)).show() },
    { id: 'graph-column', label: 'Column...', enabled: () => engine.graphTargets().length > 0 && !!engine.doc?.graphDesigns?.length, run: () => void graphColumnDialog(engine) },
    { id: 'graph-marker', label: 'Marker...', enabled: () => engine.graphTargets().length > 0 && !!engine.doc?.graphDesigns?.length, run: () => void graphMarkerDialog(engine) },
    { id: 'graph-size', label: 'Graph Size...', enabled: has, run: () => void graphSizeDialog(engine, pendingGraph.type, pendingGraph.at).then((id) => { if (id) graphData.open(id); }) },
    { id: 'trace-expand', label: 'Expand Image Trace', enabled: () => engine.traceTargets().length > 0, run: () => engine.expandTrace() },
    { id: 'trace-release', label: 'Release Image Trace', enabled: () => engine.traceTargets().length > 0, run: () => engine.releaseTrace() },
    { id: 'embed-image', label: 'Embed Image', enabled: () => engine.selected().some((n) => n.kind === 'image' && !!n.linked), run: () => { embedLinks(engine.selected().filter((n): n is ImageNode => n.kind === 'image')); } },
    { id: 'place-linked', label: 'Place Linked...', enabled: has, run: () => void (async () => { if (!canLink()) { toast('This browser cannot keep links to files, so Place embeds the image instead.'); placeInput.click(); return; } await placeLinked(await chooseLinkFile('Place Linked')); })() },
    { id: 'link-relink', label: 'Relink...', enabled: () => !!pickedImage(), run: () => void (async () => { const n = pickedImage(); if (!n) return; if (!canLink()) { relinkIds = [n.id]; relinkInput.click(); return; } const f = await chooseLinkFile('Relink'); if (f) await linkFileTo([n.id], f, 'Relink'); })() },
    { id: 'link-relink-all', label: 'Relink All Instances...', enabled: () => !!pickedImage(), run: () => void (async () => { const n = pickedImage(); if (!n) return; const ids = sameLink(n); if (!canLink()) { relinkIds = ids; relinkInput.click(); return; } const f = await chooseLinkFile(`Relink ${ids.length} Instances`); if (f) await linkFileTo(ids, f, 'Relink All Instances'); })() },
    { id: 'link-relink-folder', label: 'Relink Missing Links from Folder...', enabled: () => links.images().some((n) => links.state(n) === 'missing'), run: () => void relinkFolder() },
    { id: 'link-update', label: 'Update Link', enabled: () => { const n = pickedImage(); return !!n && links.state(n) === 'modified'; }, run: () => void (async () => { const n = pickedImage(); if (n && !(await updateLinks(sameLink(n).map((id) => engine.nodeById(id) as ImageNode)))) toast('Could not read the linked file.', 'error'); })() },
    { id: 'link-update-all', label: 'Update All Modified Links', enabled: () => links.images().some((n) => links.state(n) === 'modified'), run: () => void (async () => { const k = await updateLinks(links.images().filter((n) => links.state(n) === 'modified')); toast(`Updated ${k} ${k === 1 ? 'link' : 'links'}.`); })() },
    { id: 'link-goto', label: 'Go To Link', enabled: () => !!pickedImage(), run: () => { const n = pickedImage(); if (n) { engine.select([n.id]); engine.fitSelection(); } } },
    { id: 'link-embed', label: 'Embed Image', enabled: () => !!pickedImage()?.linked, run: () => { const n = pickedImage(); if (n) embedLinks(sameLink(n).map((id) => engine.nodeById(id) as ImageNode)); } },
    { id: 'link-unembed', label: 'Unembed...', enabled: () => { const n = pickedImage(); return !!n && !n.linked; }, run: () => { const n = pickedImage(); if (n) void unembed(n); } },
    { id: 'link-info', label: 'Link Info...', enabled: () => !!pickedImage(), run: () => { const n = pickedImage(); if (n) void linkInfo(n); } },
    { id: 'link-previews', label: 'Save Previews of Linked Images', checked: () => engine.doc?.linkPreviews !== false, enabled: has, run: () => engine.setLinkPreviews(engine.doc?.linkPreviews === false) },
    { id: 'make-clip', label: 'Make Clipping Mask', keys: ['Mod+7'], enabled: many, run: () => engine.makeClip() },
    { id: 'release-clip', label: 'Release Clipping Mask', keys: ['Alt+Mod+7'], enabled: () => engine.selected().some((n) => n.kind === 'group' && n.clip), run: () => engine.releaseClip() },
    { id: 'compound-make', label: 'Make Compound Path', keys: ['Mod+8'], enabled: sel, run: () => engine.makeCompound() },
    { id: 'compound-release', label: 'Release Compound Path', keys: ['Alt+Shift+Mod+8'], enabled: () => kindSel('compound'), run: () => engine.releaseCompound() },
    { id: 'opacity-mask', label: 'Make Opacity Mask', enabled: many, run: () => engine.makeOpacityMask() },
    { id: 'release-opacity-mask', label: 'Release Opacity Mask', enabled: () => engine.selected().some((n) => !!n.mask), run: () => engine.releaseOpacityMask() },
    { id: 'disable-opacity-mask', label: () => (engine.selected().some((n) => n.mask?.disabled) ? 'Enable Opacity Mask' : 'Disable Opacity Mask'), enabled: () => engine.selected().some((n) => !!n.mask), run: () => engine.setOpacityMask({ disabled: !engine.selected().some((n) => n.mask?.disabled) }) },
    { id: 'unlink-opacity-mask', label: () => (engine.selected().some((n) => n.mask && !n.mask.linked) ? 'Link Opacity Mask' : 'Unlink Opacity Mask'), enabled: () => engine.selected().some((n) => !!n.mask), run: () => engine.setOpacityMask({ linked: engine.selected().some((n) => n.mask && !n.mask.linked) }) },
    { id: 'new-mask-clip', label: 'New Opacity Masks Are Clipping', checked: () => engine.maskDefaults.clip, run: () => { prefs = { ...prefs, newMaskClip: !engine.maskDefaults.clip }; savePrefs(prefs); applyPrefs(engine, prefs); } },
    { id: 'new-mask-invert', label: 'New Opacity Masks Are Inverted', checked: () => engine.maskDefaults.invert, run: () => { prefs = { ...prefs, newMaskInvert: !engine.maskDefaults.invert }; savePrefs(prefs); applyPrefs(engine, prefs); } },
    { id: 'artboards-from-selection', label: 'Convert to Artboards', enabled: sel, run: () => { for (const n of engine.selected()) { const b = engine.boundsOf(n); engine.addArtboard(b, nodeLabel(n)); } } },
    { id: 'artboards-rearrange', label: 'Rearrange All Artboards...', enabled: has, run: () => void askForm('Rearrange All Artboards', [{ kind: 'number', key: 'cols', label: 'Columns', value: 2, min: 1, max: 50 }, { kind: 'number', key: 'gap', label: 'Spacing', value: 20, min: 0, unit: 'pt' }]).then((v) => { if (v) engine.rearrangeArtboards(Math.round(Number(v.cols)), Number(v.gap)); }) },
    { id: 'artboard-fit-art', label: 'Fit to Artwork Bounds', enabled: has, run: () => { const p = engine.current; if (p) engine.fitArtboard(p.activeArtboard, 'art'); } },
    { id: 'artboard-fit-selection', label: 'Fit to Selected Art', enabled: sel, run: () => { const p = engine.current; if (p) engine.fitArtboard(p.activeArtboard, 'selection'); } },
    { id: 'artboard-options', label: 'Artboard Options...', enabled: has, run: () => { const p = engine.current; if (p) void artboardsP.options(p.activeArtboard); } },
    { id: 'collect-layer', label: 'Collect in New Layer', enabled: sel, run: () => engine.collectInNewLayer() },
    { id: 'new-layer', label: 'New Layer', keys: ['Mod+L'], enabled: has, run: () => engine.addLayer(undefined, { above: engine.activeLayer || undefined }) },
    { id: 'new-symbol', label: 'New Symbol...', keys: ['F8'], enabled: () => sel() && !engine.symbolSession, run: () => void symbolOptions(true) },
    { id: 'break-symbol', label: 'Break Link to Symbol', enabled: () => kindSel('symbol'), run: () => engine.breakSymbolLink() },
    { id: 'symbol-edit', label: 'Edit Symbol', enabled: () => !!engine.symbolDef() || kindSel('symbol'), run: () => { const inst = engine.selectedInstances()[0]; engine.enterSymbolEdit(inst?.symbol ?? engine.currentSymbol, inst?.id); } },
    { id: 'symbol-exit', label: 'Exit Symbol Editing Mode', enabled: () => !!engine.symbolSession, run: () => engine.exitSymbolEdit(true) },
    { id: 'symbol-cancel', label: 'Cancel Symbol Editing', enabled: () => !!engine.symbolSession, run: () => engine.exitSymbolEdit(false) },
    { id: 'symbol-duplicate', label: 'Duplicate Symbol', enabled: () => !!engine.symbolDef(), run: () => engine.duplicateSymbol() },
    { id: 'symbol-redefine', label: 'Redefine Symbol', enabled: () => !!engine.symbolDef() && sel() && !engine.symbolSession, run: () => engine.redefineSymbol() },
    { id: 'symbol-replace', label: 'Replace Symbol', enabled: () => !!engine.symbolDef() && kindSel('symbol'), run: () => { const id = engine.currentSymbol; if (id) engine.replaceSymbol(id); } },
    { id: 'symbol-reset', label: 'Reset Symbol Overrides', enabled: () => engine.selectedInstances().some((n) => !!n.parts), run: () => engine.resetSymbolParts() },
    { id: 'symbol-options', label: 'Symbol Options...', enabled: () => !!engine.symbolDef(), run: () => void symbolOptions(false) },
    { id: 'symbol-delete', label: 'Delete Symbol', enabled: () => !!engine.symbolDef() && !engine.symbolSession, run: () => { const s = engine.symbolDef(); if (!s) return; if (allNodes(engine.doc as Doc).some((n) => n.kind === 'symbol' && n.symbol === s.id)) { toast('The symbol is in use; break the links to its instances first.'); return; } engine.edit('Delete Symbol', (d) => ({ ...d, symbols: d.symbols.filter((x) => x.id !== s.id) })); engine.currentSymbol = null; } },
    ...SYMBOL_LIBRARIES.map((l) => ({ id: `sym-lib-${l.id}`, label: l.name, run: () => showSymbolLib(l) })),
    ...Array.from({ length: 12 }, (_, i) => ({ id: `sym-user-${i}`, label: () => userSymbolLibraries()[i]?.name ?? '', enabled: () => !!userSymbolLibraries()[i], run: () => { const l = userSymbolLibraries()[i]; if (l) showSymbolLib(l); } })),
    { id: 'sym-user-none', label: 'No saved libraries yet', enabled: () => false, run: () => undefined },
    { id: 'sym-lib-other', label: 'Open Symbol Library...', run: () => { libKind = 'symbol'; libInput.accept = '.fpth'; libInput.click(); } },
    { id: 'sym-lib-save', label: 'Save Symbols...', enabled: () => !!engine.doc?.symbols.length, run: () => void saveSymbolLibrary() },

    { id: 'create-outlines', label: 'Create Outlines', keys: ['Shift+Mod+O'], enabled: () => kindSel('text'), run: () => void makeOutlines() },
    { id: 'edit-text', label: 'Edit Text', enabled: () => kindSel('text'), run: () => { const t = engine.selected().find((n) => n.kind === 'text'); if (t) { engine.setTool('type'); typing.begin({ id: t.id }); } } },
    { id: 'toggle-area-type', label: 'Convert Point and Area Type', enabled: () => kindSel('text'), run: () => { const t = engine.selected().find((n) => n.kind === 'text'); if (t?.kind !== 'text' || t.mode === 'path') return; const b = engine.boundsOf(t); if (t.mode === 'point') engine.setTextNode(t.id, { mode: 'area', frame: { x: b.x, y: b.y, w: Math.max(20, b.w + 4), h: Math.max(20, b.h + 4) }, xf: [1, 0, 0, 1, 0, 0], area: { columns: 1, rows: 1, gutter: 12, inset: 0, firstBaseline: 'ascent' } }, 'Convert to Area Type'); else { const first = t.spans[0]?.style.size ?? 12; const f = t.frame ?? b; engine.setTextNode(t.id, { mode: 'point', frame: undefined, xf: t.vertical ? [1, 0, 0, 1, f.x + f.w - first / 2, f.y] : [1, 0, 0, 1, f.x, f.y + first * 0.8] }, 'Convert to Point Type'); } } },
    { id: 'thread-create', label: 'Create', enabled: () => engine.selected().length > 1 && engine.selected().some((n) => n.kind === 'text' && n.mode === 'area'), run: () => engine.threadText() },
    { id: 'thread-release', label: 'Release Selection', enabled: () => kindSel('text'), run: () => engine.releaseThread() },
    { id: 'thread-remove', label: 'Remove Threading', enabled: () => kindSel('text'), run: () => engine.releaseThread(undefined, true) },
    { id: 'wrap-make', label: 'Make', enabled: sel, run: () => engine.setTextWrap({ offset: wrapDefaults.offset, invert: wrapDefaults.invert }) },
    { id: 'wrap-release', label: 'Release', enabled: () => engine.selected().some((n) => !!n.wrap), run: () => engine.setTextWrap(null) },
    { id: 'wrap-options', label: 'Text Wrap Options...', enabled: sel, run: () => { const cur = engine.selected().find((n) => n.wrap)?.wrap ?? wrapDefaults; void askForm('Text Wrap Options', [{ kind: 'number', key: 'offset', label: 'Offset', value: cur.offset, min: -500, max: 500, unit: 'pt' }, { kind: 'check', key: 'invert', label: 'Invert Wrap', value: cur.invert }], { ok: 'OK' }).then((v) => { if (!v) return; wrapDefaults.offset = Number(v.offset); wrapDefaults.invert = !!v.invert; engine.setTextWrap({ offset: wrapDefaults.offset, invert: wrapDefaults.invert }); }); } },
    { id: 'hyphenation-options', label: 'Hyphenation...', enabled: () => kindSel('text') || !!typing.node(), run: () => void hyphenationDialog(engine) },
    { id: 'justification-options', label: 'Justification...', enabled: () => kindSel('text') || !!typing.node(), run: () => void justificationDialog(engine) },
    { id: 'area-type-options', label: 'Area Type Options...', enabled: () => engine.selected().some((n) => n.kind === 'text' && n.mode === 'area'), run: () => void areaTypeOptionsDialog(engine) },
    { id: 'type-on-path-options', label: 'Type on a Path Options...', enabled: () => engine.selected().some((n) => n.kind === 'text' && n.mode === 'path'), run: () => void pathTypeOptionsDialog(engine) },
    ...([['rainbow', 'Rainbow'], ['skew', 'Skew'], ['ribbon', '3D Ribbon'], ['stair', 'Stair Step'], ['gravity', 'Gravity']] as const).map(([fx, label]) => ({ id: `type-path-${fx}`, label, enabled: () => engine.selected().some((n) => n.kind === 'text' && n.mode === 'path'), checked: () => engine.selected().some((n) => n.kind === 'text' && n.mode === 'path' && (n.pathEffect ?? 'rainbow') === fx), run: () => { engine.applyToSelection('Type on a Path Effect', (n) => (n.kind === 'text' && n.mode === 'path' ? { ...n, pathEffect: fx } : n)); } })),
    { id: 'type-orientation-horizontal', label: 'Horizontal', enabled: () => kindSel('text'), checked: () => engine.selected().some((n) => n.kind === 'text' && !n.vertical), run: () => { engine.setTextOrientation(false); } },
    { id: 'type-orientation-vertical', label: 'Vertical', enabled: () => kindSel('text'), checked: () => engine.selected().some((n) => n.kind === 'text' && !!n.vertical), run: () => { engine.setTextOrientation(true); } },
    { id: 'case-upper', label: 'UPPERCASE', enabled: () => kindSel('text'), run: () => changeCase('upper') },
    { id: 'case-lower', label: 'lowercase', enabled: () => kindSel('text'), run: () => changeCase('lower') },
    { id: 'case-title', label: 'Title Case', enabled: () => kindSel('text'), run: () => changeCase('title') },
    { id: 'case-sentence', label: 'Sentence case', enabled: () => kindSel('text'), run: () => changeCase('sentence') },
    { id: 'panel-character', label: 'Character', keys: ['Mod+T'], run: () => showPanel('character') },
    { id: 'panel-paragraph', label: 'Paragraph', keys: ['Alt+Mod+T'], run: () => showPanel('paragraph') },
    { id: 'panel-glyphs', label: 'Glyphs', run: () => showPanel('glyphs') },
    { id: 'panel-three-d', label: '3D and Materials', run: () => showPanel('three-d') },

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
    ...EFFECTS.map((fx) => ({ id: `fx-${fx.id}`, label: `${fx.label}...`, enabled: () => sel() || !!appearanceP.effectSlot(), run: () => void effectDialog(engine, fx.id, appearanceP.effectSlot()) })),
    { id: 'effect-gallery', label: 'Effect Gallery...', enabled: () => sel() || !!appearanceP.effectSlot(), run: () => void (gallery ??= new EffectGallery(engine)).run(undefined, appearanceP.effectSlot()) },
    { id: 'raster-settings', label: 'Document Raster Effects Settings...', enabled: has, run: async () => { const p = engine.current; if (!p) return; const v = await askForm('Document Raster Effects Settings', [{ kind: 'number', key: 'ppi', label: 'Resolution', value: p.doc.rasterPpi || 300, min: 72, max: 2400, unit: 'ppi' }, { kind: 'note', text: 'Screen is 72 ppi, Medium 150, High 300. Raster effects and the Effect Gallery render at this resolution in PDF and SVG exports, and Object > Rasterize uses it.' }], { ok: 'OK' }); if (v) engine.documentSetup({ rasterPpi: Number(v.ppi) }); } },

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
    viewFlag('snap-pixel', 'Snap to Pixel', 'snapPixel'),
    viewFlag('toggle-corner-widget', 'Show Corner Widget', 'cornerWidget'),
    viewFlag('toggle-artboards', 'Show Artboards', 'artboards'),
    viewFlag('toggle-gradient-annotator', 'Show Gradient Annotator', 'gradientAnnotator', ['Alt+Mod+G']),
    viewFlag('toggle-threads', 'Show Text Threads', 'threads', ['Shift+Mod+Y']),
    { id: 'reset-rotation', label: 'Reset Rotate View', keys: ['Shift+Mod+1'], enabled: () => !!engine.current?.viewport.rotation, run: () => engine.setViewRotation(0) },
    { id: 'screen-standard', label: 'Normal Screen Mode', checked: () => screen === 'standard', run: () => { screen = 'standard'; applyScreen(); } },
    { id: 'screen-menu', label: 'Full Screen Mode with Menu Bar', checked: () => screen === 'menu', run: () => { screen = 'menu'; applyScreen(); } },
    { id: 'screen-full', label: 'Full Screen Mode', checked: () => screen === 'full', run: () => { screen = 'full'; applyScreen(); } },
    { id: 'screen-next', label: 'Change Screen Mode', keys: ['F'], run: () => { screen = screen === 'standard' ? 'menu' : screen === 'menu' ? 'full' : 'standard'; applyScreen(); } },
    { id: 'toggle-panels', label: 'Show or Hide Panels', keys: ['Tab'], checked: () => !panelsHidden, run: () => { panelsHidden = !panelsHidden; applyScreen(); } },

    { id: 'assistant', label: 'Assistant', keys: ['Alt+Mod+I'], run: () => assistant.toggle() },
    { id: 'terminal-toggle', label: 'Terminal', keys: ['Alt+Shift+Mod+T'], checked: () => termDock.isOpen(), run: () => termDock.toggle() },
    { id: 'terminal-new', label: 'New Terminal', run: () => void termDock.newTerminal() },
    { id: 'claude-code', label: 'Claude Code', keys: ['Alt+Shift+Mod+C'], run: () => void termDock.claude() },
    { id: 'claude-chat', label: 'Chat with Claude', keys: ['Alt+Shift+Mod+H'], run: () => void termDock.showChat() },
    { id: 'manage-plugins', label: 'Manage Plugins...', run: () => void pluginsDialog.show() },
    ...Object.keys(TAB_HOMES).map((tab) => ({ id: `panel-${tab}`, label: tab.replace(/-/g, ' ').replace(/(^|\s)\w/g, (c) => c.toUpperCase()), run: () => showPanel(tab) })).filter((c) => !['panel-character', 'panel-paragraph', 'panel-glyphs', 'panel-three-d'].includes(c.id)),
    { id: 'panel-properties-col', label: 'Properties Column', checked: () => propsShown(), run: () => { store('formpth.propsCol', propsShown() ? 'hidden' : 'shown'); syncPropsCol(); } },
    ...STYLE_LIBRARIES.map((l) => ({ id: `gs-lib-${l.id}`, label: l.name, run: () => { showPanel('graphic-styles'); stylesP.showLibrary(l.id); } })),
    ...SWATCH_LIBRARIES.map((l) => ({ id: `sw-lib-${l.id}`, label: l.name, run: () => showSwatchLib(l) })),
    ...Array.from({ length: 12 }, (_, i) => ({ id: `sw-user-${i}`, label: () => userSwatchLibraries()[i]?.name ?? '', enabled: () => !!userSwatchLibraries()[i], run: () => { const l = userSwatchLibraries()[i]; if (l) showSwatchLib(l); } })),
    { id: 'sw-user-none', label: 'No saved libraries yet', enabled: () => false, run: () => undefined },
    { id: 'sw-lib-other', label: 'Other Library...', run: () => { libKind = 'swatch'; libInput.accept = '.ase,.fpth'; libInput.click(); } },
    { id: 'sw-lib-save-ase', label: 'Save Swatch Library as ASE...', enabled: has, run: () => void saveSwatchLibrary('ase') },
    { id: 'sw-lib-save-fpth', label: 'Save Swatch Library as formpth...', enabled: has, run: () => void saveSwatchLibrary('fpth') },
    ...BRUSH_LIBRARIES.map((l) => ({ id: `br-lib-${l.id}`, label: l.name, run: () => showBrushLib(l) })),
    ...Array.from({ length: 12 }, (_, i) => ({ id: `br-user-${i}`, label: () => userBrushLibraries()[i]?.name ?? '', enabled: () => !!userBrushLibraries()[i], run: () => { const l = userBrushLibraries()[i]; if (l) showBrushLib(l); } })),
    { id: 'br-user-none', label: 'No saved libraries yet', enabled: () => false, run: () => undefined },
    { id: 'br-lib-other', label: 'Open Brush Library...', run: () => { libKind = 'brush'; libInput.accept = '.fpth'; libInput.click(); } },
    { id: 'br-lib-save', label: 'Save Brushes...', enabled: has, run: () => void saveBrushLibrary() },
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
    { id: 'pf-hard-mix', label: 'Hard Mix', group: 'Object', description: 'Divides overlaps and colours each overlap with the per-channel maximum of the overlapping fills.', enabled: sel, mutates: true, run: () => engine.mixPathfinder('hard') },
    { id: 'pf-soft-mix', label: 'Soft Mix...', group: 'Object', description: 'Divides overlaps and colours each overlap with a blend of the overlapping fills at the mixing rate.', enabled: sel, mutates: true, params: { rate: { type: 'number', min: 0, max: 100, description: 'Mixing rate in percent' } }, run: (params) => void softMixDialog(params) },
    { id: 'pf-trap', label: 'Trap...', group: 'Object', description: 'Adds thin multiply-blended trap shapes where differently coloured objects abut or overlap.', enabled: sel, mutates: true, params: { thickness: { type: 'number', min: 0.01, description: 'Trap thickness in document units' }, height_width: { type: 'number', min: 5, max: 400, description: 'Height to width ratio in percent' }, tint_reduction: { type: 'number', min: 0, max: 100, description: 'Tint reduction in percent' }, process_color: { type: 'boolean', description: 'Trap with process colour' }, reverse: { type: 'boolean', description: 'Spread the darker colour into the lighter' } }, run: (params) => void trapDialog(params) },
    ...pfs.filter((x) => x !== 'unite').map((x) => ({ id: `pf-${x}`, label: PF_LABEL[x], enabled: sel, run: () => engine.pathfinder(x) })),
    { id: 'compound-shape-make', label: 'Make Compound Shape', group: 'Object', enabled: () => engine.selected().length > 1, mutates: true, run: () => engine.makeCompoundShape() },
    ...(['unite', 'minus_front', 'intersect', 'exclude'] as const).map((x) => ({ id: `compound-shape-${x}`, label: `${PF_LABEL[x]} as Compound Shape`, group: 'Object', enabled: () => engine.selected().length > 1, mutates: true, run: () => engine.pathfinder(x, undefined, true) })),
    { id: 'compound-shape-expand', label: 'Expand Compound Shape', group: 'Object', enabled: () => engine.compoundShapeTargets().length > 0, mutates: true, run: () => engine.expandCompoundShape() },
    { id: 'compound-shape-release', label: 'Release Compound Shape', group: 'Object', enabled: () => engine.compoundShapeTargets().length > 0, mutates: true, run: () => engine.releaseCompoundShape() },
    ...([['add', 'Add'], ['subtract', 'Subtract'], ['intersect', 'Intersect'], ['exclude', 'Exclude']] as const).map(([m, l]) => ({ id: `shape-mode-${m}`, label: `Shape Mode: ${l}`, group: 'Object', enabled: () => engine.canShapeMode(), mutates: true, run: () => engine.shapeMode(m) })),
    { id: 'pf-options', label: 'Pathfinder Options...', group: 'Object', params: { precision: { type: 'number', min: 0.001, max: 100, description: 'Pathfinder precision in points' }, remove_redundant_points: { type: 'boolean', description: 'Remove redundant points from Pathfinder results' }, remove_unpainted: { type: 'boolean', description: 'Divide and Outline remove unpainted artwork' } }, run: (params) => void pathfinderOptionsDialog(params) },
    { id: 'play-action', label: 'Play Action', run: () => actionsP.play() },
    { id: 'action-batch', label: 'Batch...', run: () => { showPanel('actions'); actionsP.openBatch(); } },
    { id: 'history-new-document', label: 'New Document from History State', enabled: has, run: () => { engine.newDocumentFromState(); } },
    { id: 'history-options', label: 'History Options...', run: () => void historyOptions() },
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
    const own = new Map<string, string[]>(), ps = new Map<string, string[]>();
    for (const fx of EFFECTS) { if (fx.id === '3d.model') continue; const m = fx.family === 'photoshop' ? ps : own; m.set(fx.menu, [...(m.get(fx.menu) ?? []), `fx-${fx.id}`]); }
    return [...[...own.entries()].map(([label, items]) => ({ label, items })), '-', 'effect-gallery', ...[...ps.entries()].map(([label, items]) => ({ label, items }))];
  }

  const menus: MenuDef[] = [
    { label: 'File', items: () => ['new', 'open', 'open-file', ...(recent.length ? [{ label: 'Open Recent', items: [...recent.map((_, i) => `recent-${i}`), '-', 'clear-recent'] }] : []), '-', 'close-tab', 'save', 'save-as', 'download-project', '-', 'place', 'place-linked', '-', { label: 'Automate', items: ['play-action', 'action-batch', '-', 'history-new-document', 'history-options'] }, '-', { label: 'Export', items: ['export-screens', 'export-as', '-', 'export-svg', 'export-pdf', 'export-eps', 'export-dxf', 'export-dwg', 'export-png', 'export-jpg', 'export-webp', '-', 'collect-single', 'collect-multiple'] }, '-', 'package', 'document-setup', { label: 'Document Color Mode', items: ['mode-rgb', 'mode-cmyk'] }, '-', 'send-nodemode', 'print'] },
    { label: 'Edit', items: ['undo', 'redo', '-', 'cut', 'copy', 'paste', 'paste-front', 'paste-back', 'paste-in-place', 'paste-on-selected-artboards', 'clear', '-', 'find-replace', { label: 'Spelling', items: ['auto-spell-check', 'check-spelling', 'spelling-dictionary'] }, '-', 'color-settings', 'assign-profile', 'convert-to-profile', '-', { label: 'Edit Colors', items: ['recolor', ...(prefs.showGenerative ? ['generative-recolor'] : []), '-', 'colors-invert', 'colors-grayscale', 'colors-cmyk', 'colors-rgb'] }, '-', 'shortcuts', 'settings'] },
    { label: 'Object', items: () => [
      { label: 'Transform', items: ['transform-again', '-', 'move-dialog', 'rotate-dialog', 'reflect-dialog', 'scale-dialog', 'shear-dialog', '-', 'transform-each', '-', 'toggle-scale-corners', 'reset-bounding-box'] },
      { label: 'Arrange', items: ['bring-to-front', 'bring-forward', 'send-backward', 'send-to-back', '-', 'send-to-layer'] },
      { label: 'Pathfinder', items: ['pf-unite', 'pf-minus_front', 'pf-intersect', 'pf-exclude', '-', 'pf-divide', 'pf-trim', 'pf-merge', 'pf-crop', 'pf-outline', 'pf-minus_back', '-', 'pf-hard-mix', 'pf-soft-mix', 'pf-trap', '-', 'pf-options'] },
      { label: 'Object on Path', items: ['object-on-path-attach', 'object-on-path-arrange', 'object-on-path-release'] },
      { label: 'Align', items: ALIGN.map(([a]) => `align-${a}`) }, '-',
      'group', 'ungroup', 'ungroup-all', 'isolate', '-', 'lock', 'unlock-all', 'hide', 'show-all', '-', 'expand-object', 'expand-appearance', 'rasterize', 'create-mesh', '-',
      { label: 'Path', items: ['join', 'average', '-', 'outline-stroke', 'offset-path', 'reverse-path', '-', 'simplify', 'smooth-path', 'corners-dialog', 'expand-corners', 'add-anchors', 'remove-anchors', 'close-path', '-', 'divide-below', 'split-grid', 'clean-up'] },
      { label: 'Shape', items: ['convert-to-rectangle', 'convert-to-rounded-rectangle', 'convert-to-ellipse', 'convert-to-polygon', 'convert-to-star', '-', 'expand-shape', 'shaper-expand'] },
      { label: 'Pattern', items: prefs.showGenerative ? ['make-pattern', 'edit-pattern', '-', 'generate-patterns'] : ['make-pattern', 'edit-pattern'] },
      ...(prefs.showGenerative ? [{ label: 'Generative', items: ['text-to-vector', 'generative-shape-fill'] }] : []),
      { label: 'Repeat', items: ['repeat-radial', 'repeat-grid', 'repeat-mirror', '-', 'release-live', 'repeat-options'] },
      { label: 'Blend', items: ['blend-make', 'blend-release', '-', 'blend-options', '-', 'blend-expand', 'blend-spine'] },
      { label: 'Envelope Distort', items: ['envelope-warp', 'envelope-mesh', 'envelope-top', '-', 'release-live', 'envelope-options', 'expand-object', '-', 'envelope-edit-contents', 'envelope-edit-envelope', '-', 'envelope-reset-warp', 'envelope-reset-mesh'] },
      { label: 'Perspective', items: ['persp-attach', 'persp-release', '-', 'persp-match-plane', 'persp-edit-text'] },
      { label: 'Image Trace', items: ['image-trace', 'image-trace-expand', '-', 'trace-release', 'trace-expand', '-', 'embed-image'] },
      { label: 'Links', items: ['link-relink', 'link-relink-all', 'link-relink-folder', '-', 'link-update', 'link-update-all', '-', 'link-embed', 'link-unembed', 'link-info'] },
      { label: 'Live Paint', items: ['live-paint-make', 'live-paint-merge', 'live-paint-release', 'live-paint-gap', 'live-paint-expand'] },
      { label: 'Intertwine', items: ['intertwine-make', 'intertwine-release', 'intertwine-edit'] }, '-',
      { label: 'Graph', items: ['graph-type', 'graph-data', '-', 'graph-design', 'graph-column', 'graph-marker'] }, '-',
      { label: 'Text Wrap', items: ['wrap-make', 'wrap-release', '-', 'wrap-options'] },
      { label: 'Clipping Mask', items: ['make-clip', 'release-clip'] },
      { label: 'Compound Path', items: ['compound-make', 'compound-release'] },
      { label: 'Compound Shape', items: ['compound-shape-make', 'compound-shape-expand', 'compound-shape-release', '-', 'compound-shape-unite', 'compound-shape-minus_front', 'compound-shape-intersect', 'compound-shape-exclude', '-', 'shape-mode-add', 'shape-mode-subtract', 'shape-mode-intersect', 'shape-mode-exclude'] },
      { label: 'Opacity Mask', items: ['opacity-mask', 'release-opacity-mask', 'disable-opacity-mask', 'unlink-opacity-mask', '-', 'new-mask-clip', 'new-mask-invert'] },
      { label: 'Symbol', items: ['new-symbol', 'symbol-edit', 'symbol-exit', '-', 'symbol-redefine', 'symbol-duplicate', 'symbol-replace', 'symbol-reset', '-', 'break-symbol', 'symbol-options'] },
      { label: 'Artboards', items: ['artboards-from-selection', 'artboards-rearrange', 'artboard-fit-art', 'artboard-fit-selection', '-', 'artboard-options'] }] },
    { label: 'Type', items: () => ['panel-character', 'panel-paragraph', 'panel-character-styles', 'panel-paragraph-styles', 'panel-glyphs', 'panel-tabs', '-', 'hyphenation-options', 'justification-options', 'area-type-options', { label: 'Type on a Path', items: ['type-path-rainbow', 'type-path-skew', 'type-path-ribbon', 'type-path-stair', 'type-path-gravity', '-', 'type-on-path-options'] }, { label: 'Threaded Text', items: ['thread-create', 'thread-release', 'thread-remove'] }, 'toggle-area-type', { label: 'Type Orientation', items: ['type-orientation-horizontal', 'type-orientation-vertical'] }, '-', 'create-outlines', 'edit-text', 'find-replace', 'find-font', ...(prefs.showGenerative ? ['retype'] : []), '-', { label: 'Change Case', items: ['case-upper', 'case-lower', 'case-title', 'case-sentence'] }] },
    { label: 'Select', items: ['select-all', 'select-artboard', 'deselect', 'inverse', '-', 'select-above', 'select-below', '-', { label: 'Same', items: SAME.map(([k]) => `same-${k}`) }, { label: 'Object', items: OBJ.map(([k]) => `select-${k}`) }] },
    { label: 'Effect', items: () => ['apply-last-effect', 'last-effect', '-', 'raster-settings', '-', ...effectItems()] },
    { label: 'View', items: ['outline', '-', 'zoom-in', 'zoom-out', 'fit', 'fit-all', 'actual', 'zoom-selection', 'reset-rotation', '-', 'toggle-edges', 'toggle-bbox', 'toggle-transparency', 'overprint-preview', { label: 'Proof Setup', items: ['proof-setup'] }, 'proof-colors', 'toggle-artboards', 'toggle-gradient-annotator', 'toggle-corner-widget', 'toggle-threads', '-', 'toggle-help-bar', '-', 'toggle-rulers', { label: 'Guides', items: ['toggle-guides', 'lock-guides', 'make-guides', 'release-guides', 'clear-guides'] }, 'toggle-smart', '-', { label: 'Perspective Grid', items: ['persp-show', 'persp-lock', 'persp-snap', '-', 'persp-define', { label: 'One Point Perspective', items: ['persp-1p'] }, { label: 'Two Point Perspective', items: ['persp-2p'] }, { label: 'Three Point Perspective', items: ['persp-3p'] }, 'persp-presets', '-', 'persp-save-preset', '-', 'persp-plane-left', 'persp-plane-floor', 'persp-plane-right', 'persp-plane-none'] }, '-', 'toggle-grid', 'snap-grid', 'snap-point', 'snap-pixel', '-', { label: 'Screen Mode', items: ['screen-standard', 'screen-menu', 'screen-full'] }, 'toggle-panels'] },
    { label: 'Plugins', items: () => { const ids = pluginHost.commandIds(); return ['manage-plugins', ...(ids.length ? ['-', ...ids] : [])]; } },
    { label: 'Window', items: () => ['assistant', 'claude-chat', 'claude-code', 'terminal-toggle', 'terminal-new', '-', 'toggle-task-bar', 'toggle-generative', '-', 'document-info', 'separations-preview', 'ink-manager', 'swatch-info', '-', ...Object.keys(TAB_HOMES).filter((t) => prefs.showGenerative || !['shape-fill', 'generate-patterns', 'retype', 'text-to-vector'].includes(t)).map((t) => `panel-${t}`), '-', { label: 'Brush Libraries', items: brushLibItems() }, { label: 'Graphic Style Libraries', items: STYLE_LIBRARIES.map((l) => `gs-lib-${l.id}`) }, { label: 'Swatch Libraries', items: swatchLibItems() }, { label: 'Symbol Libraries', items: symbolLibItems() }, '-', 'panel-properties-col', 'reset-panels'] },
    { label: 'Help', items: ['help', '-', 'shortcuts', 'copy-error-log', 'about'] },
  ];
  const menubar = new MenuBar(q(root, '.cv-menubar'), commands, menus);
  const catalogue = new Catalogue({ engine, commands, menus: () => menus });
  catalogue.attach();
  agents.catalogue = catalogue;
  if (wantsNativeMenus()) {
    const native = new NativeMenus(commands, () => menus);
    void native.build().catch(() => undefined);
    root.classList.add('has-native-menus');
    for (const ev of ['active', 'doc', 'selection', 'history', 'tool'] as const) engine.on(ev, () => native.refresh());
    engine.on('projects', () => { void native.build().catch(() => undefined); });
  }
  contextMenu.setItems(['undo', 'redo', '-', 'cut', 'copy', 'paste', 'paste-in-place', '-', 'group', 'ungroup', 'ungroup-all', 'isolate', '-', { label: 'Transform', items: ['transform-again', '-', 'move-dialog', 'rotate-dialog', 'reflect-dialog', 'scale-dialog', 'shear-dialog', 'transform-each', '-', 'reset-bounding-box'] }, { label: 'Arrange', items: ['bring-to-front', 'bring-forward', 'send-backward', 'send-to-back', 'send-to-layer'] }, { label: 'Select', items: ['select-above', 'select-below'] }, '-', 'make-clip', 'release-clip', 'compound-make', 'create-outlines', 'outline-stroke', 'expand-appearance', '-', 'collect-layer', 'new-symbol']);
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
      const pe = p?.patternEdit ?? null;
      setHidden(isoBar, !iso);
      const se = p?.symbolEdit ?? null;
      setHidden(q(isoBar, '.cv-iso-exit'), !!pe || !!se);
      setHidden(q(isoBar, '.cv-iso-pattern'), !pe);
      setHidden(q(isoBar, '.cv-iso-symbol'), !se);
      if (iso) setText(q(isoBar, '.cv-isolation-label'), pe ? `Pattern Editing Mode: ${pe.name}` : se ? `Symbol Editing Mode: ${p?.doc.symbols.find((s) => s.id === se.symbol)?.name ?? ''}` : `Isolation Mode: ${nodeLabel(iso)}`);
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
    const files = splitParts(Array.from(e.dataTransfer?.files ?? [])), at = stage.docPoint(e.clientX, e.clientY);
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
  installColorBackend();
  onColorChange(() => { invalidateLayers(); engine.emit('colors', null); engine.emit('render', null); });
  for (const ev of ['doc', 'active', 'projects'] as const) engine.on(ev, () => activateDocument(engine.doc));
  activateDocument(engine.doc);
  installShaping();
  void ensureFace(typeDefaults.font, typeDefaults.style);
  status.setEngine('Engine: checking');
  void api.capabilities().then((c) => {
    caps = c;
    status.setEngine(c ? `Engine ${c.version}${c.desktop ? ' · desktop' : ''}` : 'Engine offline');
    if (!c) toast('The formpth engine is offline. Drawing works; library saves, system fonts, the assistant and agents need it (./formpth boot).');
    else void systemFonts().then(() => engine.emit('options', null));
  });

  for (const [id, keys] of Object.entries(loadPrefs().shortcuts)) commands.setKeys(id, keys);
  if (import.meta.env.DEV) (window as unknown as { formpth: Record<string, unknown> }).formpth = { ...(window as unknown as { formpth?: Record<string, unknown> }).formpth, engine, commands, agents, stage };

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

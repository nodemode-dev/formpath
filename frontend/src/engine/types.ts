export interface Pt { x: number; y: number }
export type Mat = [number, number, number, number, number, number];
export interface Rect { x: number; y: number; w: number; h: number }
export interface RGB { r: number; g: number; b: number }

export type CornerType = 'round' | 'inverted' | 'chamfer';
export interface CornerSpec { type: CornerType; r: number; mode?: 'absolute' | 'relative' }
export interface Anchor { x: number; y: number; ix: number; iy: number; ox: number; oy: number; smooth?: boolean; corner?: CornerSpec }
export interface SubPath { pts: Anchor[]; closed: boolean }
export type PathData = SubPath[];
export type FillRule = 'nonzero' | 'evenodd';

export type Color =
  | { kind: 'rgb'; r: number; g: number; b: number }
  | { kind: 'cmyk'; c: number; m: number; y: number; k: number }
  | { kind: 'gray'; k: number };

export interface GradientStop { offset: number; color: Color; opacity: number; mid: number }
export interface GradientGeom { x1: number; y1: number; x2: number; y2: number; fx?: number; fy?: number }
export interface FreeformPoint { x: number; y: number; color: Color; spread: number }
export interface Gradient {
  kind: 'linear' | 'radial' | 'freeform';
  stops: GradientStop[];
  angle: number;
  aspect: number;
  geom: GradientGeom | null;
  points?: FreeformPoint[];
  mode?: 'points' | 'lines';
  strokeMode?: 'within' | 'along' | 'across';
  blend?: 'linear' | 'perceptual';
  dither?: boolean;
}

export type Paint =
  | { type: 'none' }
  | { type: 'color'; color: Color; swatch?: string; tint?: number }
  | { type: 'gradient'; gradient: Gradient; swatch?: string }
  | { type: 'pattern'; pattern: string; xf: Mat };

export type BlendMode = 'normal' | 'darken' | 'multiply' | 'color_burn' | 'lighten' | 'screen' | 'color_dodge' | 'overlay' | 'soft_light' | 'hard_light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';
export const BLEND_MODES: ReadonlyArray<{ id: BlendMode; label: string; css: GlobalCompositeOperation }> = [
  { id: 'normal', label: 'Normal', css: 'source-over' },
  { id: 'darken', label: 'Darken', css: 'darken' },
  { id: 'multiply', label: 'Multiply', css: 'multiply' },
  { id: 'color_burn', label: 'Color Burn', css: 'color-burn' },
  { id: 'lighten', label: 'Lighten', css: 'lighten' },
  { id: 'screen', label: 'Screen', css: 'screen' },
  { id: 'color_dodge', label: 'Color Dodge', css: 'color-dodge' },
  { id: 'overlay', label: 'Overlay', css: 'overlay' },
  { id: 'soft_light', label: 'Soft Light', css: 'soft-light' },
  { id: 'hard_light', label: 'Hard Light', css: 'hard-light' },
  { id: 'difference', label: 'Difference', css: 'difference' },
  { id: 'exclusion', label: 'Exclusion', css: 'exclusion' },
  { id: 'hue', label: 'Hue', css: 'hue' },
  { id: 'saturation', label: 'Saturation', css: 'saturation' },
  { id: 'color', label: 'Color', css: 'color' },
  { id: 'luminosity', label: 'Luminosity', css: 'luminosity' },
];

export type Cap = 'butt' | 'round' | 'square';
export type Join = 'miter' | 'round' | 'bevel';
export type StrokeAlign = 'center' | 'inside' | 'outside';
export interface WidthPoint { t: number; l: number; r: number }

export interface Effect { id: string; params: Record<string, number | string | boolean>; visible: boolean }

export interface FillItem { kind: 'fill'; paint: Paint; opacity: number; blend: BlendMode; visible: boolean; effects: Effect[]; overprint?: boolean }
export interface StrokeItem {
  kind: 'stroke'; paint: Paint; width: number; cap: Cap; join: Join; miter: number; align: StrokeAlign;
  dash: number[]; dashOffset: number; dashCorners: boolean;
  startArrow: string; endArrow: string; arrowScale: [number, number]; arrowAlign: 'extend' | 'tip';
  profile: WidthPoint[] | null; brush: string | null;
  opacity: number; blend: BlendMode; visible: boolean; effects: Effect[]; overprint?: boolean;
}
export type AppearanceItem = FillItem | StrokeItem;
export interface Appearance { items: AppearanceItem[]; effects: Effect[] }

export interface OpacityMask { art: VNode; clip: boolean; invert: boolean; disabled: boolean; linked: boolean }
export interface TextWrap { offset: number; invert: boolean }
export interface WrapShape { pts: Pt[]; offset: number; invert: boolean }

export type LiveShape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; radii: [number, number, number, number]; corner: 'round' | 'inverted' | 'chamfer'; xf: Mat }
  | { kind: 'ellipse'; x: number; y: number; w: number; h: number; start: number; end: number; xf: Mat }
  | { kind: 'polygon'; cx: number; cy: number; r: number; sides: number; radius: number; corner?: 'round' | 'inverted' | 'chamfer'; xf: Mat }
  | { kind: 'star'; cx: number; cy: number; r1: number; r2: number; points: number; radius?: number; corner?: 'round' | 'inverted' | 'chamfer'; xf: Mat }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number };

export interface NodeBase {
  id: string;
  name?: string;
  hidden?: boolean;
  locked?: boolean;
  opacity: number;
  blend: BlendMode;
  isolate?: boolean;
  knockout?: boolean | 'inherit';
  knockoutShape?: boolean;
  ap: Appearance;
  mask?: OpacityMask | null;
  style?: string;
  note?: string;
  wrap?: TextWrap | null;
  bbox?: number;
  part?: string;
  persp?: PerspAttach;
  smode?: ShapeMode;
}

export type ShapeMode = 'add' | 'subtract' | 'intersect' | 'exclude';
export type PerspPlane = 'left' | 'right' | 'floor';
export interface PerspAttach { plane: PerspPlane; off: number; m: Mat; src?: PathData[]; sig?: number }
export interface PerspGrid {
  type: 1 | 2 | 3; name?: string;
  ground: Pt; height: number; station: number; angle: number; distance: number; vp3: number;
  cell: number; ext: { left: number; right: number; height: number }; off: { left: number; right: number; floor: number };
  colors: { left: Color; right: Color; floor: Color }; opacity: number;
}
export interface PerspView { show: boolean; lock: boolean; snap: boolean; plane: PerspPlane | 'none' }

export interface LayerNode extends NodeBase { kind: 'layer'; children: VNode[]; color: string; template?: boolean; printable?: boolean; clip?: boolean }
export type TraceView = 'result' | 'result_outlines' | 'outlines' | 'outlines_source' | 'source';
export interface TraceInfo { src: ImageNode; opts: Record<string, number | string | boolean>; view: TraceView }
export interface LivePaint { fills: Array<{ at: Pt; paint: Paint }>; gap: number }
export type DimType = 'linear' | 'angular' | 'radial';
export type DimOrient = 'horizontal' | 'vertical' | 'aligned';
export type DimArrow = 'filled' | 'open' | 'tick' | 'dot' | 'none';
export type DimTextPos = 'above' | 'center' | 'below';
export interface DimensionSpec {
  type: DimType; orient: DimOrient; radial: 'radius' | 'diameter'; pts: Pt[]; offset: number;
  units: Units | 'doc'; precision: number; scale: number; showUnits: boolean;
  arrow: DimArrow; arrowSize: number; font: string; style: string; size: number; textPos: DimTextPos;
  color: Color; weight: number;
}
export interface IntertwineZone { d: PathData; top: string }
export interface IntertwineSpec { zones: IntertwineZone[] }
export interface ShaperSpec { cuts: Pt[]; merges: Array<{ pts: Pt[]; src: string }>; fills: Array<{ at: Pt; paint: Paint }> }
export type GraphType = 'column' | 'stacked' | 'bar' | 'stackedBar' | 'line' | 'area' | 'scatter' | 'pie' | 'radar';
export type GraphSeriesType = 'column' | 'stacked' | 'line' | 'area';
export interface GraphData { series: string[]; cats: string[]; values: Array<Array<number | null>> }
export interface GraphColumnDesign { design: string; mode: 'vertical' | 'uniform' | 'repeat'; per: number; fraction: 'chop' | 'scale' }
export interface GraphSpec {
  type: GraphType; w: number; h: number; xf: Mat; data: GraphData;
  axis: 'start' | 'end' | 'both'; auto: boolean; min: number; max: number; divisions: number;
  valueTicks: 'none' | 'short' | 'full'; catTicks: 'none' | 'short' | 'full'; prefix: string; suffix: string;
  legend: 'right' | 'top' | 'none'; pieLegend: 'standard' | 'wedges' | 'none'; pieSort: 'none' | 'all' | 'first'; piePosition: 'ratio' | 'even' | 'stacked';
  colWidth: number; clusterWidth: number; mark: boolean; connect: boolean; edgeToEdge: boolean; fillLines: boolean; lineWidth: number; markerSize: number;
  shadow: boolean; font: string; style: string; size: number;
  seriesTypes?: Record<string, GraphSeriesType>; columns?: Record<string, GraphColumnDesign>; markers?: Record<string, string>;
}
export interface GraphDesign { id: string; name: string; art: VNode }
export interface GroupNode extends NodeBase { kind: 'group'; children: VNode[]; clip: boolean; trace?: TraceInfo; livePaint?: LivePaint; dim?: DimensionSpec; intertwine?: IntertwineSpec; shaper?: ShaperSpec; graph?: GraphSpec; graphKey?: string; compoundShape?: boolean }
export interface PathNode extends NodeBase { kind: 'path'; d: PathData; rule: FillRule; live?: LiveShape; guide?: boolean }
export interface CompoundNode extends NodeBase { kind: 'compound'; children: PathNode[]; rule: FillRule }

export interface CharTouch { x: number; y: number; sx: number; sy: number; r: number }
export interface CharStyle {
  font: string; style: string; size: number; leading: number | null; tracking: number; kerning: 'auto' | 'optical' | 'none';
  baseline: number; hscale: number; vscale: number; fill: Paint; stroke: Paint; strokeWidth: number;
  underline: boolean; strike: boolean; caps: 'none' | 'all' | 'small'; position: 'normal' | 'super' | 'sub'; features: string[]; cs?: string; alt?: number; upright?: boolean;
  axes?: Record<string, number>; rotate?: number; touch?: CharTouch;
}
export type TextAlign = 'left' | 'center' | 'right' | 'justify' | 'justify_center' | 'justify_right' | 'justify_all';
export interface HyphenOptions { minWord: number; after: number; before: number; limit: number; zone: number; caps: boolean }
export type TabAlign = 'left' | 'center' | 'right' | 'decimal';
export interface TabStop { pos: number; align: TabAlign; leader?: string; char?: string }
export interface Justification { wordMin: number; wordDes: number; wordMax: number; letterMin: number; letterDes: number; letterMax: number; glyphMin: number; glyphDes: number; glyphMax: number; single: 'justify' | 'left' | 'center' | 'right' }
export type ListFormat = '1' | '01' | 'a' | 'A' | 'i' | 'I';
export interface ListStyle { kind: 'bullet' | 'number'; bullet?: string; format?: ListFormat; start?: number; sep?: string }
export interface ParaStyle { align: TextAlign; indentLeft: number; indentRight: number; indentFirst: number; spaceBefore: number; spaceAfter: number; hyphenate: boolean; name?: string; ps?: string; hyph?: HyphenOptions; tabs?: TabStop[]; just?: Justification; list?: ListStyle }
export interface Span { text: string; style: CharStyle }
export interface CharStyleDef { id: string; name: string; style: Partial<CharStyle> }
export interface ParaStyleDef { id: string; name: string; style: Partial<ParaStyle>; char?: Partial<CharStyle> }
export const CHAR_STYLE_KEYS = ['font', 'style', 'size', 'leading', 'tracking', 'kerning', 'baseline', 'hscale', 'vscale', 'fill', 'stroke', 'strokeWidth', 'underline', 'strike', 'caps', 'position', 'features', 'axes', 'rotate'] as const;
export const PARA_STYLE_KEYS = ['align', 'indentLeft', 'indentRight', 'indentFirst', 'spaceBefore', 'spaceAfter', 'hyphenate', 'hyph', 'tabs', 'just', 'list'] as const;
export type FirstBaseline = 'ascent' | 'cap' | 'x' | 'leading' | 'fixed' | 'em' | 'legacy';
export interface AreaOptions { columns: number; rows: number; gutter: number; inset: number; firstBaseline: FirstBaseline; rowGutter?: number; baselineMin?: number; flow?: 'rows' | 'columns' }
export type PathEffect = 'rainbow' | 'skew' | 'ribbon' | 'stair' | 'gravity';
export type PathAlign = 'baseline' | 'ascender' | 'descender' | 'center';
export interface TextNode extends NodeBase {
  kind: 'text';
  mode: 'point' | 'area' | 'path';
  spans: Span[];
  para: ParaStyle;
  xf: Mat;
  frame?: Rect;
  framePath?: PathData;
  path?: PathData;
  pathStart?: number;
  pathEnd?: number;
  pathEffect?: PathEffect;
  pathFlip?: boolean;
  pathAlign?: PathAlign;
  pathSpacing?: number;
  vertical?: boolean;
  area?: AreaOptions;
  next?: string;
  wrapShape?: WrapShape[];
}

export interface ImageWarp { rows: number; cols: number; pts: Pt[]; smooth: boolean }
export interface ImageLink { path?: string; handle?: string; name: string; size?: number; mtime?: number; page?: number; crop?: string; layers?: string }
export interface ImageNode extends NodeBase { kind: 'image'; src: string; w: number; h: number; xf: Mat; link?: string; linked?: ImageLink; trace?: Record<string, number | string | boolean>; warp?: ImageWarp }
export interface SymbolPart { ap?: Appearance; opacity?: number; blend?: BlendMode }
export interface SymbolNode extends NodeBase { kind: 'symbol'; symbol: string; xf: Mat; tint?: { color: Color; amount: number }; parts?: Record<string, SymbolPart> }

export interface BlendSpec { spacing: 'smooth' | 'steps' | 'distance'; steps: number; distance: number; alignToPath: boolean; spine: PathData | null }
export interface BlendNode extends NodeBase { kind: 'blend'; children: VNode[]; spec: BlendSpec }

export type EnvelopeSpec =
  | { kind: 'warp'; style: string; bend: number; h: number; v: number; vertical: boolean }
  | { kind: 'mesh'; rows: number; cols: number; points: Pt[]; h?: Array<[Pt, Pt, Pt, Pt]>; u?: number[]; v?: number[] }
  | { kind: 'top'; shape: PathData };
export interface EnvelopeOptions { fidelity: number; appearance: boolean; gradients: boolean; patterns: boolean; antiAlias: boolean }
export interface EnvelopeNode extends NodeBase { kind: 'envelope'; children: VNode[]; spec: EnvelopeSpec; frame: Rect; opts?: Partial<EnvelopeOptions>; editContents?: boolean }

export interface MeshPoint { x: number; y: number; color: Color; opacity: number; h: [Pt, Pt, Pt, Pt] }
export interface MeshNode extends NodeBase { kind: 'mesh'; rows: number; cols: number; points: MeshPoint[] }

export type RepeatSpec =
  | { kind: 'radial'; instances: number; radius: number; cx: number; cy: number; start: number; end: number; reverse: boolean }
  | { kind: 'grid'; rows: number; cols: number; hs: number; vs: number; flipRows: boolean; flipCols: boolean }
  | { kind: 'mirror'; angle: number; cx: number; cy: number };
export interface RepeatNode extends NodeBase { kind: 'repeat'; children: VNode[]; spec: RepeatSpec }

export type VNode = LayerNode | GroupNode | PathNode | CompoundNode | TextNode | ImageNode | SymbolNode | BlendNode | EnvelopeNode | MeshNode | RepeatNode;
export type NodeKind = VNode['kind'];
export type ContainerNode = LayerNode | GroupNode | CompoundNode | BlendNode | EnvelopeNode | RepeatNode;

export interface Artboard { id: string; name: string; x: number; y: number; w: number; h: number; bg?: Color | null }
export interface Swatch { id: string; name: string; paint: Paint; global: boolean; spot: boolean; group?: string }
export interface SymbolSlice { x1: number; y1: number; x2: number; y2: number }
export interface SymbolDef { id: string; name: string; art: VNode; reg: Pt; type?: 'static' | 'dynamic'; slice?: SymbolSlice | null }
export interface GraphicStyle { id: string; name: string; ap: Appearance; opacity: number; blend: BlendMode }
export type BrushKind =
  | { type: 'calligraphic'; angle: number; roundness: number; size: number }
  | { type: 'scatter'; art: VNode; size: number; spacing: number; scatter: number; rotation: number; relative: boolean }
  | { type: 'art'; art: VNode; stretch: boolean; flip: boolean; width: number; guides?: [number, number] | null; flipAlong?: boolean }
  | { type: 'pattern'; art: VNode; spacing: number; fit: 'stretch' | 'space' | 'approximate'; outer?: VNode | null; inner?: VNode | null; start?: VNode | null; end?: VNode | null; flipAlong?: boolean; flip?: boolean }
  | { type: 'bristle'; shape: BristleShape; size: number; length: number; density: number; thickness: number; opacity: number; stiffness: number };
export type BristleShape = 'round_point' | 'flat_point' | 'round_blunt' | 'flat_blunt' | 'round_curve' | 'flat_curve' | 'round_angle' | 'flat_angle' | 'fan';
export const BRISTLE_SHAPES: ReadonlyArray<readonly [BristleShape, string]> = [['round_point', 'Round Point'], ['flat_point', 'Flat Point'], ['round_blunt', 'Round Blunt'], ['flat_blunt', 'Flat Blunt'], ['round_curve', 'Round Curve'], ['flat_curve', 'Flat Curve'], ['round_angle', 'Round Angle'], ['flat_angle', 'Flat Angle'], ['fan', 'Fan']];
export interface BrushDef { id: string; name: string; brush: BrushKind; colorize: 'none' | 'tints' | 'tints_shades' | 'hue_shift' }
export interface PatternDef { id: string; name: string; tile: Rect; art: VNode; type: 'grid' | 'brick_row' | 'brick_col' | 'hex_col' | 'hex_row'; hs: number; vs: number; brick?: number; overlap?: ['left' | 'right', 'top' | 'bottom'] }
export interface Guide { id: string; vertical: boolean; pos: number }
export interface ExportAsset { id: string; name: string; ids: string[] }
export interface ImageAsset { mime: string; w: number; h: number }
export type Units = 'pt' | 'px' | 'mm' | 'cm' | 'in' | 'pc';

export interface Doc {
  version: 1;
  title: string;
  units: Units;
  colorMode: 'rgb' | 'cmyk';
  artboards: Artboard[];
  layers: LayerNode[];
  swatches: Swatch[];
  symbols: SymbolDef[];
  styles: GraphicStyle[];
  brushes: BrushDef[];
  patterns: PatternDef[];
  charStyles: CharStyleDef[];
  paraStyles: ParaStyleDef[];
  guides: Guide[];
  grid: { spacing: number; subdivisions: number };
  images: Record<string, ImageAsset>;
  rasterPpi: number;
  exportAssets?: ExportAsset[];
  graphDesigns?: GraphDesign[];
  variables?: Variable[];
  dataSets?: DataSet[];
  dataSet?: number;
  persp?: PerspGrid;
  perspView?: PerspView;
  linkPreviews?: boolean;
  bleed?: { t: number; b: number; l: number; r: number };
  cm?: ColorSettings;
  inks?: InkSettings;
}

export interface ProfileRef { id: string; name: string }
export interface ProofSetup { device?: ProfileRef; preserve?: boolean; paper?: boolean; blackInk?: boolean }
export interface InkSettings { off?: string[]; process?: string[]; alias?: Record<string, string>; allSpotsToProcess?: boolean }
export interface ColorSettings { rgb?: ProfileRef; cmyk?: ProfileRef; intent?: 0 | 1 | 2 | 3; bpc?: boolean; proof?: ProofSetup }

export type VariableKind = 'text' | 'image' | 'visibility' | 'graph';
export interface Variable { id: string; name: string; kind: VariableKind; node: string | null }
export type VariableValue = string | boolean | GraphData;
export interface DataSet { id: string; name: string; values: Record<string, VariableValue> }

export type ToolId = string;
export interface Notice { text: string; kind: 'info' | 'error' }

export interface EngineEvents {
  projects: null; doc: null; selection: null; active: null; viewport: null; tool: null; options: null;
  history: null; colors: null; render: null; overlay: null; busy: boolean; notice: Notice;
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const MAX_ARTBOARD_PT = 163440;
export const clampArtboardSide = (v: number): number => clamp(Number.isFinite(v) ? v : 1, 1, MAX_ARTBOARD_PT);
export const UNIT_PT: Record<Units, number> = { pt: 1, px: 1, mm: 72 / 25.4, cm: 72 / 2.54, in: 72, pc: 12 };

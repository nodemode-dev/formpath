import { History } from './history';
import type { PatternSession } from './pattern';
import { perspViewOf } from './perspective';
import type { SymbolSession } from './symbols';
import type { Doc, PerspView } from './types';
import { Viewport } from './viewport';

export class Project {
  readonly id: string;
  name: string;
  libraryName: string | null = null;
  libraryVersion: string | null = null;
  doc: Doc;
  selection = new Set<string>();
  anchors = new Map<string, Set<number>>();
  activeLayer: string;
  isolation: string | null = null;
  layerTarget: string | null = null;
  patternEdit: PatternSession | null = null;
  symbolEdit: SymbolSession | null = null;
  activeArtboard = 0;
  persp: PerspView;
  readonly history: History;
  readonly viewport = new Viewport();
  readonly assets = new Map<string, Blob>();
  readonly bitmaps = new Map<string, ImageBitmap | HTMLImageElement>();
  readonly previews = new Map<string, Blob>();

  constructor(id: string, doc: Doc, name: string) {
    this.id = id;
    this.doc = doc;
    this.name = name;
    this.history = new History(doc);
    this.persp = perspViewOf(doc);
    this.activeLayer = doc.layers[doc.layers.length - 1]?.id ?? '';
  }

  get modified(): boolean { return this.history.modified; }
}

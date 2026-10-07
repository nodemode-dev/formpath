import { History } from './history';
import type { Doc } from './types';
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
  activeArtboard = 0;
  readonly history: History;
  readonly viewport = new Viewport();
  readonly assets = new Map<string, Blob>();
  readonly bitmaps = new Map<string, ImageBitmap | HTMLImageElement>();

  constructor(id: string, doc: Doc, name: string) {
    this.id = id;
    this.doc = doc;
    this.name = name;
    this.history = new History(doc);
    this.activeLayer = doc.layers[doc.layers.length - 1]?.id ?? '';
  }

  get modified(): boolean { return this.history.modified; }
}

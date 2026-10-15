import { clamp, type Mat, type Pt } from './types';

export class Viewport {
  static readonly MIN = 0.0025;
  static readonly MAX = 640;
  static insetRight = 0;
  zoom = 1;
  panX = 0;
  panY = 0;
  width = 800;
  height = 600;
  fitted = true;
  rotation = 0;

  get centerX(): number { return (this.width - Viewport.insetRight) / 2; }
  get matrix(): Mat { return [this.zoom, 0, 0, this.zoom, this.panX, this.panY]; }
  toDoc(sx: number, sy: number): Pt { return { x: (sx - this.panX) / this.zoom, y: (sy - this.panY) / this.zoom }; }
  toScreen(x: number, y: number): Pt { return { x: x * this.zoom + this.panX, y: y * this.zoom + this.panY }; }

  resize(w: number, h: number): void {
    this.panX += (w - this.width) / 2;
    this.panY += (h - this.height) / 2;
    this.width = w;
    this.height = h;
  }

  fitRect(x: number, y: number, w: number, h: number, margin = 40): void {
    const vw = this.width - Viewport.insetRight;
    const z = Math.min((vw - margin * 2) / Math.max(1e-6, w), (this.height - margin * 2) / Math.max(1e-6, h));
    this.zoom = clamp(Number.isFinite(z) && z > 0 ? z : 1, Viewport.MIN, Viewport.MAX);
    this.panX = Math.round((vw - w * this.zoom) / 2 - x * this.zoom);
    this.panY = Math.round((this.height - h * this.zoom) / 2 - y * this.zoom);
    this.fitted = true;
  }

  zoomAt(z: number, sx: number, sy: number): void {
    const p = this.toDoc(sx, sy);
    this.zoom = clamp(z, Viewport.MIN, Viewport.MAX);
    this.panX = sx - p.x * this.zoom;
    this.panY = sy - p.y * this.zoom;
    this.fitted = false;
  }

  panBy(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
    this.fitted = false;
  }
}

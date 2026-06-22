import { clamp } from '../util/math.js';

/**
 * Viewport owns the single source of truth for the camera: a uniform scale
 * plus a screen-space translation. It maps between screen and world space and
 * applies the transform to the world layer.
 *
 *   screen = world * scale + translate
 *   world  = (screen - translate) / scale
 *
 * The transform is written as `translate(...) scale(...)` with a `0 0`
 * transform-origin so this math matches the rendered result exactly.
 */
export class Viewport {
  constructor(worldEl, { minScale = 0.02, maxScale = 80, scale = 1 } = {}) {
    this.worldEl = worldEl;
    this.minScale = minScale;
    this.maxScale = maxScale;
    this.scale = scale;
    this.tx = 0;
    this.ty = 0;
    this._listeners = new Set();
  }

  /** Subscribe to viewport changes. Returns an unsubscribe function. */
  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  apply() {
    this.worldEl.style.transform =
      `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
    for (const fn of this._listeners) fn(this);
  }

  screenToWorld(point) {
    return {
      x: (point.x - this.tx) / this.scale,
      y: (point.y - this.ty) / this.scale,
    };
  }

  worldToScreen(point) {
    return {
      x: point.x * this.scale + this.tx,
      y: point.y * this.scale + this.ty,
    };
  }

  /** Move the camera by a screen-space delta. */
  panBy(dx, dy) {
    this.tx += dx;
    this.ty += dy;
    this.apply();
  }

  /** Zoom by `factor` while keeping the world point under `anchor` fixed. */
  zoomAt(anchor, factor) {
    const next = clamp(this.scale * factor, this.minScale, this.maxScale);
    const applied = next / this.scale;
    if (applied === 1) return;

    this.tx = anchor.x - (anchor.x - this.tx) * applied;
    this.ty = anchor.y - (anchor.y - this.ty) * applied;
    this.scale = next;
    this.apply();
  }
}

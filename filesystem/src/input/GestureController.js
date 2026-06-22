import { distance, midpoint } from '../util/math.js';

/**
 * GestureController turns raw pointer + wheel events on the surface into
 * viewport pan/zoom. It deliberately implements pinch from scratch (using the
 * Pointer Events model) rather than relying on the browser's touch gestures,
 * so the behavior is identical across mouse, trackpad and touch and is easy to
 * tune or replace.
 *
 *   - 1 pointer  -> pan
 *   - 2 pointers -> pinch zoom about the midpoint, plus pan by midpoint drift
 *   - wheel      -> zoom about the cursor (ctrl/trackpad-pinch zooms finer)
 *
 * Elements marked with `data-gesture-ignore` (e.g. the add button) are skipped
 * so their own handlers stay in control.
 */
export class GestureController {
  constructor(surfaceEl, viewport, { wheelZoomSpeed = 0.0015 } = {}) {
    this.surface = surfaceEl;
    this.viewport = viewport;
    this.wheelZoomSpeed = wheelZoomSpeed;

    /** @type {Map<number, {x:number, y:number}>} */
    this.pointers = new Map();
    this._baseline = null; // {x,y} for pan, or {dist,mid} for pinch

    this._bind();
  }

  _bind() {
    const s = this.surface;
    s.addEventListener('pointerdown', this._onDown);
    s.addEventListener('pointermove', this._onMove);
    s.addEventListener('pointerup', this._onUp);
    s.addEventListener('pointercancel', this._onUp);
    s.addEventListener('wheel', this._onWheel, { passive: false });
    s.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _onDown = (e) => {
    if (e.target.closest('[data-gesture-ignore]')) return;
    this.surface.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this._resetBaseline();
  };

  _onMove = (e) => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pts = [...this.pointers.values()];

    if (pts.length === 1 && this._baseline) {
      const p = pts[0];
      this.viewport.panBy(p.x - this._baseline.x, p.y - this._baseline.y);
      this._baseline = { x: p.x, y: p.y };
    } else if (pts.length >= 2 && this._baseline?.dist) {
      const [a, b] = pts;
      const mid = midpoint(a, b);
      const dist = distance(a, b);
      this.viewport.panBy(mid.x - this._baseline.mid.x, mid.y - this._baseline.mid.y);
      this.viewport.zoomAt(mid, dist / this._baseline.dist);
      this._baseline = { dist, mid };
    }
  };

  _onUp = (e) => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.surface.hasPointerCapture?.(e.pointerId)) {
      this.surface.releasePointerCapture(e.pointerId);
    }
    this._resetBaseline();
  };

  // Re-seed the gesture baseline whenever the pointer count changes, so adding
  // or lifting a finger never produces a sudden jump.
  _resetBaseline() {
    const pts = [...this.pointers.values()];
    if (pts.length === 1) {
      this._baseline = { x: pts[0].x, y: pts[0].y };
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      this._baseline = { dist: distance(a, b), mid: midpoint(a, b) };
    } else {
      this._baseline = null;
    }
  }

  _onWheel = (e) => {
    e.preventDefault();
    const anchor = { x: e.clientX, y: e.clientY };
    const factor = Math.exp(-e.deltaY * this.wheelZoomSpeed * (e.ctrlKey ? 2 : 1));
    this.viewport.zoomAt(anchor, factor);
  };
}

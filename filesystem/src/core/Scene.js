import { IconItem } from './Item.js';

/**
 * Scene is the model + view registry for everything that lives in world space.
 * It owns the list of items and their DOM, but knows nothing about input or the
 * camera — callers pass already-resolved world coordinates and sizes.
 */
export class Scene {
  constructor(worldEl) {
    this.worldEl = worldEl;
    this.items = [];
  }

  /** Add a square centered on `worldPoint` with edge length `worldSize`. */
  addIcon(worldPoint, worldSize) {
    const item = new IconItem({
      x: worldPoint.x,
      y: worldPoint.y,
      size: worldSize,
    });
    this.items.push(item);
    this.worldEl.append(item.el);
    return item;
  }

  clear() {
    for (const item of this.items) item.el.remove();
    this.items = [];
  }
}

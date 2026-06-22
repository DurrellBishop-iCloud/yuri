import { el } from '../util/dom.js';

let nextId = 1;

/**
 * An IconItem is a single square placed in world space. Position (`x`, `y`) is
 * the item's center and `size` is its edge length, both in world units. Because
 * it lives inside the scaled world layer, its on-screen size follows the zoom.
 *
 * This is intentionally minimal: future item types (folders, files, groups)
 * can extend or compose this without touching the viewport or input layers.
 */
export class IconItem {
  constructor({ x, y, size, type = 'icon' }) {
    this.id = `item-${nextId++}`;
    this.x = x;
    this.y = y;
    this.size = size;
    this.type = type;
    this.el = el('div', { class: 'icon', dataset: { id: this.id, type } });
    this.layout();
  }

  layout() {
    const { style } = this.el;
    style.width = `${this.size}px`;
    style.height = `${this.size}px`;
    style.left = `${this.x - this.size / 2}px`;
    style.top = `${this.y - this.size / 2}px`;
  }
}

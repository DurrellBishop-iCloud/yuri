/**
 * Grid renders the background reference grid by driving the surface element's
 * CSS background to follow the viewport. The grid is anchored in world space,
 * so its cells grow and shrink with the zoom, giving a sense of scale.
 */
export class Grid {
  constructor(surfaceEl, viewport, { cellSize = 80 } = {}) {
    this.surface = surfaceEl;
    this.viewport = viewport;
    this.cellSize = cellSize;
    viewport.onChange(() => this.update());
  }

  update() {
    const { scale, tx, ty } = this.viewport;
    const size = this.cellSize * scale;
    this.surface.style.backgroundSize = `${size}px ${size}px`;
    this.surface.style.backgroundPosition = `${tx}px ${ty}px`;
  }
}

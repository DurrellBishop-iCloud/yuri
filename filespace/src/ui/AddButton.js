import { el } from '../util/dom.js';

/**
 * AddButton is the single creation affordance for stage one.
 *
 *   - A tap (press + release without dragging) drops an icon at screen center.
 *   - A press-and-drag shows a ghost icon floating just above the finger so the
 *     placement target is never hidden, and drops the icon there on release.
 *
 * Newly created icons always appear at a fixed on-screen size (`iconScreenSize`)
 * regardless of the current zoom. We achieve this by converting that screen
 * size into world units at creation time (`size / scale`); from then on the
 * icon lives in world space and scales naturally with the viewport.
 */
export class AddButton {
  constructor({
    viewport,
    scene,
    iconScreenSize = 72,
    dragThreshold = 6,
    ghostOffset = 64,
  }) {
    this.viewport = viewport;
    this.scene = scene;
    this.iconScreenSize = iconScreenSize;
    this.dragThreshold = dragThreshold;
    this.ghostOffset = ghostOffset;

    this.start = null;
    this.dragging = false;

    this.ghost = el('div', { class: 'ghost', dataset: { gestureIgnore: '' } });
    this.el = el(
      'button',
      {
        class: 'add-button',
        type: 'button',
        'aria-label': 'Add icon',
        dataset: { gestureIgnore: '' },
      },
      '+',
    );

    this.el.addEventListener('pointerdown', this._onDown);
    this.el.addEventListener('pointermove', this._onMove);
    this.el.addEventListener('pointerup', this._onUp);
    this.el.addEventListener('pointercancel', this._onCancel);

    // The ghost is sized once to match a freshly created icon on screen.
    this.ghost.style.width = `${iconScreenSize}px`;
    this.ghost.style.height = `${iconScreenSize}px`;
  }

  mount(parent) {
    parent.append(this.ghost, this.el);
  }

  _onDown = (e) => {
    e.preventDefault();
    this.el.setPointerCapture(e.pointerId);
    this.start = { x: e.clientX, y: e.clientY };
    this.dragging = false;
  };

  _onMove = (e) => {
    if (!this.start) return;
    const moved = Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y);

    if (!this.dragging && moved > this.dragThreshold) {
      this.dragging = true;
      this.ghost.classList.add('is-visible');
    }
    if (this.dragging) this._moveGhost(e.clientX, e.clientY);
  };

  _onUp = (e) => {
    if (!this.start) return;
    const target = this.dragging
      ? { x: e.clientX, y: e.clientY - this.ghostOffset }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this._place(target);
    this._reset();
  };

  _onCancel = () => this._reset();

  _moveGhost(x, y) {
    const half = this.iconScreenSize / 2;
    this.ghost.style.left = `${x - half}px`;
    this.ghost.style.top = `${y - this.ghostOffset - half}px`;
  }

  _place(screenPoint) {
    const worldPoint = this.viewport.screenToWorld(screenPoint);
    const worldSize = this.iconScreenSize / this.viewport.scale;
    this.scene.addIcon(worldPoint, worldSize);
  }

  _reset() {
    this.start = null;
    this.dragging = false;
    this.ghost.classList.remove('is-visible');
  }
}

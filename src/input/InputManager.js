export class InputManager {
  constructor(target) {
    this.target = target;
    this.keys = new Set();
    this.state = {
      boost: 0,
      speedMultiplier: 1,
    };

    target.addEventListener('keydown', (event) => this.keys.add(event.code));
    target.addEventListener('keyup', (event) => this.keys.delete(event.code));
  }

  update() {
    this.state.boost = this.keys.has('Space') || this.keys.has('ArrowUp') ? 1 : 0;
    this.state.speedMultiplier = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 1.35 : 1;
  }
}

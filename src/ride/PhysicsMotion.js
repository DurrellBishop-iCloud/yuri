import { clamp, damp } from '../utils/math.js';

export class PhysicsMotion {
  constructor(track) {
    this.track = track;
    this.progress = 0;
    this.speed = 48;
    this.smoothedSpeed = this.speed;
    this.baseSpeed = 42;
    this.maxSpeed = 98;
    this.distance = 0;
    this.acceleration = 0;
    this.snapshot = {
      speed: 0,
      acceleration: 0,
      progress: 0,
      gradient: 0,
    };
  }

  update(dt, input, settings) {
    const speedScale = settings.speedScale * input.speedMultiplier;
    const gradient = this.track.getGradientAt(this.progress);
    const gravityDrive = clamp(-gradient * 62, -25, 44);
    const drag = this.speed * this.speed * 0.0038;
    const targetPull = (this.baseSpeed * speedScale - this.speed) * 0.46;
    const oldSpeed = this.speed;

    this.acceleration = gravityDrive + targetPull - drag + input.boost * 34;
    this.speed = clamp(this.speed + this.acceleration * dt, 16, this.maxSpeed * speedScale);
    this.smoothedSpeed = damp(this.smoothedSpeed, this.speed, 4.8, dt);

    const loopLength = this.track.curve.getLength();
    this.distance = (this.distance + this.smoothedSpeed * dt) % loopLength;
    this.progress = this.distance / loopLength;

    this.snapshot.speed = this.smoothedSpeed;
    this.snapshot.acceleration = (this.speed - oldSpeed) / Math.max(dt, 0.0001);
    this.snapshot.progress = this.progress;
    this.snapshot.gradient = gradient;
  }
}

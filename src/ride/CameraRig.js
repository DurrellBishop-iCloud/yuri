import {
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { clamp, damp } from '../utils/math.js';

export class CameraRig {
  constructor(camera, track, motion) {
    this.camera = camera;
    this.track = track;
    this.motion = motion;
    this.position = new Vector3();
    this.velocityLag = new Vector3();
    this.lookTarget = new Vector3();
    this.targetPosition = new Vector3();
    this.curveAxis = new Vector3();
    this.frame = {
      position: new Vector3(),
      tangent: new Vector3(),
      normal: new Vector3(),
      binormal: new Vector3(),
    };
    this.lookFrame = {
      position: new Vector3(),
      tangent: new Vector3(),
      normal: new Vector3(),
      binormal: new Vector3(),
    };
    this.basis = new Matrix4();
    this.baseRotation = new Quaternion();
    this.secondaryRotation = new Quaternion();
    this.rollPitchYaw = new Euler(0, 0, 0, 'YXZ');
    this.roll = 0;
    this.pitchLag = 0;
    this.yawLag = 0;
    this.shakeTime = 0;
  }

  update(dt, settings) {
    const progress = this.motion.progress;
    const rigSpeed = settings.paused ? 0 : this.motion.smoothedSpeed;
    const speed01 = clamp((rigSpeed - 20) / 80, 0, 1);
    const lookAhead = 0.012 + speed01 * 0.018;
    const cameraHeight = 1.65;

    this.track.getFrameAt(progress, this.frame);
    this.track.getFrameAt(progress + lookAhead, this.lookFrame);

    const targetPosition = this.targetPosition
      .copy(this.frame.position)
      .addScaledVector(this.frame.normal, cameraHeight)
      .addScaledVector(this.frame.tangent, 2.4);

    const curveYaw = this.curveAxis.crossVectors(this.frame.tangent, this.lookFrame.tangent).y;
    const targetRoll = clamp(-curveYaw * 4.1, -0.82, 0.82);
    const targetPitch = clamp(-this.motion.snapshot.gradient * 0.55, -0.42, 0.38);
    const targetYaw = clamp(curveYaw * 1.25, -0.24, 0.24);

    this.roll = damp(this.roll, targetRoll, 5.8, dt);
    this.pitchLag = damp(this.pitchLag, targetPitch, 3.4, dt);
    this.yawLag = damp(this.yawLag, targetYaw, 3.6, dt);

    this.velocityLag.lerp(this.frame.tangent, 1 - Math.exp(-2.7 * dt));
    const lagAmount = clamp(this.motion.snapshot.acceleration * -0.025, -1.15, 1.35);
    targetPosition.addScaledVector(this.frame.tangent, lagAmount);

    this.shakeTime += dt * (4.5 + speed01 * 15);
    const vibration = settings.vibration * speed01;
    targetPosition
      .addScaledVector(this.frame.binormal, Math.sin(this.shakeTime * 1.7) * vibration * 0.08)
      .addScaledVector(this.frame.normal, Math.sin(this.shakeTime * 2.3) * vibration * 0.055);

    this.position.lerp(targetPosition, 1 - Math.exp(-9.5 * dt));
    this.camera.position.copy(this.position);

    this.lookTarget
      .copy(this.lookFrame.position)
      .addScaledVector(this.lookFrame.normal, 1.2)
      .addScaledVector(this.lookFrame.tangent, 28 + speed01 * 20);
    this.camera.lookAt(this.lookTarget);
    this.baseRotation.copy(this.camera.quaternion);

    this.rollPitchYaw.set(this.pitchLag, this.yawLag, this.roll + Math.sin(this.shakeTime) * vibration * 0.006);
    this.secondaryRotation.setFromEuler(this.rollPitchYaw);
    this.camera.quaternion.multiply(this.secondaryRotation);

    const targetFov = 76 + speed01 * 15 * settings.fovBoost;
    this.camera.fov = damp(this.camera.fov, targetFov, 4.2, dt);
    this.camera.updateProjectionMatrix();
  }
}

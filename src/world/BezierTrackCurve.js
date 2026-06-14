import { Vector3 } from 'three';
import { clamp } from '../utils/math.js';
import { sanitizeTrackDocument, vectorFromArray } from './TrackDocument.js';

const WORLD_UP = new Vector3(0, 1, 0);

export class BezierTrackCurve {
  constructor(document, samples = 900) {
    this.samples = samples;
    this.document = sanitizeTrackDocument(document);
    this.arcSamples = Math.max(samples, 900);
    this.arcLengths = [];
    this.length = 1;
    this.frames = {
      positions: [],
      tangents: [],
      normals: [],
      binormals: [],
    };
    this.setDocument(document);
  }

  setDocument(document) {
    this.document = sanitizeTrackDocument(document);
    this.rebuildArcTable();
    this.frames = this.buildFrames();
  }

  getLength() {
    return this.length;
  }

  getPointAt(progress) {
    return this.getRawPointAt(this.mapProgressToRaw(progress));
  }

  getTangentAt(progress) {
    return this.getRawTangentAt(this.mapProgressToRaw(progress));
  }

  getFrameAt(progress, target) {
    const wrapped = wrap01(progress);
    const scaled = wrapped * this.samples;
    const index = Math.floor(scaled);
    const nextIndex = (index + 1) % this.samples;
    const alpha = scaled - index;

    target.position.copy(this.frames.positions[index]).lerp(this.frames.positions[nextIndex], alpha);
    target.tangent.copy(this.frames.tangents[index]).lerp(this.frames.tangents[nextIndex], alpha).normalize();
    target.normal.copy(this.frames.normals[index]).lerp(this.frames.normals[nextIndex], alpha).normalize();
    target.binormal.copy(this.frames.binormals[index]).lerp(this.frames.binormals[nextIndex], alpha).normalize();
    return target;
  }

  getGradientAt(progress) {
    const wrapped = wrap01(progress);
    const index = Math.floor(wrapped * this.samples);
    return this.frames.tangents[index]?.y ?? 0;
  }

  getCurvatureAt(progress) {
    const ahead = this.getTangentAt(progress + 0.006);
    const behind = this.getTangentAt(progress - 0.006);
    return scratchCurvature.crossVectors(behind, ahead).y;
  }

  getRawPointAt(progress) {
    const { anchor, next, localT } = this.getSegment(progress);
    return cubicBezier(
      vectorFromArray(anchor.position),
      vectorFromArray(anchor.position).add(vectorFromArray(anchor.out)),
      vectorFromArray(next.position).add(vectorFromArray(next.in)),
      vectorFromArray(next.position),
      localT,
    );
  }

  getRawTangentAt(progress) {
    const { anchor, next, localT } = this.getSegment(progress);
    const tangent = cubicBezierDerivative(
      vectorFromArray(anchor.position),
      vectorFromArray(anchor.position).add(vectorFromArray(anchor.out)),
      vectorFromArray(next.position).add(vectorFromArray(next.in)),
      vectorFromArray(next.position),
      localT,
    );

    if (tangent.lengthSq() > 0.000001) {
      return tangent.normalize();
    }

    const fallback = this.getRawPointAt(progress + 0.0007).sub(this.getRawPointAt(progress - 0.0007));
    return fallback.lengthSq() > 0.000001 ? fallback.normalize() : new Vector3(0, 0, 1);
  }

  getSegment(progress) {
    const anchors = this.document.anchors;
    const count = anchors.length;
    const wrapped = wrap01(progress);
    const scaled = wrapped * count;
    const index = Math.floor(scaled) % count;

    return {
      index,
      anchor: anchors[index],
      next: anchors[(index + 1) % count],
      localT: scaled - index,
    };
  }

  rebuildArcTable() {
    this.arcLengths = [0];
    let previous = this.getRawPointAt(0);
    let length = 0;

    for (let index = 1; index <= this.arcSamples; index += 1) {
      const t = index / this.arcSamples;
      const current = this.getRawPointAt(t);
      length += current.distanceTo(previous);
      this.arcLengths.push(length);
      previous = current;
    }

    this.length = Math.max(length, 1);
  }

  buildFrames() {
    const positions = [];
    const tangents = [];
    const normals = [];
    const binormals = [];
    const previousTangent = this.getTangentAt(0).normalize();
    const transportNormal = getStableNormalForTangent(previousTangent);
    const rotationAxis = new Vector3();

    for (let index = 0; index <= this.samples; index += 1) {
      const t = index / this.samples;
      const position = this.getPointAt(t);
      const tangent = this.getTangentAt(t).normalize();

      if (index > 0) {
        rotationAxis.crossVectors(previousTangent, tangent);
        const axisLength = rotationAxis.length();
        if (axisLength > 0.000001) {
          const angle = Math.atan2(axisLength, clamp(previousTangent.dot(tangent), -1, 1));
          transportNormal.applyAxisAngle(rotationAxis.multiplyScalar(1 / axisLength), angle);
        }
      }

      orthogonalizeNormal(transportNormal, tangent);

      const curvatureBank = clamp(this.getCurvatureAt(t) * 1.7, -0.82, 0.82);
      const authoredBank = this.getInterpolatedBankAt(t);
      const authoredTwist = this.getTwistRollAt(t);
      const normal = transportNormal.clone().applyAxisAngle(tangent, curvatureBank + authoredBank + authoredTwist).normalize();

      const binormal = new Vector3().crossVectors(tangent, normal).normalize();

      positions.push(position);
      tangents.push(tangent.clone());
      normals.push(normal.clone());
      binormals.push(binormal.clone());

      previousTangent.copy(tangent);
    }

    return { positions, tangents, normals, binormals };
  }

  getInterpolatedBankAt(progress) {
    const { anchor, next, localT } = this.getSegment(this.mapProgressToRaw(progress));
    return anchor.bank + (next.bank - anchor.bank) * localT;
  }

  getTwistRollAt(progress) {
    let roll = 0;

    for (const twist of this.document.twists || []) {
      const halfLength = Math.max(0.001, twist.length * 0.5);
      const distance = Math.abs(shortestLoopDistance(progress, twist.center));
      if (distance > halfLength) {
        continue;
      }

      const normalizedDistance = distance / halfLength;
      const envelope = (1 + Math.cos(Math.PI * normalizedDistance)) * 0.5;
      roll += twist.roll * envelope;
    }

    return roll;
  }

  mapProgressToRaw(progress) {
    const distance = wrap01(progress) * this.length;
    let low = 0;
    let high = this.arcLengths.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.arcLengths[mid] < distance) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const index = clamp(low, 1, this.arcLengths.length - 1);
    const previousLength = this.arcLengths[index - 1];
    const nextLength = this.arcLengths[index];
    const span = Math.max(0.0001, nextLength - previousLength);
    const alpha = (distance - previousLength) / span;
    return (index - 1 + alpha) / this.arcSamples;
  }
}

function cubicBezier(p0, p1, p2, p3, t) {
  const inv = 1 - t;
  return p0
    .multiplyScalar(inv * inv * inv)
    .add(p1.multiplyScalar(3 * inv * inv * t))
    .add(p2.multiplyScalar(3 * inv * t * t))
    .add(p3.multiplyScalar(t * t * t));
}

function cubicBezierDerivative(p0, p1, p2, p3, t) {
  const inv = 1 - t;
  const d0 = p1.clone().sub(p0).multiplyScalar(3 * inv * inv);
  const d1 = p2.clone().sub(p1).multiplyScalar(6 * inv * t);
  const d2 = p3.clone().sub(p2).multiplyScalar(3 * t * t);
  return d0.add(d1).add(d2);
}

function wrap01(value) {
  return ((value % 1) + 1) % 1;
}

function getStableNormalForTangent(tangent) {
  const normal = WORLD_UP.clone().addScaledVector(tangent, -WORLD_UP.dot(tangent));
  if (normal.lengthSq() > 0.000001) {
    return normal.normalize();
  }

  return new Vector3(1, 0, 0).addScaledVector(tangent, -tangent.x).normalize();
}

function orthogonalizeNormal(normal, tangent) {
  normal.addScaledVector(tangent, -normal.dot(tangent));
  if (normal.lengthSq() > 0.000001) {
    normal.normalize();
    return;
  }

  normal.copy(getStableNormalForTangent(tangent));
}

function shortestLoopDistance(a, b) {
  let delta = wrap01(a) - wrap01(b);
  if (delta > 0.5) delta -= 1;
  if (delta < -0.5) delta += 1;
  return delta;
}

const scratchCurvature = new Vector3();

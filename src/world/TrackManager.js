import {
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import { TAU } from '../utils/math.js';
import { BezierTrackCurve } from './BezierTrackCurve.js';
import {
  createDefaultTrackDocument,
  loadTrackDocumentFromStorage,
  sanitizeTrackDocument,
} from './TrackDocument.js';

export class TrackManager {
  constructor(scene, terrain, options = {}) {
    this.scene = scene;
    this.terrain = terrain;
    this.group = new Group();
    this.samples = 900;
    this.document = sanitizeTrackDocument(
      options.trackDocument || loadTrackDocumentFromStorage() || createDefaultTrackDocument(),
    );
    this.curve = new BezierTrackCurve(this.document, this.samples);
    this.frames = this.curve.frames;
  }

  build() {
    this.createRails();
    this.createSleepers();
    this.createSupportColumns();
  }

  rebuildFromDocument(document) {
    this.document = sanitizeTrackDocument(document);
    this.curve.setDocument(this.document);
    this.frames = this.curve.frames;
    disposeObject(this.group);
    this.group.clear();
    this.build();
  }

  getFrameAt(t, target) {
    return this.curve.getFrameAt(t, target);
  }

  getCurvatureAt(t) {
    return this.curve.getCurvatureAt(t);
  }

  getGradientAt(t) {
    return this.curve.getGradientAt(t);
  }

  createRails() {
    const railMaterial = new MeshStandardMaterial({
      color: 0x2b3034,
      roughness: 0.44,
      metalness: 0.58,
    });
    const spineMaterial = new MeshStandardMaterial({
      color: 0x6b4632,
      roughness: 0.72,
      metalness: 0.06,
    });

    const railOffset = 2.05;
    const railRadius = 0.22;
    const railSegments = 420;
    const leftPoints = [];
    const rightPoints = [];
    const centerPoints = [];

    for (let i = 0; i <= railSegments; i += 1) {
      const t = i / railSegments;
      const frame = this.getFrameAt(t, TrackManager.frameScratch);
      const left = frame.position.clone().addScaledVector(frame.binormal, -railOffset).addScaledVector(frame.normal, -0.1);
      const right = frame.position.clone().addScaledVector(frame.binormal, railOffset).addScaledVector(frame.normal, -0.1);
      const center = frame.position.clone().addScaledVector(frame.normal, -1.15);
      leftPoints.push(left);
      rightPoints.push(right);
      centerPoints.push(center);
    }

    const leftRail = new Mesh(
      new TubeGeometry(new CatmullRomCurve3(leftPoints, true), railSegments, railRadius, 8, true),
      railMaterial,
    );
    const rightRail = new Mesh(
      new TubeGeometry(new CatmullRomCurve3(rightPoints, true), railSegments, railRadius, 8, true),
      railMaterial,
    );
    const centerSpine = new Mesh(
      new TubeGeometry(new CatmullRomCurve3(centerPoints, true), railSegments, 0.16, 6, true),
      spineMaterial,
    );

    for (const rail of [leftRail, rightRail, centerSpine]) {
      rail.castShadow = true;
      rail.receiveShadow = true;
      this.group.add(rail);
    }
  }

  createSleepers() {
    const sleeperCount = 175;
    const material = new MeshStandardMaterial({
      color: 0x493424,
      roughness: 0.88,
      metalness: 0,
    });
    const geometry = new BoxGeometry(5.4, 0.32, 0.72);
    const mesh = new InstancedMesh(geometry, material, sleeperCount);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const matrix = new Matrix4();
    const scale = new Vector3(1, 1, 1);

    for (let i = 0; i < sleeperCount; i += 1) {
      const t = i / sleeperCount;
      const frame = this.getFrameAt(t, TrackManager.frameScratch);
      const position = frame.position.clone().addScaledVector(frame.normal, -0.9);
      matrix.makeBasis(frame.binormal, frame.normal, frame.tangent);
      matrix.setPosition(position);
      matrix.scale(scale);
      mesh.setMatrixAt(i, matrix);
    }

    this.group.add(mesh);
  }

  createSupportColumns() {
    const supportCount = 72;
    const material = new MeshStandardMaterial({
      color: new Color(0x485050),
      roughness: 0.58,
      metalness: 0.28,
    });
    const geometry = new CylinderGeometry(0.32, 0.46, 1, 8, 1);
    const mesh = new InstancedMesh(geometry, material, supportCount);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const matrix = new Matrix4();
    let placed = 0;

    for (let i = 0; i < supportCount; i += 1) {
      const t = (i / supportCount + 0.006 * Math.sin(i * TAU * 0.17)) % 1;
      const frame = this.getFrameAt(t, TrackManager.frameScratch);
      const top = frame.position.clone().addScaledVector(frame.normal, -1.8);
      const groundY = this.terrain.getHeightAt(top.x, top.z);
      const height = Math.max(2, top.y - groundY);
      const center = top.clone();
      center.y = groundY + height * 0.5;

      matrix.makeScale(1, height, 1);
      matrix.setPosition(center);
      mesh.setMatrixAt(placed, matrix);
      placed += 1;
    }

    mesh.count = placed;
    this.group.add(mesh);
  }

  setVisible(visible) {
    this.group.visible = visible;
  }
}

TrackManager.frameScratch = {
  position: new Vector3(),
  tangent: new Vector3(),
  normal: new Vector3(),
  binormal: new Vector3(),
};

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }

    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}

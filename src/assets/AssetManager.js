import {
  ConeGeometry,
  DodecahedronGeometry,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { TAU, hash2, signedNoise, valueNoise } from '../utils/math.js';
import { RobotCrowdManager } from './RobotCrowdManager.js';

export class AssetManager {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.group = new Group();
    this.robotCrowd = new RobotCrowdManager(terrain);
  }

  populate() {
    this.createRockFields();
    this.createTreeBands();
    this.createMarkerArches();
    this.group.add(this.robotCrowd.group);
    this.robotCrowd.load().catch((error) => {
      console.error('Robot crowd failed to load.', error);
    });
  }

  update(dt) {
    this.robotCrowd.update(dt);
  }

  createRockFields() {
    const count = 520;
    const geometry = new DodecahedronGeometry(1, 1);
    const material = new MeshStandardMaterial({
      color: 0x77796f,
      roughness: 0.94,
      metalness: 0.02,
    });
    const rocks = new InstancedMesh(geometry, material, count);
    rocks.castShadow = true;
    rocks.receiveShadow = true;

    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const euler = new Euler();
    const scale = new Vector3();
    let placed = 0;

    for (let i = 0; i < count * 2 && placed < count; i += 1) {
      const x = (hash2(i, 2) - 0.5) * 780;
      const z = (hash2(i, 7) - 0.5) * 780;
      const distanceFromCenter = Math.hypot(x, z);
      const cluster = valueNoise(x * 0.017, z * 0.017);
      if (distanceFromCenter < 70 || cluster < 0.42) {
        continue;
      }

      const y = this.terrain.getHeightAt(x, z);
      const size = 0.8 + hash2(i, 11) * 3.8;
      euler.set(
        signedNoise(i * 0.1, 2) * 0.45,
        hash2(i, 13) * TAU,
        signedNoise(i * 0.2, 9) * 0.45,
        'XYZ',
      );
      quaternion.setFromEuler(euler);
      scale.set(size * (0.8 + hash2(i, 20) * 0.7), size * (0.65 + hash2(i, 21) * 1.1), size);
      matrix.compose(new Vector3(x, y + size * 0.35, z), quaternion, scale);
      rocks.setMatrixAt(placed, matrix);
      placed += 1;
    }

    rocks.count = placed;
    this.group.add(rocks);
  }

  createTreeBands() {
    const count = 340;
    const trunkGeometry = new ConeGeometry(0.65, 6, 7);
    const canopyGeometry = new ConeGeometry(2.8, 8.4, 8);
    const trunkMaterial = new MeshStandardMaterial({
      color: 0x6b4a2e,
      roughness: 0.86,
      metalness: 0,
    });
    const canopyMaterial = new MeshStandardMaterial({
      color: 0x255c3a,
      roughness: 0.9,
      metalness: 0,
    });
    const trunks = new InstancedMesh(trunkGeometry, trunkMaterial, count);
    const canopies = new InstancedMesh(canopyGeometry, canopyMaterial, count);
    trunks.castShadow = true;
    canopies.castShadow = true;
    canopies.receiveShadow = true;

    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    let placed = 0;

    for (let i = 0; i < count * 3 && placed < count; i += 1) {
      const angle = hash2(i, 50) * TAU;
      const radius = 145 + hash2(i, 51) * 260;
      const x = Math.cos(angle) * radius + signedNoise(i * 0.02, 5) * 40;
      const z = Math.sin(angle) * radius + signedNoise(i * 0.03, 8) * 40;
      const glade = valueNoise(x * 0.011, z * 0.011);
      if (glade < 0.36) {
        continue;
      }

      const y = this.terrain.getHeightAt(x, z);
      const treeScale = 0.72 + hash2(i, 55) * 0.78;
      quaternion.setFromAxisAngle(new Vector3(0, 1, 0), hash2(i, 56) * TAU);

      scale.setScalar(treeScale);
      matrix.compose(new Vector3(x, y + 3 * treeScale, z), quaternion, scale);
      trunks.setMatrixAt(placed, matrix);

      scale.set(treeScale * 1.05, treeScale * (0.9 + hash2(i, 57) * 0.35), treeScale * 1.05);
      matrix.compose(new Vector3(x, y + 8.6 * treeScale, z), quaternion, scale);
      canopies.setMatrixAt(placed, matrix);
      placed += 1;
    }

    trunks.count = placed;
    canopies.count = placed;
    this.group.add(trunks, canopies);
  }

  createMarkerArches() {
    const geometry = new ConeGeometry(2.2, 16, 5);
    const material = new MeshStandardMaterial({
      color: 0xc19a4a,
      roughness: 0.74,
      metalness: 0.05,
    });
    const markers = new InstancedMesh(geometry, material, 22);
    markers.castShadow = true;

    const matrix = new Matrix4();
    const quaternion = new Quaternion();
    const scale = new Vector3(1, 1, 1);

    for (let i = 0; i < 22; i += 1) {
      const angle = (i / 22) * TAU;
      const radius = 210 + Math.sin(i * 1.7) * 70;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = this.terrain.getHeightAt(x, z);
      quaternion.setFromAxisAngle(new Vector3(0, 1, 0), angle);
      matrix.compose(new Vector3(x, y + 8, z), quaternion, scale);
      markers.setMatrixAt(i, matrix);
    }

    this.group.add(markers);
  }
}

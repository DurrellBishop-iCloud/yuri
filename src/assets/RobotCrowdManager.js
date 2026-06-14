import {
  Box3,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { TAU, hash2, signedNoise, valueNoise } from '../utils/math.js';
import { getAssetUrl } from '../utils/routes.js';

const CROWD_CLUSTERS = [
  { x: -28, z: 124, radius: 48 },
  { x: 82, z: 80, radius: 56 },
  { x: 136, z: -8, radius: 46 },
  { x: 84, z: -110, radius: 62 },
  { x: -50, z: -146, radius: 54 },
  { x: -130, z: -42, radius: 58 },
  { x: -108, z: 72, radius: 50 },
  { x: 198, z: 138, radius: 72 },
  { x: -210, z: 130, radius: 64 },
  { x: 230, z: -126, radius: 70 },
];

const ROBOT_TINTS = [
  0xf9f0d6,
  0xffd166,
  0xef476f,
  0x06d6a0,
  0x8fb2cf,
  0xf4a261,
  0xb8f3ff,
  0xd9ed92,
];

const UP = new Vector3(0, 1, 0);

export class RobotCrowdManager {
  constructor(terrain, options = {}) {
    this.terrain = terrain;
    this.modelUrl = options.modelUrl ?? getAssetUrl('models/Robot2-.1.obj');
    this.count = options.count ?? 360;
    this.group = new Group();
    this.group.name = 'RobotCrowd';
    this.people = [];
    this.matrices = [];
    this.instancedMeshes = [];
    this.ready = false;
    this.time = 0;
    this.position = new Vector3();
    this.scale = new Vector3();
    this.quaternion = new Quaternion();
    this.matrix = new Matrix4();
  }

  async load() {
    const loader = new OBJLoader();
    const object = await loader.loadAsync(this.modelUrl);
    object.updateWorldMatrix(true, true);

    const bounds = new Box3().setFromObject(object);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const normalizedHeight = 5.3;
    const normalizationScale = normalizedHeight / Math.max(size.y, 0.001);

    this.createPeople();

    object.traverse((child) => {
      if (!child.isMesh || !child.geometry?.attributes?.position) {
        return;
      }

      child.updateWorldMatrix(true, false);
      const geometry = child.geometry.clone();
      geometry.applyMatrix4(child.matrixWorld);
      geometry.translate(-center.x, -bounds.min.y, -center.z);
      geometry.scale(normalizationScale, normalizationScale, normalizationScale);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const material = this.createMaterial(child.material);
      const mesh = new InstancedMesh(geometry, material, this.count);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.applyInstanceColors(mesh);
      this.instancedMeshes.push(mesh);
      this.group.add(mesh);
    });

    this.update(0);
    this.ready = true;
  }

  createPeople() {
    this.people.length = 0;
    this.matrices.length = 0;

    for (let i = 0; i < this.count; i += 1) {
      const cluster = CROWD_CLUSTERS[Math.floor(hash2(i, 91) * CROWD_CLUSTERS.length)];
      const angle = hash2(i, 92) * TAU;
      const clusterRadius = Math.sqrt(hash2(i, 93)) * cluster.radius;
      const anchorX = cluster.x + Math.cos(angle) * clusterRadius;
      const anchorZ = cluster.z + Math.sin(angle) * clusterRadius;
      const walkRadius = 2.5 + hash2(i, 94) * 9.5;
      const baseScale = 0.55 + hash2(i, 95) * 0.62;

      this.people.push({
        anchorX,
        anchorZ,
        walkRadius,
        angle: hash2(i, 96) * TAU,
        speed: 0.25 + hash2(i, 97) * 0.78,
        direction: hash2(i, 98) > 0.5 ? 1 : -1,
        phase: hash2(i, 99) * TAU,
        lean: signedNoise(i * 0.13, 101) * 0.18,
        baseScale,
        scaleX: baseScale * (0.72 + hash2(i, 102) * 0.62),
        scaleY: baseScale * (0.72 + hash2(i, 103) * 1.05),
        scaleZ: baseScale * (0.72 + hash2(i, 104) * 0.66),
        tint: new Color(ROBOT_TINTS[Math.floor(hash2(i, 105) * ROBOT_TINTS.length)]),
        wanderA: hash2(i, 106) * TAU,
        wanderB: hash2(i, 107) * TAU,
      });
      this.matrices.push(new Matrix4());
    }
  }

  createMaterial(sourceMaterial) {
    const materialName = Array.isArray(sourceMaterial)
      ? sourceMaterial[0]?.name
      : sourceMaterial?.name;
    const name = String(materialName ?? '').toLowerCase();

    let color = 0xf7f3e8;
    let roughness = 0.42;
    let metalness = 0.08;

    if (name.includes('yellow')) color = 0xffcf4d;
    if (name.includes('red')) color = 0xe94f57;
    if (name.includes('green')) color = 0x2fbf71;
    if (name.includes('black')) color = 0x15171a;
    if (name.includes('steel')) {
      color = 0xa5aaa8;
      roughness = 0.34;
      metalness = 0.48;
    }

    return new MeshStandardMaterial({
      color,
      roughness,
      metalness,
    });
  }

  update(dt) {
    if (!this.instancedMeshes.length) {
      return;
    }

    this.time += dt;

    for (let i = 0; i < this.people.length; i += 1) {
      const person = this.people[i];
      person.angle += dt * person.speed * person.direction;

      const walkX = Math.cos(person.angle) * person.walkRadius;
      const walkZ = Math.sin(person.angle) * person.walkRadius;
      const wanderX = Math.sin(this.time * 0.37 + person.wanderA) * 1.4;
      const wanderZ = Math.cos(this.time * 0.31 + person.wanderB) * 1.4;
      const x = person.anchorX + walkX + wanderX;
      const z = person.anchorZ + walkZ + wanderZ;
      const groundY = this.terrain.getHeightAt(x, z);
      const step = Math.sin(this.time * (3.2 + person.speed * 2.1) + person.phase);
      const bounce = Math.abs(step);
      const heading = person.angle + (person.direction > 0 ? Math.PI * 0.5 : -Math.PI * 0.5);
      const squash = 1 + step * 0.055;

      this.position.set(x, groundY + bounce * 0.22, z);
      this.quaternion.setFromAxisAngle(UP, -heading + person.lean * step);
      this.scale.set(
        person.scaleX * (1 - (squash - 1) * 0.45),
        person.scaleY * squash,
        person.scaleZ * (1 - (squash - 1) * 0.35),
      );
      this.matrices[i].compose(this.position, this.quaternion, this.scale);
    }

    for (const mesh of this.instancedMeshes) {
      for (let i = 0; i < this.matrices.length; i += 1) {
        mesh.setMatrixAt(i, this.matrices[i]);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  applyInstanceColors(mesh) {
    for (let i = 0; i < this.people.length; i += 1) {
      mesh.setColorAt(i, this.people[i].tint);
    }

    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }
}

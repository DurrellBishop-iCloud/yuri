import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { TAU, hash2, signedNoise, valueNoise } from '../utils/math.js';

const Y_AXIS = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);
const TORUS_ROTATION = new Quaternion().setFromAxisAngle(X_AXIS, Math.PI / 2);

const PALETTES = [
  [0xf7f0e5, 0x77706b, 0xffcf30, 0xf36b45, 0x88d6c8, 0xf3a7bd],
  [0xffffff, 0x706f73, 0xe6423a, 0xffdf59, 0xbfd9ef, 0xf9c9ca],
  [0xfff2d9, 0x858894, 0xe85f86, 0xf6a55f, 0x8ed8cf, 0x8b6b66],
  [0xf7f6ee, 0x737378, 0xf5d328, 0xf15f3b, 0xdbe9f7, 0xc4b9c5],
  [0xffefe3, 0x7d706d, 0xec7f2f, 0xdf436d, 0xaedfd7, 0xf3c7d1],
];

const SHAPE_SPECS = {
  cylinder: {
    geometry: () => new CylinderGeometry(1, 1, 1, 36, 1),
    capacity: 11,
  },
  softCylinder: {
    geometry: () => new CylinderGeometry(1, 1, 1, 48, 1),
    capacity: 7,
  },
  frustumUp: {
    geometry: () => new CylinderGeometry(0.58, 1, 1, 36, 1),
    capacity: 4,
  },
  frustumDown: {
    geometry: () => new CylinderGeometry(1, 0.58, 1, 36, 1),
    capacity: 4,
  },
  cone: {
    geometry: () => new ConeGeometry(1, 1, 36),
    capacity: 2,
  },
  sphere: {
    geometry: () => new SphereGeometry(1, 36, 18),
    capacity: 7,
  },
  torus: {
    geometry: () => new TorusGeometry(1, 0.18, 16, 44),
    capacity: 10,
  },
  box: {
    geometry: () => new BoxGeometry(1, 1, 1),
    capacity: 10,
  },
};

export class GeometricStackField {
  constructor(terrain, options = {}) {
    this.terrain = terrain;
    this.options = {
      count: 380,
      minRadius: 82,
      maxRadius: 410,
      clusterThreshold: 0.26,
      ...options,
    };
    this.group = new Group();
    this.group.name = 'Geometric stack field';

    this.batches = new Map();
    this.matrix = new Matrix4();
    this.position = new Vector3();
    this.quaternion = new Quaternion();
    this.scale = new Vector3();
  }

  build() {
    this.group.clear();
    this.createBatches();

    let placed = 0;
    const count = this.options.count;
    for (let i = 0; i < count * 4 && placed < count; i += 1) {
      const angle = hash2(i, 60) * TAU;
      const radius = this.options.minRadius + hash2(i, 61) * (this.options.maxRadius - this.options.minRadius);
      const x = Math.cos(angle) * radius + signedNoise(i * 0.023, 5) * 42;
      const z = Math.sin(angle) * radius + signedNoise(i * 0.031, 8) * 42;
      const glade = valueNoise(x * 0.011, z * 0.011);
      if (glade < this.options.clusterThreshold) {
        continue;
      }

      const groundY = this.terrain.getHeightAt(x, z);
      const yaw = hash2(i, 62) * TAU;
      const size = 1 + hash2(i, 63) * 1.25;
      this.buildStack(i, x, groundY, z, yaw, size);
      placed += 1;
    }

    this.finalizeBatches();
  }

  createBatches() {
    this.batches.clear();
  }

  finalizeBatches() {
    for (const batch of this.batches.values()) {
      batch.mesh.count = batch.index;
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  buildStack(seed, x, groundY, z, yaw, size) {
    const family = Math.floor(hash2(seed, 65) * 6);
    const palette = PALETTES[Math.floor(hash2(seed, 66) * PALETTES.length)];
    const oval = 0.72 + hash2(seed, 67) * 0.62;
    const vertical = 0.82 + hash2(seed, 68) * 0.62;

    if (family === 0) {
      this.buildPlateColumn(seed, x, groundY, z, yaw, size, oval, vertical, palette);
    } else if (family === 1) {
      this.buildBeadColumn(seed, x, groundY, z, yaw, size, oval, vertical, palette);
    } else if (family === 2) {
      this.buildGraphicCylinder(seed, x, groundY, z, yaw, size, oval, vertical, palette);
    } else if (family === 3) {
      this.buildHourglass(seed, x, groundY, z, yaw, size, oval, vertical, palette);
    } else if (family === 4) {
      this.buildLowBowlStack(seed, x, groundY, z, yaw, size, oval, vertical, palette);
    } else {
      this.buildSlenderTotem(seed, x, groundY, z, yaw, size, oval, vertical, palette);
    }
  }

  buildPlateColumn(seed, x, y, z, yaw, size, oval, vertical, palette) {
    let cursor = 0;
    cursor += this.addPiece('softCylinder', x, y, z, yaw, cursor, 1.7 * size, 0.8 * size, palette[0], oval);
    cursor += this.addPiece('torus', x, y, z, yaw, cursor - 0.08 * size, 2.05 * size, 0.38 * size, palette[5], oval);
    cursor += this.addPiece('cylinder', x, y, z, yaw, cursor, 0.82 * size, 4.8 * size * vertical, palette[0], oval);
    this.addHorizontalBands(x, y, z, yaw, cursor - 4.2 * size * vertical, 0.86 * size, 4.2 * size * vertical, size, palette[1], oval, 4);
    cursor += this.addPiece('sphere', x, y, z, yaw, cursor - 0.12 * size, 1.55 * size, 2.25 * size, palette[2], oval);
    cursor += this.addPiece('torus', x, y, z, yaw, cursor - 0.2 * size, 1.8 * size, 0.42 * size, palette[3], oval);
    cursor += this.addPiece('cylinder', x, y, z, yaw, cursor, 0.68 * size, 2.5 * size * vertical, palette[0], oval);
    this.addSideDot(x, y, z, yaw, cursor - 1.15 * size * vertical, 0.71 * size, 0.24 * size, palette[3]);
    cursor += this.addPiece('torus', x, y, z, yaw, cursor - 0.14 * size, 1.35 * size, 0.36 * size, palette[5], oval);
  }

  buildBeadColumn(seed, x, y, z, yaw, size, oval, vertical, palette) {
    let cursor = 0;
    const layers = 5 + Math.floor(hash2(seed, 70) * 4);
    cursor += this.addPiece('softCylinder', x, y, z, yaw, cursor, 1.25 * size, 0.6 * size, palette[0], oval);

    for (let i = 0; i < layers; i += 1) {
      const color = palette[(i + 2) % palette.length];
      const roll = hash2(seed + i, 71);
      if (roll < 0.34) {
        cursor += this.addPiece('sphere', x, y, z, yaw, cursor - 0.08 * size, (1.1 + hash2(seed + i, 72) * 0.95) * size, (1.15 + hash2(seed + i, 73) * 1.1) * size, color, oval);
      } else if (roll < 0.68) {
        cursor += this.addPiece('torus', x, y, z, yaw, cursor, (1.25 + hash2(seed + i, 74) * 0.8) * size, (0.34 + hash2(seed + i, 75) * 0.36) * size, color, oval);
      } else {
        cursor += this.addPiece('cylinder', x, y, z, yaw, cursor, (0.78 + hash2(seed + i, 76) * 0.48) * size, (1.0 + hash2(seed + i, 77) * 1.6) * size * vertical, color, oval);
      }

      if (hash2(seed + i, 78) > 0.56) {
        cursor += this.addPiece('cylinder', x, y, z, yaw, cursor, 0.62 * size, 0.35 * size, palette[0], oval);
      }
    }
  }

  buildGraphicCylinder(seed, x, y, z, yaw, size, oval, vertical, palette) {
    let cursor = 0;
    const bodyHeight = (8.4 + hash2(seed, 80) * 5.8) * size * vertical;
    const bodyRadius = (1.1 + hash2(seed, 81) * 0.65) * size;
    cursor += this.addPiece('cylinder', x, y, z, yaw, cursor, bodyRadius, bodyHeight, palette[0], oval);
    this.addHorizontalBands(x, y, z, yaw, 0.35 * size, bodyRadius * 1.01, bodyHeight - 0.7 * size, size, palette[1], oval, 8);
    this.addCheckerBand(x, y, z, yaw, bodyHeight * 0.46, bodyRadius * 1.04, bodyHeight * 0.24, size, palette[1], palette[0], oval);
    cursor += this.addPiece('torus', x, y, z, yaw, cursor - 0.06 * size, bodyRadius * 1.2, 0.36 * size, palette[3], oval);
    cursor += this.addPiece('cylinder', x, y, z, yaw, cursor, bodyRadius * 0.55, 1.35 * size, palette[0], oval);
    cursor += this.addPiece('torus', x, y, z, yaw, cursor - 0.1 * size, bodyRadius * 1.05, 0.32 * size, palette[3], oval);
  }

  buildHourglass(seed, x, y, z, yaw, size, oval, vertical, palette) {
    let cursor = 0;
    cursor += this.addPiece('torus', x, y, z, yaw, cursor, 1.6 * size, 0.42 * size, palette[0], oval);
    cursor += this.addPiece('frustumUp', x, y, z, yaw, cursor - 0.05 * size, 1.45 * size, 2.6 * size * vertical, palette[2], oval);
    cursor += this.addPiece('frustumDown', x, y, z, yaw, cursor - 0.1 * size, 1.45 * size, 2.6 * size * vertical, palette[2], oval);
    cursor += this.addPiece('torus', x, y, z, yaw, cursor - 0.25 * size, 1.9 * size, 0.45 * size, palette[5], oval);
    cursor += this.addPiece('sphere', x, y, z, yaw, cursor - 0.1 * size, 1.25 * size, 2.0 * size, palette[4], oval);
    cursor += this.addPiece('cylinder', x, y, z, yaw, cursor, 0.58 * size, 1.4 * size, palette[0], oval);
    this.addSideDot(x, y, z, yaw + TAU * 0.08, cursor - 0.7 * size, 0.6 * size, 0.22 * size, palette[3]);
  }

  buildLowBowlStack(seed, x, y, z, yaw, size, oval, vertical, palette) {
    let cursor = 0;
    const wide = (1.5 + hash2(seed, 90) * 1.2) * size;
    cursor += this.addPiece('frustumDown', x, y, z, yaw, cursor, wide, 1.2 * size, palette[0], oval * 1.18);
    cursor += this.addPiece('sphere', x, y, z, yaw, cursor - 0.35 * size, wide * 0.92, 1.35 * size, palette[4], oval * 1.08);
    cursor += this.addPiece('torus', x, y, z, yaw, cursor - 0.28 * size, wide * 1.08, 0.34 * size, palette[1], oval * 1.1);
    if (hash2(seed, 91) > 0.34) {
      cursor += this.addPiece('cylinder', x, y, z, yaw, cursor, wide * 0.45, 1.55 * size * vertical, palette[2], oval);
      cursor += this.addPiece('torus', x, y, z, yaw, cursor - 0.1 * size, wide * 0.72, 0.28 * size, palette[5], oval);
    }
  }

  buildSlenderTotem(seed, x, y, z, yaw, size, oval, vertical, palette) {
    let cursor = 0;
    cursor += this.addPiece('cylinder', x, y, z, yaw, cursor, 1.05 * size, 0.72 * size, palette[0], oval);
    cursor += this.addPiece('sphere', x, y, z, yaw, cursor - 0.05 * size, 0.95 * size, 2.55 * size * vertical, palette[5], oval * 0.75);
    cursor += this.addPiece('torus', x, y, z, yaw, cursor - 0.14 * size, 1.25 * size, 0.34 * size, palette[2], oval);
    cursor += this.addPiece('cylinder', x, y, z, yaw, cursor, 0.54 * size, 2.3 * size * vertical, palette[3], oval);
    cursor += this.addPiece('sphere', x, y, z, yaw, cursor - 0.08 * size, 0.8 * size, 1.85 * size, palette[4], oval * 0.82);
    cursor += this.addPiece('torus', x, y, z, yaw, cursor - 0.1 * size, 1.1 * size, 0.28 * size, palette[0], oval);
    if (hash2(seed, 100) > 0.54) {
      cursor += this.addPiece('cone', x, y, z, yaw, cursor - 0.05 * size, 0.78 * size, 1.45 * size, palette[3], oval);
    }
  }

  addPiece(kind, x, baseY, z, yaw, bottom, radius, height, color, radiusZScale = 1) {
    const batch = this.getBatch(kind, color);
    if (!batch || batch.index >= batch.mesh.instanceMatrix.count) {
      return height;
    }

    const radiusZ = radius * radiusZScale;
    this.position.set(x, baseY + bottom + height * 0.5, z);

    if (kind === 'sphere') {
      this.scale.set(radius, height * 0.5, radiusZ);
      this.quaternion.setFromAxisAngle(Y_AXIS, yaw);
    } else if (kind === 'torus') {
      this.scale.set(radius / 1.18, radiusZ / 1.18, Math.max(0.06, height / 0.36));
      this.quaternion.setFromAxisAngle(Y_AXIS, yaw).multiply(TORUS_ROTATION);
    } else {
      this.scale.set(radius, height, radiusZ);
      this.quaternion.setFromAxisAngle(Y_AXIS, yaw);
    }

    this.addInstance(batch);
    return height;
  }

  addHorizontalBands(x, baseY, z, yaw, bottom, radius, height, size, color, oval, bands) {
    for (let i = 0; i < bands; i += 1) {
      const bandY = bottom + ((i + 0.5) / bands) * height;
      this.addPiece('cylinder', x, baseY, z, yaw, bandY, radius, 0.12 * size, color, oval);
    }
  }

  addCheckerBand(x, baseY, z, yaw, bottom, radius, height, size, dark, light, oval) {
    const rows = 2;
    const columns = 10;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if ((row + column) % 2 !== 0) {
          continue;
        }
        const angle = yaw + (column / columns) * TAU;
        const radialX = Math.sin(angle);
        const radialZ = Math.cos(angle);
        const panelY = baseY + bottom + ((row + 0.5) / rows) * height;
        const panelWidth = Math.max(0.32 * size, (radius * TAU) / columns * 0.7);
        const panelHeight = height / rows * 0.64;
        this.position.set(
          x + radialX * radius,
          panelY,
          z + radialZ * radius * oval,
        );
        this.scale.set(panelWidth, panelHeight, 0.08 * size);
        this.quaternion.setFromAxisAngle(Y_AXIS, angle);
        this.addInstance(this.getBatch('box', row === 0 ? dark : light));
      }
    }
  }

  addSideDot(x, baseY, z, yaw, centerY, radius, dotRadius, color) {
    const angle = yaw;
    const radialX = Math.sin(angle);
    const radialZ = Math.cos(angle);
    this.position.set(
      x + radialX * radius,
      baseY + centerY,
      z + radialZ * radius,
    );
    this.scale.set(dotRadius, dotRadius, 0.07);
    this.quaternion.setFromAxisAngle(Y_AXIS, angle);
    this.addInstance(this.getBatch('sphere', color));
  }

  getBatch(kind, color) {
    const key = `${kind}:${color.toString(16)}`;
    if (this.batches.has(key)) {
      return this.batches.get(key);
    }

    const spec = SHAPE_SPECS[kind];
    if (!spec) {
      return null;
    }

    const material = new MeshBasicMaterial({
      color,
      toneMapped: false,
    });
    const mesh = new InstancedMesh(
      spec.geometry(),
      material,
      Math.ceil(this.options.count * spec.capacity),
    );
    mesh.name = `Stack ${kind} ${color.toString(16)}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.count = 0;
    const batch = { mesh, index: 0 };
    this.batches.set(key, batch);
    this.group.add(mesh);
    return batch;
  }

  addInstance(batch) {
    if (!batch || batch.index >= batch.mesh.instanceMatrix.count) {
      return;
    }

    this.matrix.compose(this.position, this.quaternion, this.scale);
    batch.mesh.setMatrixAt(batch.index, this.matrix);
    batch.index += 1;
  }
}

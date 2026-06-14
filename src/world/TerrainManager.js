import {
  BufferAttribute,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { signedNoise, smoothstep, valueNoise } from '../utils/math.js';

export class TerrainManager {
  constructor() {
    this.group = new Group();
    this.size = 880;
    this.segments = 176;
    this.texture = this.createTerrainTexture();
    this.colorGrass = new Color(0x4f8d45);
    this.colorDryGrass = new Color(0xa4a45b);
    this.colorDirt = new Color(0x8a6742);
    this.colorStone = new Color(0x7c8275);
  }

  build() {
    const geometry = new PlaneGeometry(this.size, this.size, this.segments, this.segments);
    geometry.rotateX(-Math.PI / 2);

    const position = geometry.attributes.position;
    const colors = [];

    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const height = this.getHeightAt(x, z);
      position.setY(i, height);

      const zone = this.getSurfaceAt(x, z, height);
      colors.push(zone.r, zone.g, zone.b);
    }

    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
    geometry.computeVertexNormals();

    const material = new MeshStandardMaterial({
      map: this.texture,
      vertexColors: true,
      roughness: 0.92,
      metalness: 0,
    });

    this.mesh = new Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
  }

  getHeightAt(x, z) {
    const broad = Math.sin(x * 0.009) * 10 + Math.cos(z * 0.008) * 12;
    const ridges = Math.sin((x + z) * 0.018) * 4;
    const rolling = signedNoise(x * 0.018, z * 0.018) * 16;
    const detail = signedNoise(x * 0.055 + 80, z * 0.055 - 20) * 3;
    const valley = smoothstep(80, 360, Math.hypot(x * 0.75, z * 0.9)) * 7;
    return broad + rolling + ridges + detail - valley;
  }

  getSurfaceAt(x, z, height = this.getHeightAt(x, z)) {
    const moisture = valueNoise(x * 0.018 + 40, z * 0.018 - 15);
    const scrub = valueNoise(x * 0.045 - 10, z * 0.045 + 90);
    const slopeStone = smoothstep(12, 27, Math.abs(height));

    if (slopeStone > 0.62 && scrub > 0.42) {
      return this.colorStone;
    }

    if (moisture < 0.28 || scrub > 0.78) {
      return this.colorDirt;
    }

    return moisture > 0.62 ? this.colorGrass : this.colorDryGrass;
  }

  createTerrainTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    const image = context.createImageData(canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const i = (y * canvas.width + x) * 4;
        const grain = 210 + Math.floor(valueNoise(x * 0.2, y * 0.2) * 45);
        image.data[i] = grain;
        image.data[i + 1] = grain;
        image.data[i + 2] = grain;
        image.data[i + 3] = 255;
      }
    }

    context.putImageData(image, 0, 0);
    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(42, 42);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }
}

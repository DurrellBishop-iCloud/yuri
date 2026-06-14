export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function smoothstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

export function fract(value) {
  return value - Math.floor(value);
}

export function hash2(x, z) {
  return fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453123);
}

export function valueNoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smoothstep(0, 1, x - ix);
  const fz = smoothstep(0, 1, z - iz);

  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);

  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}

export function signedNoise(x, z) {
  return valueNoise(x, z) * 2 - 1;
}

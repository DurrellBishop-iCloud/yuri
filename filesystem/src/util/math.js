// Small, dependency-free math helpers shared across modules.

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const lerp = (a, b, t) => a + (b - a) * t;

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const midpoint = (a, b) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

import { Vector3 } from 'three';

export const TRACK_STORAGE_KEY = 'yuriCoast.trackDocument.v1';

const DEFAULT_TRACK_POINTS = [
  [0, 42, 150],
  [76, 54, 112],
  [138, 28, 24],
  [108, 18, -80],
  [34, 72, -156],
  [-72, 96, -132],
  [-142, 24, -54],
  [-116, 12, 50],
  [-42, 30, 96],
];

export function createDefaultTrackDocument() {
  const anchors = DEFAULT_TRACK_POINTS.map(([x, y, z], index) => ({
    id: `p${String(index + 1).padStart(2, '0')}`,
    position: [x, y, z],
    in: [0, 0, 0],
    out: [0, 0, 0],
    bank: 0,
    speed: 1,
  }));

  applyAutoHandles(anchors, 0.18);

  return {
    version: 1,
    name: 'Yuri Coast author track',
    closed: true,
    units: 'meters',
    anchors,
  };
}

export function cloneTrackDocument(document) {
  return {
    ...document,
    anchors: document.anchors.map((anchor) => ({
      ...anchor,
      position: [...anchor.position],
      in: [...anchor.in],
      out: [...anchor.out],
    })),
  };
}

export function sanitizeTrackDocument(input) {
  if (!input || !Array.isArray(input.anchors) || input.anchors.length < 3) {
    return createDefaultTrackDocument();
  }

  const anchors = input.anchors.map((anchor, index) => {
    const fallback = DEFAULT_TRACK_POINTS[index % DEFAULT_TRACK_POINTS.length];
    return {
      id: String(anchor.id || `p${String(index + 1).padStart(2, '0')}`),
      position: sanitizeVector(anchor.position, fallback),
      in: sanitizeVector(anchor.in, [0, 0, 0]),
      out: sanitizeVector(anchor.out, [0, 0, 0]),
      bank: Number.isFinite(anchor.bank) ? anchor.bank : 0,
      speed: Number.isFinite(anchor.speed) ? anchor.speed : 1,
    };
  });

  return {
    version: 1,
    name: String(input.name || 'Yuri Coast author track'),
    closed: input.closed !== false,
    units: 'meters',
    anchors,
  };
}

export function loadTrackDocumentFromStorage() {
  try {
    const raw = localStorage.getItem(TRACK_STORAGE_KEY);
    return raw ? sanitizeTrackDocument(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveTrackDocumentToStorage(document) {
  try {
    localStorage.setItem(TRACK_STORAGE_KEY, JSON.stringify(sanitizeTrackDocument(document)));
    return true;
  } catch {
    // Local storage can be unavailable in privacy-restricted browser contexts.
    return false;
  }
}

export function createPointAfter(document, anchorIndex) {
  const doc = cloneTrackDocument(document);
  const count = doc.anchors.length;
  const current = doc.anchors[anchorIndex];
  const next = doc.anchors[(anchorIndex + 1) % count];
  const position = [
    (current.position[0] + next.position[0]) * 0.5,
    (current.position[1] + next.position[1]) * 0.5,
    (current.position[2] + next.position[2]) * 0.5,
  ];

  const newAnchor = {
    id: `p${Date.now().toString(36).slice(-5)}`,
    position,
    in: [0, 0, 0],
    out: [0, 0, 0],
    bank: 0,
    speed: 1,
  };

  doc.anchors.splice(anchorIndex + 1, 0, newAnchor);
  applyAutoHandles(doc.anchors, 0.16);
  return doc;
}

export function removePoint(document, anchorIndex) {
  const doc = cloneTrackDocument(document);
  if (doc.anchors.length <= 4) {
    return doc;
  }

  doc.anchors.splice(anchorIndex, 1);
  applyAutoHandles(doc.anchors, 0.16);
  return doc;
}

export function applyAutoHandles(anchors, tension = 0.18) {
  const count = anchors.length;

  for (let index = 0; index < count; index += 1) {
    const previous = vectorFromArray(anchors[(index - 1 + count) % count].position);
    const next = vectorFromArray(anchors[(index + 1) % count].position);
    const tangent = next.sub(previous).multiplyScalar(tension);
    anchors[index].out = vectorToArray(tangent);
    anchors[index].in = vectorToArray(tangent.multiplyScalar(-1));
  }
}

export function makeSwiftTrackSnippet(document) {
  const doc = sanitizeTrackDocument(document);
  const anchors = doc.anchors.map((anchor) => {
    const p = anchor.position.map((value) => value.toFixed(3)).join(', ');
    const i = anchor.in.map((value) => value.toFixed(3)).join(', ');
    const o = anchor.out.map((value) => value.toFixed(3)).join(', ');
    return `    TrackAnchor(position: SIMD3<Float>(${p}), inHandle: SIMD3<Float>(${i}), outHandle: SIMD3<Float>(${o}), bank: ${anchor.bank.toFixed(3)}, speed: ${anchor.speed.toFixed(3)})`;
  });

  return [
    'let authoredTrackAnchors: [TrackAnchor] = [',
    anchors.join(',\n'),
    ']',
  ].join('\n');
}

export function vectorFromArray(value) {
  return new Vector3(value[0], value[1], value[2]);
}

export function vectorToArray(vector) {
  return [round3(vector.x), round3(vector.y), round3(vector.z)];
}

function sanitizeVector(value, fallback) {
  if (!Array.isArray(value) || value.length < 3) {
    return [...fallback];
  }

  return [0, 1, 2].map((index) => (
    Number.isFinite(Number(value[index])) ? Number(value[index]) : fallback[index]
  ));
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

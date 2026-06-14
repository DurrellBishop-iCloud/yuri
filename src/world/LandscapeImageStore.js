import { getAssetUrl } from '../utils/routes.js';

export const LANDSCAPE_IMAGE_STORAGE_KEY = 'yuriCoast.landscapeImage.v1';

const MAX_IMAGE_SIDE = 1024;
const JPEG_QUALITY = 0.86;
const PUBLISHED_MANIFEST_URL = 'landscape/landscape.json';

export async function loadLandscapeImageFromFile(file) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Expected an image file.');
  }

  const image = await decodeImageFile(file);
  const dataUrl = resizeImageToDataUrl(image, file.type);
  const document = {
    version: 1,
    name: file.name || 'Landscape image',
    dataUrl,
    updatedAt: Date.now(),
  };

  return {
    ...document,
    saved: saveLocalLandscapeImage(document),
  };
}

export function loadLocalLandscapeImage() {
  try {
    const raw = window.localStorage?.getItem(LANDSCAPE_IMAGE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const document = JSON.parse(raw);
    if (!document?.dataUrl?.startsWith('data:image/')) {
      return null;
    }

    return {
      version: 1,
      name: String(document.name || 'Landscape image'),
      dataUrl: document.dataUrl,
      updatedAt: Number(document.updatedAt) || 0,
    };
  } catch {
    return null;
  }
}

export function saveLocalLandscapeImage(document) {
  try {
    window.localStorage?.setItem(LANDSCAPE_IMAGE_STORAGE_KEY, JSON.stringify(document));
    return true;
  } catch {
    return false;
  }
}

export function clearLocalLandscapeImage() {
  try {
    window.localStorage?.removeItem(LANDSCAPE_IMAGE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export async function applySavedLandscapeToTerrain(terrain) {
  const local = loadLocalLandscapeImage();
  if (local) {
    await terrain.setLandscapeImage(local.dataUrl);
    return { source: 'local', name: local.name };
  }

  const published = await loadPublishedLandscapeImage();
  if (published) {
    await terrain.setLandscapeImage(published.url);
    return { source: 'published', name: published.name };
  }

  return null;
}

export async function loadPublishedLandscapeImage() {
  try {
    const response = await fetch(getAssetUrl(PUBLISHED_MANIFEST_URL), { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }

    const manifest = await response.json();
    if (!manifest?.image) {
      return null;
    }

    const cacheKey = manifest.updatedAt ? `?v=${encodeURIComponent(manifest.updatedAt)}` : '';
    return {
      name: String(manifest.name || manifest.image),
      url: `${getAssetUrl(`landscape/${manifest.image}`)}${cacheKey}`,
    };
  } catch {
    return null;
  }
}

function decodeImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image.'));
    };
    image.src = url;
  });
}

function resizeImageToDataUrl(image, originalType) {
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { alpha: originalType === 'image/png' });
  context.drawImage(image, 0, 0, width, height);

  const type = originalType === 'image/png' ? 'image/png' : 'image/jpeg';
  return canvas.toDataURL(type, JPEG_QUALITY);
}

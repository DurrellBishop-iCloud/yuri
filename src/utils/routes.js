const baseUrl = normalizeBase(import.meta.env.BASE_URL || '/');

export function getBaseUrl() {
  return baseUrl;
}

export function getRideUrl() {
  return baseUrl;
}

export function getEditorUrl() {
  return `${baseUrl}editor`;
}

export function getHashEditorUrl() {
  return `${baseUrl}#editor`;
}

export function getAssetUrl(path) {
  return `${baseUrl}${path.replace(/^\/+/, '')}`;
}

export function isEditorRoute(location = window.location) {
  const path = stripBase(location.pathname);
  return path === '/editor' || location.hash === '#editor';
}

function stripBase(pathname) {
  const path = normalizePath(pathname);
  const basePath = normalizePath(new URL(baseUrl, window.location.origin).pathname);

  if (basePath !== '/' && (path === basePath || path.startsWith(`${basePath}/`))) {
    return normalizePath(path.slice(basePath.length) || '/');
  }

  return path;
}

function normalizeBase(value) {
  if (!value) {
    return '/';
  }

  return value.endsWith('/') ? value : `${value}/`;
}

function normalizePath(value) {
  const trimmed = String(value || '/').replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '/';
}

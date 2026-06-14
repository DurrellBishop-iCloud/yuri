export const appVersion = typeof __YURI_BUILD_VERSION__ === 'string'
  ? __YURI_BUILD_VERSION__
  : '0.1.0+dev';

export const buildTime = typeof __YURI_BUILD_TIME__ === 'string'
  ? __YURI_BUILD_TIME__
  : new Date().toISOString();

export const commitId = typeof __YURI_COMMIT__ === 'string'
  ? __YURI_COMMIT__
  : 'local';

export function shortVersion() {
  return appVersion.split('+')[1] ? `v${appVersion.split('+')[1]}` : `v${appVersion}`;
}

export async function freshReload() {
  await clearBrowserCaches();
  const url = new URL(window.location.href);
  url.searchParams.set('v', `${appVersion}-${Date.now()}`);
  window.location.replace(url.toString());
}

async function clearBrowserCaches() {
  if (!('caches' in window)) {
    return;
  }

  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {
    // Cache storage can be unavailable or blocked; the URL version still busts normal browser caches.
  }
}

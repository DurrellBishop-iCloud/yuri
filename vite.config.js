import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function githubPagesBase() {
  if (process.env.VITE_BASE_PATH) {
    return process.env.VITE_BASE_PATH;
  }

  const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
  if (!repository || repository.endsWith('.github.io')) {
    return '/';
  }

  return `/${repository}/`;
}

function buildInfo() {
  const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  const commit = readCommand('git rev-parse --short HEAD') || 'local';
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
  const version = `${packageJson.version}+${stamp}.${commit}`;

  return {
    commit,
    version,
    builtAt: new Date().toISOString(),
  };
}

function readCommand(command) {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

const info = buildInfo();

export default defineConfig({
  base: githubPagesBase(),
  define: {
    __YURI_BUILD_VERSION__: JSON.stringify(info.version),
    __YURI_BUILD_TIME__: JSON.stringify(info.builtAt),
    __YURI_COMMIT__: JSON.stringify(info.commit),
  },
});

import { defineConfig } from 'vite';

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

export default defineConfig({
  base: githubPagesBase(),
});

import { copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));

await copyFile(
  join(distDir, 'index.html'),
  join(distDir, '404.html'),
);

await writeFile(join(distDir, '.nojekyll'), '');

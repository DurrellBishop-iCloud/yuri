#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourcePath = process.argv[2] ? resolve(process.argv[2]) : null;
const resourcesPath = resolve(repoRoot, 'yuriCoast', 'yuriCoast', 'Resources');
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

if (!sourcePath || !existsSync(sourcePath) || !allowedExtensions.has(extname(sourcePath).toLowerCase())) {
  console.error('Usage: npm run vision:landscape -- "/path/to/photo.jpg"');
  process.exit(1);
}

mkdirSync(resourcesPath, { recursive: true });
for (const file of readdirSync(resourcesPath)) {
  if (file.startsWith('LandscapeImage.')) {
    rmSync(resolve(resourcesPath, file), { force: true });
  }
}

const extension = extname(sourcePath).toLowerCase() === '.jpeg' ? '.jpg' : extname(sourcePath).toLowerCase();
const destination = resolve(resourcesPath, `LandscapeImage${extension}`);
cpSync(sourcePath, destination);
console.log(`Installed ${basename(sourcePath)} as ${destination.replace(`${repoRoot}/`, '')}`);

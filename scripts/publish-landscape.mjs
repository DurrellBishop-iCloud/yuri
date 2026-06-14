#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const deploy = args.includes('--deploy');
const imagePath = args.find((arg) => !arg.startsWith('--'));
const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const landscapeDir = join(repoRoot, 'public', 'landscape');
const allowedExtensions = new Map([
  ['.jpg', '.jpg'],
  ['.jpeg', '.jpg'],
  ['.png', '.png'],
  ['.webp', '.webp'],
]);

if (!imagePath) {
  console.error('Usage: npm run landscape:publish -- "/path/to/photo.jpg" [--deploy]');
  process.exit(1);
}

const source = resolve(imagePath);
const extension = allowedExtensions.get(extname(source).toLowerCase());
if (!extension || !existsSync(source)) {
  console.error('Please choose an existing JPG, PNG, or WebP image.');
  process.exit(1);
}

mkdirSync(landscapeDir, { recursive: true });
for (const file of readdirSync(landscapeDir)) {
  if (file.startsWith('custom-landscape.')) {
    rmSync(join(landscapeDir, file), { force: true });
  }
}

const imageName = `custom-landscape${extension}`;
cpSync(source, join(landscapeDir, imageName));
writeFileSync(
  join(landscapeDir, 'landscape.json'),
  `${JSON.stringify({
    image: imageName,
    name: basename(source),
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`,
);

console.log(`Installed ${basename(source)} as public/landscape/${imageName}`);

if (!deploy) {
  console.log('Run with --deploy to build, commit, push, and update GitHub Pages.');
  process.exit(0);
}

run('npm', ['run', 'build']);
run('git', ['add', 'public/landscape']);
commitIfChanged('Update published landscape', ['public/landscape']);
run('git', ['push']);
deployPages();

function deployPages() {
  const worktree = process.env.YURI_PAGES_WORKTREE || '/tmp/yuri-gh-pages';
  if (!existsSync(worktree)) {
    run('git', ['worktree', 'add', worktree, 'gh-pages']);
  }

  run('git', ['-C', worktree, 'pull', '--ff-only']);
  run('git', ['-C', worktree, 'rm', '-r', '.']);
  const distDir = join(repoRoot, 'dist');
  for (const file of readdirSync(distDir)) {
    cpSync(join(distDir, file), join(worktree, file), { recursive: true });
  }
  run('git', ['-C', worktree, 'add', '-A']);
  commitIfChanged('Deploy published landscape', [], worktree);
  run('git', ['-C', worktree, 'push']);
}

function commitIfChanged(message, paths = [], cwd = repoRoot) {
  const statusArgs = ['status', '--porcelain'];
  if (paths.length) {
    statusArgs.push('--', ...paths);
  }
  const status = execFileSync('git', statusArgs, { cwd, encoding: 'utf8' });
  if (!status.trim()) {
    console.log('No git changes to commit.');
    return;
  }

  run('git', ['commit', '-m', message], cwd);
}

function run(command, argsForCommand, cwd = repoRoot) {
  console.log(`$ ${command} ${argsForCommand.join(' ')}`);
  execFileSync(command, argsForCommand, { cwd, stdio: 'inherit' });
}

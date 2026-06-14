#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeSwiftTrackSnippet, sanitizeTrackDocument } from '../src/world/TrackDocument.js';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const inputPath = process.argv[2] ? resolve(process.argv[2]) : null;
const outputPath = process.argv[3]
  ? resolve(process.argv[3])
  : resolve(repoRoot, 'yuriCoast', 'yuriCoast', 'AuthoredTrack.swift');

if (!inputPath || !existsSync(inputPath)) {
  console.error('Usage: npm run vision:track -- "/path/to/yuri-coast-track.json"');
  process.exit(1);
}

const document = sanitizeTrackDocument(JSON.parse(readFileSync(inputPath, 'utf8')));
const swift = `${makeSwiftTrackSnippet(document)}\n`;
writeFileSync(outputPath, swift);

console.log(`Wrote ${outputPath.replace(`${dirname(repoRoot)}/`, '')}`);

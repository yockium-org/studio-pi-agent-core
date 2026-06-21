#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const [, , targetDir] = process.argv;

if (!targetDir) {
  console.error('Usage: node scripts/check-parity.mjs <project/packages/pi-agent-core>');
  process.exit(2);
}

const repoRoot = process.cwd();
const compareEntries = [
  'src',
  'test',
  'README.md',
  'tsconfig.json',
];

// Standalone packaging metadata can intentionally diverge while project repos
// still carry temporary in-repo copies. Keep source and behavioral tests in sync.
const ignoredFiles = new Set(['test/public-api.test.ts']);
const ignoredDirs = new Set(['node_modules', 'dist', '.git']);

const hashFile = async (filePath) =>
  createHash('sha256').update(await readFile(filePath)).digest('hex');

const walk = async (root, relative = '') => {
  const fullPath = path.join(root, relative);
  const info = await stat(fullPath);

  if (info.isFile()) return [relative];
  if (!info.isDirectory()) return [];

  const entries = await readdir(fullPath);
  const files = [];
  for (const entry of entries.sort()) {
    if (ignoredDirs.has(entry)) continue;
    files.push(...(await walk(root, path.join(relative, entry))));
  }
  return files;
};

const collect = async (root) => {
  const files = [];
  for (const entry of compareEntries) {
    files.push(...(await walk(root, entry)));
  }
  return files.filter((file) => !ignoredFiles.has(file)).sort();
};

const rootFiles = await collect(repoRoot);
const targetFiles = await collect(targetDir);
const problems = [];

if (JSON.stringify(rootFiles) !== JSON.stringify(targetFiles)) {
  const rootSet = new Set(rootFiles);
  const targetSet = new Set(targetFiles);
  for (const file of rootFiles) {
    if (!targetSet.has(file)) problems.push(`Only in standalone: ${file}`);
  }
  for (const file of targetFiles) {
    if (!rootSet.has(file)) problems.push(`Only in target: ${file}`);
  }
}

for (const file of rootFiles.filter((entry) => targetFiles.includes(entry))) {
  const [leftHash, rightHash] = await Promise.all([
    hashFile(path.join(repoRoot, file)),
    hashFile(path.join(targetDir, file)),
  ]);
  if (leftHash !== rightHash) problems.push(`Different content: ${file}`);
}

if (problems.length > 0) {
  console.error(`pi-agent-core parity failed for ${targetDir}:`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`pi-agent-core parity OK: ${targetDir}`);

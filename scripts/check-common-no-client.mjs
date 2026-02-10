#!/usr/bin/env node
/**
 * Ensures @lightdash-tools/common does not depend on @lightdash-tools/client.
 * Exit 0 if the rule is satisfied, non-zero otherwise.
 *
 * Checks:
 * 1. packages/common/package.json must not list @lightdash-tools/client in dependencies or devDependencies.
 * 2. No file under packages/common may import or require @lightdash-tools/client or path segments that resolve to the client package.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COMMON_DIR = path.join(ROOT, 'packages', 'common');
const CLIENT_PKG = '@lightdash-tools/client';

const errors = [];

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

// 1. Package dependency check
const commonPkgPath = path.join(COMMON_DIR, 'package.json');
if (!fs.existsSync(commonPkgPath)) {
  errors.push(`packages/common/package.json not found at ${commonPkgPath}`);
} else {
  const pkg = readJson(commonPkgPath);
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps[CLIENT_PKG]) {
    errors.push(
      `packages/common/package.json must not depend on "${CLIENT_PKG}". Found in dependencies or devDependencies.`,
    );
  }
}

// 2. Import scan: match import/require of @lightdash-tools/client or path ending in /client
const IMPORT_CLIENT_RE = /(?:from|import)\s+['"](@lightdash-tools\/client|[\w./-]*\/client)['"]/g;
const REQUIRE_CLIENT_RE =
  /require\s*\(\s*['"](@lightdash-tools\/client|[\w./-]*\/client)['"]\s*\)/g;
const EXTENSIONS = new Set(['.ts', '.js', '.mts', '.cts']);

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== 'dist') scanDir(full);
      continue;
    }
    const ext = path.extname(e.name);
    if (!EXTENSIONS.has(ext)) continue;
    const content = fs.readFileSync(full, 'utf8');
    const relPath = path.relative(ROOT, full);
    let m;
    IMPORT_CLIENT_RE.lastIndex = 0;
    while ((m = IMPORT_CLIENT_RE.exec(content)) !== null) {
      errors.push(
        `${relPath}: forbidden import/require of "${m[1]}". @lightdash-tools/common must not depend on @lightdash-tools/client.`,
      );
    }
    REQUIRE_CLIENT_RE.lastIndex = 0;
    while ((m = REQUIRE_CLIENT_RE.exec(content)) !== null) {
      errors.push(
        `${relPath}: forbidden require of "${m[1]}". @lightdash-tools/common must not depend on @lightdash-tools/client.`,
      );
    }
  }
}

scanDir(COMMON_DIR);

if (errors.length > 0) {
  errors.forEach((msg) => process.stderr.write(msg + '\n'));
  process.exit(1);
}

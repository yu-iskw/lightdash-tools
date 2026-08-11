#!/usr/bin/env node
/**
 * Package dependency firewall checks.
 *
 * 1. @lightdash-tools/common must not depend on @lightdash-tools/client.
 * 2. @lightdash-tools/visualization must not depend on @lightdash-tools/client or @lightdash-tools/mcp.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COMMON_DIR = path.join(ROOT, 'packages', 'common');
const VISUALIZATION_DIR = path.join(ROOT, 'packages', 'visualization');
const CLIENT_PKG = '@lightdash-tools/client';
const MCP_PKG = '@lightdash-tools/mcp';

const errors = [];

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function forbidPackageDeps(pkgDir, pkgLabel, forbiddenPkgs) {
  const pkgPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    errors.push(`${pkgLabel} package.json not found at ${pkgPath}`);
    return;
  }
  const pkg = readJson(pkgPath);
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const forbidden of forbiddenPkgs) {
    if (deps[forbidden]) {
      errors.push(
        `${pkgLabel}/package.json must not depend on "${forbidden}". Found in dependencies or devDependencies.`,
      );
    }
  }
}

const EXTENSIONS = new Set(['.ts', '.js', '.mts', '.cts']);

function scanForbiddenImports(dir, pkgLabel, patterns) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== 'dist') {
        scanForbiddenImports(full, pkgLabel, patterns);
      }
      continue;
    }
    const ext = path.extname(e.name);
    if (!EXTENSIONS.has(ext)) continue;
    const content = fs.readFileSync(full, 'utf8');
    const relPath = path.relative(ROOT, full);
    for (const { re, label } of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(content)) !== null) {
        errors.push(
          `${relPath}: forbidden import/require of "${m[1]}". ${pkgLabel} must not depend on ${label}.`,
        );
      }
    }
  }
}

forbidPackageDeps(COMMON_DIR, 'packages/common', [CLIENT_PKG]);
scanForbiddenImports(COMMON_DIR, '@lightdash-tools/common', [
  {
    re: /(?:from|import)\s+['"](@lightdash-tools\/client|[\w./-]*\/client)['"]/g,
    label: '@lightdash-tools/client',
  },
  {
    re: /require\s*\(\s*['"](@lightdash-tools\/client|[\w./-]*\/client)['"]\s*\)/g,
    label: '@lightdash-tools/client',
  },
]);

if (fs.existsSync(VISUALIZATION_DIR)) {
  forbidPackageDeps(VISUALIZATION_DIR, 'packages/visualization', [CLIENT_PKG, MCP_PKG]);
  scanForbiddenImports(VISUALIZATION_DIR, '@lightdash-tools/visualization', [
    {
      re: /(?:from|import)\s+['"](@lightdash-tools\/client)['"]/g,
      label: '@lightdash-tools/client',
    },
    {
      re: /(?:from|import)\s+['"](@lightdash-tools\/mcp)['"]/g,
      label: '@lightdash-tools/mcp',
    },
    {
      re: /require\s*\(\s*['"](@lightdash-tools\/client)['"]\s*\)/g,
      label: '@lightdash-tools/client',
    },
    {
      re: /require\s*\(\s*['"](@lightdash-tools\/mcp)['"]\s*\)/g,
      label: '@lightdash-tools/mcp',
    },
  ]);
}

if (errors.length > 0) {
  errors.forEach((msg) => process.stderr.write(msg + '\n'));
  process.exit(1);
}

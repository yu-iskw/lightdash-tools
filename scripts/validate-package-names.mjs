#!/usr/bin/env node
/**
 * Validates that root and workspace package names follow @lightdash-tools scope
 * and that descriptions do not contain template placeholder text.
 * Exit 0 if all checks pass, non-zero otherwise.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXPECTED_ROOT_NAME = '@lightdash-tools';
const SCOPE = '@lightdash-tools';
const TEMPLATE_PLACEHOLDER = 'TypeScript template project';
const PACKAGES_DIR = path.join(ROOT, 'packages');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

const errors = [];

// 1. Root package.json
const rootPkgPath = path.join(ROOT, 'package.json');
const rootPkg = readJson(rootPkgPath);
if (rootPkg.name !== EXPECTED_ROOT_NAME) {
  errors.push(
    `Root package.json: expected "name" to be "${EXPECTED_ROOT_NAME}", got "${rootPkg.name}"`,
  );
}

// 2. Workspace packages
if (!fs.existsSync(PACKAGES_DIR)) {
  errors.push(`Packages directory not found: ${PACKAGES_DIR}`);
} else {
  const dirs = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true });
  for (const dirent of dirs) {
    if (!dirent.isDirectory()) continue;
    const pkgDir = dirent.name;
    const pkgPath = path.join(PACKAGES_DIR, pkgDir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;

    const pkg = readJson(pkgPath);
    const expectedName = `${SCOPE}/${pkgDir}`;
    if (pkg.name !== expectedName) {
      errors.push(
        `packages/${pkgDir}/package.json: expected "name" to be "${expectedName}", got "${pkg.name}"`,
      );
    }
    const desc = (pkg.description || '').trim();
    if (!desc) {
      errors.push(`packages/${pkgDir}/package.json: "description" must be non-empty`);
    } else if (desc.includes(TEMPLATE_PLACEHOLDER)) {
      errors.push(
        `packages/${pkgDir}/package.json: "description" must not contain template placeholder "${TEMPLATE_PLACEHOLDER}"`,
      );
    }
  }
}

if (errors.length > 0) {
  errors.forEach((msg) => process.stderr.write(msg + '\n'));
  process.exit(1);
}

#!/usr/bin/env node
/**
 * Fail when a pnpm-lock.yaml importer specifier disagrees with a workspace override.
 *
 * pnpm records the override range on direct importers. `pnpm audit --fix` can
 * rewrite that line to the package.json range and break `pnpm install --frozen-lockfile`.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WORKSPACE_PATH = path.join(ROOT, 'pnpm-workspace.yaml');
const LOCKFILE_PATH = path.join(ROOT, 'pnpm-lock.yaml');

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseOverrides(workspaceYaml) {
  const overrides = new Map();
  const lines = workspaceYaml.split('\n');
  let inOverrides = false;
  for (const line of lines) {
    if (!inOverrides) {
      if (line === 'overrides:') {
        inOverrides = true;
      }
      continue;
    }
    if (line.trim() === '' || line.startsWith('#')) {
      continue;
    }
    if (!line.startsWith('  ') || line.startsWith('   ')) {
      break;
    }
    const match = line.match(/^ {2}(?:'([^']+)'|"([^"]+)"|([^:'"]+)):\s*(.+)$/);
    if (!match) {
      continue;
    }
    const name = match[1] ?? match[2] ?? match[3];
    overrides.set(name, unquote(match[4]));
  }
  return overrides;
}

function importerSection(lockfileYaml) {
  const start = lockfileYaml.indexOf('\nimporters:\n');
  if (start === -1) {
    return '';
  }
  const fromImporters = lockfileYaml.slice(start + 1);
  const packagesAt = fromImporters.search(/\npackages:\n/);
  return packagesAt === -1 ? fromImporters : fromImporters.slice(0, packagesAt);
}

function lockfileImporterSpecifiers(importersYaml) {
  const specifiers = new Map();
  const lines = importersYaml.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const nameMatch = lines[i].match(/^ {4,8}(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9@/_.-]+)):\s*$/);
    if (!nameMatch) {
      continue;
    }
    const name = nameMatch[1] ?? nameMatch[2] ?? nameMatch[3];
    const next = lines[i + 1] ?? '';
    const specifierMatch = next.match(/^ +specifier:\s*(.+)\s*$/);
    if (!specifierMatch) {
      continue;
    }
    const values = specifiers.get(name) ?? [];
    values.push(unquote(specifierMatch[1]));
    specifiers.set(name, values);
  }
  return specifiers;
}

const errors = [];

if (!fs.existsSync(WORKSPACE_PATH)) {
  errors.push(`pnpm-workspace.yaml not found at ${WORKSPACE_PATH}`);
}
if (!fs.existsSync(LOCKFILE_PATH)) {
  errors.push(`pnpm-lock.yaml not found at ${LOCKFILE_PATH}`);
}

if (errors.length === 0) {
  const overrides = parseOverrides(fs.readFileSync(WORKSPACE_PATH, 'utf8'));
  if (overrides.size === 0) {
    errors.push('pnpm-workspace.yaml has no overrides: block');
  }
  const importers = lockfileImporterSpecifiers(
    importerSection(fs.readFileSync(LOCKFILE_PATH, 'utf8')),
  );
  for (const [name, overrideSpecifier] of overrides) {
    const seen = importers.get(name);
    if (!seen) {
      continue;
    }
    for (const specifier of seen) {
      if (specifier !== overrideSpecifier) {
        errors.push(
          `pnpm-lock.yaml importer "${name}" specifier is "${specifier}" but pnpm-workspace.yaml override is "${overrideSpecifier}". ` +
            'Do not commit a lockfile whose importer specifiers disagree with overrides (pnpm audit --fix can rewrite them and break frozen installs).',
        );
      }
    }
  }
}

if (errors.length > 0) {
  errors.forEach((msg) => process.stderr.write(`${msg}\n`));
  process.exit(1);
}

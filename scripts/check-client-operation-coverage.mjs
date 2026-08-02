#!/usr/bin/env node
/**
 * Hard gate: every catalog operation must map to a resolvable LightdashClient method (ADR-0013).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COMMON_DIST = path.join(ROOT, 'packages/common/dist/operations/index.js');
const CLIENT_DIST = path.join(ROOT, 'packages/client/dist/client.js');

/**
 * @param {unknown} root
 * @param {string} methodPath e.g. v1.charts.getChartsAsCode
 * @returns {boolean}
 */
function clientHasMethod(root, methodPath) {
  const parts = methodPath.split('.');
  if (parts.length < 2) {
    return false;
  }
  let current = root;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return false;
    }
    current = current[part];
  }
  return typeof current === 'function';
}

/**
 * @param {unknown} client
 * @param {string} methodRef
 * @returns {string[]} unresolved segments
 */
function unresolvedMethodRefs(client, methodRef) {
  // MCP-local ledger / policy tools with no LightdashClient call.
  if (methodRef.startsWith('ledger:')) {
    return [];
  }
  if (methodRef.startsWith('composed:')) {
    const parts = methodRef.slice('composed:'.length).split('+');
    return parts.filter((part) => !clientHasMethod(client, part));
  }
  return clientHasMethod(client, methodRef) ? [] : [methodRef];
}

async function main() {
  if (!fs.existsSync(COMMON_DIST)) {
    throw new Error(
      `Built common package not found at ${COMMON_DIST}. Run "pnpm --filter @lightdash-tools/common build" first.`,
    );
  }
  if (!fs.existsSync(CLIENT_DIST)) {
    throw new Error(
      `Built client package not found at ${CLIENT_DIST}. Run "pnpm --filter @lightdash-tools/client build" first.`,
    );
  }

  const { listOperations, getClientMethodForOperation } = await import(COMMON_DIST);
  const { LightdashClient } = await import(CLIENT_DIST);
  const client = new LightdashClient({
    baseUrl: 'http://127.0.0.1',
    personalAccessToken: 'coverage-check',
  });

  const errors = [];

  for (const operation of listOperations()) {
    const method = getClientMethodForOperation(operation.id);
    if (typeof method !== 'string' || method.trim().length === 0) {
      errors.push(`Missing client coverage for operation '${operation.id}'`);
      continue;
    }
    const missing = unresolvedMethodRefs(client, method);
    for (const ref of missing) {
      errors.push(
        `Operation '${operation.id}' maps to unresolved client method '${ref}' (from '${method}')`,
      );
    }
  }

  if (errors.length > 0) {
    for (const message of errors) {
      process.stderr.write(`${message}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `Client coverage OK for ${listOperations().length} operations (methods resolved on LightdashClient)\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

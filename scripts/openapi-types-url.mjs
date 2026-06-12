#!/usr/bin/env node
/**
 * Prints the Lightdash swagger.json URL using the pinned ref in config/lightdash-openapi-ref.txt.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REF_PATH = path.join(ROOT, 'config/lightdash-openapi-ref.txt');
const SWAGGER_PATH = 'packages/backend/src/generated/swagger.json';

const ref = fs.readFileSync(REF_PATH, 'utf8').trim();
if (!ref) {
  process.stderr.write(`OpenAPI ref is empty: ${REF_PATH}\n`);
  process.exit(1);
}

const isCommit = /^[0-9a-f]{40}$/i.test(ref);
const base = isCommit
  ? `https://raw.githubusercontent.com/lightdash/lightdash/${ref}`
  : `https://raw.githubusercontent.com/lightdash/lightdash/refs/heads/${ref}`;

process.stdout.write(`${base}/${SWAGGER_PATH}`);

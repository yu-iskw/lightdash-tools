/**
 * Copies the built mcp-ui single-file HTML into the MCP package dist for publishing.
 * Run after mcp-ui build and mcp tsc (see packages/mcp/package.json build script).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(scriptDir, '../../mcp-ui/dist/index.html');
const destDir = path.resolve(scriptDir, '../dist/assets');
const dest = path.join(destDir, 'minimal-app.html');

if (!fs.existsSync(source)) {
  console.error(
    `MCP UI build output missing: ${source}. Build @lightdash-tools/mcp-ui before @lightdash-tools/mcp.`,
  );
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(source, dest);

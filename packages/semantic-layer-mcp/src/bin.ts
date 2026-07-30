#!/usr/bin/env node
/**
 * Deprecated shim: forwards to @lightdash-tools/mcp (semantic-layer persona).
 */
import { createRequire } from 'node:module';

console.error(
  'DEPRECATED: @lightdash-tools/semantic-layer-mcp is deprecated. Use @lightdash-tools/mcp (`lightdash-mcp`). Streamable HTTP path: /semantic-layer/v1/mcp',
);

createRequire(__filename)('@lightdash-tools/mcp/dist/bin.js');

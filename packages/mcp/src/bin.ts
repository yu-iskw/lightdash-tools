#!/usr/bin/env node
/**
 * MCP server CLI entrypoint.
 */

const args = process.argv.slice(2);

if (args.includes('--http')) {
  import('./http.js');
} else {
  import('./index.js');
}

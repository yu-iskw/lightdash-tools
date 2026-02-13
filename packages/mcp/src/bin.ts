#!/usr/bin/env node
/**
 * MCP server CLI entrypoint.
 */

const args = process.argv.slice(2);

if (args.includes('--http')) {
  void import('./http.js');
} else {
  void import('./index.js');
}

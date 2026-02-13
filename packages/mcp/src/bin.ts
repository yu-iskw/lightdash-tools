#!/usr/bin/env node
/**
 * MCP server CLI entrypoint.
 */

import { Command } from 'commander';
import { SafetyMode } from '@lightdash-tools/common';
import { setBindedToolMode } from './config.js';

const program = new Command();

program
  .name('lightdash-mcp')
  .description('MCP server for Lightdash AI')
  .version('0.2.2')
  .option('--http', 'Run as HTTP server instead of Stdio')
  .option(
    '--binded-tool-mode <mode>',
    'Filter registered tools by safety mode (read-only, write-idempotent, write-destructive)',
  )
  .action((options) => {
    if (options.bindedToolMode) {
      if (Object.values(SafetyMode).includes(options.bindedToolMode)) {
        setBindedToolMode(options.bindedToolMode as SafetyMode);
      } else {
        console.error(`Invalid safety mode: ${options.bindedToolMode}`);
        process.exit(1);
      }
    }

    if (options.http) {
      void import('./http.js');
    } else {
      void import('./index.js');
    }
  });

program.parse(process.argv);

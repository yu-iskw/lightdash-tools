#!/usr/bin/env node
/**
 * MCP server CLI entrypoint.
 */

import { Command } from 'commander';
import { SafetyMode } from '@lightdash-tools/common';
import { setStaticSafetyMode } from './config.js';

const program = new Command();

program
  .name('lightdash-mcp')
  .description('MCP server for Lightdash AI')
  .version('0.2.3')
  .option('--http', 'Run as HTTP server instead of Stdio')
  .option(
    '--safety-mode <mode>',
    'Filter registered tools by safety mode (read-only, write-idempotent, write-destructive)',
  )
  .action((options) => {
    if (options.safetyMode) {
      if (Object.values(SafetyMode).includes(options.safetyMode)) {
        setStaticSafetyMode(options.safetyMode as SafetyMode);
      } else {
        console.error(`Invalid safety mode: ${options.safetyMode}`);
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

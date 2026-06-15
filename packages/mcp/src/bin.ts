#!/usr/bin/env node
/**
 * MCP server CLI entrypoint.
 */

import { SafetyMode } from '@lightdash-tools/common';
import { Command } from 'commander';

import { MCP_HTTP_AUTH_MODES } from './auth/auth-mode.js';
import { setStaticSafetyMode, setStaticAllowedProjectUuids, setDryRunMode } from './config.js';

const program = new Command();

function applyGuardrailOptions(options: {
  safetyMode?: string;
  projects?: string;
  dryRun?: boolean;
}): void {
  if (options.safetyMode) {
    if (Object.values(SafetyMode).includes(options.safetyMode as SafetyMode)) {
      setStaticSafetyMode(options.safetyMode as SafetyMode);
    } else {
      console.error(`Invalid safety mode: ${options.safetyMode}`);
      process.exit(1);
    }
  }

  if (options.projects) {
    const uuids = options.projects
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setStaticAllowedProjectUuids(uuids);
  }

  if (options.dryRun) {
    setDryRunMode(true);
  }
}

function runStdio(): void {
  void import('./index.js');
}

function runHttp(authMode?: string): void {
  if (authMode) {
    if (!(MCP_HTTP_AUTH_MODES as readonly string[]).includes(authMode)) {
      console.error(
        `Invalid --auth-mode: ${authMode}. Expected ${MCP_HTTP_AUTH_MODES.join(', ')}.`,
      );
      process.exit(1);
    }
    process.env.LIGHTDASH_TOOLS_MCP_AUTH_MODE = authMode;
  }
  void import('./http.js');
}

program
  .name('lightdash-mcp')
  .description('MCP server for Lightdash AI')
  .version('0.6.0')
  .option(
    '--safety-mode <mode>',
    'Filter registered tools by safety mode (read-only, write-idempotent, write-destructive)',
  )
  .option(
    '--projects <uuids>',
    'Comma-separated list of allowed project UUIDs (overrides LIGHTDASH_TOOLS_ALLOWED_PROJECTS; empty = all allowed)',
  )
  .option(
    '--dry-run',
    'Simulate write operations without executing them (overrides LIGHTDASH_TOOLS_DRY_RUN)',
  );

program
  .command('stdio')
  .description('Run MCP server on stdio (default)')
  .action((_, command) => {
    applyGuardrailOptions(command.opts());
    runStdio();
  });

program
  .command('serve-http')
  .description('Run MCP server with Streamable HTTP transport')
  .option(
    '--auth-mode <mode>',
    'HTTP auth mode: none, shared-key, or lightdash-oauth (overrides LIGHTDASH_TOOLS_MCP_AUTH_MODE)',
  )
  .action((options, command) => {
    applyGuardrailOptions(command.parent?.opts() ?? command.opts());
    runHttp(options.authMode);
  });

program
  .option('--http', 'Run as HTTP server instead of Stdio (alias for serve-http)')
  .action((options) => {
    applyGuardrailOptions(options);
    if (options.http) {
      runHttp();
    } else {
      runStdio();
    }
  });

program.parse(process.argv);

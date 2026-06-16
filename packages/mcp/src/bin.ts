import { Command } from 'commander';

import { MCP_HTTP_AUTH_MODES } from './auth/auth-mode.js';
import {
  addGuardrailOptions,
  applyGuardrailOptions,
  resolveGuardrailOptions,
} from './cli-guardrails.js';

const program = new Command();

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

addGuardrailOptions(program);

program.name('lightdash-mcp').description('MCP server for Lightdash AI').version('0.6.0');

addGuardrailOptions(
  program
    .command('stdio')
    .description('Run MCP server on stdio (default)')
    .action((_, command) => {
      applyGuardrailOptions(resolveGuardrailOptions(command));
      runStdio();
    }),
);

addGuardrailOptions(
  program
    .command('serve-http')
    .description('Run MCP server with Streamable HTTP transport')
    .option(
      '--auth-mode <mode>',
      'HTTP auth mode: none, shared-key, or lightdash-oauth (overrides LIGHTDASH_TOOLS_MCP_AUTH_MODE)',
    )
    .action((options, command) => {
      applyGuardrailOptions(resolveGuardrailOptions(command, options));
      runHttp(options.authMode);
    }),
);

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

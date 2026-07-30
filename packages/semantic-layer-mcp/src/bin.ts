#!/usr/bin/env node
import { Command } from 'commander';

import { setStaticAllowedProjectUuids } from './config.js';

const PROJECTS_OPTION = '--projects <uuids>' as const;
const PROJECTS_DESCRIPTION = 'Comma-separated allowed project UUIDs';

const program = new Command();

function applyProjects(options: { projects?: string }): void {
  if (options.projects) {
    setStaticAllowedProjectUuids(
      options.projects
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
}

function runStdio(): void {
  void import('./index.js');
}

function runHttp(): void {
  void import('./http.js');
}

program
  .name('lightdash-semantic-layer-mcp')
  .description('MCP server for Lightdash semantic-layer discovery and compile-only workflows')
  .version('0.6.0')
  .option(PROJECTS_OPTION, PROJECTS_DESCRIPTION)
  .action((options) => {
    applyProjects(options);
    runStdio();
  });

program
  .command('stdio')
  .description('Run MCP server on stdio (default)')
  .option(PROJECTS_OPTION, PROJECTS_DESCRIPTION)
  .action((options) => {
    applyProjects(options);
    runStdio();
  });

program
  .command('serve-http')
  .description('Run MCP server on Streamable HTTP (Lightdash OAuth)')
  .option(PROJECTS_OPTION, PROJECTS_DESCRIPTION)
  .action((options) => {
    applyProjects(options);
    runHttp();
  });

program.parse(process.argv);

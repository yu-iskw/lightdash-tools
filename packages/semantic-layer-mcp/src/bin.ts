#!/usr/bin/env node
import { Command } from 'commander';

import { resolveCliOptions } from './cli-options.js';
import { setStaticAllowedProjectUuids } from './config.js';
import { parsePinnedProjectUuid, setStaticPinnedProjectUuid } from './project-pin.js';

const PROJECTS_OPTION = '--projects <uuids>' as const;
const PROJECTS_DESCRIPTION = 'Comma-separated allowed project UUIDs';
const PIN_OPTION = '--pin-project <uuid>' as const;
const PIN_DESCRIPTION =
  'Pin a single project UUID (overrides LIGHTDASH_TOOLS_PINNED_PROJECT; HTTP also accepts X-Lightdash-Project)';

const program = new Command();

function applyOptions(options: { projects?: string; pinProject?: string }): void {
  if (options.pinProject !== undefined) {
    setStaticPinnedProjectUuid(parsePinnedProjectUuid(options.pinProject));
  }
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
  .option(PIN_OPTION, PIN_DESCRIPTION)
  .action((options) => {
    applyOptions(options);
    runStdio();
  });

program
  .command('stdio')
  .description('Run MCP server on stdio (default)')
  .option(PROJECTS_OPTION, PROJECTS_DESCRIPTION)
  .option(PIN_OPTION, PIN_DESCRIPTION)
  .action((options, command) => {
    applyOptions(resolveCliOptions(command, options));
    runStdio();
  });

program
  .command('serve-http')
  .description('Run MCP server on Streamable HTTP (Lightdash OAuth)')
  .option(PROJECTS_OPTION, PROJECTS_DESCRIPTION)
  .option(PIN_OPTION, PIN_DESCRIPTION)
  .action((options, command) => {
    applyOptions(resolveCliOptions(command, options));
    runHttp();
  });

program.parse(process.argv);

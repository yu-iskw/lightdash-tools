#!/usr/bin/env node
import { PROFILE_IDS, type ProfileId } from '@lightdash-tools/common';
import { Command } from 'commander';

import { formatProfilesHelp } from './cli-help.js';
import { parseProfileId } from './profiles/index.js';
import { PACKAGE_VERSION } from './server/version.js';

const program = new Command();

function runStdio(profileId: ProfileId): void {
  void import('./index.js').then((m) => {
    m.startStdio(profileId);
  });
}

function runHttp(): void {
  void import('./http.js');
}

const profileList = PROFILE_IDS.join(', ');

program
  .name('lightdash-mcp')
  .description(
    `MCP server for Lightdash (${profileList}). Use \`stdio --profile <id>\` or \`http\`.`,
  )
  .version(PACKAGE_VERSION)
  .showHelpAfterError()
  .addHelpText(
    'after',
    () =>
      '\nSee `lightdash-mcp stdio --help` or `lightdash-mcp http --help` for profiles, paths, and tools.\n',
  )
  .action(() => {
    console.error(
      `Transport required. Use \`lightdash-mcp stdio --profile <id>\` (profiles: ${profileList}) or \`lightdash-mcp http\`.`,
    );
    // Stdio MCP requires stdout for JSON-RPC only — help must go to stderr.
    program.outputHelp({ error: true });
    process.exitCode = 1;
  });

program
  .command('stdio')
  .description('Run MCP server on stdio')
  .requiredOption('--profile <id>', `Profile id (${profileList})`)
  .addHelpText('after', formatProfilesHelp)
  .action((opts: { profile: string }) => {
    const id = parseProfileId(opts.profile);
    if (!id) {
      console.error(`Invalid profile '${opts.profile}'. Expected one of: ${profileList}.`);
      process.exitCode = 1;
      return;
    }
    runStdio(id);
  });

program
  .command('http')
  .description('Run MCP server over Streamable HTTP (all fixed profile paths)')
  .addHelpText('after', formatProfilesHelp)
  .action(() => {
    runHttp();
  });

program.parse(process.argv);

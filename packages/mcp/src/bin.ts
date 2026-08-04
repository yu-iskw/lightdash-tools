#!/usr/bin/env node
import { PROFILE_IDS, type ProfileId } from '@lightdash-tools/common';
import { Command } from 'commander';

import { parseProfileId } from './profiles/index.js';
import { PACKAGE_VERSION } from './server/version.js';

const program = new Command();

const PROFILE_STDIO_DESCRIPTIONS = new Map<ProfileId, string>([
  ['semantic-layer', 'Run semantic-layer profile on stdio'],
  ['organization-audit', 'Run organization-audit profile on stdio (read-only org governance)'],
  [
    'content-reader',
    'Run content-reader profile on stdio (saved-content discovery and bounded execution)',
  ],
  [
    'content-developer',
    'Run content-developer profile on stdio (chart/dashboard/space authoring behind preview -> validate -> apply)',
  ],
  [
    'content-governance',
    'Run content-governance profile on stdio (elicitation-gated soft-delete of charts and dashboards)',
  ],
  [
    'ai-agent-ops',
    'Run ai-agent-ops profile on stdio (thin AI-agent APIs and product evaluation runs)',
  ],
  [
    'data-analyst',
    'Run data-analyst profile on stdio (explore discovery and bounded ad-hoc metric queries)',
  ],
]);

function profileStdioDescription(profileId: ProfileId): string {
  const description = PROFILE_STDIO_DESCRIPTIONS.get(profileId);
  if (description === undefined) {
    throw new Error(`Missing stdio description for profile '${profileId}'`);
  }
  return description;
}

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
    `MCP server for Lightdash (${profileList}). Stdio requires an explicit profile subcommand or \`stdio <profile>\`.`,
  )
  .version(PACKAGE_VERSION)
  .showHelpAfterError()
  .action(() => {
    console.error(
      `Stdio profile required. Pass a profile subcommand (e.g. lightdash-mcp semantic-layer) or \`stdio <profile>\`. Profiles: ${profileList}. Or use \`http\` for Streamable HTTP.`,
    );
    // Stdio MCP requires stdout for JSON-RPC only — help must go to stderr.
    program.outputHelp({ error: true });
    process.exitCode = 1;
  });

program
  .command('stdio')
  .description('Run MCP server on stdio with an explicit profile')
  .argument('<profile>', `Profile id (${profileList})`)
  .action((profileArg: string) => {
    const id = parseProfileId(profileArg);
    if (!id) {
      console.error(`Invalid profile '${profileArg}'. Expected one of: ${profileList}.`);
      process.exitCode = 1;
      return;
    }
    runStdio(id);
  });

for (const profileId of PROFILE_IDS) {
  program
    .command(profileId)
    .description(profileStdioDescription(profileId))
    .action(() => {
      runStdio(profileId);
    });
}

program
  .command('http')
  .description('Run MCP server over Streamable HTTP (all fixed profile paths)')
  .action(() => {
    runHttp();
  });

program.parse(process.argv);

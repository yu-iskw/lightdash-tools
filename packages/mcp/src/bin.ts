import { PROFILE_IDS, type ProfileId } from '@lightdash-tools/common';
import { Command } from 'commander';

const program = new Command();

const DEFAULT_STDIO_PROFILE: ProfileId = 'semantic-layer';

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

function runStdio(profileId?: ProfileId): void {
  if (profileId) {
    process.env.LIGHTDASH_TOOLS_MCP_STDIO_PROFILE = profileId;
  }
  void import('./index.js');
}

function runHttp(): void {
  void import('./http.js');
}

program
  .name('lightdash-mcp')
  .description(
    `MCP server for Lightdash (${PROFILE_IDS.join(', ')}). Default stdio profile is ${DEFAULT_STDIO_PROFILE}.`,
  )
  .version('0.10.0');

program
  .command('stdio', { isDefault: true })
  .description(`Run MCP server on stdio with the default ${DEFAULT_STDIO_PROFILE} profile`)
  .action(() => {
    runStdio(DEFAULT_STDIO_PROFILE);
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

program
  .command('serve-http')
  .description('Deprecated alias for `http`')
  .action(() => {
    console.warn('Warning: `serve-http` is deprecated; use `lightdash-mcp http`.');
    runHttp();
  });

program.parse(process.argv);

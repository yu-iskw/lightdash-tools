#!/usr/bin/env node
import { PROFILE_IDS, type ProfileId } from '@lightdash-tools/common';
import { Command } from 'commander';

import { ENV_LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT } from './config/env.js';
import {
  PROMPT_CONTEXT_POLICIES,
  resolvePromptContextPolicy,
  type PromptContextPolicy,
} from './config/prompt-context-policy.js';
import { parseProfileId } from './profiles/catalog.js';
import { PACKAGE_VERSION } from './server/version.js';

const program = new Command();

function resolvePolicyOrExit(cli?: string): PromptContextPolicy | undefined {
  try {
    return resolvePromptContextPolicy({
      cli,
      env: process.env,
    });
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
    return undefined;
  }
}

function runStdio(profileId: ProfileId, promptContext?: string): void {
  const promptContextPolicy = resolvePolicyOrExit(promptContext);
  if (!promptContextPolicy) return;
  void import('./index.js')
    .then((m) => m.startStdio(profileId, { promptContextPolicy }))
    .catch((err: unknown) => {
      console.error('Fatal:', err);
      process.exit(1);
    });
}

function runHttp(promptContext?: string): void {
  const policy = resolvePolicyOrExit(promptContext);
  if (!policy) return;
  void import('./http.js')
    .then((m) => m.startHttp({ promptContextPolicy: policy }))
    .catch((err: unknown) => {
      console.error('Fatal:', err);
      process.exit(1);
    });
}

/** Lazy so `lightdash-mcp http` does not load all ToolModules for offline help. */
function profilesHelpText(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- help-only inventory
  const { formatProfilesHelp } = require('./cli-help.js') as {
    formatProfilesHelp: () => string;
  };
  return formatProfilesHelp();
}

const profileList = PROFILE_IDS.join(', ');
const promptContextHelp = `Prompt context policy (${PROMPT_CONTEXT_POLICIES.join('|')}; env: ${ENV_LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT})`;

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
  .option('--prompt-context <policy>', promptContextHelp)
  .addHelpText('after', profilesHelpText)
  .action((opts: { profile: string; promptContext?: string }) => {
    const id = parseProfileId(opts.profile);
    if (!id) {
      console.error(`Invalid profile '${opts.profile}'. Expected one of: ${profileList}.`);
      process.exitCode = 1;
      return;
    }
    runStdio(id, opts.promptContext);
  });

program
  .command('http')
  .description('Run MCP server over Streamable HTTP (fixed profile paths)')
  .option('--prompt-context <policy>', promptContextHelp)
  .addHelpText('after', profilesHelpText)
  .action((opts: { promptContext?: string }) => {
    runHttp(opts.promptContext);
  });

program.parse(process.argv);

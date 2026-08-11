#!/usr/bin/env node
import { PROFILE_IDS, type ProfileId } from '@lightdash-tools/common';
import { Command } from 'commander';

import { formatProfilesHelp } from './cli-help.js';
import { ENV_LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT } from './config/env.js';
import {
  PROMPT_CONTEXT_POLICIES,
  resolvePromptContextPolicy,
  type PromptContextPolicy,
} from './config/prompt-context-policy.js';
import { parseProfileId } from './profiles/index.js';
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
  void import('./index.js').then((m) => {
    m.startStdio(profileId, { promptContextPolicy });
  });
}

function runHttp(promptContext?: string): void {
  const policy = resolvePolicyOrExit(promptContext);
  if (!policy) return;
  // Resolve early so invalid CLI fails before HTTP boot; HTTP reads env at load.
  process.env[ENV_LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT] = policy;
  void import('./http.js');
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
  .addHelpText('after', formatProfilesHelp)
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
  .addHelpText('after', formatProfilesHelp)
  .action((opts: { promptContext?: string }) => {
    runHttp(opts.promptContext);
  });

program.parse(process.argv);

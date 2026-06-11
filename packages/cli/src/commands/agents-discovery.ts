/**
 * Agent discovery commands — preferences, suggestions, models, readiness.
 */

import {
  READ_ONLY_DEFAULT,
  WRITE_DESTRUCTIVE,
  WRITE_IDEMPOTENT,
} from '@lightdash-tools/common';

import { getClient } from '../utils/client';
import { readParsedInput } from '../utils/file-input';
import { wrapAction } from '../utils/safety';

import type { Command } from 'commander';

type DiscoveryClientMethod =
  | 'getUserAgentPreferences'
  | 'setUserAgentPreferences'
  | 'deleteUserAgentPreferences'
  | 'listAgentSuggestions'
  | 'listAgentModels'
  | 'evaluateAgentReadiness';

type DiscoveryClient = Record<DiscoveryClientMethod, ((...args: unknown[]) => Promise<unknown>) | undefined>;

function requireClientMethod(
  client: unknown,
  methodName: DiscoveryClientMethod,
): (...args: unknown[]) => Promise<unknown> {
  const discoveryClient = client as DiscoveryClient;
  const candidate = discoveryClient[methodName];
  if (typeof candidate !== 'function') {
    console.error(
      `Error: client.v1.aiAgents.${methodName}() is not implemented in @lightdash-tools/client yet.`,
    );
    console.error(
      'Discovery endpoints are defined in the OpenAPI schema but the HTTP client facade has no method.',
    );
    process.exit(1);
  }
  return candidate.bind(client);
}

/**
 * Registers discovery subcommands on the `agents` command group.
 */
export function registerAgentsDiscoveryCommands(agentsCmd: Command): void {
  const preferencesCmd = agentsCmd
    .command('preferences')
    .description('Manage per-user AI agent preferences in a project');

  preferencesCmd
    .command('get')
    .description('Get current user agent preferences for a project')
    .requiredOption('--project <uuid>', 'Project UUID')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async function (this: Command) {
        const { project } = this.opts() as { project: string };
        try {
          const client = getClient();
          const getPreferences = requireClientMethod(client.v1.aiAgents, 'getUserAgentPreferences');
          const result = await getPreferences(project);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error fetching agent preferences:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  preferencesCmd
    .command('set')
    .description('Set user agent preferences (flags or JSON/YAML via --file/--stdin)')
    .requiredOption('--project <uuid>', 'Project UUID')
    .option('--default-agent <uuid>', 'Default agent UUID for the project')
    .option('--file <path>', 'Read preferences JSON/YAML from file')
    .option('--stdin', 'Read preferences JSON/YAML from stdin')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async function (this: Command) {
        const options = this.opts() as {
          project: string;
          defaultAgent?: string;
          file?: string;
          stdin?: boolean;
        };
        let body: Record<string, unknown>;
        if (options.file != null || options.stdin === true || !process.stdin.isTTY) {
          const parsed = await readParsedInput({ file: options.file, stdin: options.stdin });
          if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            console.error('Error: preferences input must be a JSON/YAML object');
            process.exit(1);
          }
          body = parsed as Record<string, unknown>;
        } else if (options.defaultAgent != null) {
          body = { defaultAgentUuid: options.defaultAgent };
        } else {
          console.error(
            'Error: provide --default-agent or preferences via --file/--stdin',
          );
          process.exit(1);
        }
        try {
          const client = getClient();
          const setPreferences = requireClientMethod(client.v1.aiAgents, 'setUserAgentPreferences');
          const result = await setPreferences(options.project, body);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error setting agent preferences:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  preferencesCmd
    .command('delete')
    .description('Clear user agent preferences for a project')
    .requiredOption('--project <uuid>', 'Project UUID')
    .action(
      wrapAction(WRITE_DESTRUCTIVE, async function (this: Command) {
        const { project } = this.opts() as { project: string };
        try {
          const client = getClient();
          const deletePreferences = requireClientMethod(
            client.v1.aiAgents,
            'deleteUserAgentPreferences',
          );
          const result = await deletePreferences(project);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error deleting agent preferences:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  agentsCmd
    .command('suggestions <agentUuid>')
    .description('List verified question suggestions for an agent')
    .requiredOption('--project <uuid>', 'Project UUID')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (agentUuid: string, cmd: Command) => {
        const { project } = cmd.opts() as { project: string };
        try {
          const client = getClient();
          const listSuggestions = requireClientMethod(client.v1.aiAgents, 'listAgentSuggestions');
          const result = await listSuggestions(project, agentUuid);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error listing agent suggestions:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  agentsCmd
    .command('models')
    .description('List available AI model options for agents in a project')
    .requiredOption('--project <uuid>', 'Project UUID')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async function (this: Command) {
        const { project } = this.opts() as { project: string };
        try {
          const client = getClient();
          const listModels = requireClientMethod(client.v1.aiAgents, 'listAgentModels');
          const result = await listModels(project);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error listing agent models:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );

  const readinessCmd = agentsCmd
    .command('readiness')
    .description('Agent release readiness checks');

  readinessCmd
    .command('evaluate <agentUuid>')
    .description('Evaluate release readiness score for an agent')
    .requiredOption('--project <uuid>', 'Project UUID')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (agentUuid: string, cmd: Command) => {
        const { project } = cmd.opts() as { project: string };
        try {
          const client = getClient();
          const evaluateReadiness = requireClientMethod(
            client.v1.aiAgents,
            'evaluateAgentReadiness',
          );
          const result = await evaluateReadiness(project, agentUuid);
          console.log(JSON.stringify(result, null, 2));
        } catch (error) {
          console.error(
            'Error evaluating agent readiness:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );
}

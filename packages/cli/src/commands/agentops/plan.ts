/**
 * agentops plan — validate bundle, fetch current state, compute diff (read-only).
 */

import {
  READ_ONLY_DEFAULT,
  computeBundleDiff,
  parseLightdashAiAgentBundle,
} from '@lightdash-tools/common';

import { getClient } from '../../utils/client';
import { readFileOrStdin } from '../../utils/file-input';
import { assertAllowedProject, wrapAction } from '../../utils/safety';

import { fetchBundleCurrentState } from './state';

import type { Command } from 'commander';

export function registerAgentopsPlanCommand(agentopsCmd: Command): void {
  agentopsCmd
    .command('plan')
    .description('Validate an agent bundle and show the planned diff (read-only)')
    .option('--file <path>', 'Path to bundle YAML file')
    .option('--stdin', 'Read bundle YAML from stdin')
    .option('--output <format>', 'Output format: json', 'json')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async function (this: Command) {
        const options = this.opts() as { file?: string; stdin?: boolean; output?: string };
        if (options.output !== 'json') {
          console.error(
            `Error: unsupported --output '${options.output}'. Only 'json' is supported.`,
          );
          process.exit(1);
        }
        try {
          const content = await readFileOrStdin({ file: options.file, stdin: options.stdin });
          const bundle = parseLightdashAiAgentBundle(content);
          assertAllowedProject(this, bundle.spec.projectUuid);
          const client = getClient();
          const current = await fetchBundleCurrentState(client, bundle);
          const diff = computeBundleDiff(bundle, current);
          console.log(JSON.stringify(diff, null, 2));
        } catch (error) {
          console.error(
            'Error planning bundle:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );
}

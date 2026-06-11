/**
 * agentops drift — detect configuration drift vs desired bundle state.
 */

import { READ_ONLY_DEFAULT, detectBundleDrift, parseLightdashAiAgentBundle } from '@lightdash-tools/common';

import { getClient } from '../../utils/client';
import { wrapAction } from '../../utils/safety';
import { readYamlInput } from '../agentops';
import { fetchBundleCurrentState } from './state';

import type { Command } from 'commander';

export function registerAgentopsDriftCommand(agentopsCmd: Command): void {
  agentopsCmd
    .command('drift')
    .description('Detect drift between bundle desired state and Lightdash')
    .option('--file <path>', 'Path to bundle YAML file')
    .option('--stdin', 'Read bundle YAML from stdin')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async function (this: Command) {
        const options = this.opts() as { file?: string; stdin?: boolean };
        try {
          const content = await readYamlInput({ file: options.file, stdin: options.stdin });
          const bundle = parseLightdashAiAgentBundle(content);
          const client = getClient();
          const current = await fetchBundleCurrentState(client, bundle);
          const { hasDrift, diff } = detectBundleDrift(bundle, current);
          console.log(
            JSON.stringify(
              {
                bundleName: bundle.metadata.name,
                projectUuid: bundle.spec.projectUuid,
                hasDrift,
                summary: diff.summary,
                changes: diff.changes.filter((c) => c.operation !== 'noop'),
              },
              null,
              2,
            ),
          );
          if (hasDrift) {
            process.exit(1);
          }
        } catch (error) {
          console.error('Error detecting drift:', error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }),
    );
}

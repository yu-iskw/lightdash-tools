/**
 * agentops apply — apply bundle diff to Lightdash.
 */

import { applyBundleDiff } from '@lightdash-tools/client';
import {
  WRITE_DESTRUCTIVE,
  WRITE_NONDESTRUCTIVE,
  computeBundleDiff,
  isAllowed,
  parseLightdashAiAgentBundle,
} from '@lightdash-tools/common';

import { getClient } from '../../utils/client';
import { readFileOrStdin } from '../../utils/file-input';
import { assertAllowedProject, getSafetyMode, wrapAction } from '../../utils/safety';

import { fetchBundleCurrentState } from './state';

import type { Command } from 'commander';

export function registerAgentopsApplyCommand(agentopsCmd: Command): void {
  agentopsCmd
    .command('apply')
    .description('Apply an agent bundle to Lightdash')
    .option('--file <path>', 'Path to bundle YAML file')
    .option('--stdin', 'Read bundle YAML from stdin')
    .action(
      wrapAction(WRITE_NONDESTRUCTIVE, async function (this: Command) {
        const options = this.opts() as { file?: string; stdin?: boolean };
        try {
          const content = await readFileOrStdin({ file: options.file, stdin: options.stdin });
          const bundle = parseLightdashAiAgentBundle(content);
          assertAllowedProject(this, bundle.spec.projectUuid);
          const client = getClient();
          const current = await fetchBundleCurrentState(client, bundle);
          const diff = computeBundleDiff(bundle, current);

          if (diff.summary.deletes > 0 && !isAllowed(getSafetyMode(this), WRITE_DESTRUCTIVE)) {
            console.error(
              'Error: bundle requires destructive operations (deletes). Use --safety-mode write-destructive.',
            );
            process.exit(1);
          }

          const result = await applyBundleDiff(client, bundle, diff.changes);
          console.log(
            JSON.stringify(
              {
                bundleName: bundle.metadata.name,
                projectUuid: bundle.spec.projectUuid,
                summary: diff.summary,
                applied: result.applied,
                skipped: result.skipped,
                failed: result.failed,
              },
              null,
              2,
            ),
          );

          if (result.failed.length > 0) {
            process.exit(1);
          }
        } catch (error) {
          console.error(
            'Error applying bundle:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );
}

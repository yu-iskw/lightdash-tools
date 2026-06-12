/**
 * agentops bundle-schema — emit JSON Schema for LightdashAiAgentBundle.
 */

import { READ_ONLY_DEFAULT, getLightdashAiAgentBundleJsonSchema } from '@lightdash-tools/common';

import { wrapAction } from '../../utils/safety';

import type { Command } from 'commander';

export function registerAgentopsBundleSchemaCommand(agentopsCmd: Command): void {
  agentopsCmd
    .command('bundle-schema')
    .description('Print JSON Schema for LightdashAiAgentBundle documents')
    .action(
      wrapAction(READ_ONLY_DEFAULT, () => {
        console.log(JSON.stringify(getLightdashAiAgentBundleJsonSchema(), null, 2));
      }),
    );
}

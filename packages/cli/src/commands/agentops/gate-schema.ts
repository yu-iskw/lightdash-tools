/**
 * agentops gate-schema — emit JSON Schema for LightdashAiEvaluationGate.
 */

import { READ_ONLY_DEFAULT, getLightdashAiEvaluationGateJsonSchema } from '@lightdash-tools/common';

import { wrapAction } from '../../utils/safety';

import type { Command } from 'commander';

export function registerAgentopsGateSchemaCommand(agentopsCmd: Command): void {
  agentopsCmd
    .command('gate-schema')
    .description('Print JSON Schema for LightdashAiEvaluationGate documents')
    .action(
      wrapAction(READ_ONLY_DEFAULT, () => {
        console.log(JSON.stringify(getLightdashAiEvaluationGateJsonSchema(), null, 2));
      }),
    );
}

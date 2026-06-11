/**
 * agentops apply — apply bundle diff to Lightdash.
 */

import {
  WRITE_DESTRUCTIVE,
  WRITE_NONDESTRUCTIVE,
  computeBundleDiff,
  isAllowed,
  parseLightdashAiAgentBundle,
} from '@lightdash-tools/common';

import { getClient } from '../../utils/client';
import { getSafetyMode, wrapAction } from '../../utils/safety';
import { readYamlInput } from '../agentops';
import { fetchBundleCurrentState } from './state';

import type { BundleAgentSpec, BundleDiffChange, LightdashAiAgentBundle } from '@lightdash-tools/common';
import type { Command } from 'commander';

function findDesiredAgent(bundle: LightdashAiAgentBundle, key: string): BundleAgentSpec | undefined {
  return bundle.spec.agents.find((a) => a.key === key);
}

function findDesiredEvaluation(
  agent: BundleAgentSpec,
  key: string,
): BundleAgentSpec['evaluations'][number] | undefined {
  return agent.evaluations.find((e) => e.key === key);
}

async function applyDiff(
  bundle: LightdashAiAgentBundle,
  changes: BundleDiffChange[],
): Promise<{ applied: number; skipped: number }> {
  const client = getClient();
  const projectUuid = bundle.spec.projectUuid;
  let applied = 0;
  let skipped = 0;
  const agentUuidByKey = new Map<string, string>();

  for (const change of changes) {
    if (change.operation === 'noop') {
      skipped++;
      continue;
    }

    if (change.resourceType === 'agent' && change.operation === 'create') {
      const desired = findDesiredAgent(bundle, change.key);
      if (!desired) continue;
      const createBody = {
        name: desired.name,
        projectUuid,
        description: desired.description ?? null,
        instruction: desired.instruction ?? null,
        tags: desired.tags ?? null,
        ...(desired.enableDataAccess != null ? { enableDataAccess: desired.enableDataAccess } : {}),
        ...(desired.enableSelfImprovement != null
          ? { enableSelfImprovement: desired.enableSelfImprovement }
          : {}),
        ...(desired.enableReasoning != null ? { enableReasoning: desired.enableReasoning } : {}),
      } as Parameters<typeof client.v1.aiAgents.createAgent>[1];
      const created = await client.v1.aiAgents.createAgent(projectUuid, createBody);
      agentUuidByKey.set(desired.key, created.uuid);
      applied++;
      continue;
    }

    if (change.resourceType === 'agent' && change.operation === 'update') {
      const desired = findDesiredAgent(bundle, change.key);
      if (!desired) continue;
      const agentUuid = desired.uuid ?? agentUuidByKey.get(desired.key);
      if (!agentUuid) continue;
      await client.v1.aiAgents.updateAgent(projectUuid, agentUuid, {
        uuid: agentUuid,
        name: desired.name,
        description: desired.description ?? null,
        instruction: desired.instruction ?? null,
        tags: desired.tags ?? null,
        enableDataAccess: desired.enableDataAccess,
        enableSelfImprovement: desired.enableSelfImprovement,
        enableReasoning: desired.enableReasoning,
      });
      agentUuidByKey.set(desired.key, agentUuid);
      applied++;
      continue;
    }

    if (change.resourceType === 'agent' && change.operation === 'delete') {
      await client.v1.aiAgents.deleteAgent(projectUuid, change.key);
      applied++;
      continue;
    }

    if (change.resourceType === 'evaluation' && change.operation === 'create') {
      const desiredAgent = change.agentKey ? findDesiredAgent(bundle, change.agentKey) : undefined;
      const desiredEval =
        desiredAgent && change.key ? findDesiredEvaluation(desiredAgent, change.key) : undefined;
      if (!desiredAgent || !desiredEval) continue;
      const agentUuid =
        change.agentUuid ?? desiredAgent.uuid ?? agentUuidByKey.get(desiredAgent.key);
      if (!agentUuid) continue;
      const createEvalBody = {
        title: desiredEval.title,
        ...(desiredEval.description != null ? { description: desiredEval.description } : {}),
        prompts: desiredEval.prompts.map((p) =>
          'prompt' in p
            ? { prompt: p.prompt, expectedResponse: p.expectedResponse ?? null }
            : {
                threadUuid: p.threadUuid,
                promptUuid: p.promptUuid,
                expectedResponse: p.expectedResponse ?? null,
              },
        ),
      } as Parameters<typeof client.v1.aiAgents.createEvaluation>[2];
      await client.v1.aiAgents.createEvaluation(projectUuid, agentUuid, createEvalBody);
      applied++;
      continue;
    }

    if (change.resourceType === 'evaluation' && change.operation === 'update') {
      const desiredAgent = change.agentKey ? findDesiredAgent(bundle, change.agentKey) : undefined;
      const desiredEval =
        desiredAgent && change.key ? findDesiredEvaluation(desiredAgent, change.key) : undefined;
      if (!desiredAgent || !desiredEval) continue;
      const agentUuid =
        change.agentUuid ?? desiredAgent.uuid ?? agentUuidByKey.get(desiredAgent.key);
      const evalUuid = desiredEval.uuid;
      if (!agentUuid || !evalUuid) continue;
      const updateEvalBody = {
        title: desiredEval.title,
        ...(desiredEval.description != null ? { description: desiredEval.description } : {}),
        prompts: desiredEval.prompts.map((p) =>
          'prompt' in p
            ? { prompt: p.prompt, expectedResponse: p.expectedResponse ?? null }
            : {
                threadUuid: p.threadUuid,
                promptUuid: p.promptUuid,
                expectedResponse: p.expectedResponse ?? null,
              },
        ),
      } as Parameters<typeof client.v1.aiAgents.updateEvaluation>[3];
      await client.v1.aiAgents.updateEvaluation(projectUuid, agentUuid, evalUuid, updateEvalBody);
      applied++;
      continue;
    }

    if (change.resourceType === 'evaluation' && change.operation === 'delete') {
      const desiredAgent = change.agentKey ? findDesiredAgent(bundle, change.agentKey) : undefined;
      const agentUuid =
        change.agentUuid ??
        desiredAgent?.uuid ??
        (change.agentKey ? agentUuidByKey.get(change.agentKey) : undefined);
      if (!agentUuid) continue;
      await client.v1.aiAgents.deleteEvaluation(projectUuid, agentUuid, change.key);
      applied++;
    }
  }

  return { applied, skipped };
}

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
          const content = await readYamlInput({ file: options.file, stdin: options.stdin });
          const bundle = parseLightdashAiAgentBundle(content);
          const client = getClient();
          const current = await fetchBundleCurrentState(client, bundle);
          const diff = computeBundleDiff(bundle, current);

          if (diff.summary.deletes > 0 && !isAllowed(getSafetyMode(this), WRITE_DESTRUCTIVE)) {
            console.error(
              'Error: bundle requires destructive operations (deletes). Use --safety-mode write-destructive.',
            );
            process.exit(1);
          }

          const result = await applyDiff(bundle, diff.changes);
          console.log(
            JSON.stringify(
              {
                bundleName: bundle.metadata.name,
                projectUuid: bundle.spec.projectUuid,
                summary: diff.summary,
                applied: result.applied,
                skipped: result.skipped,
              },
              null,
              2,
            ),
          );
        } catch (error) {
          console.error('Error applying bundle:', error instanceof Error ? error.message : String(error));
          process.exit(1);
        }
      }),
    );
}

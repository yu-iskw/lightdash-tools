/**
 * MCP resources for AI agent evaluations (RFC Phase 2).
 */

import { areAllProjectsAllowed } from '@lightdash-tools/common';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

import { createAiAgentCompletionCallbacks } from '../completion/index.js';
import { getAllowedProjectUuids } from '../config.js';

import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const EVALUATION_RUN_RESULTS_URI_TEMPLATE =
  'lightdash://projects/{projectUuid}/ai-agents/{agentUuid}/evaluations/{evalUuid}/runs/{runUuid}/results';

function assertProjectAllowed(projectUuid: string): void {
  const allowlist = getAllowedProjectUuids();
  if (allowlist.length > 0 && !areAllProjectsAllowed(allowlist, [projectUuid])) {
    throw new Error(
      `Project ${projectUuid} is not in the list of allowed projects. Allowed: [${allowlist.join(', ')}].`,
    );
  }
}

export function registerAiAgentResources(server: McpServer, client: LightdashClient): void {
  const complete = createAiAgentCompletionCallbacks(client);

  const template = new ResourceTemplate(EVALUATION_RUN_RESULTS_URI_TEMPLATE, {
    list: undefined,
    complete: {
      projectUuid: complete.projectUuid,
      agentUuid: complete.agentUuid,
      evalUuid: complete.evalUuid,
      runUuid: complete.runUuid,
    },
  });

  server.registerResource(
    'ai_agent_evaluation_run_results',
    template,
    {
      title: 'AI agent evaluation run results',
      description:
        'Detailed per-prompt results for a specific AI agent evaluation run, including pass/fail and assessments',
      mimeType: 'application/json',
    },
    async (uri, variables) => {
      const projectUuid = String(variables.projectUuid);
      const agentUuid = String(variables.agentUuid);
      const evalUuid = String(variables.evalUuid);
      const runUuid = String(variables.runUuid);
      assertProjectAllowed(projectUuid);
      const results = await client.v1.aiAgents.getEvaluationRunResults(
        projectUuid,
        agentUuid,
        evalUuid,
        runUuid,
      );
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    },
  );
}

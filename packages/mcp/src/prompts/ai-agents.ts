/**
 * MCP prompts for AI agent lifecycle and evaluation workflows (RFC Phase 2).
 */

import { completable } from '@modelcontextprotocol/sdk/server/completable.js';
import { z } from 'zod';

import {
  createAgentUuidCompleter,
  createEvalUuidCompleter,
  createProjectUuidCompleter,
} from '../completion/ai-agents.js';
import { MCP_PROFILE_CORE_LIFECYCLE, MCP_PROFILE_EVALUATIONS, hasMcpProfile } from '../config.js';

import type { McpProfile } from '../config.js';
import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

function scopedArgsSchema(
  contextProvider: McpContextProvider,
  fields: {
    projectUuid?: boolean;
    agentUuid?: boolean;
    evalUuid?: boolean;
    focusArea?: boolean;
    releaseVersion?: boolean;
  },
) {
  const shape: Record<string, z.ZodType> = {};
  if (fields.projectUuid) {
    shape.projectUuid = completable(
      z.string().describe('Project UUID'),
      createProjectUuidCompleter(contextProvider),
    );
  }
  if (fields.agentUuid) {
    shape.agentUuid = completable(
      z.string().describe('Agent UUID'),
      createAgentUuidCompleter(contextProvider),
    );
  }
  if (fields.evalUuid) {
    shape.evalUuid = completable(
      z.string().describe('Evaluation UUID'),
      createEvalUuidCompleter(contextProvider),
    );
  }
  if (fields.focusArea) {
    shape.focusArea = z.string().optional().describe('Optional focus area for the review');
  }
  if (fields.releaseVersion) {
    shape.releaseVersion = z
      .string()
      .optional()
      .describe('Release or deployment version to validate');
  }
  return shape;
}

export function registerAiAgentPrompts(
  server: McpServer,
  contextProvider: McpContextProvider,
  profiles: Set<McpProfile>,
): void {
  if (hasMcpProfile(MCP_PROFILE_CORE_LIFECYCLE, profiles)) {
    server.registerPrompt(
      'lightdash_ai_agent_review',
      {
        title: 'Review AI agent configuration',
        description:
          'Structured review of an AI agent configuration, instruction, and integration settings before changes go live',
        argsSchema: scopedArgsSchema(contextProvider, {
          projectUuid: true,
          agentUuid: true,
          focusArea: true,
        }),
      },
      async ({ projectUuid, agentUuid, focusArea }) => {
        const focus = focusArea ? ` Focus on: ${focusArea}.` : '';
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: [
                  'Review the Lightdash AI agent configuration for quality and safety.',
                  `Project: ${projectUuid}`,
                  `Agent: ${agentUuid}.${focus}`,
                  'Use MCP tools to fetch the agent definition, recent threads, and org AI settings.',
                  'Summarize risks, instruction clarity, data-access scope, and recommended changes.',
                ].join('\n'),
              },
            },
          ],
        };
      },
    );

    server.registerPrompt(
      'lightdash_ai_release_check',
      {
        title: 'AI agent release readiness check',
        description:
          'Pre-release checklist for AI agent changes covering evaluations, regressions, and rollout guardrails',
        argsSchema: scopedArgsSchema(contextProvider, {
          projectUuid: true,
          agentUuid: true,
          releaseVersion: true,
        }),
      },
      async ({ projectUuid, agentUuid, releaseVersion }) => {
        const version = releaseVersion ? ` Release: ${releaseVersion}.` : '';
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: [
                  'Run a release readiness check for a Lightdash AI agent.',
                  `Project: ${projectUuid}`,
                  `Agent: ${agentUuid}.${version}`,
                  'Verify evaluation suites exist, latest runs pass, and safety settings match policy.',
                  'Report blockers, warnings, and a go/no-go recommendation.',
                ].join('\n'),
              },
            },
          ],
        };
      },
    );
  }

  if (hasMcpProfile(MCP_PROFILE_EVALUATIONS, profiles)) {
    server.registerPrompt(
      'lightdash_ai_evaluation_triage',
      {
        title: 'Triage AI evaluation failures',
        description:
          'Investigate failing evaluation runs, cluster failure patterns, and propose fixes or new test cases',
        argsSchema: scopedArgsSchema(contextProvider, {
          projectUuid: true,
          agentUuid: true,
          evalUuid: true,
        }),
      },
      async ({ projectUuid, agentUuid, evalUuid }) => {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: [
                  'Triage failing prompts in a Lightdash AI agent evaluation suite.',
                  `Project: ${projectUuid}`,
                  `Agent: ${agentUuid}`,
                  `Evaluation: ${evalUuid}`,
                  'List recent runs, fetch the latest failing run results, and group failures by theme.',
                  'For each cluster, suggest root cause and concrete next steps (prompt, instruction, or data fix).',
                ].join('\n'),
              },
            },
          ],
        };
      },
    );
  }
}

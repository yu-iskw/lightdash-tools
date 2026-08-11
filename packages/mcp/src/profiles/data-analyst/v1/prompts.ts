/**
 * MCP prompts for data-analyst workflows (progressive-disclosure context).
 */

/* eslint-disable @typescript-eslint/no-deprecated -- matches other profile prompt registration pattern */
import { z } from 'zod';

import { optionalProjectUuidField } from '../../../tools/lib/schema-fields.js';
import { bindProfilePromptContext } from '../../lib/prompt-context.js';

import { DATA_ANALYST_DEFAULT_INVARIANT_IDS, DATA_ANALYST_INVARIANTS } from './invariants.js';
import {
  DATA_ANALYST_CORE_PLAYBOOK,
  DATA_ANALYST_TOPIC_META,
  DATA_ANALYST_TOPIC_PLAYBOOKS,
} from './resources/playbooks.js';

import type { RegisterPromptsOptions } from '../../types.js';
import type { McpServer } from '@modelcontextprotocol/server';

const bindPromptContext = bindProfilePromptContext({
  invariants: DATA_ANALYST_INVARIANTS,
  core: DATA_ANALYST_CORE_PLAYBOOK,
  topics: DATA_ANALYST_TOPIC_PLAYBOOKS,
  topicMeta: DATA_ANALYST_TOPIC_META,
});

export function registerDataAnalystPrompts(
  server: McpServer,
  options?: RegisterPromptsOptions,
): void {
  const promptContext = bindPromptContext(options?.promptContextPolicy);
  const invariantIds = DATA_ANALYST_DEFAULT_INVARIANT_IDS;

  server.registerPrompt(
    'explore_data',
    {
      title: 'Explore data',
      description:
        'Explore a Lightdash project with unsaved metric queries (dimensions, metrics, filters) — do not save charts',
      argsSchema: {
        projectUuid: optionalProjectUuidField(),
        question: z.string(),
        exploreHint: z.string().optional(),
      },
    },
    ({ projectUuid, question, exploreHint }) =>
      promptContext({
        task: `Answer this data question by exploring the semantic layer and running unsaved metric queries:

${question}

Project: ${projectUuid ?? '(use HTTP pin or ask for projectUuid — PROJECT_SCOPE_REQUIRED otherwise)'}.
Explore hint: ${exploreHint ?? '(discover with list_explores search+limit)'}.

Procedure:
1. get_project; record analystCapabilities.
2. list_explores (search+limit≤15) → get_explore → lock exploreName.
3. Copy fieldIds from list_dimensions / list_metrics (or get_explore base-table metrics). Never invent fieldIds.
4. Optional compile_query; then run_metric_query with small limit. Poll get_query_result if needed.
5. Iterate filters/fields. Do not save charts unless the user asks.`,
        invariantIds,
        requiredTopics: ['explore'],
      }),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */

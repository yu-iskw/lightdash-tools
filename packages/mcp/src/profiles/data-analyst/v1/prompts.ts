/**
 * MCP prompts for data-analyst workflows.
 */

/* eslint-disable @typescript-eslint/no-deprecated -- matches other profile prompt registration pattern */
import { z } from 'zod';

import { optionalProjectUuidField } from '../../../tools/lib/schema-fields.js';
import { createPromptPlaybookEmbedder } from '../../lib/playbook-resources.js';

import {
  DATA_ANALYST_CORE_PLAYBOOK,
  DATA_ANALYST_HARD_BANS,
  DATA_ANALYST_TOPIC_PLAYBOOKS,
} from './resources/playbooks.js';

import type { McpServer } from '@modelcontextprotocol/server';

const userMessages = createPromptPlaybookEmbedder({
  core: DATA_ANALYST_CORE_PLAYBOOK,
  topics: DATA_ANALYST_TOPIC_PLAYBOOKS,
});

export function registerDataAnalystPrompts(server: McpServer): void {
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
      userMessages(
        `Answer this data question by exploring the semantic layer and running unsaved metric queries:

${question}

${DATA_ANALYST_HARD_BANS}

Project: ${projectUuid ?? '(use HTTP pin or ask for projectUuid — PROJECT_SCOPE_REQUIRED otherwise)'}.
Explore hint: ${exploreHint ?? '(discover with list_explores search+limit)'}.

Procedure:
1. get_project; record analystCapabilities.
2. list_explores (search+limit≤15) → get_explore → lock exploreName.
3. Copy fieldIds from list_dimensions / list_metrics (or get_explore base-table metrics). Never invent fieldIds.
4. Optional compile_query; then run_metric_query with small limit. Poll get_query_result if needed.
5. Iterate filters/fields. Do not save charts unless the user asks.`,
        'explore',
      ),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */

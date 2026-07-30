/**
 * MCP prompts for semantic-layer discovery and compile workflows.
 */

import { z } from 'zod';

import { exploreIdField, projectUuidField } from '../../tools/schema-fields.js';

import {
  getPlaybookMarkdown,
  SEMANTIC_LAYER_HARD_BANS,
  SEMANTIC_LAYER_PLAYBOOK_MIME,
  SEMANTIC_LAYER_PLAYBOOK_URI,
} from './resources/playbook.js';

import type { McpServer } from '@modelcontextprotocol/server';

function playbookEmbeddedResource() {
  return {
    type: 'resource' as const,
    resource: {
      uri: SEMANTIC_LAYER_PLAYBOOK_URI,
      mimeType: SEMANTIC_LAYER_PLAYBOOK_MIME,
      text: getPlaybookMarkdown(),
    },
  };
}

function userMessages(text: string) {
  return {
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text,
        },
      },
      {
        role: 'user' as const,
        content: playbookEmbeddedResource(),
      },
    ],
  };
}

export function registerSemanticLayerPrompts(server: McpServer): void {
  server.registerPrompt(
    'lightdash_semantic_explore',
    {
      title: 'Explore semantic layer',
      description:
        'Locate explores, metrics, and dimensions for a question without running warehouse queries',
      argsSchema: z.object({
        projectUuid: projectUuidField(),
        question: z.string().optional().describe('Natural-language question or topic'),
      }),
    },
    async ({ projectUuid, question }) => {
      const topic = question ? ` Question/topic: ${question}.` : '';
      return userMessages(
        [
          'Discover the Lightdash semantic layer for this project. Compile is out of scope unless asked.',
          `Project: ${projectUuid}.${topic}`,
          SEMANTIC_LAYER_HARD_BANS,
          'Procedure:',
          '1) If the user gave BigQuery/`bq ls` hints: dataset → prefer schemaName; TABLE → list_explores search; partition/time field → candidate dimension later.',
          '2) Always ldt__list_explores with search+limit (never default first-N). Disambiguate: exact label + schemaName (prefer dwh_* warehouse table; skip empty schemaName when a dataset was given; deprioritize eda_/reporting_/mre_).',
          '3) ldt__list_dimensions (base-table fieldIds). For metrics: search specific keywords from the question (nps, session, …) — not the table/explore id; avoid broad-only tokens like count/sum as a first search. Keep rows with tableName === explore id.',
          'Deliverable: shortlist name/label/schemaName/tags/fieldId (+ why chosen). Do not dump get_explore or full dimension arrays.',
          `Follow the embedded playbook (${SEMANTIC_LAYER_PLAYBOOK_URI}). Use only ldt__* tools.`,
        ].join('\n'),
      );
    },
  );

  server.registerPrompt(
    'lightdash_semantic_compose_compile',
    {
      title: 'Compose and compile query',
      description:
        'Build a metric query and compile it with ldt__compile_query; never execute against the warehouse',
      argsSchema: z.object({
        projectUuid: projectUuidField(),
        question: z.string().optional().describe('What the query should answer'),
        exploreId: exploreIdField().optional(),
      }),
    },
    async ({ projectUuid, question, exploreId }) => {
      const topic = question ? ` Goal: ${question}.` : '';
      const explore = exploreId ? ` Preferred explore: ${exploreId}.` : '';
      return userMessages(
        [
          'Compose a Lightdash metric query and compile it with ldt__compile_query. Do not run the query.',
          `Project: ${projectUuid}.${topic}${explore}`,
          SEMANTIC_LAYER_HARD_BANS,
          'Procedure:',
          '1) If exploreId is missing, map any BigQuery/`bq ls` hints (dataset→schemaName, TABLE→search), then disambiguate (exact label + schemaName; warehouse table beats eda_/reporting_/mre_; skip empty schemaName when dataset known).',
          '2) Dimension fieldIds from ldt__list_dimensions (base table). Metrics: keyword search → filter tableName === explore id; metric wire ids are {exploreId}_{metricName}. metrics may be [] (e.g. volume-by-day via a time dimension).',
          '3) ldt__compile_query with fieldIds only. If isError about empty SELECT, switch to fieldIds and re-compile once.',
          '4) Verify SQL columns match the goal; stop.',
          'Deliverable: compiled SQL (or compile errors). Never paste full explore/dimension payloads.',
          `Follow the embedded playbook (${SEMANTIC_LAYER_PLAYBOOK_URI}).`,
        ].join('\n'),
      );
    },
  );

  server.registerPrompt(
    'lightdash_semantic_compile_debug',
    {
      title: 'Debug compile errors',
      description: 'Interpret ldt__compile_query failures, adjust the metric query, and re-compile',
      argsSchema: z.object({
        projectUuid: projectUuidField(),
        exploreId: exploreIdField(),
        errorText: z.string().optional().describe('Compile error text if already known'),
      }),
    },
    async ({ projectUuid, exploreId, errorText }) => {
      const err = errorText ? ` Error: ${errorText}` : '';
      return userMessages(
        [
          'Debug a failing ldt__compile_query call and re-compile until it succeeds or you explain blockers.',
          `Project: ${projectUuid}`,
          `Explore: ${exploreId}.${err}`,
          SEMANTIC_LAYER_HARD_BANS,
          'Checklist:',
          '- Empty SELECT / isError about empty SELECT → replace short names with fieldIds from ldt__list_dimensions (base table).',
          '- Unknown field id → re-list dimensions; confirm explore id is the disambiguated warehouse match (exact label + schemaName).',
          '- Metric not found → get_metric/list_metrics tableName must be the full explore id; search metric keywords not table names; compile metrics as {exploreId}_{metricName}.',
          'Deliverable: successful compile (SQL with expected columns) or a clear blocker. Stop after a good compile.',
          `Follow the embedded playbook (${SEMANTIC_LAYER_PLAYBOOK_URI}).`,
        ].join('\n'),
      );
    },
  );
}

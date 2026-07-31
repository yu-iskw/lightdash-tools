/**
 * MCP prompts for semantic-layer discovery and compile workflows.
 */

import { z } from 'zod';

import { exploreIdField, projectUuidField } from '../../../tools/schema-fields.js';

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
          '3) ldt__list_dimensions (base-table fieldIds) — shortlist high-signal fields (time grain, platform/utm, demographics); do not dump hundreds of nested dims.',
          '4) Metrics: keyword search (nps, 完了, …) then keep tableName === explore id. Table/explore-id search often returns zero; broad medico/session floods other tables. If filter yields zero, ldt__get_explore and list only tables[baseTable].metrics names/labels.',
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
          '2) Dimension fieldIds from ldt__list_dimensions (base table); prefer JST time grains, platform/utm, demographics. Metrics: keyword catalog → filter tableName === explore id; if empty, get_explore → tables[baseTable].metrics only. Wire ids are {exploreId}_{metricName}.',
          '3) If the user asked for N insights, reuse one explore resolution and compile N diverse cuts (trend, funnel, quality/NPS, outcome, acquisition) — see playbook Multi-insight composition.',
          '4) ldt__compile_query with fieldIds only. If isError about empty SELECT, switch to fieldIds and re-compile once.',
          '5) Verify SQL columns match the goal; stop (or next insight).',
          'Deliverable: insight title(s) + fieldIds + compiled SQL (or errors). Never paste full explore/dimension payloads.',
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
          '- Metric not found / catalog empty for this explore → get_explore tables[baseTable].metrics; get_metric/list_metrics tableName must be the full explore id; never search by table name alone; compile as {exploreId}_{metricName}.',
          'Deliverable: successful compile (SQL with expected columns) or a clear blocker. Stop after a good compile.',
          `Follow the embedded playbook (${SEMANTIC_LAYER_PLAYBOOK_URI}).`,
        ].join('\n'),
      );
    },
  );
}

/**
 * MCP prompts for semantic-layer discovery and compile workflows.
 */

import { z } from 'zod';

import {
  getPlaybookMarkdown,
  SEMANTIC_LAYER_PLAYBOOK_MIME,
  SEMANTIC_LAYER_PLAYBOOK_URI,
} from '../resources/playbook.js';
import { PROJECT_UUID_DESC } from '../tools/schema-fields.js';

import type { McpServer } from '@modelcontextprotocol/server';

const HARD_BANS =
  'Do not run metric/SQL/chart queries, use SQL runner, trigger validation jobs, mutate content, or call AI/identity tools. Those are not available on this server.';

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
        projectUuid: z.string().describe(PROJECT_UUID_DESC),
        question: z.string().optional().describe('Natural-language question or topic'),
      }),
    },
    async ({ projectUuid, question }) => {
      const topic = question ? ` Question/topic: ${question}.` : '';
      return userMessages(
        [
          'Discover the Lightdash semantic layer for this project.',
          `Project: ${projectUuid}.${topic}`,
          'Always use list_explores with search/limit. Do not use the default first-N explore list.',
          'Warehouse table names are search hints, not explore IDs. Disambiguate near-duplicates by exact label, then dataset path, then tags.',
          'list_metrics is catalog-wide: filter data[].tableName === chosen explore id; get_metric tableName is that explore id (not the warehouse label).',
          'Prefer list_dimensions rows where table === explore id (base table). Compile field IDs are fieldId / {table}_{name}.',
          HARD_BANS,
          'Deliverable: shortlist name/label/tags/fieldId only. Do not paste full get_explore, dimensions, or lineage JSON. Do not compile unless asked.',
          `Follow the embedded playbook (${SEMANTIC_LAYER_PLAYBOOK_URI}).`,
        ].join('\n'),
      );
    },
  );

  server.registerPrompt(
    'lightdash_semantic_compose_compile',
    {
      title: 'Compose and compile query',
      description:
        'Build a metric query and compile it with compile_query; never execute against the warehouse',
      argsSchema: z.object({
        projectUuid: z.string().describe(PROJECT_UUID_DESC),
        question: z.string().optional().describe('What the query should answer'),
        exploreId: z.string().optional().describe('Explore ID when already known'),
      }),
    },
    async ({ projectUuid, question, exploreId }) => {
      const topic = question ? ` Goal: ${question}.` : '';
      const explore = exploreId ? ` Preferred explore: ${exploreId}.` : '';
      return userMessages(
        [
          'Compose a Lightdash metric query and compile it. Do not run the query.',
          `Project: ${projectUuid}.${topic}${explore}`,
          'Always search explores; disambiguate if many matches. Prefer base-table dimensions (table === explore id).',
          'list_metrics: filter tableName === explore id; get_metric tableName is the explore id. Metric fieldIds are {exploreId}_{metricName}.',
          'Use list_dimensions fieldId values ({table}_{name}) in metricQuery. Short names may compile with an empty SELECT—treat that as failure and fix fieldIds.',
          'metricQuery needs exploreName, dimensions, metrics, filters, sorts, limit, tableCalculations.',
          HARD_BANS,
          'Deliverable: compiled SQL (verify expected columns) or compile errors. No raw dumps. Stop after compile_query.',
          `Follow the embedded playbook (${SEMANTIC_LAYER_PLAYBOOK_URI}).`,
        ].join('\n'),
      );
    },
  );

  server.registerPrompt(
    'lightdash_semantic_compile_debug',
    {
      title: 'Debug compile errors',
      description: 'Interpret compile_query failures, adjust the metric query, and re-compile',
      argsSchema: z.object({
        projectUuid: z.string().describe(PROJECT_UUID_DESC),
        exploreId: z.string().describe('Explore ID used in the failing compile'),
        errorText: z.string().optional().describe('Compile error text if already known'),
      }),
    },
    async ({ projectUuid, exploreId, errorText }) => {
      const err = errorText ? ` Error: ${errorText}` : '';
      return userMessages(
        [
          'Debug a failing Lightdash compile_query call and re-compile until it succeeds or you explain blockers.',
          `Project: ${projectUuid}`,
          `Explore: ${exploreId}.${err}`,
          'Check field IDs use {table}_{name} (from list_dimensions fieldId). Empty SELECT or missing columns means bad fieldIds—fix and re-compile.',
          'If get_field_lineage with fieldId returns null/empty, retry with the field short name (do not paste full lineage).',
          'get_metric tableName must be the explore id, not the warehouse label.',
          HARD_BANS,
          'Deliverable: successful compile (SQL with expected columns) or a clear blocker. Stop when compile succeeds or cannot proceed.',
          `Follow the embedded playbook (${SEMANTIC_LAYER_PLAYBOOK_URI}).`,
        ].join('\n'),
      );
    },
  );
}

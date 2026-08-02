/**
 * MCP prompts for semantic-layer discovery and compile workflows.
 */

import { z } from 'zod';

import { projectUuidField } from '../../../tools/lib/schema-fields.js';
import { exploreIdField } from '../../../tools/semantic/schema-fields.js';
import { createPromptPlaybookEmbedder } from '../../lib/playbook-resources.js';

import {
  SEMANTIC_LAYER_COMPOSE_COMPILE_URI,
  SEMANTIC_LAYER_CORE_PLAYBOOK,
  SEMANTIC_LAYER_CORE_URI,
  SEMANTIC_LAYER_EXPLORE_URI,
  SEMANTIC_LAYER_HARD_BANS,
  SEMANTIC_LAYER_TOPIC_PLAYBOOKS,
} from './resources/playbooks.js';

import type { McpServer } from '@modelcontextprotocol/server';

const userMessages = createPromptPlaybookEmbedder({
  core: SEMANTIC_LAYER_CORE_PLAYBOOK,
  topics: SEMANTIC_LAYER_TOPIC_PLAYBOOKS,
});

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
          '1) Stick to this projectUuid (do not switch from an org-wide list_projects). Warehouse/dataset/table hints are search keys only.',
          '2) Always lightdash_list_explores with search+limit; disambiguate per playbook (schemaName, label or name __{table}, skip empty schema when dataset known).',
          '3) Shortlist base-table dimensions by role; once explore is known prefer get_explore → tables[baseTable].metrics only (catalog keyword optional, still filter tableName === explore id).',
          'Deliverable: shortlist name/label/schemaName/fieldId (+ why). Do not dump full explore/dimension/metric/lineage payloads.',
          `Follow the embedded playbooks (${SEMANTIC_LAYER_CORE_URI}, ${SEMANTIC_LAYER_EXPLORE_URI}). Use only lightdash_* tools.`,
        ].join('\n'),
        'explore',
      );
    },
  );

  server.registerPrompt(
    'lightdash_semantic_compose_compile',
    {
      title: 'Compose and compile query',
      description:
        'Build a metric query and compile it with lightdash_compile_query; never execute against the warehouse',
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
          'Compose a Lightdash metric query and compile it with lightdash_compile_query. Do not run the query.',
          `Project: ${projectUuid}.${topic}${explore}`,
          SEMANTIC_LAYER_HARD_BANS,
          'Procedure:',
          '1) If exploreId is missing, resolve it per playbook (search + disambiguation).',
          '2) Use full fieldIds from list_dimensions / {exploreId}_{metricName}; prefer get_explore → tables[baseTable].metrics once explore is known.',
          '3) If the user asked for N insights, reuse one explore and compile N diverse cuts from available fields.',
          '4) Compile with fieldIds only; on empty SELECT or unknown field id, fix fieldIds and re-compile once. Extra related metrics in SQL can be OK. Stop after a good compile.',
          'Deliverable: insight title(s) + fieldIds + compiled SQL (or errors). Never paste full explore/dimension/metric/lineage payloads.',
          `Follow the embedded playbooks (${SEMANTIC_LAYER_CORE_URI}, ${SEMANTIC_LAYER_COMPOSE_COMPILE_URI}).`,
        ].join('\n'),
        'compose-compile',
      );
    },
  );

  server.registerPrompt(
    'lightdash_semantic_compile_debug',
    {
      title: 'Debug compile errors',
      description:
        'Interpret lightdash_compile_query failures, adjust the metric query, and re-compile',
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
          'Debug a failing lightdash_compile_query call and re-compile until it succeeds or you explain blockers.',
          `Project: ${projectUuid}`,
          `Explore: ${exploreId}.${err}`,
          SEMANTIC_LAYER_HARD_BANS,
          'Checklist:',
          '- Empty SELECT or unknown field id → use fieldIds from lightdash_list_dimensions (base table).',
          '- Wrong explore → re-disambiguate per playbook (schemaName; label or name __{table}).',
          '- Metric not found / catalog empty → get_explore tables[baseTable].metrics; tableName must be the full explore id; compile as {exploreId}_{metricName}.',
          'Deliverable: successful compile (SQL with expected columns) or a clear blocker. Stop after a good compile.',
          `Follow the embedded playbooks (${SEMANTIC_LAYER_CORE_URI}, ${SEMANTIC_LAYER_COMPOSE_COMPILE_URI}).`,
        ].join('\n'),
        'compose-compile',
      );
    },
  );
}

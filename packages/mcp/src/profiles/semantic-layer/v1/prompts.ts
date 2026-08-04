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
      const topic = question ? `Question/topic: ${question}.` : '';
      return userMessages(
        `Discover the Lightdash semantic layer for this project. Compile is out of scope unless asked.

Project UUID (required on every tool): ${projectUuid}.
${topic}

${SEMANTIC_LAYER_HARD_BANS}

Procedure:
1. get_project once to confirm name. Do not switch projects from org-wide list_projects.
2. list_explores with search+limit (≤15). Disambiguate: skip empty schemaName / errors; prefer exact label or name __{table}; deprioritize eda_/reporting_ unless asked.
3. list_dimensions (base table) → shortlist ≤12 fieldIds by role (time/channel/segment/entity). Copy fieldIds literally.
4. get_explore → tables[baseTable].metrics only (≤8 names/labels). Skip list_metrics once explore is known. Skip get_metric / get_field_lineage unless needed.
5. Deliverable: chosen explore (name/label/schemaName/databaseName + why) + field shortlist. Never dump full explore/dimension/metric/lineage payloads.

Follow embedded playbooks (${SEMANTIC_LAYER_CORE_URI}, ${SEMANTIC_LAYER_EXPLORE_URI}). Use only lightdash_* tools.`,
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
      const topic = question ? `Goal: ${question}.` : '';
      const explore = exploreId ? `Preferred explore: ${exploreId}.` : '';
      return userMessages(
        `Compose a Lightdash metric query and compile it with lightdash_compile_query. Do not run the query.

Project UUID: ${projectUuid}.
${topic}
${explore}

${SEMANTIC_LAYER_HARD_BANS}

Procedure:
1. If exploreId is missing, resolve it per explore playbook (search + disambiguation). Stay on this projectUuid.
2. Copy fieldIds from list_dimensions and {exploreId}_{metricName} from get_explore → tables[baseTable].metrics. Never invent grains.
3. If the user asked for N insights, reuse one explore and compile N diverse cuts.
4. Build metricQuery from the compose-compile skeleton (fieldIds only; tool sets exploreName from exploreId and defaults missing tableCalculations to []). After each compile, verify every requested fieldId appears as a SELECT alias (missing alias = failure even without isError). Prefer SELECT aliases over metric name/label. ≤2 fix retries.
5. Deliverable: insight title(s) + fieldIds + compiled SQL (or errors). Never paste full explore/dimension/metric/lineage payloads.

Follow embedded playbooks (${SEMANTIC_LAYER_CORE_URI}, ${SEMANTIC_LAYER_COMPOSE_COMPILE_URI}).`,
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
      const err = errorText ? `Known error: ${errorText}` : '';
      return userMessages(
        `Debug a failing lightdash_compile_query call and re-compile until it succeeds or you explain blockers.

Project UUID: ${projectUuid}
Explore: ${exploreId}
${err}

${SEMANTIC_LAYER_HARD_BANS}

Checklist:
- unknown field id / empty SELECT / missing SELECT alias → use fieldIds from list_dimensions (base table) + explore-local metrics; re-compile (≤2 retries). Prefer SELECT aliases / compiledSql over metric name/label.
- Other OpenAPI-required keys still failing (filters, sorts, limit, …) → copy the compose-compile skeleton; MCP fills exploreName and missing tableCalculations.
- Wrong explore → re-disambiguate (schemaName; label or name __{table}; skip empty schema / eda unless asked).
- Metric not found / catalog empty → get_explore tables[baseTable].metrics; tableName must be the full explore id; compile as {exploreId}_{metricName}.
- Verify SELECT aliases after every compile. Stop after a good compile or a clear blocker.

Follow embedded playbooks (${SEMANTIC_LAYER_CORE_URI}, ${SEMANTIC_LAYER_COMPOSE_COMPILE_URI}).`,
        'compose-compile',
      );
    },
  );
}

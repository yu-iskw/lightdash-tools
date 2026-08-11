/**
 * MCP prompts for semantic-layer discovery and compile workflows (progressive-disclosure context).
 */

import { z } from 'zod';

import {
  DEFAULT_PROMPT_CONTEXT_POLICY,
  type PromptContextPolicy,
} from '../../../config/prompt-context-policy.js';
import { projectUuidField } from '../../../tools/lib/schema-fields.js';
import { exploreIdField } from '../../../tools/semantic/schema-fields.js';
import { createPromptContextComposer } from '../../lib/prompt-context.js';

import { SEMANTIC_LAYER_DEFAULT_INVARIANT_IDS, SEMANTIC_LAYER_INVARIANTS } from './invariants.js';
import {
  SEMANTIC_LAYER_CORE_PLAYBOOK,
  SEMANTIC_LAYER_TOPIC_META,
  SEMANTIC_LAYER_TOPIC_PLAYBOOKS,
} from './resources/playbooks.js';

import type { RegisterPromptsOptions } from '../../types.js';
import type { SemanticLayerPlaybookTopic } from './resources/playbooks.js';
import type { McpServer } from '@modelcontextprotocol/server';

const TOPIC_COMPOSE_COMPILE = 'compose-compile' as const satisfies SemanticLayerPlaybookTopic;

function createComposer(policy: PromptContextPolicy) {
  return createPromptContextComposer({
    policy,
    invariants: SEMANTIC_LAYER_INVARIANTS,
    core: SEMANTIC_LAYER_CORE_PLAYBOOK,
    topics: SEMANTIC_LAYER_TOPIC_PLAYBOOKS,
    topicMeta: SEMANTIC_LAYER_TOPIC_META,
  });
}

export function registerSemanticLayerPrompts(
  server: McpServer,
  options?: RegisterPromptsOptions,
): void {
  const policy = options?.promptContextPolicy ?? DEFAULT_PROMPT_CONTEXT_POLICY;
  const promptContext = createComposer(policy);
  const invariantIds = SEMANTIC_LAYER_DEFAULT_INVARIANT_IDS;

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
      return promptContext({
        task: `Discover the Lightdash semantic layer for this project. Compile is out of scope unless asked.

Project UUID (required on every tool): ${projectUuid}.
${topic}

Procedure:
1. get_project once to confirm name. Do not switch projects from org-wide list_projects.
2. list_explores with search+limit (≤15). Disambiguate: skip empty schemaName / errors; prefer exact label or name __{table}; deprioritize eda_/reporting_ unless asked.
3. list_dimensions (base table) → shortlist ≤12 fieldIds by role (time/channel/segment/entity). Copy fieldIds literally.
4. get_explore → tables[baseTable].metrics only (≤8 names/labels). Skip list_metrics once explore is known. Skip get_metric / get_field_lineage unless needed.
5. Deliverable: chosen explore (name/label/schemaName/databaseName + why) + field shortlist. Never dump full explore/dimension/metric/lineage payloads.

Use only lightdash_* tools.`,
        invariantIds,
        requiredTopics: ['explore'],
      });
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
      return promptContext({
        task: `Compose a Lightdash metric query and compile it with lightdash_compile_query. Do not run the query.

Project UUID: ${projectUuid}.
${topic}
${explore}

Procedure:
1. If exploreId is missing, resolve it per explore playbook (search + disambiguation). Stay on this projectUuid.
2. Copy fieldIds from list_dimensions and {exploreId}_{metricName} from get_explore → tables[baseTable].metrics. Never invent grains.
3. If the user asked for N insights, reuse one explore and compile N diverse cuts.
4. Build metricQuery from the compose-compile skeleton (fieldIds only; tool sets exploreName from exploreId and defaults missing tableCalculations to []). After each compile, verify every requested fieldId appears as a SELECT alias (missing alias = failure even without isError). Prefer SELECT aliases over metric name/label. ≤2 fix retries.
5. Deliverable: insight title(s) + fieldIds + compiled SQL (or errors). Never paste full explore/dimension/metric/lineage payloads.`,
        invariantIds,
        requiredTopics: [TOPIC_COMPOSE_COMPILE],
      });
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
      return promptContext({
        task: `Debug a failing lightdash_compile_query call and re-compile until it succeeds or you explain blockers.

Project UUID: ${projectUuid}
Explore: ${exploreId}
${err}

Checklist:
- unknown field id / empty SELECT / missing SELECT alias → use fieldIds from list_dimensions (base table) + explore-local metrics; re-compile (≤2 retries). Prefer SELECT aliases / compiledSql over metric name/label.
- Other OpenAPI-required keys still failing (filters, sorts, limit, …) → copy the compose-compile skeleton; MCP fills exploreName and missing tableCalculations.
- Wrong explore → re-disambiguate (schemaName; label or name __{table}; skip empty schema / eda unless asked).
- Metric not found / catalog empty → get_explore tables[baseTable].metrics; tableName must be the full explore id; compile as {exploreId}_{metricName}.
- Verify SELECT aliases after every compile. Stop after a good compile or a clear blocker.`,
        invariantIds,
        requiredTopics: [TOPIC_COMPOSE_COMPILE],
      });
    },
  );
}

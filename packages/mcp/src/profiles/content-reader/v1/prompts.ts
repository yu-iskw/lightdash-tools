/**
 * MCP prompts for content-reader workflows (progressive-disclosure context).
 */

/* eslint-disable @typescript-eslint/no-deprecated -- matches organization-audit prompt registration pattern */
import { z } from 'zod';

import {
  DEFAULT_PROMPT_CONTEXT_POLICY,
  type PromptContextPolicy,
} from '../../../config/prompt-context-policy.js';
import { projectUuidField } from '../../../tools/lib/schema-fields.js';
import { createPromptContextComposer } from '../../lib/prompt-context.js';

import {
  CONTENT_READER_DEFAULT_INVARIANT_IDS,
  CONTENT_READER_INVARIANTS,
} from './invariants.js';
import {
  CONTENT_READER_CORE_PLAYBOOK,
  CONTENT_READER_TOPIC_META,
  CONTENT_READER_TOPIC_PLAYBOOKS,
} from './resources/playbooks.js';

import type { RegisterPromptsOptions } from '../../types.js';
import type { ContentReaderPlaybookTopic } from './resources/playbooks.js';
import type { McpServer } from '@modelcontextprotocol/server';

const TOPIC_EXPLAIN_RUN = 'explain-run' as const satisfies ContentReaderPlaybookTopic;

const optionalProjectUuid = projectUuidField().optional();

const PROJECT_UUID_HINT = '(pin or projectUuid required)';

function createComposer(policy: PromptContextPolicy) {
  return createPromptContextComposer({
    policy,
    invariants: CONTENT_READER_INVARIANTS,
    core: CONTENT_READER_CORE_PLAYBOOK,
    topics: CONTENT_READER_TOPIC_PLAYBOOKS,
    topicMeta: CONTENT_READER_TOPIC_META,
  });
}

export function registerContentReaderPrompts(
  server: McpServer,
  options?: RegisterPromptsOptions,
): void {
  const policy = options?.promptContextPolicy ?? DEFAULT_PROMPT_CONTEXT_POLICY;
  const promptContext = createComposer(policy);
  const invariantIds = CONTENT_READER_DEFAULT_INVARIANT_IDS;

  server.registerPrompt(
    'find_content',
    {
      title: 'Find content',
      description: 'Find the most relevant saved Lightdash content in the current project',
      argsSchema: {
        projectUuid: optionalProjectUuid,
        question: z.string(),
        contentTypes: z.string().optional(),
        verifiedOnly: z.boolean().optional(),
        spaceUuid: z.string().optional(),
      },
    },
    ({ projectUuid, question, contentTypes, verifiedOnly, spaceUuid }) =>
      promptContext({
        task: `Find the most relevant Lightdash content for:

${question}

Project: ${projectUuid ?? '(use HTTP pin or ask for projectUuid — PROJECT_SCOPE_REQUIRED otherwise)'}.
Content types hint: ${contentTypes ?? '(any)'}.
Verified preference: ${verifiedOnly ?? false} (when true, call list_verified_content first — search_content does not filter by verification).
Space filter: ${spaceUuid ?? '(none)'}.

Workflow:
resolve project → verified-first when requested → search → rank → return ≤5 candidates.
Do not execute unless values were requested.`,
        invariantIds,
        requiredTopics: ['discover'],
      }),
  );

  server.registerPrompt(
    'explain_chart',
    {
      title: 'Explain chart',
      description: 'Explain a saved chart from metadata (optional bounded execution)',
      argsSchema: {
        projectUuid: optionalProjectUuid,
        chartUuidOrSlug: z.string(),
        includeLatestValues: z.boolean().optional(),
      },
    },
    ({ projectUuid, chartUuidOrSlug, includeLatestValues }) =>
      promptContext({
        task: `Explain the saved chart ${chartUuidOrSlug}.

Project: ${projectUuid ?? PROJECT_UUID_HINT}.
includeLatestValues=${includeLatestValues ?? false}.

Workflow:
get_project → get_chart / explain_content → optional bounded run_chart / export_chart_image.
Skip SQL charts for execution. Separate explicit metadata from inference.`,
        invariantIds,
        requiredTopics: [TOPIC_EXPLAIN_RUN],
      }),
  );

  server.registerPrompt(
    'summarize_dashboard',
    {
      title: 'Summarize dashboard',
      description: 'Summarize a dashboard with optional bounded tile execution',
      argsSchema: {
        projectUuid: optionalProjectUuid,
        dashboardUuidOrSlug: z.string(),
        executeTiles: z.boolean().optional(),
        maximumTiles: z.number().optional(),
        focus: z.string().optional(),
      },
    },
    ({ projectUuid, dashboardUuidOrSlug, executeTiles, maximumTiles, focus }) =>
      promptContext({
        task: `Summarize dashboard ${dashboardUuidOrSlug}.

Project: ${projectUuid ?? PROJECT_UUID_HINT}.
Focus: ${focus ?? '(general summary)'}.
Execute tiles: ${executeTiles ?? false}; max tiles: ${maximumTiles ?? 5}.

Workflow:
get_dashboard → summarize structure → optional bounded run_dashboard_tile.
Unexecuted tiles must not support conclusions.`,
        invariantIds,
        requiredTopics: [TOPIC_EXPLAIN_RUN],
      }),
  );

  server.registerPrompt(
    'answer_from_content',
    {
      title: 'Answer from content',
      description: 'Answer a question using existing saved Lightdash content only',
      argsSchema: {
        projectUuid: optionalProjectUuid,
        question: z.string(),
        verifiedOnly: z.boolean().optional(),
        maximumExecutions: z.number().optional(),
      },
    },
    ({ projectUuid, question, verifiedOnly, maximumExecutions }) =>
      promptContext({
        task: `Answer this question using existing Lightdash content only:

${question}

Project: ${projectUuid ?? PROJECT_UUID_HINT}.
Prefer verified=${verifiedOnly ?? false} when set — call list_verified_content first; else search_content.
Max executions: ${maximumExecutions ?? 3}.

Workflow:
discover → inspect → minimal bounded execution → answer with coverage/limitations.`,
        invariantIds,
        requiredTopics: [TOPIC_EXPLAIN_RUN],
      }),
  );

  server.registerPrompt(
    'compare_content',
    {
      title: 'Compare content',
      description: 'Compare saved content definitions and optionally values',
      argsSchema: {
        projectUuid: optionalProjectUuid,
        contentReferences: z.string(),
        comparisonQuestion: z.string(),
      },
    },
    ({ projectUuid, contentReferences, comparisonQuestion }) =>
      promptContext({
        task: `Compare these Lightdash content items:

${contentReferences}

Question:
${comparisonQuestion}

Project: ${projectUuid ?? PROJECT_UUID_HINT}.

Workflow:
resolve both sides → diff definitions before values → execute only when needed (≤2).`,
        invariantIds,
        requiredTopics: ['compare'],
      }),
  );

  server.registerPrompt(
    'investigate_result_difference',
    {
      title: 'Investigate result difference',
      description: 'Investigate why two content resources differ',
      argsSchema: {
        projectUuid: optionalProjectUuid,
        firstContent: z.string(),
        secondContent: z.string(),
        observedDifference: z.string(),
      },
    },
    ({ projectUuid, firstContent, secondContent, observedDifference }) =>
      promptContext({
        task: `Investigate why these Lightdash resources differ:

First: ${firstContent}
Second: ${secondContent}
Difference: ${observedDifference}

Project: ${projectUuid ?? PROJECT_UUID_HINT}.

Workflow:
checklist definitions (metrics, filters, grains, parameters, cache) → execute only when needed.
Separate confirmed, plausible, ruled-out, and unresolved causes.`,
        invariantIds,
        requiredTopics: ['compare'],
      }),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */

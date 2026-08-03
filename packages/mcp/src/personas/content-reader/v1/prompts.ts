/**
 * MCP prompts for content-reader workflows.
 */

/* eslint-disable @typescript-eslint/no-deprecated -- matches organization-audit prompt registration pattern */
import { z } from 'zod';

import { projectUuidField } from '../../../tools/lib/schema-fields.js';
import { createPromptPlaybookEmbedder } from '../../lib/playbook-resources.js';

import {
  CONTENT_READER_CORE_PLAYBOOK,
  CONTENT_READER_HARD_BANS,
  CONTENT_READER_TOPIC_PLAYBOOKS,
} from './resources/playbooks.js';

import type { ContentReaderPlaybookTopic } from './resources/playbooks.js';
import type { McpServer } from '@modelcontextprotocol/server';

const userMessages = createPromptPlaybookEmbedder({
  core: CONTENT_READER_CORE_PLAYBOOK,
  topics: CONTENT_READER_TOPIC_PLAYBOOKS,
});

const TOPIC_EXPLAIN_RUN = 'explain-run' as const satisfies ContentReaderPlaybookTopic;

const optionalProjectUuid = projectUuidField().optional();

const PROJECT_UUID_HINT = '(pin or projectUuid required)';

export function registerContentReaderPrompts(server: McpServer): void {
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
      userMessages(
        `Find the most relevant Lightdash content for:

${question}

${CONTENT_READER_HARD_BANS}

Project: ${projectUuid ?? '(use HTTP pin or ask for projectUuid — PROJECT_SCOPE_REQUIRED otherwise)'}.
Content types hint: ${contentTypes ?? '(any)'}.
Verified only: ${verifiedOnly ?? false} (verification is often null — fall back to pinned + views + description).
Space filter: ${spaceUuid ?? '(none)'}.

Procedure:
1. get_project with projectUuid/pin; record readerCapabilities.
2. search_content with short tokens (retry Japanese/single keyword / sortBy=views if empty). Use spaceUuids when given. pageSize≤25; ≤2 pages.
3. Prefer semantic charts (source≠sql). Rank by relevance, views, pinnedList; verification is optional.
4. Optionally list_spaces / get_space (≤3) to confirm path.
5. Return ≤5 candidates (name/type/uuid/space/views/source/why). Do not execute unless values were requested.`,
        'discover',
      ),
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
      userMessages(
        `Explain the saved chart ${chartUuidOrSlug}.

${CONTENT_READER_HARD_BANS}

Project: ${projectUuid ?? PROJECT_UUID_HINT}.
includeLatestValues=${includeLatestValues ?? false}.

Procedure:
1. get_project → get_chart (includeQueryDefinition as needed) and/or explain_content.
2. If chartType/source is sql, do not run; cite non-executable / capability.
3. When includeLatestValues is true and semantic: run_chart (cache, bounded limit); cite queryUuid.
4. Separate explicit metadata from inferred meaning; quote population caveats from the description.
5. Do not construct a new query or retrieve underlying data.`,
        TOPIC_EXPLAIN_RUN,
      ),
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
      userMessages(
        `Summarize dashboard ${dashboardUuidOrSlug}.

${CONTENT_READER_HARD_BANS}

Project: ${projectUuid ?? PROJECT_UUID_HINT}.
Focus: ${focus ?? '(general summary)'}.
Execute tiles: ${executeTiles ?? false}; max tiles: ${maximumTiles ?? 5}.

Procedure:
1. get_dashboard with includeTiles (+ filters as needed). Use tileUuid (not uuid); skip non-executable/markdown tiles.
2. Describe purpose, filters, parameters, verification, and tile structure — summarize, do not dump all tiles.
3. When execution is requested, run_dashboard_tile for ≤max relevant executable tiles; preserve dashboard context; value-only overrides.
4. Report values/trends/failures with content + query UUIDs. Unexecuted tiles must not support conclusions.`,
        TOPIC_EXPLAIN_RUN,
      ),
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
      userMessages(
        `Answer this question using existing Lightdash content only:

${question}

${CONTENT_READER_HARD_BANS}

Project: ${projectUuid ?? PROJECT_UUID_HINT}.
Prefer verified=${verifiedOnly ?? false} when present; else pinned + views + description.
Max executions: ${maximumExecutions ?? 3}.

Procedure:
1. get_project → search_content (short tokens; retry if empty) → pick best semantic content.
2. Inspect metadata; execute the smallest number of saved charts/tiles required (≤ max), cache-first.
3. Skip SQL / non-executable sources. Value-only parameter/filter overrides.
4. State answer, content used, filter/parameter context, result time/cache, truncation, and limitations.`,
        TOPIC_EXPLAIN_RUN,
      ),
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
      userMessages(
        `Compare these Lightdash content items:

${contentReferences}

Question:
${comparisonQuestion}

${CONTENT_READER_HARD_BANS}

Project: ${projectUuid ?? PROJECT_UUID_HINT}.

Procedure:
1. Resolve both sides in-project; fetch metadata first (definitions, fieldIds, filters, grains, parameters, source).
2. Diff before values. Matching labels ≠ equivalence.
3. Execute only when structurally comparable or values are the question (≤2 runs). Skip SQL sides.
4. Report confirmed / plausible / ruled-out / unresolved causes with UUIDs.`,
        'compare',
      ),
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
      userMessages(
        `Investigate why these Lightdash resources differ:

First: ${firstContent}
Second: ${secondContent}
Difference: ${observedDifference}

${CONTENT_READER_HARD_BANS}

Project: ${projectUuid ?? PROJECT_UUID_HINT}.

Checklist: metrics, fields, filters, dashboard context, date ranges, time grains, parameters, sorts, limits, pivots, table calculations, verification, cache timestamps, semantic-vs-SQL.
Execute only when needed with equivalent valid context. Separate confirmed, plausible, ruled-out, and unresolved causes.`,
        'compare',
      ),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */

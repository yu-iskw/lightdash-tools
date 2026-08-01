/**
 * MCP prompts for content-reader workflows.
 */

/* eslint-disable @typescript-eslint/no-deprecated -- matches organization-audit prompt registration pattern */
import { z } from 'zod';

import {
  CONTENT_READER_HARD_BANS,
  CONTENT_READER_PLAYBOOK_MIME,
  CONTENT_READER_PLAYBOOK_URI,
  getPlaybookMarkdown,
} from './resources/playbook.js';

import type { McpServer } from '@modelcontextprotocol/server';

function playbookEmbeddedResource() {
  return {
    type: 'resource' as const,
    resource: {
      uri: CONTENT_READER_PLAYBOOK_URI,
      mimeType: CONTENT_READER_PLAYBOOK_MIME,
      text: getPlaybookMarkdown(),
    },
  };
}

function userMessages(text: string) {
  return {
    messages: [
      {
        role: 'user' as const,
        content: { type: 'text' as const, text },
      },
      {
        role: 'user' as const,
        content: playbookEmbeddedResource(),
      },
    ],
  };
}

export function registerContentReaderPrompts(server: McpServer): void {
  server.registerPrompt(
    'find_content',
    {
      title: 'Find content',
      description: 'Find the most relevant saved Lightdash content in the current project',
      argsSchema: {
        question: z.string(),
        contentTypes: z.string().optional(),
        verifiedOnly: z.boolean().optional(),
        spaceUuid: z.string().optional(),
      },
    },
    ({ question, contentTypes, verifiedOnly, spaceUuid }) =>
      userMessages(`Find the most relevant Lightdash content in the current project for:

${question}

${CONTENT_READER_HARD_BANS}

Resolve the project first via lightdash_get_project. Search with lightdash_search_content and navigate spaces.
Prefer verified content when equally relevant. Content types hint: ${contentTypes ?? '(any)'}.
Verified only: ${verifiedOnly ?? false}. Space filter: ${spaceUuid ?? '(none)'}.

Do not execute content unless values or analysis are requested.

Return at most five candidates with name/type, UUID, space path, verification, relevance, and warnings.`),
  );

  server.registerPrompt(
    'explain_chart',
    {
      title: 'Explain chart',
      description: 'Explain a saved chart from metadata (optional bounded execution)',
      argsSchema: {
        chartUuidOrSlug: z.string(),
        includeLatestValues: z.boolean().optional(),
      },
    },
    ({ chartUuidOrSlug, includeLatestValues }) =>
      userMessages(`Explain the saved chart ${chartUuidOrSlug}.

${CONTENT_READER_HARD_BANS}

Retrieve chart metadata with lightdash_get_chart / lightdash_explain_content.
Distinguish explicit metadata from inferred business meaning.
When includeLatestValues is ${includeLatestValues ?? false}, run lightdash_run_chart with cache and bounded limits.
Cite chart UUID and query UUID. Do not construct a new query or retrieve underlying data.`),
  );

  server.registerPrompt(
    'summarize_dashboard',
    {
      title: 'Summarize dashboard',
      description: 'Summarize a dashboard with optional bounded tile execution',
      argsSchema: {
        dashboardUuidOrSlug: z.string(),
        executeTiles: z.boolean().optional(),
        maximumTiles: z.number().optional(),
        focus: z.string().optional(),
      },
    },
    ({ dashboardUuidOrSlug, executeTiles, maximumTiles, focus }) =>
      userMessages(`Summarize dashboard ${dashboardUuidOrSlug}.

${CONTENT_READER_HARD_BANS}

Describe purpose, tabs, filters, parameters, verification, and tile structure via lightdash_get_dashboard.
Select tiles relevant to: ${focus ?? '(general summary)'}.
When execution is requested (${executeTiles ?? false}), execute no more than ${maximumTiles ?? 5} tiles with lightdash_run_dashboard_tile,
preserve dashboard context, use cache, and use bounded limits.
Report values, trends, failures, content UUIDs, and query UUIDs. Do not claim unexecuted tiles support a conclusion.`),
  );

  server.registerPrompt(
    'answer_from_content',
    {
      title: 'Answer from content',
      description: 'Answer a question using existing saved Lightdash content only',
      argsSchema: {
        question: z.string(),
        verifiedOnly: z.boolean().optional(),
        maximumExecutions: z.number().optional(),
      },
    },
    ({ question, verifiedOnly, maximumExecutions }) =>
      userMessages(`Answer this question using existing Lightdash content:

${question}

${CONTENT_READER_HARD_BANS}

Search for relevant content, inspect metadata, prefer verified=${verifiedOnly ?? false} when set,
and execute only the smallest number of saved charts or tiles required, up to ${maximumExecutions ?? 3}.
Use saved filters and parameters except for validated value overrides.
State the answer, content used, filter/parameter context, result timestamp, cache state, truncation, and limitations.`),
  );

  server.registerPrompt(
    'compare_content',
    {
      title: 'Compare content',
      description: 'Compare saved content definitions and optionally values',
      argsSchema: {
        contentReferences: z.string(),
        comparisonQuestion: z.string(),
      },
    },
    ({ contentReferences, comparisonQuestion }) =>
      userMessages(`Compare these Lightdash content items:

${contentReferences}

Question:
${comparisonQuestion}

${CONTENT_READER_HARD_BANS}

Retrieve metadata first. Compare definitions, dimensions, filters, time grains, parameters, verification, and update state before values.
Execute only when structurally comparable or when differences are the subject of analysis.
Do not assume matching labels mean matching definitions.`),
  );

  server.registerPrompt(
    'investigate_result_difference',
    {
      title: 'Investigate result difference',
      description: 'Investigate why two content resources differ',
      argsSchema: {
        firstContent: z.string(),
        secondContent: z.string(),
        observedDifference: z.string(),
      },
    },
    ({ firstContent, secondContent, observedDifference }) =>
      userMessages(`Investigate why these Lightdash resources differ:

First: ${firstContent}
Second: ${secondContent}
Difference: ${observedDifference}

${CONTENT_READER_HARD_BANS}

Check metrics, fields, filters, dashboard context, date ranges, time grains, parameters, sorts, limits, pivots, table calculations, verification, cache timestamps, and semantic-versus-SQL behavior.
Execute only when needed with equivalent valid context. Separate confirmed, plausible, ruled-out, and unresolved causes.`),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */

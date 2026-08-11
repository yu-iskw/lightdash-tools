/**
 * Pure PromptContextSpec builders for content-reader prompts.
 * Shared by registerContentReaderPrompts and budget gates.
 */

import { PROMPT_PROJECT_UUID_HINT } from '../../../tools/lib/schema-fields.js';

import { CONTENT_READER_DEFAULT_INVARIANT_IDS } from './invariants.js';

import type { ContentReaderPlaybookTopic } from './resources/playbooks.js';
import type { PromptContextSpec } from '../../lib/prompt-context.js';

const TOPIC_DISCOVER = 'discover' as const satisfies ContentReaderPlaybookTopic;

export type FindContentPromptArgs = {
  question: string;
  projectUuid?: string;
  contentTypes?: string;
  verifiedOnly?: boolean;
  spaceUuid?: string;
};

/**
 * Production PromptContextSpec for `find_content` (task + discover topic).
 */
export function buildFindContentPromptSpec(
  args: FindContentPromptArgs,
): PromptContextSpec<ContentReaderPlaybookTopic> {
  const { projectUuid, question, contentTypes, verifiedOnly, spaceUuid } = args;
  return {
    task: `Find the most relevant Lightdash content for:

${question}

Project: ${projectUuid ?? PROMPT_PROJECT_UUID_HINT}.
Content types hint: ${contentTypes ?? '(any)'}.
Verified preference: ${verifiedOnly ?? false} (when true, call list_verified_content first — search_content does not filter by verification).
Space filter: ${spaceUuid ?? '(none)'}.

Workflow:
resolve project → verified-first when requested → search → rank → return ≤5 candidates.
Do not execute unless values were requested.`,
    invariantIds: CONTENT_READER_DEFAULT_INVARIANT_IDS,
    requiredTopics: [TOPIC_DISCOVER],
  };
}

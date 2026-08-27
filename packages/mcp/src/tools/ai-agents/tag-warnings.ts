/**
 * Soft warnings when agent tags match no explores (Lightdash explore allowlist).
 */

export type AgentTagWarningCode = 'EXPLORE_ACCESS_SUMMARY_UNAVAILABLE' | 'TAGS_MATCH_NO_EXPLORES';

export type AgentTagWarning = {
  code: AgentTagWarningCode;
  message: string;
};

export type ExploreAccessSummaryClient = {
  getExploreAccessSummary: (
    projectUuid: string,
    body: { tags: string[] | null },
  ) => Promise<unknown[]>;
};

/** Non-empty tags only; null/empty skip (all explores). */
export function effectiveAgentTags(tags: string[] | null | undefined): string[] | undefined {
  if (tags == null || tags.length === 0) {
    return undefined;
  }
  return tags;
}

export type ExploreAccessForTagsResult = { count: number } | { error: Error } | { skipped: true };

/** Shared explore-access-summary fetch for preview messages and post-mutation warnings. */
export async function fetchExploreAccessForAgentTags(
  client: ExploreAccessSummaryClient,
  projectUuid: string,
  tags: string[] | null | undefined,
): Promise<ExploreAccessForTagsResult> {
  const effective = effectiveAgentTags(tags);
  if (effective === undefined) {
    return { skipped: true };
  }

  try {
    const summary = await client.getExploreAccessSummary(projectUuid, { tags: effective });
    return { count: summary.length };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/** Explore count for create confirmation copy; null when all explores or summary unavailable. */
export async function previewExploreCountForTags(
  client: ExploreAccessSummaryClient,
  projectUuid: string,
  tags: string[] | null | undefined,
): Promise<number | null> {
  const result = await fetchExploreAccessForAgentTags(client, projectUuid, tags);
  if ('skipped' in result) {
    return null;
  }
  if ('error' in result) {
    return null;
  }
  return result.count;
}

/**
 * After create/update with non-empty tags, warn when explore-access-summary is empty.
 * Never fails the mutation.
 */
export async function warningsForAgentTags(
  client: ExploreAccessSummaryClient,
  projectUuid: string,
  tags: string[] | null | undefined,
): Promise<AgentTagWarning[]> {
  const result = await fetchExploreAccessForAgentTags(client, projectUuid, tags);
  if ('skipped' in result) {
    return [];
  }
  if ('error' in result) {
    return [
      {
        code: 'EXPLORE_ACCESS_SUMMARY_UNAVAILABLE',
        message: `Could not verify explore access for agent tags: ${result.error.message}`,
      },
    ];
  }
  if (result.count === 0) {
    return [
      {
        code: 'TAGS_MATCH_NO_EXPLORES',
        message:
          'Agent tags match no explores (OR match on dbt/Lightdash explore or field tags). ' +
          'The agent will see no data model. Clear tags for all explores, or tag explores first, ' +
          'then re-check with get_explore_access_summary.',
      },
    ];
  }
  return [];
}

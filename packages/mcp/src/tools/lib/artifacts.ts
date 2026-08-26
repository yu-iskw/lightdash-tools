/**
 * Content-reader tool-result artifact helpers (ADR-0032).
 */

import { z } from 'zod';

import { contentReaderEnvelope } from '../../policy/envelope.js';
import { artifactToolResult } from '../shared.js';

import type { ContentReaderWarning } from '../../policy/envelope.js';
import type {
  TextContent,
  ToolArtifactCatalogEntry,
  ToolArtifactKind,
  ToolArtifactSpec,
} from '../shared.js';
import type { SqlChart } from '@lightdash-tools/client';
import type { ProfileId } from '@lightdash-tools/common';

export const ARTIFACT_KIND_SCHEMA = z.enum(['sql', 'data']);

export const includeArtifactsField = (): z.ZodOptional<z.ZodArray<typeof ARTIFACT_KIND_SCHEMA>> =>
  z
    .array(ARTIFACT_KIND_SCHEMA)
    .optional()
    .describe(
      "Bulky payloads to attach as separate MCP resource parts (default: discover=[], run=['data']). SQL bodies require explicit 'sql'.",
    );

export function parseIncludeArtifacts(
  value: Array<'data' | 'sql'> | undefined,
  defaults: ToolArtifactKind[],
): Set<ToolArtifactKind> {
  return new Set(value ?? defaults);
}

export function contentReaderArtifactUri(kind: ToolArtifactKind, id: string): string {
  return `lightdash://artifacts/content-reader/${kind}/${encodeURIComponent(id)}`;
}

export const SQL_ARTIFACT_AVAILABLE_WARNING: ContentReaderWarning = {
  code: 'SQL_ARTIFACT_AVAILABLE',
  message:
    'Authored SQL is available; pass includeArtifacts=["sql"] to attach it as a separate resource part',
};

/** Opted-in SQL is model-facing (ADR-0032). */
export function buildSqlArtifact(args: { savedSqlUuid: string; sql: string }): ToolArtifactSpec {
  return {
    kind: 'sql',
    uri: contentReaderArtifactUri('sql', args.savedSqlUuid),
    mimeType: 'text/sql',
    text: args.sql,
    audience: ['assistant', 'user'],
    priority: 0.6,
  };
}

export function buildDataArtifact(args: { queryUuid: string; rows: unknown }): ToolArtifactSpec {
  return {
    kind: 'data',
    uri: contentReaderArtifactUri('data', args.queryUuid),
    mimeType: 'application/json',
    text: JSON.stringify(args.rows),
    audience: ['assistant', 'user'],
    priority: 0.8,
  };
}

export function catalogEntry(
  kind: ToolArtifactKind,
  uri: string,
  mimeType: string,
  included: boolean,
): ToolArtifactCatalogEntry {
  return { kind, uri, mimeType, included };
}

/** Catalog (+ optional attach) for an authored SQL body. */
export function buildSqlArtifactParts(
  include: Set<ToolArtifactKind>,
  sql: { savedSqlUuid: string; sql?: string },
): { artifacts: ToolArtifactSpec[]; catalog: ToolArtifactCatalogEntry[] } {
  const uri = contentReaderArtifactUri('sql', sql.savedSqlUuid);
  const included = include.has('sql') && typeof sql.sql === 'string';
  const catalog = [catalogEntry('sql', uri, 'text/sql', included)];
  const artifacts =
    included && sql.sql !== undefined
      ? [buildSqlArtifact({ savedSqlUuid: sql.savedSqlUuid, sql: sql.sql })]
      : [];
  return { artifacts, catalog };
}

/** Discover/explain SQL chart: envelope summary + optional SQL resource part. */
export function sqlRevealToolResult(args: {
  profile: ProfileId;
  projectUuid: string;
  projectPinned: boolean;
  include: Set<ToolArtifactKind>;
  sqlChart: SqlChart;
  summaryData: object;
}): TextContent {
  const includeSql = args.include.has('sql');
  const warnings: ContentReaderWarning[] = includeSql ? [] : [SQL_ARTIFACT_AVAILABLE_WARNING];
  const envelope = contentReaderEnvelope(args.summaryData, {
    profile: args.profile,
    projectUuid: args.projectUuid,
    projectPinned: args.projectPinned,
    warnings,
  });
  const { artifacts, catalog } = buildSqlArtifactParts(args.include, {
    savedSqlUuid: args.sqlChart.savedSqlUuid,
    sql: includeSql ? args.sqlChart.sql : undefined,
  });
  return artifactToolResult({
    summary: envelope,
    artifacts,
    catalog,
  });
}

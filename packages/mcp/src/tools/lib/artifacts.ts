/**
 * Content-reader tool-result artifact helpers (ADR-0032).
 */

import { z } from 'zod';

import type { ToolArtifactCatalogEntry, ToolArtifactKind, ToolArtifactSpec } from '../shared.js';

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
  const kinds = value ?? defaults;
  return new Set(kinds);
}

export function contentReaderArtifactUri(kind: ToolArtifactKind, id: string): string {
  return `lightdash://artifacts/content-reader/${kind}/${encodeURIComponent(id)}`;
}

export function buildSqlArtifact(args: {
  savedSqlUuid: string;
  sql: string;
  forModel: boolean;
}): ToolArtifactSpec {
  return {
    kind: 'sql',
    uri: contentReaderArtifactUri('sql', args.savedSqlUuid),
    mimeType: 'text/sql',
    text: args.sql,
    audience: args.forModel ? ['assistant', 'user'] : ['user'],
    priority: args.forModel ? 0.6 : 0.3,
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

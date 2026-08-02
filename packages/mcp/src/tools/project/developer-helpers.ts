/**
 * Pure helpers for content-developer diffing and dashboard tile-array composition
 * (ADR-0014). No I/O except optional injected getters; safe to unit test without mocks.
 */

import { hashStableValue, isRecord, stableStringify } from '../lib/stable-stringify.js';

import type { PreviewBaseline } from '../../policy/preview-ledger.js';

export type ShallowDiff = {
  added: string[];
  removed: string[];
  changed: string[];
};

export { stableStringify };

/** Top-level key diff between two objects (added/removed/changed keys). */
export function shallowDiff(before: unknown, after: unknown): ShallowDiff {
  const beforeRecord = isRecord(before) ? before : {};
  const afterRecord = isRecord(after) ? after : {};
  const beforeKeys = new Set(Object.keys(beforeRecord));
  const afterKeys = new Set(Object.keys(afterRecord));

  const added: string[] = [];
  const changed: string[] = [];
  for (const key of afterKeys) {
    if (!beforeKeys.has(key)) {
      added.push(key);
    } else if (
      // eslint-disable-next-line security/detect-object-injection -- key comes from Object.keys of the same record
      stableStringify(beforeRecord[key]) !== stableStringify(afterRecord[key])
    ) {
      changed.push(key);
    }
  }

  const removed: string[] = [];
  for (const key of beforeKeys) {
    if (!afterKeys.has(key)) {
      removed.push(key);
    }
  }

  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() };
}

export type DashboardTile = Record<string, unknown>;

/** Dashboard tiles are identified by `uuid` or the legacy `tileUuid` alias. */
function tileUuidOf(tile: DashboardTile): string | undefined {
  const uuid = tile.uuid ?? tile.tileUuid;
  return typeof uuid === 'string' ? uuid : undefined;
}

export class TileNotFoundError extends Error {
  constructor(tileUuid: string) {
    super(`Tile '${tileUuid}' was not found in the dashboard's tile array`);
    this.name = 'TileNotFoundError';
  }
}

/** Append a new tile to the tile array. */
export function applyTileAdd(tiles: unknown[], tile: Record<string, unknown>): unknown[] {
  return [...tiles, tile];
}

/** Return a new tile array with `x`/`y` updated on the matching tile. Throws if not found. */
export function applyTileMove(
  tiles: unknown[],
  tileUuid: string,
  x?: number,
  y?: number,
): unknown[] {
  let found = false;
  const next = (tiles as DashboardTile[]).map((tile) => {
    if (tileUuidOf(tile) !== tileUuid) {
      return tile;
    }
    found = true;
    return {
      ...tile,
      ...(x !== undefined ? { x } : {}),
      ...(y !== undefined ? { y } : {}),
    };
  });
  if (!found) {
    throw new TileNotFoundError(tileUuid);
  }
  return next;
}

/** Return a new tile array with the matching tile removed. Throws if not found. */
export function applyTileRemove(tiles: unknown[], tileUuid: string): unknown[] {
  const next = (tiles as DashboardTile[]).filter((tile) => tileUuidOf(tile) !== tileUuid);
  if (next.length === tiles.length) {
    throw new TileNotFoundError(tileUuid);
  }
  return next;
}

/** Return a new tile array with `w`/`h` updated on the matching tile. Throws if not found. */
export function applyTileResize(
  tiles: unknown[],
  tileUuid: string,
  w?: number,
  h?: number,
): unknown[] {
  let found = false;
  const next = (tiles as DashboardTile[]).map((tile) => {
    if (tileUuidOf(tile) !== tileUuid) {
      return tile;
    }
    found = true;
    return {
      ...tile,
      ...(w !== undefined ? { w } : {}),
      ...(h !== undefined ? { h } : {}),
    };
  });
  if (!found) {
    throw new TileNotFoundError(tileUuid);
  }
  return next;
}

/** Merge dashboard field overrides (e.g. `{ tiles }`) onto the current dashboard's editable fields. */
export function buildDashboardUpdateBody(
  current: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  return {
    name: current.name,
    description: current.description,
    tiles: current.tiles,
    filters: current.filters,
    tabs: current.tabs,
    parameters: current.parameters,
    ...overrides,
  };
}

export type VersionSummary = { versionUuid: string; createdAt: string };

/**
 * Resolve two version UUIDs to compare: explicit args when both are given, otherwise
 * the two most recent entries in the version history (descending by `createdAt`).
 * Providing only one of versionUuidA/versionUuidB is rejected.
 */
export function resolveCompareVersionIds(
  history: readonly VersionSummary[],
  versionUuidA?: string,
  versionUuidB?: string,
): [string, string] {
  const hasA = versionUuidA != null && versionUuidA !== '';
  const hasB = versionUuidB != null && versionUuidB !== '';
  if (hasA !== hasB) {
    throw new Error(
      'versionUuidA and versionUuidB must both be provided when specifying explicit versions',
    );
  }
  if (hasA && hasB && versionUuidA && versionUuidB) {
    return [versionUuidA, versionUuidB];
  }
  const sorted = [...history].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const [latest, previous] = sorted;
  if (!latest || !previous) {
    throw new Error(
      'At least two version-history entries are required to compare when versionUuidA/versionUuidB are not both provided',
    );
  }
  return [latest.versionUuid, previous.versionUuid];
}

export type MoveContentType = 'chart' | 'dashboard' | 'data_app';
export type MoveChartSource = 'dbt_explore' | 'sql';

/** Throws when `contentTypes` (required) or `chartSources` (when provided) don't line up 1:1 with `itemUuids`. */
export function assertMoveContentLengths(
  itemUuids: readonly string[],
  contentTypes: readonly MoveContentType[],
  chartSources?: readonly MoveChartSource[],
): void {
  if (contentTypes.length !== itemUuids.length) {
    throw new Error('itemUuids and contentTypes must have the same length');
  }
  if (chartSources && chartSources.length !== itemUuids.length) {
    throw new Error('itemUuids and chartSources must have the same length');
  }
}

/** Stable preview/apply `resourceKey` for a content-move (sorted UUIDs, comma-joined). */
export function buildMoveContentResourceKey(itemUuids: readonly string[]): string {
  return [...itemUuids].sort().join(',');
}

/**
 * Build the canonical proposal object hashed by the preview ledger for a content move.
 * Both `preview_content_move` and `move_content` must hash the same shape — including
 * required `contentTypes` and optional `chartSources` — so an apply cannot silently change
 * item types or chart sources versus what was previewed and validated.
 */
export function buildMoveContentProposal(input: {
  itemUuids: readonly string[];
  targetSpaceUuid: string | null;
  contentTypes: readonly MoveContentType[];
  chartSources?: readonly MoveChartSource[];
}): Record<string, unknown> {
  return {
    itemUuids: input.itemUuids,
    targetSpaceUuid: input.targetSpaceUuid,
    contentTypes: input.contentTypes,
    chartSources: input.chartSources ?? null,
  };
}

/** Build a single `ItemPayload`-shaped entry for the content bulk-move API. */
export function buildMoveContentItem(
  uuid: string,
  contentType: MoveContentType,
  chartSource?: MoveChartSource,
): Record<string, unknown> {
  switch (contentType) {
    case 'chart':
      return { contentType: 'chart', uuid, source: chartSource ?? 'dbt_explore' };
    case 'dashboard':
      return { contentType: 'dashboard', uuid };
    case 'data_app':
      return { contentType: 'data_app', uuid };
    default: {
      const exhaustive: never = contentType;
      throw new Error(`Unsupported content type: ${String(exhaustive)}`);
    }
  }
}

/** One resolved content row for a content-move hard baseline (ADR-0014 Phase 4). */
export type MoveContentManifestItem = {
  uuid: string;
  contentType: MoveContentType;
  spaceUuid: string | null;
  /** `lastUpdatedAt` / `updatedAt` when the API provides one. */
  updatedAt: string | null;
  /** Chart source when `contentType === 'chart'`; otherwise null. */
  source: MoveChartSource | null;
};

export type MoveContentManifestTargetSpace = {
  uuid: string | null;
  name: string | null;
};

/** Hash-stable content-move baseline: items sorted by UUID + resolved target space. */
export type MoveContentManifest = {
  items: MoveContentManifestItem[];
  targetSpace: MoveContentManifestTargetSpace;
};

export type MoveContentResolveError = {
  code: 'CONTENT_NOT_FOUND' | 'INVALID_ARGUMENT' | 'PREVIEW_STALE';
  message: string;
};

const MOVE_CONTENT_TYPE_SET = new Set<string>(['chart', 'dashboard', 'data_app']);
const MOVE_CHART_SOURCE_SET = new Set<string>(['dbt_explore', 'sql']);

/** Sort records by `uuid` for hash-stable manifests (localeCompare, ascending). */
export function sortByUuidStable<T extends { uuid: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.uuid.localeCompare(b.uuid));
}

/**
 * Build the canonical move-content baseline manifest (sorted by item UUID).
 * Preview and apply must produce identical shapes for the same server facts.
 */
export function buildMoveContentManifest(input: {
  items: readonly MoveContentManifestItem[];
  targetSpace: MoveContentManifestTargetSpace;
}): MoveContentManifest {
  return {
    items: sortByUuidStable(input.items),
    targetSpace: {
      uuid: input.targetSpace.uuid,
      name: input.targetSpace.name,
    },
  };
}

function optionalStringField(
  record: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  if (!record) {
    return undefined;
  }
  // eslint-disable-next-line security/detect-object-injection -- key is a fixed field name from callers
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function chartSourceFromSummary(item: Record<string, unknown>): MoveChartSource {
  const rawSource = optionalStringField(item, 'source');
  if (rawSource != null && MOVE_CHART_SOURCE_SET.has(rawSource)) {
    return rawSource as MoveChartSource;
  }
  return 'dbt_explore';
}

/**
 * Extract a manifest item from a content-search / SummaryContent-shaped record.
 * Returns null when uuid/contentType are missing or unsupported for bulk move.
 */
export function moveContentItemFromSummary(
  item: Record<string, unknown>,
): MoveContentManifestItem | null {
  const uuid = optionalStringField(item, 'uuid');
  const contentType = optionalStringField(item, 'contentType');
  if (uuid == null || contentType == null || !MOVE_CONTENT_TYPE_SET.has(contentType)) {
    return null;
  }
  const space = isRecord(item.space) ? item.space : undefined;
  const spaceUuid =
    optionalStringField(space, 'uuid') ?? optionalStringField(item, 'spaceUuid') ?? null;
  const updatedAt =
    optionalStringField(item, 'lastUpdatedAt') ?? optionalStringField(item, 'updatedAt') ?? null;
  return {
    uuid,
    contentType: contentType as MoveContentType,
    spaceUuid,
    updatedAt,
    source: contentType === 'chart' ? chartSourceFromSummary(item) : null,
  };
}

/** Normalize target-space identity for the move-content baseline. */
export function moveContentTargetSpaceFromRecord(
  targetSpaceUuid: string | null,
  space: Record<string, unknown> | null,
): MoveContentManifestTargetSpace {
  if (targetSpaceUuid == null) {
    return { uuid: null, name: null };
  }
  return {
    uuid: optionalStringField(space ?? undefined, 'uuid') ?? targetSpaceUuid,
    name: optionalStringField(space ?? undefined, 'name') ?? null,
  };
}

function matchChartSourceAtIndex(
  uuid: string,
  index: number,
  resolved: MoveContentManifestItem,
  chartSources: readonly MoveChartSource[] | undefined,
): MoveContentResolveError | null {
  // eslint-disable-next-line security/detect-object-injection -- index bound by caller itemUuids.length
  const expectedSource = chartSources?.[index] ?? 'dbt_explore';
  const actualSource = resolved.source ?? 'dbt_explore';
  if (actualSource === expectedSource) {
    return null;
  }
  return {
    code: 'INVALID_ARGUMENT',
    message:
      `Chart '${uuid}' has source '${actualSource}' but chartSources[${String(index)}] ` +
      `is '${expectedSource}'`,
  };
}

/**
 * Reject caller contentTypes/chartSources that disagree with resolved server facts.
 * Length checks should already have run via `assertMoveContentLengths`.
 */
export function matchMoveContentResolved(input: {
  itemUuids: readonly string[];
  contentTypes: readonly MoveContentType[];
  chartSources?: readonly MoveChartSource[];
  resolvedItems: readonly MoveContentManifestItem[];
}): MoveContentResolveError | null {
  const byUuid = new Map(input.resolvedItems.map((item) => [item.uuid, item]));
  for (let index = 0; index < input.itemUuids.length; index += 1) {
    // eslint-disable-next-line security/detect-object-injection -- index bound by itemUuids.length
    const uuid = input.itemUuids[index];
    // eslint-disable-next-line security/detect-object-injection -- index bound by itemUuids.length
    const expectedType = input.contentTypes[index];
    const resolved = byUuid.get(uuid);
    if (!resolved) {
      return {
        code: 'CONTENT_NOT_FOUND',
        message: `Content '${uuid}' was not found while building the move baseline`,
      };
    }
    if (resolved.contentType !== expectedType) {
      return {
        code: 'INVALID_ARGUMENT',
        message:
          `Content '${uuid}' is type '${resolved.contentType}' but contentTypes[${String(index)}] ` +
          `is '${expectedType}'`,
      };
    }
    if (expectedType === 'chart') {
      const sourceErr = matchChartSourceAtIndex(uuid, index, resolved, input.chartSources);
      if (sourceErr) {
        return sourceErr;
      }
    }
  }
  return null;
}

/**
 * Ledger baseline for content-move: `updatedAt` is a fingerprint of the sorted
 * manifest so `assertBaselineStillValid` detects item/space drift on apply.
 */
export function baselineFromMoveContentManifest(manifest: MoveContentManifest): PreviewBaseline {
  return {
    updatedAt: hashStableValue(manifest),
    uuid: buildMoveContentResourceKey(manifest.items.map((item) => item.uuid)),
  };
}

type ResolveMoveResult =
  { kind: 'error'; error: MoveContentResolveError } | { kind: 'ok'; manifest: MoveContentManifest };

async function resolveMoveItems(
  itemUuids: readonly string[],
  findContentByUuid: (uuid: string) => Promise<Record<string, unknown> | null>,
): Promise<
  | { kind: 'error'; error: MoveContentResolveError }
  | { kind: 'ok'; items: MoveContentManifestItem[] }
> {
  const summaries = await Promise.all(itemUuids.map((uuid) => findContentByUuid(uuid)));
  const resolvedItems: MoveContentManifestItem[] = [];
  for (let index = 0; index < itemUuids.length; index += 1) {
    // eslint-disable-next-line security/detect-object-injection -- index bound by itemUuids.length
    const uuid = itemUuids[index]!;
    // eslint-disable-next-line security/detect-object-injection -- index bound by Promise.all result
    const summary = summaries[index];
    if (!summary) {
      return {
        kind: 'error',
        error: { code: 'CONTENT_NOT_FOUND', message: `Content '${uuid}' was not found` },
      };
    }
    const item = moveContentItemFromSummary(summary);
    if (!item) {
      return {
        kind: 'error',
        error: {
          code: 'INVALID_ARGUMENT',
          message: `Content '${uuid}' is not a movable chart/dashboard/data_app`,
        },
      };
    }
    if (item.uuid !== uuid) {
      return {
        kind: 'error',
        error: {
          code: 'PREVIEW_STALE',
          message: `Content lookup for '${uuid}' resolved to a different uuid '${item.uuid}'`,
        },
      };
    }
    resolvedItems.push(item);
  }
  return { kind: 'ok', items: resolvedItems };
}

async function resolveMoveTargetSpace(input: {
  targetSpaceUuid: string | null;
  getSpace: (spaceUuid: string) => Promise<Record<string, unknown>>;
  isNotFound: (err: unknown) => boolean;
}): Promise<
  | { kind: 'error'; error: MoveContentResolveError }
  | { kind: 'ok'; targetSpace: MoveContentManifestTargetSpace }
> {
  if (input.targetSpaceUuid == null) {
    return { kind: 'ok', targetSpace: { uuid: null, name: null } };
  }
  try {
    const space = await input.getSpace(input.targetSpaceUuid);
    const targetSpace = moveContentTargetSpaceFromRecord(input.targetSpaceUuid, space);
    if (targetSpace.uuid !== input.targetSpaceUuid) {
      return {
        kind: 'error',
        error: {
          code: 'PREVIEW_STALE',
          message:
            `Target space '${input.targetSpaceUuid}' resolved to a different uuid ` +
            `'${targetSpace.uuid ?? 'null'}'`,
        },
      };
    }
    return { kind: 'ok', targetSpace };
  } catch (err) {
    if (input.isNotFound(err)) {
      return {
        kind: 'error',
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: `Target space '${input.targetSpaceUuid}' was not found`,
        },
      };
    }
    throw err;
  }
}

/**
 * Resolve content + target-space facts into a hard move baseline.
 * `findContentByUuid` / `getSpace` are injected so unit tests need no network.
 */
export async function resolveMoveContentManifest(input: {
  itemUuids: readonly string[];
  contentTypes: readonly MoveContentType[];
  chartSources?: readonly MoveChartSource[];
  targetSpaceUuid: string | null;
  findContentByUuid: (uuid: string) => Promise<Record<string, unknown> | null>;
  getSpace: (spaceUuid: string) => Promise<Record<string, unknown>>;
  isNotFound: (err: unknown) => boolean;
}): Promise<ResolveMoveResult> {
  assertMoveContentLengths(input.itemUuids, input.contentTypes, input.chartSources);

  const [itemsResult, targetResult] = await Promise.all([
    resolveMoveItems(input.itemUuids, input.findContentByUuid),
    resolveMoveTargetSpace({
      targetSpaceUuid: input.targetSpaceUuid,
      getSpace: input.getSpace,
      isNotFound: input.isNotFound,
    }),
  ]);
  if (itemsResult.kind === 'error') {
    return itemsResult;
  }

  const mismatch = matchMoveContentResolved({
    itemUuids: input.itemUuids,
    contentTypes: input.contentTypes,
    chartSources: input.chartSources,
    resolvedItems: itemsResult.items,
  });
  if (mismatch) {
    return { kind: 'error', error: mismatch };
  }

  if (targetResult.kind === 'error') {
    return targetResult;
  }

  return {
    kind: 'ok',
    manifest: buildMoveContentManifest({
      items: itemsResult.items,
      targetSpace: targetResult.targetSpace,
    }),
  };
}

export type ChartPreviewCurrentResult =
  | { kind: 'error'; code: 'CHART_SLUG_EXISTS'; message: string }
  | { kind: 'ok'; current: Record<string, unknown> | null };

/** Extract preview/apply baseline fields from a saved resource record. */
export function baselineFromResource(
  resource: Record<string, unknown> | null,
): PreviewBaseline | undefined {
  if (!resource) {
    return undefined;
  }
  const updatedAt = typeof resource.updatedAt === 'string' ? resource.updatedAt : undefined;
  const uuid = typeof resource.uuid === 'string' ? resource.uuid : undefined;
  const slug = typeof resource.slug === 'string' ? resource.slug : undefined;
  if (updatedAt == null && uuid == null && slug == null) {
    return undefined;
  }
  return { updatedAt, uuid, slug };
}

/**
 * Resolve the saved chart for a preview: update path uses chartUuidOrSlug;
 * create path (slug only) rejects when that slug already exists.
 * `getSavedChart` / `isNotFound` are injected so unit tests need no network.
 */
export async function resolveChartPreviewCurrent(input: {
  chartUuidOrSlug?: string;
  slug?: string;
  getSavedChart: (chartUuidOrSlug: string) => Promise<Record<string, unknown>>;
  isNotFound: (err: unknown) => boolean;
}): Promise<ChartPreviewCurrentResult> {
  if (input.chartUuidOrSlug) {
    return { kind: 'ok', current: await input.getSavedChart(input.chartUuidOrSlug) };
  }
  if (input.slug == null || input.slug === '') {
    return { kind: 'ok', current: null };
  }
  try {
    await input.getSavedChart(input.slug);
    return {
      kind: 'error',
      code: 'CHART_SLUG_EXISTS',
      message:
        `Chart slug '${input.slug}' already exists; pass chartUuidOrSlug and use the update path ` +
        '(preview_chart_changes → confirm_preview → update_chart)',
    };
  } catch (err) {
    if (input.isNotFound(err)) {
      return { kind: 'ok', current: null };
    }
    throw err;
  }
}

/**
 * Apply-time optional chart baseline: 404 → undefined (create still free);
 * found → baseline for PREVIEW_STALE race / update drift checks.
 */
export async function fetchChartBaselineOptional(input: {
  chartUuidOrSlug: string;
  getSavedChart: (chartUuidOrSlug: string) => Promise<Record<string, unknown>>;
  isNotFound: (err: unknown) => boolean;
}): Promise<PreviewBaseline | undefined> {
  try {
    return baselineFromResource(await input.getSavedChart(input.chartUuidOrSlug));
  } catch (err) {
    if (input.isNotFound(err)) {
      return undefined;
    }
    throw err;
  }
}

/**
 * Pure helpers for content-developer diffing and dashboard tile-array composition
 * (ADR-0014). No I/O except optional injected getters; safe to unit test without mocks.
 */

import { stableStringify } from '../lib/stable-stringify.js';

import type { PreviewBaseline } from '../../policy/preview-ledger.js';

export type ShallowDiff = {
  added: string[];
  removed: string[];
  changed: string[];
};

export { stableStringify };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

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

/**
 * Fill missing FilterGroup / FilterRule `id`s for MetricQuery filters.
 *
 * Lightdash compile/run use strict Filters (id required). Chart-as-code FiltersInput
 * auto-generates ids — that does not apply here. Only fill missing/empty ids via
 * structural duck-typing; leave unrecognized shapes unchanged for flexibility.
 */

import { randomUUID } from 'node:crypto';

import { isRecord } from '../lib/stable-stringify.js';

function hasNonEmptyId(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0;
}

function withId(node: Record<string, unknown>): Record<string, unknown> {
  if (hasNonEmptyId(node.id)) {
    return node;
  }
  return { ...node, id: randomUUID() };
}

/**
 * Recursively ensure ids on FilterGroup / FilterRule-shaped nodes.
 * Does not invent wrappers for arrays or rewrite other fields.
 */
export function ensureFilterNode(node: unknown): unknown {
  if (!isRecord(node)) {
    return node;
  }

  const hasAnd = Array.isArray(node.and);
  const hasOr = Array.isArray(node.or);

  if (hasAnd && hasOr) {
    // Ambiguous — do not invent structure; pass through for upstream validation.
    return node;
  }

  if (hasAnd) {
    const items = (node.and as unknown[]).map((item) => ensureFilterNode(item));
    return { ...withId(node), and: items };
  }

  if (hasOr) {
    const items = (node.or as unknown[]).map((item) => ensureFilterNode(item));
    return { ...withId(node), or: items };
  }

  if ('target' in node && 'operator' in node) {
    return withId(node);
  }

  return node;
}

/**
 * Ensure missing ids on `filters.dimensions|metrics|tableCalculations` FilterGroups.
 * Empty `{}`, null, non-objects, and array-valued keys pass through unchanged.
 */
export function ensureFilterIds(filters: unknown): unknown {
  if (!isRecord(filters)) {
    return filters;
  }

  const next: Record<string, unknown> = { ...filters };
  let touched = false;

  // Always rewrite present FilterGroup keys — and/or groups allocate even when ids already exist.
  // Fixed property names (not dynamic keys) keep security/detect-object-injection quiet.
  if ('dimensions' in filters && !Array.isArray(filters.dimensions)) {
    next.dimensions = ensureFilterNode(filters.dimensions);
    touched = true;
  }
  if ('metrics' in filters && !Array.isArray(filters.metrics)) {
    next.metrics = ensureFilterNode(filters.metrics);
    touched = true;
  }
  if ('tableCalculations' in filters && !Array.isArray(filters.tableCalculations)) {
    next.tableCalculations = ensureFilterNode(filters.tableCalculations);
    touched = true;
  }

  return touched ? next : filters;
}

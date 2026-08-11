/**
 * Structured prompt invariants (SSOT for eager safety capsules and HARD_BANS projections).
 */

export type PromptInvariantSeverity = 'critical' | 'important';

export type PromptInvariant = {
  id: string;
  severity: PromptInvariantSeverity;
  /** One-line rule shown in the invariant capsule / HARD_BANS projection. */
  short: string;
  detail?: string;
  tags?: readonly string[];
};

export const INVARIANT_CAPSULE_HEADER = 'Critical invariants:' as const;

/** Assert unique invariant ids (throws on duplicates). */
export function assertUniqueInvariantIds(invariants: readonly PromptInvariant[]): void {
  const seen = new Set<string>();
  for (const inv of invariants) {
    if (seen.has(inv.id)) {
      throw new Error(`Duplicate prompt invariant id '${inv.id}'`);
    }
    seen.add(inv.id);
  }
}

/** Typed id list for a catalog (avoids per-profile `as unknown as` casts). */
export function allInvariantIds<T extends PromptInvariant>(
  catalog: readonly T[],
): ReadonlyArray<T['id']> {
  return catalog.map((inv) => inv.id);
}

export function resolveInvariants(
  byId: ReadonlyMap<string, PromptInvariant>,
  ids: readonly string[],
): PromptInvariant[] {
  const resolved: PromptInvariant[] = [];
  for (const id of ids) {
    const inv = byId.get(id);
    if (!inv) {
      throw new Error(`Unknown prompt invariant id '${id}'`);
    }
    resolved.push(inv);
  }
  return resolved;
}

/** Build a lookup map once (call after assertUniqueInvariantIds). */
export function invariantIndex(
  catalog: readonly PromptInvariant[],
): ReadonlyMap<string, PromptInvariant> {
  return new Map(catalog.map((inv) => [inv.id, inv]));
}

/** Compact eager capsule for prompts/get text. */
export function formatInvariantCapsule(invariants: readonly PromptInvariant[]): string {
  if (invariants.length === 0) {
    return '';
  }
  const lines = invariants.map((inv) => `- ${inv.short}`);
  return [INVARIANT_CAPSULE_HEADER, ...lines].join('\n');
}

/** Legacy multi-line HARD_BANS string (one ban per line, no header). */
export function formatHardBansProjection(invariants: readonly PromptInvariant[]): string {
  return invariants.map((inv) => inv.short).join('\n');
}

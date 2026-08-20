/**
 * Values-only filter override validation for dashboard tiles.
 */

export type ReaderFilterOverride = {
  /** Filter target id (must already exist on the dashboard). */
  id: string;
  values: unknown[];
};

export class FilterOverrideError extends Error {
  readonly code = 'INVALID_FILTER_OVERRIDE' as const;

  constructor(message: string) {
    super(message);
    this.name = 'FilterOverrideError';
  }
}

type DashboardFilterLike = {
  id?: string;
  target?: unknown;
  operator?: unknown;
  values?: unknown[];
  required?: boolean;
  disabled?: boolean;
};

type DashboardFiltersLike = {
  dimensions?: DashboardFilterLike[];
  metrics?: DashboardFilterLike[];
  tableCalculations?: DashboardFilterLike[];
};

function collectKnownIds(base: DashboardFiltersLike): Set<string> {
  const knownIds = new Set<string>();
  for (const group of [base.dimensions, base.metrics, base.tableCalculations]) {
    for (const f of group ?? []) {
      if (f.id) knownIds.add(f.id);
    }
  }
  return knownIds;
}

function buildOverrideMap(
  overrides: ReaderFilterOverride[],
  knownIds: Set<string>,
): Map<string, ReaderFilterOverride> {
  const overridesById = new Map<string, ReaderFilterOverride>();
  for (const override of overrides) {
    if (!override.id) {
      throw new FilterOverrideError('Filter override requires id');
    }
    if (!Array.isArray(override.values)) {
      throw new FilterOverrideError(`Filter override '${override.id}' values must be an array`);
    }
    if (!knownIds.has(override.id)) {
      throw new FilterOverrideError(
        `Filter override '${override.id}' does not match a saved dashboard filter`,
      );
    }
    overridesById.set(override.id, override);
  }
  return overridesById;
}

function patchGroup(
  group: DashboardFilterLike[] | undefined,
  overridesById: Map<string, ReaderFilterOverride>,
): DashboardFilterLike[] {
  if (!group) return [];
  return group.map((filter) => {
    const id = filter.id;
    if (!id || !overridesById.has(id)) {
      return { ...filter };
    }
    const override = overridesById.get(id)!;
    return {
      ...filter,
      values: override.values,
      // Enable when required, or when the agent supplies non-empty override values
      // (optional dashboard filters are often saved disabled with empty values).
      disabled: filter.required === true || override.values.length > 0 ? false : filter.disabled,
    };
  });
}

/**
 * Apply values-only overrides onto a saved dashboard filter tree.
 * Rejects unknown filter ids. Does not allow changing target/operator.
 */
export function applyFilterValueOverrides(
  saved: DashboardFiltersLike | undefined,
  overrides: ReaderFilterOverride[] | undefined,
): { filters: DashboardFiltersLike; warnings: string[] } {
  const warnings: string[] = [];
  const base: DashboardFiltersLike = {
    dimensions: saved?.dimensions ? [...saved.dimensions] : [],
    metrics: saved?.metrics ? [...saved.metrics] : [],
    tableCalculations: saved?.tableCalculations ? [...saved.tableCalculations] : [],
  };
  if (!overrides || overrides.length === 0) {
    return { filters: base, warnings };
  }

  const overridesById = buildOverrideMap(overrides, collectKnownIds(base));
  const filters: DashboardFiltersLike = {
    dimensions: patchGroup(base.dimensions, overridesById),
    metrics: patchGroup(base.metrics, overridesById),
    tableCalculations: patchGroup(base.tableCalculations, overridesById),
  };

  return { filters, warnings };
}

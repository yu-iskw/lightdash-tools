// Global coverage minimums (repo policy). Raise as test coverage improves.

export const GLOBAL_THRESHOLDS = {
  lines: 31,
  branches: 30,
  functions: 37,
  statements: 31,
};

/** Path prefixes for per-package coverage rollups. */
export const PACKAGE_LABELS = {
  'packages/common/': '@lightdash-tools/common',
  'packages/client/': '@lightdash-tools/client',
  'packages/cli/': '@lightdash-tools/cli',
  'packages/mcp/': '@lightdash-tools/mcp',
};

/**
 * @param {{ lines: { pct: number }, branches: { pct: number }, functions: { pct: number }, statements: { pct: number } }} metrics
 */
export function isBelowGlobalThresholds(metrics) {
  return (
    metrics.lines.pct < GLOBAL_THRESHOLDS.lines ||
    metrics.branches.pct < GLOBAL_THRESHOLDS.branches ||
    metrics.functions.pct < GLOBAL_THRESHOLDS.functions ||
    metrics.statements.pct < GLOBAL_THRESHOLDS.statements
  );
}

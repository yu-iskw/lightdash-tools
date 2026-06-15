/** Strips trailing slashes from a URL. */
export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Normalizes a public MCP base URL: no trailing slash, no `/mcp` suffix.
 */
export function normalizePublicUrl(url: string): string {
  let normalized = stripTrailingSlash(url.trim());
  if (normalized.endsWith('/mcp')) {
    normalized = normalized.slice(0, -'/mcp'.length);
    normalized = stripTrailingSlash(normalized);
  }
  return normalized;
}

/** Normalizes Lightdash instance URL. */
export function normalizeLightdashUrl(url: string): string {
  return stripTrailingSlash(url.trim());
}

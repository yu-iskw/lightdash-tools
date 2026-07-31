/** Strips trailing slashes from a URL. */
export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Normalizes a public MCP base URL: no trailing slash, no persona MCP path suffix.
 * Longer suffixes are tried first so nested paths strip correctly.
 */
export function normalizePublicUrl(url: string, mcpPaths: readonly string[]): string {
  let normalized = stripTrailingSlash(url.trim());
  const paths = [...mcpPaths].map(normalizeMcpPath).sort((a, b) => b.length - a.length);
  for (const normalizedPath of paths) {
    if (normalized.endsWith(normalizedPath)) {
      normalized = stripTrailingSlash(normalized.slice(0, -normalizedPath.length));
      break;
    }
  }
  return normalized;
}

/** Normalizes Lightdash instance URL. */
export function normalizeLightdashUrl(url: string): string {
  return stripTrailingSlash(url.trim());
}

/** Normalizes MCP HTTP endpoint path to a leading-slash, no-trailing-slash form. */
export function normalizeMcpPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    throw new Error('MCP path must not be empty');
  }

  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return stripTrailingSlash(withLeading);
}

/** True when the URL is cleartext HTTP on loopback (localhost or 127.0.0.1 only). */
export function isLocalHttpOrigin(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:') return false;
  return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
}

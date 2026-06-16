export interface ExtractTokenScopesOptions {
  /** Dev-only escape hatch: grant all supported scopes when claims are missing. */
  grantAllWhenUnknown?: boolean;
}

function tryDecodeJwtPayload(accessToken: string): Record<string, unknown> | undefined {
  const parts = accessToken.split('.');
  if (parts.length !== 3) return undefined;

  try {
    const payload = parts[1];
    if (!payload) return undefined;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function parseScopeClaim(payload: Record<string, unknown>): string[] {
  const scope = payload.scope;
  if (typeof scope === 'string' && scope.trim().length > 0) {
    return scope.split(/\s+/);
  }

  const scp = payload.scp;
  if (Array.isArray(scp)) {
    return scp.filter((value): value is string => typeof value === 'string');
  }

  return [];
}

function filterSupportedScopes(scopes: string[], scopesSupported: readonly string[]): string[] {
  const supported = new Set(scopesSupported);
  return [...new Set(scopes.filter((scope) => supported.has(scope)))];
}

function scopesWhenUnknown(
  scopesSupported: readonly string[],
  grantAllWhenUnknown: boolean,
): string[] {
  return grantAllWhenUnknown ? [...scopesSupported] : [];
}

/** Extracts OAuth scopes from JWT claims. Unknown/opaque tokens fail closed by default. */
export function extractTokenScopes(
  accessToken: string,
  scopesSupported: readonly string[],
  options: ExtractTokenScopesOptions = {},
): string[] {
  const grantAllWhenUnknown = options.grantAllWhenUnknown === true;
  const payload = tryDecodeJwtPayload(accessToken);
  if (!payload) {
    return scopesWhenUnknown(scopesSupported, grantAllWhenUnknown);
  }

  const fromClaim = filterSupportedScopes(parseScopeClaim(payload), scopesSupported);
  if (fromClaim.length > 0) {
    return fromClaim;
  }

  return scopesWhenUnknown(scopesSupported, grantAllWhenUnknown);
}

export function hasRequiredScopes(
  grantedScopes: readonly string[],
  requiredScopes: readonly string[],
): boolean {
  const granted = new Set(grantedScopes);
  return requiredScopes.every((scope) => granted.has(scope));
}

export function requiredScopeForTool(readOnly: boolean): 'mcp:read' | 'mcp:write' {
  return readOnly ? 'mcp:read' : 'mcp:write';
}

export function hasToolScope(grantedScopes: readonly string[], readOnly: boolean): boolean {
  return grantedScopes.includes(requiredScopeForTool(readOnly));
}

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

function hasScopeClaim(payload: Record<string, unknown>): boolean {
  if (typeof payload.scope === 'string') {
    return true;
  }
  return Array.isArray(payload.scp);
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

const ENFORCEABLE_MCP_SCOPES = new Set(['mcp:read', 'mcp:write']);

function filterSupportedScopes(scopes: string[], scopesSupported: readonly string[]): string[] {
  if (scopesSupported.length === 0) {
    return [...new Set(scopes.filter((scope) => ENFORCEABLE_MCP_SCOPES.has(scope)))];
  }

  const supported = new Set(scopesSupported);
  return [...new Set(scopes.filter((scope) => supported.has(scope)))];
}

function scopesWhenUnknown(
  scopesSupported: readonly string[],
  grantAllWhenUnknown: boolean,
): string[] | undefined {
  return grantAllWhenUnknown ? [...scopesSupported] : undefined;
}

/**
 * Extracts OAuth scopes from JWT claims when present.
 *
 * For `lightdash-oauth`, Lightdash access tokens are typically opaque and this returns
 * `undefined` — MCP-local scope enforcement is skipped and authorization relies on the persona
 * tool surface plus Lightdash RBAC (ADR-0006 / ADR-0008). Do not treat decoded JWT scopes as
 * validated Lightdash OAuth authorization unless Lightdash formally issues resource-bound JWT
 * access tokens.
 */
export function extractTokenScopes(
  accessToken: string,
  scopesSupported: readonly string[],
  options: ExtractTokenScopesOptions = {},
): string[] | undefined {
  const grantAllWhenUnknown = options.grantAllWhenUnknown === true;
  const payload = tryDecodeJwtPayload(accessToken);
  if (!payload) {
    return scopesWhenUnknown(scopesSupported, grantAllWhenUnknown);
  }

  if (!hasScopeClaim(payload)) {
    return scopesWhenUnknown(scopesSupported, grantAllWhenUnknown);
  }

  return filterSupportedScopes(parseScopeClaim(payload), scopesSupported);
}

export function hasRequiredScopes(
  grantedScopes: readonly string[],
  requiredScopes: readonly string[],
): boolean {
  const granted = new Set(grantedScopes);
  return requiredScopes.every((scope) => granted.has(scope));
}

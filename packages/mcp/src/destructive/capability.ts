/**
 * Detect MCP client form-elicitation capability (ADR-0015).
 */

import { CLIENT_CAPABILITIES_META_KEY } from '@modelcontextprotocol/server';

import type { ClientCapabilities, ServerContext } from '@modelcontextprotocol/server';

type ElicitationCapability = NonNullable<ClientCapabilities['elicitation']>;

function elicitationSupportsForm(elicitation: ElicitationCapability): boolean {
  // Empty elicitation object ≡ form mode only (spec backwards-compat).
  if (Object.keys(elicitation).length === 0) {
    return true;
  }
  return elicitation.form !== undefined;
}

/**
 * True when the client declared form elicitation.
 *
 * - 2026-07-28: prefer per-request envelope under CLIENT_CAPABILITIES_META_KEY.
 * - 2025-era (current @modelcontextprotocol/server@2.0.0 default): fall back to
 *   initialize-declared capabilities from `Server.getClientCapabilities()`.
 * Empty `elicitation: {}` is equivalent to form-only support per the spec.
 */
export function supportsFormElicitation(
  serverContext: ServerContext | undefined,
  initializeCapabilities?: ClientCapabilities | undefined,
): boolean {
  if (serverContext?.mcpReq) {
    const envelope = serverContext.mcpReq.envelope as Record<PropertyKey, unknown> | undefined;
    const fromEnvelope =
      envelope === undefined
        ? undefined
        : (Reflect.get(envelope, CLIENT_CAPABILITIES_META_KEY) as ClientCapabilities | undefined);
    if (fromEnvelope?.elicitation !== undefined) {
      return elicitationSupportsForm(fromEnvelope.elicitation);
    }
  }

  if (initializeCapabilities?.elicitation !== undefined) {
    return elicitationSupportsForm(initializeCapabilities.elicitation);
  }

  return false;
}

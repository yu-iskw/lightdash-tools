import { buildAuditLogEntry, logAuditEntry } from '@lightdash-tools/common';

import {
  sendJson,
  sendRedirect,
  sendRedirectWithQuery,
  timingSafeEqualString,
} from '../../transports/http-response.js';

import { buildLightdashAuthorizeUrl } from './lightdash-token.js';
import { readFormOrJson } from './oauth-form.js';

import type { OAuthBrokerStore } from './pending-store.js';
import type { McpHttpConfig } from '../../config/load-mcp-config.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

function auditConsent(status: 'blocked' | 'success'): void {
  const startMs = Date.now();
  logAuditEntry(
    buildAuditLogEntry({
      tool: 'oauth_consent',
      status,
      startMs,
    }),
  );
}

function rejectInvalidConsent(res: ServerResponse): void {
  auditConsent('blocked');
  sendJson(res, 400, {
    error: 'invalid_request',
    error_description: 'Invalid or expired consent request',
  });
}

function consentOriginAllowed(req: IncomingMessage, expectedOrigin: string): boolean {
  const raw = req.headers.origin;
  if (typeof raw !== 'string' || raw.length === 0) {
    return false;
  }
  try {
    return new URL(raw).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export type ConsentRequestContext = {
  config: McpHttpConfig;
  expectedOrigin: string;
  store: OAuthBrokerStore;
};

export async function handleConsent(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: ConsentRequestContext,
): Promise<void> {
  if (req.method !== 'POST') {
    res.writeHead(405, { Allow: 'POST' }).end();
    return;
  }

  if (!consentOriginAllowed(req, ctx.expectedOrigin)) {
    auditConsent('blocked');
    sendJson(res, 400, {
      error: 'invalid_request',
      error_description: 'Origin does not match the MCP public URL',
    });
    return;
  }

  const params = await readFormOrJson(req, res, ctx.config.maxBodyBytes);
  if (!params) return;

  const brokerState = params.get('broker_state') ?? '';
  const csrfToken = params.get('csrf_token') ?? '';
  const decision = params.get('decision') ?? '';
  const pending = await ctx.store.getPending(brokerState);
  if (!pending || !timingSafeEqualString(csrfToken, pending.csrfToken)) {
    rejectInvalidConsent(res);
    return;
  }

  if (decision === 'deny') {
    await ctx.store.takePending(brokerState);
    auditConsent('blocked');
    sendRedirectWithQuery(res, pending.redirectUri, {
      error: 'access_denied',
      error_description: 'The user denied the authorization request',
      state: pending.clientState,
    });
    return;
  }

  if (decision !== 'approve') {
    auditConsent('blocked');
    sendJson(res, 400, {
      error: 'invalid_request',
      error_description: 'decision must be approve or deny',
    });
    return;
  }

  const consented = await ctx.store.markConsented(brokerState);
  if (!consented) {
    rejectInvalidConsent(res);
    return;
  }

  auditConsent('success');
  // MCP resource/scope stay on the client→broker leg. Do not forward them to Lightdash.
  sendRedirect(res, buildLightdashAuthorizeUrl(ctx.config, { state: consented.brokerState }));
}

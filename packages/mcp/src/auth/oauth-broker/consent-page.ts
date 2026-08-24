import { getProfileByPath } from '../../profiles/index.js';

import type { ProfileId } from '@lightdash-tools/common';

const CONSENT_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'";

export const CONSENT_PAGE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': CONSENT_CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

const WRITE_PROFILES = new Set<ProfileId>([
  'content-developer',
  'content-governance',
  'ai-agent-ops',
  'ai-agent-chat',
]);

const DESTRUCTIVE_PROFILES = new Set<ProfileId>(['content-governance']);

const OPEN_WORLD_PROFILES = new Set<ProfileId>(['ai-agent-chat', 'data-analyst']);

export type ProfileConsentCapabilities = {
  profileId: string;
  canMutate: boolean;
  destructive: boolean;
  openWorld: boolean;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function profileCapabilitiesFromResource(resource: string): ProfileConsentCapabilities {
  let pathname = resource;
  try {
    pathname = new URL(resource).pathname;
  } catch {
    // Keep the raw string; getProfileByPath will fail closed to unknown.
  }
  const profile = getProfileByPath(pathname);
  const profileId = profile?.id ?? 'unknown';
  return {
    profileId,
    canMutate: profile !== undefined && WRITE_PROFILES.has(profile.id),
    destructive: profile !== undefined && DESTRUCTIVE_PROFILES.has(profile.id),
    openWorld: profile !== undefined && OPEN_WORLD_PROFILES.has(profile.id),
  };
}

export type ConsentPageInput = {
  consentPath: string;
  brokerState: string;
  csrfToken: string;
  clientId: string;
  clientName: string;
  resource: string;
};

function capabilityItem(allowed: boolean, label: string): string {
  const mark = allowed ? 'yes' : 'no';
  return `<li><strong>${mark}:</strong> ${escapeHtml(label)}</li>`;
}

export function renderConsentPage(input: ConsentPageInput): string {
  const caps = profileCapabilitiesFromResource(input.resource);
  const name = input.clientName.trim() === '' ? 'Unregistered MCP client' : input.clientName;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Authorize MCP client</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; color: #111; }
    .unverified { color: #92400e; font-weight: 600; }
    .box { border: 1px solid #d1d5db; border-radius: 8px; padding: 1rem 1.25rem; }
    button { margin-right: 0.75rem; margin-top: 1rem; padding: 0.5rem 1rem; }
  </style>
</head>
<body>
  <h1>Allow this MCP client to use Lightdash through Lightdash-tools?</h1>
  <div class="box">
    <p><span class="unverified">Unverified</span> (dynamic client registration)</p>
    <p><strong>Client name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Client id:</strong> <code>${escapeHtml(input.clientId)}</code></p>
    <p><strong>Requested profile:</strong> <code>${escapeHtml(caps.profileId)}</code></p>
    <p><strong>Resource:</strong> <code>${escapeHtml(input.resource)}</code></p>
    <p>You will authenticate with Lightdash next. This client will be able to:</p>
    <ul>
      ${capabilityItem(true, 'Call tools on the requested MCP profile as your Lightdash user')}
      ${capabilityItem(caps.canMutate, 'Create or update Lightdash content')}
      ${capabilityItem(caps.destructive, 'Delete or otherwise destroy content')}
      ${capabilityItem(caps.openWorld, 'Run open-world or generative operations')}
    </ul>
    <form method="post" action="${escapeHtml(input.consentPath)}">
      <input type="hidden" name="broker_state" value="${escapeHtml(input.brokerState)}"/>
      <input type="hidden" name="csrf_token" value="${escapeHtml(input.csrfToken)}"/>
      <button type="submit" name="decision" value="deny">Cancel</button>
      <button type="submit" name="decision" value="approve">Continue to Lightdash</button>
    </form>
  </div>
</body>
</html>
`;
}

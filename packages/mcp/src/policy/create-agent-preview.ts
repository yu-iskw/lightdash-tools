/**
 * HMAC-signed preview tokens for create_project_agent (ADR-0034 / ADR-0019).
 *
 * Client-carried draft → confirm → apply when the host lacks MCP form elicitation.
 */

import { randomUUID } from 'node:crypto';

import { createRequestStateCodec } from '@modelcontextprotocol/server';

import { resolveRequestStateKey } from '../auth/request-state-key.js';

import type { RequestStateCodec, ServerContext } from '@modelcontextprotocol/server';

export const CREATE_AGENT_PREVIEW_KEY_PURPOSE = 'ai-agent-ops create preview tokens are enabled';

export type CreateAgentPreviewStatus = 'draft' | 'validated';

/** Claims embedded in createPreviewToken / createConfirmToken (no full payload body). */
export type CreateAgentPreviewClaims = {
  previewId: string;
  subject: string;
  projectUuid: string;
  agentName: string;
  payloadDigest: string;
  status: CreateAgentPreviewStatus;
  createdAt: string;
  expiresAt: string;
};

export class CreateAgentPreviewError extends Error {
  readonly code:
    | 'CREATE_PREVIEW_NOT_OWNED'
    | 'CREATE_PREVIEW_NOT_VALIDATED'
    | 'CREATE_PREVIEW_REQUIRED'
    | 'CREATE_PREVIEW_STALE';

  constructor(code: CreateAgentPreviewError['code'], message: string) {
    super(message);
    this.name = 'CreateAgentPreviewError';
    this.code = code;
  }
}

/** Default preview lifetime; short enough to discourage stale multi-step drift. */
export const DEFAULT_CREATE_AGENT_PREVIEW_TTL_MS = 10 * 60_000;
const TTL_SECONDS = DEFAULT_CREATE_AGENT_PREVIEW_TTL_MS / 1000;

/** Minimal ServerContext for unit tests that mint/verify without a live MCP request. */
export const EMPTY_CREATE_AGENT_SERVER_CONTEXT = { mcpReq: {} } as ServerContext;

let codec: RequestStateCodec<CreateAgentPreviewClaims> | undefined;

function getCreateAgentPreviewCodec(): RequestStateCodec<CreateAgentPreviewClaims> {
  if (!codec) {
    codec = createRequestStateCodec<CreateAgentPreviewClaims>({
      key: resolveRequestStateKey(CREATE_AGENT_PREVIEW_KEY_PURPOSE),
      ttlSeconds: TTL_SECONDS,
    });
  }
  return codec;
}

/** Reset codec (tests only). */
export function resetCreateAgentPreviewCodecForTests(): void {
  codec = undefined;
}

export { getCreateAgentPreviewCodec };

function resolveServerContext(serverContext: ServerContext | undefined): ServerContext {
  return serverContext ?? EMPTY_CREATE_AGENT_SERVER_CONTEXT;
}

async function mintClaims(
  claims: CreateAgentPreviewClaims,
  serverContext: ServerContext | undefined,
): Promise<string> {
  return getCreateAgentPreviewCodec().mint(claims, resolveServerContext(serverContext));
}

async function verifyClaims(
  token: string,
  serverContext: ServerContext | undefined,
): Promise<CreateAgentPreviewClaims> {
  if (token.length === 0) {
    throw new CreateAgentPreviewError(
      'CREATE_PREVIEW_REQUIRED',
      'createPreviewToken is required; call preview_create_agent first',
    );
  }
  try {
    const claims = await getCreateAgentPreviewCodec().verify(
      token,
      resolveServerContext(serverContext),
    );
    if (Date.parse(claims.expiresAt) < Date.now()) {
      throw new CreateAgentPreviewError(
        'CREATE_PREVIEW_REQUIRED',
        'createPreviewToken is invalid or expired; call preview_create_agent first',
      );
    }
    return claims;
  } catch (err) {
    if (err instanceof CreateAgentPreviewError) {
      throw err;
    }
    throw new CreateAgentPreviewError(
      'CREATE_PREVIEW_REQUIRED',
      'createPreviewToken is invalid or expired; call preview_create_agent first',
    );
  }
}

function assertSubjectAndProject(
  claims: CreateAgentPreviewClaims,
  subject: string,
  projectUuid: string,
): void {
  if (claims.subject !== subject || claims.projectUuid !== projectUuid) {
    throw new CreateAgentPreviewError(
      'CREATE_PREVIEW_NOT_OWNED',
      `Preview '${claims.previewId}' is not owned by this subject/project`,
    );
  }
}

function assertAgentName(claims: CreateAgentPreviewClaims, agentName: string): void {
  if (claims.agentName !== agentName) {
    throw new CreateAgentPreviewError(
      'CREATE_PREVIEW_STALE',
      `Preview '${claims.previewId}' was created for agent name '${claims.agentName}', not '${agentName}'`,
    );
  }
}

/** Mint a draft createPreviewToken. Does not store payload on the server. */
export async function mintDraftCreateAgentPreviewToken(input: {
  subject: string;
  projectUuid: string;
  agentName: string;
  payloadDigest: string;
  serverContext?: ServerContext;
}): Promise<{ createPreviewToken: string; claims: CreateAgentPreviewClaims }> {
  const now = Date.now();
  const claims: CreateAgentPreviewClaims = {
    previewId: randomUUID(),
    subject: input.subject,
    projectUuid: input.projectUuid,
    agentName: input.agentName,
    payloadDigest: input.payloadDigest,
    status: 'draft',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DEFAULT_CREATE_AGENT_PREVIEW_TTL_MS).toISOString(),
  };
  const createPreviewToken = await mintClaims(claims, input.serverContext);
  return { createPreviewToken, claims };
}

/** Confirm a draft token: verify bindings and mint a validated createConfirmToken (no write). */
export async function confirmCreateAgentPreviewToken(input: {
  createPreviewToken: string;
  subject: string;
  projectUuid: string;
  agentName: string;
  serverContext?: ServerContext;
}): Promise<{ createConfirmToken: string; claims: CreateAgentPreviewClaims }> {
  const claims = await verifyClaims(input.createPreviewToken, input.serverContext);
  assertSubjectAndProject(claims, input.subject, input.projectUuid);
  assertAgentName(claims, input.agentName);
  if (claims.status !== 'draft') {
    throw new CreateAgentPreviewError(
      'CREATE_PREVIEW_NOT_VALIDATED',
      `Preview '${claims.previewId}' cannot be confirmed from status '${claims.status}'`,
    );
  }
  const now = Date.now();
  const validated: CreateAgentPreviewClaims = {
    ...claims,
    status: 'validated',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + DEFAULT_CREATE_AGENT_PREVIEW_TTL_MS).toISOString(),
  };
  const createConfirmToken = await mintClaims(validated, input.serverContext);
  return { createConfirmToken, claims: validated };
}

export type ApplyCreateAgentPreviewInput = {
  createConfirmToken: string;
  subject: string;
  projectUuid: string;
  agentName: string;
  payloadDigest: string;
  serverContext?: ServerContext;
};

/** Verify validated token before create (no upstream write). */
export async function verifyValidatedCreateConfirmToken(
  input: ApplyCreateAgentPreviewInput,
): Promise<CreateAgentPreviewClaims> {
  const claims = await verifyClaims(input.createConfirmToken, input.serverContext);
  assertSubjectAndProject(claims, input.subject, input.projectUuid);
  assertAgentName(claims, input.agentName);
  if (claims.status !== 'validated') {
    throw new CreateAgentPreviewError(
      'CREATE_PREVIEW_NOT_VALIDATED',
      `Preview '${claims.previewId}' has not been validated; call confirm_create_agent first`,
    );
  }
  if (claims.payloadDigest !== input.payloadDigest) {
    throw new CreateAgentPreviewError(
      'CREATE_PREVIEW_STALE',
      `Preview '${claims.previewId}' payload digest does not match; re-run preview_create_agent -> confirm_create_agent`,
    );
  }
  return claims;
}

/** Verify validated token then run create mutation (ADR-0019: no server-side claim store). */
export async function withValidatedCreateAgentApply<T>(
  input: ApplyCreateAgentPreviewInput,
  fn: (claims: CreateAgentPreviewClaims) => Promise<T>,
): Promise<T> {
  const claims = await verifyValidatedCreateConfirmToken(input);
  return fn(claims);
}

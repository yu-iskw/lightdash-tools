/**
 * HMAC-signed requestState for create_project_agent elicitation (ADR-0033 / ADR-0015 pattern).
 */

import { createRequestStateCodec } from '@modelcontextprotocol/server';

import { resolveRequestStateKey } from '../../auth/request-state-key.js';

import type { RequestStateCodec, ServerContext } from '@modelcontextprotocol/server';

export const CREATE_AGENT_REQUEST_STATE_KEY_PURPOSE =
  'ai-agent-ops create_project_agent elicitation is enabled';

export const CREATE_PROJECT_AGENT_OPERATION_ID = 'create_project_agent' as const;

export type CreateAgentRequestState = {
  operationId: typeof CREATE_PROJECT_AGENT_OPERATION_ID;
  projectUuid: string;
  payloadDigest: string;
  subject: string;
};

const TTL_SECONDS = 10 * 60;

let codec: RequestStateCodec<CreateAgentRequestState> | undefined;

function getCreateAgentRequestStateCodec(): RequestStateCodec<CreateAgentRequestState> {
  if (!codec) {
    codec = createRequestStateCodec<CreateAgentRequestState>({
      key: resolveRequestStateKey(CREATE_AGENT_REQUEST_STATE_KEY_PURPOSE),
      ttlSeconds: TTL_SECONDS,
    });
  }
  return codec;
}

/** Reset codec (tests only). */
export function resetCreateAgentRequestStateCodecForTests(): void {
  codec = undefined;
}

export async function mintCreateAgentRequestState(
  state: CreateAgentRequestState,
  serverContext: ServerContext,
): Promise<string> {
  return getCreateAgentRequestStateCodec().mint(state, serverContext);
}

export async function verifyCreateAgentRequestState(
  token: string | undefined,
  serverContext: ServerContext,
): Promise<CreateAgentRequestState | undefined> {
  if (token === undefined || token.length === 0) {
    return undefined;
  }
  try {
    return await getCreateAgentRequestStateCodec().verify(token, serverContext);
  } catch {
    return undefined;
  }
}

export { getCreateAgentRequestStateCodec };

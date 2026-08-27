import { McpServer } from '@modelcontextprotocol/server';

import {
  assertRequestStateKeyConfigured,
  DESTRUCTIVE_REQUEST_STATE_KEY_PURPOSE,
  PREVIEW_TOKEN_KEY_PURPOSE,
} from '../auth/request-state-key.js';
import { getDestructiveRequestStateCodec } from '../destructive/request-state.js';
import { getDefaultProfile, getProfileServerName } from '../profiles/index.js';
import {
  CREATE_AGENT_REQUEST_STATE_KEY_PURPOSE,
  getCreateAgentRequestStateCodec,
} from '../tools/ai-agents/create-request-state.js';

import { registerCapabilities } from './capabilities.js';
import { PACKAGE_VERSION } from './version.js';

import type { RegisterCapabilitiesOptions } from './capabilities.js';
import type { McpContextProvider } from './request-context.js';
import type { ServerContext } from '@modelcontextprotocol/server';

export function createLightdashMcpServer(
  contextProvider: McpContextProvider,
  options?: RegisterCapabilitiesOptions,
): McpServer {
  const profile = options?.profile ?? getDefaultProfile();
  if (profile.id === 'content-governance') {
    assertRequestStateKeyConfigured(DESTRUCTIVE_REQUEST_STATE_KEY_PURPOSE);
  } else if (profile.id === 'content-developer') {
    assertRequestStateKeyConfigured(PREVIEW_TOKEN_KEY_PURPOSE);
  } else if (profile.id === 'ai-agent-ops') {
    assertRequestStateKeyConfigured(CREATE_AGENT_REQUEST_STATE_KEY_PURPOSE);
  }

  let serverOptions:
    { requestState: { verify: (state: string, ctx: ServerContext) => unknown } } | undefined;
  if (profile.id === 'content-governance') {
    serverOptions = {
      requestState: {
        verify: (state: string, ctx: ServerContext) =>
          getDestructiveRequestStateCodec().verify(state, ctx),
      },
    };
  } else if (profile.id === 'ai-agent-ops') {
    serverOptions = {
      requestState: {
        verify: (state: string, ctx: ServerContext) =>
          getCreateAgentRequestStateCodec().verify(state, ctx),
      },
    };
  }

  const server = new McpServer(
    {
      name: getProfileServerName(profile),
      version: PACKAGE_VERSION,
    },
    serverOptions,
  );
  registerCapabilities(server, contextProvider, { ...options, profile });
  return server;
}

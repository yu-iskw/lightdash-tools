import { McpServer } from '@modelcontextprotocol/server';

import {
  assertRequestStateKeyConfigured,
  DESTRUCTIVE_REQUEST_STATE_KEY_PURPOSE,
  PREVIEW_TOKEN_KEY_PURPOSE,
} from '../auth/request-state-key.js';
import { getDestructiveRequestStateCodec } from '../destructive/request-state.js';
import { getDefaultProfile, getProfileServerName } from '../profiles/index.js';

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
  }
  const serverOptions =
    profile.id === 'content-governance'
      ? {
          requestState: {
            verify: (state: string, ctx: ServerContext) =>
              getDestructiveRequestStateCodec().verify(state, ctx),
          },
        }
      : undefined;
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

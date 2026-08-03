import { McpServer } from '@modelcontextprotocol/server';

import {
  assertRequestStateKeyConfigured,
  DESTRUCTIVE_REQUEST_STATE_KEY_PURPOSE,
  PREVIEW_TOKEN_KEY_PURPOSE,
} from '../auth/request-state-key.js';
import { getDestructiveRequestStateCodec } from '../destructive/request-state.js';
import { getDefaultPersona, getPersonaServerName } from '../personas/index.js';

import { registerCapabilities } from './capabilities.js';
import { PACKAGE_VERSION } from './version.js';

import type { RegisterCapabilitiesOptions } from './capabilities.js';
import type { McpContextProvider } from './request-context.js';
import type { ServerContext } from '@modelcontextprotocol/server';

export function createLightdashMcpServer(
  contextProvider: McpContextProvider,
  options?: RegisterCapabilitiesOptions,
): McpServer {
  const persona = options?.persona ?? getDefaultPersona();
  if (persona.id === 'content-governance') {
    assertRequestStateKeyConfigured(DESTRUCTIVE_REQUEST_STATE_KEY_PURPOSE);
  } else if (persona.id === 'content-developer') {
    assertRequestStateKeyConfigured(PREVIEW_TOKEN_KEY_PURPOSE);
  }
  const serverOptions =
    persona.id === 'content-governance'
      ? {
          requestState: {
            verify: (state: string, ctx: ServerContext) =>
              getDestructiveRequestStateCodec().verify(state, ctx),
          },
        }
      : undefined;
  const server = new McpServer(
    {
      name: getPersonaServerName(persona),
      version: PACKAGE_VERSION,
    },
    serverOptions,
  );
  registerCapabilities(server, contextProvider, { ...options, persona });
  return server;
}

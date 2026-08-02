import { McpServer } from '@modelcontextprotocol/server';

import {
  assertDestructiveRequestStateKeyConfigured,
  getDestructiveRequestStateCodec,
} from '../destructive/request-state.js';
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
  const serverOptions =
    persona.id === 'content-governance'
      ? (() => {
          assertDestructiveRequestStateKeyConfigured();
          return {
            requestState: {
              verify: (state: string, ctx: ServerContext) =>
                getDestructiveRequestStateCodec().verify(state, ctx),
            },
          };
        })()
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

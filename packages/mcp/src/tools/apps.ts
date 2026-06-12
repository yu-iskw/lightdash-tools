/**
 * MCP App tools and resources registration.
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';

import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';

import { registerAppToolSafe, READ_ONLY_DEFAULT } from './shared.js';

import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const appRequire = createRequire(__filename);
const resourceUri = 'ui://minimal-app/index.html';

function loadAppHtml(): string | undefined {
  let htmlPath: string;
  try {
    htmlPath = appRequire.resolve('@lightdash-tools/mcp-ui/index.html');
  } catch (err) {
    console.error(
      'Warning: Could not resolve @lightdash-tools/mcp-ui/index.html. Make sure the package is built.',
      err,
    );
    return undefined;
  }

  try {
    // htmlPath comes from require.resolve of a workspace package export, not user input.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- resolved package asset path
    return fs.readFileSync(htmlPath, 'utf-8');
  } catch (err) {
    console.error('Error reading MCP App HTML:', err);
    return undefined;
  }
}

/**
 * Registers MCP App tools and resources.
 */
export function registerAppTools(server: McpServer, _client: LightdashClient): void {
  const appHtml = loadAppHtml();
  if (!appHtml) {
    return;
  }

  registerAppToolSafe(
    server,
    'minimal_app',
    {
      title: 'Minimal MCP app',
      description: 'Open a minimal Lightdash MCP app to test connectivity and bidirectional flow.',
      inputSchema: {
        test: z.boolean().optional().describe('Optional test flag'),
      },
      annotations: READ_ONLY_DEFAULT,
      _meta: {
        ui: { resourceUri },
      },
    },
    async (args) => {
      return {
        content: [
          {
            type: 'text',
            text: `Launching minimal app with args: ${JSON.stringify(args)}. If you see this, your host should be rendering the UI resource at ${resourceUri}.`,
          },
        ],
      };
    },
  );

  registerAppResource(
    server as unknown as Parameters<typeof registerAppResource>[0],
    resourceUri,
    'Minimal App UI',
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [
        {
          uri: resourceUri,
          mimeType: RESOURCE_MIME_TYPE,
          text: appHtml,
        },
      ],
    }),
  );
}

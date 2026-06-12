/**
 * MCP App tools and resources registration.
 */

import fs from 'node:fs';
import path from 'node:path';

import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';

import { registerAppToolSafe, READ_ONLY_DEFAULT } from './shared.js';

import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const resourceUri = 'ui://minimal-app/index.html';
/** Bundled at build time from @lightdash-tools/mcp-ui (see scripts/copy-ui-asset.mjs). */
const bundledAppHtmlPath = path.join(__dirname, '..', 'assets', 'minimal-app.html');

function loadAppHtml(): string | undefined {
  try {
    // Path is fixed relative to this module; not derived from user input.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- bundled package asset path
    return fs.readFileSync(bundledAppHtmlPath, 'utf-8');
  } catch (err) {
    console.error(
      `Warning: Could not read bundled MCP App HTML at ${bundledAppHtmlPath}. Rebuild @lightdash-tools/mcp.`,
      err,
    );
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

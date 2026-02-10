/**
 * Minimal MCP server over Stdio (local). Use as a starting point.
 * Logging: use console.error only; never console.log (stdout is used for JSON-RPC).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'example', version: '1.0.0' });

server.registerTool(
  'echo',
  {
    description: 'Echo a message back',
    inputSchema: { message: z.string().describe('Message to echo') },
  },
  async ({ message }) => ({
    content: [{ type: 'text', text: message }],
  }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

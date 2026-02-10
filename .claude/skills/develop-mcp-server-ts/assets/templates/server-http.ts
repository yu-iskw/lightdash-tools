/**
 * Minimal MCP server over Streamable HTTP (remote). Use as a starting point.
 * Wire StreamableHTTPServerTransport to your HTTP server (Express, Node http, etc.).
 * For auth, see: https://modelcontextprotocol.io/docs/tutorials/security/authorization
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// Referenced in commented example below when wiring HTTP handler
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'; // eslint-disable-line @typescript-eslint/no-unused-vars
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

// Example: create transport and connect server; then in your HTTP handler,
// call transport.handleRequest(req, res, body) for POST requests.
// const transport = new StreamableHTTPServerTransport();
// await server.connect(transport);
// app.post("/mcp", (req, res) => transport.handleRequest(req, res, req.body));

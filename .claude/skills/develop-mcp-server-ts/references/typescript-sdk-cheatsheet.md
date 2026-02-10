# TypeScript SDK cheatsheet

Code patterns for building MCP servers with `@modelcontextprotocol/sdk`. The SDK requires **Zod** for tool inputSchema.

## Imports and server instance

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'my-server',
  version: '1.0.0',
});
```

## Stdio transport (local)

```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
// Logging: use console.error only; never console.log (stdout corrupts JSON-RPC)
console.error('MCP server running on stdio');
```

## Streamable HTTP transport (remote)

```typescript
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const transport = new StreamableHTTPServerTransport({ ... });
await server.connect(transport);
// Then wire transport to your HTTP server (e.g. Express, Node http).
```

## Register a tool (with Zod inputSchema)

```typescript
server.registerTool(
  'get_data',
  {
    description: 'Fetches data by ID',
    inputSchema: {
      id: z.string().describe('Resource ID'),
      limit: z.number().optional().describe('Max results'),
    },
  },
  async ({ id, limit }) => {
    // ... fetch data ...
    return {
      content: [{ type: 'text', text: `Result for ${id}` }],
    };
  },
);
```

Tool result shape: `{ content: Array<{ type: "text"; text: string } | ...> }`. Always return an array of content items.

## Register a resource (template)

Resources expose read-only data by URI. Use a URI template for dynamic resources.

```typescript
// Example: resource template "user://{username}/profile"
server.registerResource(
  'user_profile',
  'user://{username}/profile',
  { description: 'Read-only user profile' },
  async (uri, { username }) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: 'text/plain',
        text: `Profile data for ${username}`,
      },
    ],
  }),
);
```

## Logging rule (Stdio)

For **Stdio** transport, the server must not write to **stdout**; stdout is used for JSON-RPC messages.

- **Bad**: `console.log("...")` (writes to stdout).
- **Good**: `console.error("...")` or a logger configured to write to stderr.

For **Streamable HTTP**, normal stdout logging is fine.

## Package and TypeScript

- **Dependencies**: `@modelcontextprotocol/sdk`, `zod`.
- **ESM**: Use `"type": "module"` in package.json; import with `.js` extension in path (e.g. `.../mcp.js`).
- **tsconfig**: `"module": "Node16"`, `"moduleResolution": "Node16"`, `"target": "ES2022"`.

## Official SDK and examples

- [TypeScript SDK repo](https://github.com/modelcontextprotocol/typescript-sdk)
- [Server examples](https://github.com/modelcontextprotocol/typescript-sdk/tree/main/examples/server)
- [MCP Build server (TypeScript)](https://modelcontextprotocol.io/docs/develop/build-server#typescript)

# TypeScript SDK cheatsheet

Code patterns for building MCP servers with `@modelcontextprotocol/sdk`. The SDK requires **Zod** for tool inputSchema. Aligned with **MCP specification 2025-11-25**; see [spec-2025-11-25-index.md](spec-2025-11-25-index.md) and [server/tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [server/utilities](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities).

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

**Tool names (2025-11-25):** 1–128 characters, case-sensitive. Allowed: letters, digits, `_`, `-`, `.`. No spaces or commas. See [server/tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

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

**Tool result shape:** `{ content: Array<{ type: "text"; text: string } | ...> }`. Always return an array of content items.

**Tool execution errors vs protocol errors:** For input validation or business-logic failures, return a **tool execution error** (result with `isError: true` and optional `content`). Protocol errors (unknown tool, malformed request) are reported by the SDK/protocol layer. See [server/tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

**Optional tool fields (2025-11-25):** The spec allows optional `title`, `icons`, `outputSchema`, and `annotations` on tool definitions; use the SDK types or spec for details.

## Tool annotations

Tool annotations are optional hints that help clients present tools and support user approval. They do **not** affect model behavior and must not be used for security decisions. See [MCP Tools — Tool annotations](https://modelcontextprotocol.io/legacy/concepts/tools#tool-annotations).

| Annotation        | Type    | Purpose                                                                                    |
| ----------------- | ------- | ------------------------------------------------------------------------------------------ |
| `title`           | string  | Human-readable title for UI display.                                                       |
| `readOnlyHint`    | boolean | If true, the tool does not modify its environment.                                         |
| `destructiveHint` | boolean | If true, the tool may perform destructive updates (meaningful when readOnlyHint is false). |
| `idempotentHint`  | boolean | If true, repeated calls with the same arguments have no additional effect.                 |
| `openWorldHint`   | boolean | If true, the tool may interact with external entities (e.g. the web).                      |

**Example:** Register a tool with `title` and `annotations` so clients can show a friendly name and approval cues:

```typescript
server.registerTool(
  'web_search',
  {
    title: 'Web Search',
    description: 'Search the web for information',
    inputSchema: {
      query: z.string().describe('Search query'),
    },
    annotations: {
      title: 'Web Search',
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async ({ query }) => ({
    content: [{ type: 'text', text: `Results for: ${query}` }],
  }),
);
```

Use annotations accurately so clients can categorize tools and users can make informed approval decisions. Annotations are hints only—never rely on them for security.

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

**Protocol logging (2025-11-25):** The spec defines a logging capability and `notifications/message` (level, logger, data) for structured protocol logging. See [server/utilities/logging](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/logging).

## Pagination (2025-11-25)

List operations (e.g. `tools/list`, `resources/list`) may support **cursor-based pagination**: request params can include `cursor`; responses may include `nextCursor`. Cursors are opaque; pass them through unchanged. See [server/utilities/pagination](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/pagination).

## Package and TypeScript

- **Dependencies**: `@modelcontextprotocol/sdk`, `zod`.
- **ESM**: Use `"type": "module"` in package.json; import with `.js` extension in path (e.g. `.../mcp.js`).
- **tsconfig**: `"module": "Node16"`, `"moduleResolution": "Node16"`, `"target": "ES2022"`.

## Official SDK and examples

- [TypeScript SDK repo](https://github.com/modelcontextprotocol/typescript-sdk)
- [Server examples](https://github.com/modelcontextprotocol/typescript-sdk/tree/main/examples/server)
- [MCP Build server (TypeScript)](https://modelcontextprotocol.io/docs/develop/build-server#typescript)
- [Spec 2025-11-25: server/tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) · [server/utilities](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/completion) (completion, logging, pagination)
- [MCP Tools — Tool annotations](https://modelcontextprotocol.io/legacy/concepts/tools#tool-annotations) (title, readOnlyHint, destructiveHint, idempotentHint, openWorldHint)

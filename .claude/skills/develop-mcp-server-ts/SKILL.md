---
name: develop-mcp-server-ts
description: Standardized workflow for building MCP (Model Context Protocol) servers in TypeScript. Use when building or extending an MCP server with the official TypeScript SDK (tools, resources, prompts), choosing Stdio vs Streamable HTTP transport, or testing with MCP Inspector or Claude Desktop.
---

# Develop MCP Server (TypeScript)

## Purpose

Provide a repeatable, documented workflow for building MCP servers with the official TypeScript SDK so that agents and developers can add tools, resources, and prompts without ad-hoc discovery. Follow this workflow to go from requirements to a testable server (Stdio or Streamable HTTP).

## Workflow Checklist

- [ ] **Step 1: Requirements discovery**
  - [ ] Read [references/mcp-specification.md](references/mcp-specification.md) for primitives (Tools, Resources, Prompts) and transports.
  - [ ] Decide which primitives the server will expose (e.g. tools only, or tools + resources).
  - [ ] Choose transport: **Stdio** (local, process-based) or **Streamable HTTP** (remote, web-based).
- [ ] **Step 2: Project initialization**
  - [ ] Initialize a Node/pnpm project; install `@modelcontextprotocol/sdk` and `zod`.
  - [ ] Configure TypeScript for ESM (e.g. `"module": "Node16"`, `"target": "ES2022"`). Optionally use [assets/boilerplate/package.json](assets/boilerplate/package.json) and [assets/boilerplate/tsconfig.json](assets/boilerplate/tsconfig.json).
- [ ] **Step 3: Implementation patterns**
  - [ ] Use [references/typescript-sdk-cheatsheet.md](references/typescript-sdk-cheatsheet.md) for McpServer, transport, registerTool (with Zod inputSchema), and registerResource.
  - [ ] For **Stdio**: Use only `console.error` (or stderr) for logging; never `console.log` (stdout corrupts JSON-RPC).
  - [ ] Optionally copy from [assets/templates/server-stdio.ts](assets/templates/server-stdio.ts) or [assets/templates/server-http.ts](assets/templates/server-http.ts).
- [ ] **Step 4: Testing**
  - [ ] Test with **MCP Inspector**: e.g. `npx @modelcontextprotocol/inspector` and run your server (e.g. `node build/index.js`).
  - [ ] Or test with **Claude Desktop**: Add the server to `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`) with `command` and `args`, then restart Claude Desktop.

## Detailed Instructions

### 1. Requirements discovery

Read the [MCP specification summary](references/mcp-specification.md) for:

- **Primitives**: Tools (callable by the LLM), Resources (read-only context), Prompts (reusable templates).
- **Transports**: Stdio (local, one client per process) vs Streamable HTTP (remote, many clients).
- **Lifecycle**: Initialize, negotiate capabilities, then list/call tools or read resources.

Decide which primitives your server needs and whether it will run locally (Stdio) or be hosted (Streamable HTTP).

### 2. Project initialization

- Create a package (e.g. `pnpm init` or `npm init -y`).
- Install: `pnpm add @modelcontextprotocol/sdk zod` (or `npm install @modelcontextprotocol/sdk zod`). The SDK requires Zod for tool inputSchema.
- Set `"type": "module"` in package.json if using ESM.
- Use a tsconfig with `"module": "Node16"`, `"moduleResolution": "Node16"`, `"target": "ES2022"`, and `"outDir": "./build"` (or similar).

### 3. Implementation patterns

Use the [TypeScript SDK cheatsheet](references/typescript-sdk-cheatsheet.md) for:

- Creating an `McpServer` and connecting a transport (`StdioServerTransport` or `StreamableHTTPServerTransport`).
- Registering tools with `server.registerTool(name, { description, inputSchema }, handler)`. Use Zod for `inputSchema` (e.g. `{ id: z.string() }`). Return `{ content: [{ type: "text", text: "..." }] }`.
- Registering resources if needed (URI templates and read handler).
- **Logging**: For Stdio transport, never write to stdout; use `console.error` or a logger that writes to stderr.

### 4. Testing

- **MCP Inspector**: Run `npx @modelcontextprotocol/inspector`, then start your server (e.g. with the command you would use in Claude Desktop). Use the Inspector UI to list tools and call them.
- **Claude Desktop**: Edit the config file (see [Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers)). Add an entry under `mcpServers` with `command` and `args` (e.g. `node` and `["/path/to/build/index.js"]`). Restart Claude Desktop fully (quit the app, then reopen). Verify the server appears under Connectors.

## Success Criteria

- The server lists and executes tools (and optionally resources/prompts) correctly.
- For Stdio: No use of `console.log`; logs go to stderr.
- Tool inputSchema uses Zod and matches the SDK expectations.
- Official links (TypeScript SDK, MCP spec) are used for version and API details.

## References

- [references/mcp-specification.md](references/mcp-specification.md) – MCP concepts and spec links
- [references/typescript-sdk-cheatsheet.md](references/typescript-sdk-cheatsheet.md) – SDK snippets and logging rule
- [MCP Build server (TypeScript)](https://modelcontextprotocol.io/docs/develop/build-server#typescript)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Specification versioning](https://modelcontextprotocol.io/specification/versioning)

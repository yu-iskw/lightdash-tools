# MCP specification summary

Short reference for the Model Context Protocol (MCP) concepts used when building servers. This summary is aligned with **MCP specification 2025-11-25**. For full details and versioned links, see [spec-2025-11-25-index.md](spec-2025-11-25-index.md) and the official specification.

## Participants

- **MCP Host**: The AI application (e.g. Claude Desktop, VS Code) that coordinates clients.
- **MCP Client**: Maintains a connection to one MCP server; obtains context for the host.
- **MCP Server**: Program that provides context to clients (tools, resources, prompts).

## Primitives (server → client)

Servers can expose three core primitives:

| Primitive     | Purpose                                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tools**     | Functions the LLM can call (e.g. run a query, send a message). Protocol: `tools/list`, `tools/call`. Tools can include optional **annotations** (e.g. `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) to help clients present and approve tools; see [Tool annotations](https://modelcontextprotocol.io/legacy/concepts/tools#tool-annotations). |
| **Resources** | Read-only data (e.g. file contents, API responses). Protocol: `resources/list`, `resources/templates/list`, `resources/read`.                                                                                                                                                                                                                                                   |
| **Prompts**   | Reusable interaction templates. Protocol: `prompts/list`, `prompts/get`.                                                                                                                                                                                                                                                                                                        |

## Transports

| Transport           | Use case                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **Stdio**           | Local servers; host spawns the server process and communicates via stdin/stdout. One client per process. |
| **Streamable HTTP** | Remote servers; clients connect over HTTP. Supports many clients; optional OAuth/authorization.          |

## Lifecycle

1. **Initialize**: Client sends `initialize` with protocol version and capabilities; server responds with its capabilities (e.g. tools, resources).
2. **Ready**: Client sends `notifications/initialized`.
3. **Discovery**: Client calls e.g. `tools/list` to get tool definitions.
4. **Execution**: Client calls `tools/call` with name and arguments; server returns result content.

## Protocol and versioning

- MCP uses JSON-RPC 2.0 for messages.
- Protocol version is a date string (e.g. **2025-11-25**). Version negotiation happens during initialization.
- Specification (2025-11-25): [Changelog](https://modelcontextprotocol.io/specification/2025-11-25/changelog), [Architecture](https://modelcontextprotocol.io/specification/2025-11-25/architecture). Full index: [spec-2025-11-25-index.md](spec-2025-11-25-index.md).

## Lifecycle, transports, authorization (2025-11-25)

- **Lifecycle**: [basic/lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle) — initialize, negotiate capabilities, discovery, execution.
- **Transports**: [basic/transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) — Stdio, Streamable HTTP, etc.
- **Authorization**: [basic/authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) — auth for HTTP and other transports.

## Server utilities (2025-11-25)

Servers may offer additional capabilities beyond tools, resources, and prompts:

- **Completion**: [server/utilities/completion](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/completion) — autocompletion for prompt/resource arguments.
- **Logging**: [server/utilities/logging](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/logging) — protocol logging capability and `notifications/message`.
- **Pagination**: [server/utilities/pagination](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/pagination) — cursor-based pagination for list operations.

## Basic and client (optional reference)

- **Basic utilities**: Cancellation, ping, progress, tasks — see [spec-2025-11-25-index.md](spec-2025-11-25-index.md) (Basic utilities).
- **Client features**: Roots, sampling, elicitation — see [spec-2025-11-25-index.md](spec-2025-11-25-index.md) (Client features).

## Official links (2025-11-25 and docs)

- [Spec index (2025-11-25)](spec-2025-11-25-index.md) — in-skill index of all spec sections.
- [Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)
- [What is MCP?](https://modelcontextprotocol.io/docs/getting-started/intro)
- [Architecture overview (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25/architecture)
- [Understanding MCP servers](https://modelcontextprotocol.io/docs/learn/server-concepts) (tools, resources, prompts)
- [Understanding MCP clients](https://modelcontextprotocol.io/docs/learn/client-concepts)
- [Build an MCP server (TypeScript)](https://modelcontextprotocol.io/docs/develop/build-server#typescript)
- [Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers)
- [Connect to remote MCP servers](https://modelcontextprotocol.io/docs/develop/connect-remote-servers)
- [Authorization (OAuth)](https://modelcontextprotocol.io/docs/tutorials/security/authorization) (for HTTP servers)

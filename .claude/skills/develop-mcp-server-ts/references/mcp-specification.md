# MCP specification summary

Short reference for the Model Context Protocol (MCP) concepts used when building servers. For full details, use the official docs and specification.

## Participants

- **MCP Host**: The AI application (e.g. Claude Desktop, VS Code) that coordinates clients.
- **MCP Client**: Maintains a connection to one MCP server; obtains context for the host.
- **MCP Server**: Program that provides context to clients (tools, resources, prompts).

## Primitives (server → client)

Servers can expose three core primitives:

| Primitive     | Purpose                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Tools**     | Functions the LLM can call (e.g. run a query, send a message). Protocol: `tools/list`, `tools/call`.                          |
| **Resources** | Read-only data (e.g. file contents, API responses). Protocol: `resources/list`, `resources/templates/list`, `resources/read`. |
| **Prompts**   | Reusable interaction templates. Protocol: `prompts/list`, `prompts/get`.                                                      |

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
- Protocol version is a date string (e.g. `2025-11-25`). Version negotiation happens during initialization.
- Specification: [modelcontextprotocol.io/specification](https://modelcontextprotocol.io/specification/versioning).

## Official links

- [What is MCP?](https://modelcontextprotocol.io/docs/getting-started/intro)
- [Architecture overview](https://modelcontextprotocol.io/docs/learn/architecture)
- [Understanding MCP servers](https://modelcontextprotocol.io/docs/learn/server-concepts) (tools, resources, prompts)
- [Understanding MCP clients](https://modelcontextprotocol.io/docs/learn/client-concepts)
- [Build an MCP server (TypeScript)](https://modelcontextprotocol.io/docs/develop/build-server#typescript)
- [Connect to local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers)
- [Connect to remote MCP servers](https://modelcontextprotocol.io/docs/develop/connect-remote-servers)
- [Authorization (OAuth)](https://modelcontextprotocol.io/docs/tutorials/security/authorization) (for HTTP servers)

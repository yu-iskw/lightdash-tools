# Creating a Custom Persona Package (OSS)

You can create an MCP persona package by composing the exported tool-registration functions from `@lightdash-tools/mcp`.

## Minimal example

This example creates a small read-oriented “finance viewer” persona that registers a subset of tools.

```ts
import {
  createLightdashMcpServer,
  createMcpContextProvider,
  runPersonaStdioBin,
} from '@lightdash-tools/mcp';
import {
  registerSearchContentTool,
  registerListProjectsTool,
  registerGetProjectTool,
  registerListChartsTool,
  registerListDashboardsTool,
} from '@lightdash-tools/mcp/tools';

export function createFinanceViewerServer(options?: { contextProvider?: McpContextProvider }) {
  const server = createLightdashMcpServer({
    name: 'acme-lightdash-finance-viewer',
    version: '1.0.0',
  });

  const contextProvider = options?.contextProvider ?? createMcpContextProvider();

  registerSearchContentTool(server, contextProvider);
  registerListProjectsTool(server, contextProvider);
  registerGetProjectTool(server, contextProvider);
  registerListChartsTool(server, contextProvider);
  registerListDashboardsTool(server, contextProvider);
  // ... register only the tools you want exposed ...

  return server;
}

runPersonaStdioBin('acme-lightdash-finance-viewer', (contextProvider) =>
  createFinanceViewerServer({ contextProvider }),
);
```

## Checklist

1. **Register only the tools you need.** If you don’t register a tool, it won’t appear in `tools/list`.
2. **Always inherit guardrails** by using tool registration functions (which route through `registerToolSafe`).
3. **Set runtime guardrails** with environment variables:
   - `LIGHTDASH_TOOLS_SAFETY_MODE`
   - `LIGHTDASH_TOOLS_ALLOWED_PROJECTS`
   - `LIGHTDASH_TOOLS_DRY_RUN` (recommended for write-capable personas)
   - `LIGHTDASH_TOOLS_AUDIT_LOG`
4. **Test your tool surface.** Use the provided conformance helper:

   ```ts
   import { listRegisteredToolNamesForTest } from '@lightdash-tools/mcp/testing';
   import { createFinanceViewerServer } from '../src/index.js';

   const toolNames = await listRegisteredToolNamesForTest(createFinanceViewerServer());
   // snapshot or assert exact tool list
   ```

## Security caveat

Persona packages narrow MCP tool exposure, but they do not change the underlying Lightdash PAT scopes.

---
name: gen-mcp-tool
description: >
  Scaffold a new Lightdash MCP tool module following the project's established patterns.
  Use when adding a new domain tool file to packages/mcp/src/tools/ and wiring it into
  profile mounts. Provide the resource name (e.g. "validations", "ai-agents")
  and the desired operations (read-only list/get vs. write upsert/delete).
---

# Generate MCP Tool

## Purpose

Create a new `packages/mcp/src/tools/<domain>/<resource>.ts` with `register*` handlers and
`defineTool` exports, then append those ToolModules to the relevant profile `tools` arrays
([ADR-0022](../../../docs/adr/0022-mcp-profile-owned-toolmodules-replace-operations-catalog.md)).

## Key Conventions

| Concern            | Pattern                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| Tool name          | `lightdash_<resource>_<action>` (prefix added automatically by `TOOL_PREFIX`) |
| Read-only tools    | `annotations: READ_ONLY_DEFAULT`                                              |
| Idempotent writes  | `annotations: WRITE_IDEMPOTENT`                                               |
| Destructive writes | `annotations: WRITE_DESTRUCTIVE` (reversible only; see ADR-0004)              |
| Irrecoverable ops  | **Do not add** — add the short id to `IRRECOVERABLE_TOOL_DENYLIST` in common  |
| Error handling     | Handled by `wrapTool` — no try/catch in the handler body                      |
| Client access      | `c.v1.<resource>.*` or `c.v2.<resource>.*` from `@lightdash-tools/client`     |
| Output format      | `{ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }`      |

## Workflow

1. **Identify the client API**
   Browse `packages/client/src/api/v1/` and `packages/client/src/api/v2/` to find the
   relevant client class and its methods. Note the method signatures and return types.

2. **Create the tool file**
   Create `packages/mcp/src/tools/<domain>/<resource>.ts` using the template below.
   - Use `READ_ONLY_DEFAULT` for list/get operations.
   - Use `WRITE_IDEMPOTENT` for create/upsert operations.
   - Use `WRITE_DESTRUCTIVE` only for **reversible** delete/revoke operations (ADR-0004).
   - For irrecoverable deletes, do not add an MCP tool; extend `IRRECOVERABLE_TOOL_DENYLIST`.

3. **Export ToolModules and mount on profiles**
   - At the bottom of the handler file: `export const listFooTool = defineTool('list_foo', registerListFoo);`
   - Import that export into `packages/mcp/src/profiles/<id>/v1/index.ts` and append to `tools`.

4. **Build and test**
   Run `pnpm build && pnpm test` to verify the scaffold compiles and the guardrail
   suite still passes.

## File Template

```typescript
/**
 * MCP tools: <resource> (<list of operations>).
 */

import { z } from 'zod';

import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT } from '../shared.js';
import { defineTool } from '../types.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerListResource(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'list_<resource>',
    {
      title: 'List <resource>',
      description: 'List <resource> in a project',
      inputSchema: { projectUuid: z.string().describe('Project UUID') },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(contextProvider, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const result = await c.v1.<resource>.list<Resource>(projectUuid);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }),
  );
}

export const listResourceTool = defineTool('list_<resource>', registerListResource);
```

## Checklist Before Finishing

- [ ] Tool names follow `<resource>_<action>` (short name; prefix is added automatically)
- [ ] All inputs have explicit Zod types with `.describe()` strings
- [ ] Annotation preset matches the operation type (read / idempotent write / destructive write)
- [ ] Irrecoverable operations are not exposed; denylist updated if needed (ADR-0004)
- [ ] `wrapTool` is used — no bare try/catch in handler bodies
- [ ] `defineTool` export added and mounted on the profile `tools` array
- [ ] `pnpm build && pnpm test` passes

## Resources

- [shared.ts](../../../../packages/mcp/src/tools/shared.ts): `registerToolSafe`, `wrapTool`, annotation presets <!-- markdown-link-check-disable-line -->
- [types.ts](../../../../packages/mcp/src/tools/types.ts): `defineTool` / `ToolModule` <!-- markdown-link-check-disable-line -->
- [CONTRIBUTING.md](../../../../packages/mcp/CONTRIBUTING.md): Extension points <!-- markdown-link-check-disable-line -->
- [pnpm Commands](../common-references/pnpm-commands.md): Build and test commands

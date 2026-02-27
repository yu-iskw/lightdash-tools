---
name: gen-mcp-tool
description: >
  Scaffold a new Lightdash MCP tool module following the project's established patterns.
  Use when adding a new domain tool file to packages/mcp/src/tools/ and wiring it into
  the registration barrel. Provide the resource name (e.g. "validations", "ai-agents")
  and the desired operations (read-only list/get vs. write upsert/delete).
---

# Generate MCP Tool

## Purpose

Create a new `packages/mcp/src/tools/<resource>.ts` and register it in
`packages/mcp/src/tools/index.ts`, following the project's guardrail patterns
(`registerToolSafe`, `wrapTool`, Zod schemas, annotation presets).

## Key Conventions

| Concern            | Pattern                                                                   |
| ------------------ | ------------------------------------------------------------------------- |
| Tool name          | `ldt__<resource>_<action>` (prefix added automatically by `TOOL_PREFIX`)  |
| Read-only tools    | `annotations: READ_ONLY_DEFAULT`                                          |
| Idempotent writes  | `annotations: WRITE_IDEMPOTENT`                                           |
| Destructive writes | `annotations: WRITE_DESTRUCTIVE`                                          |
| Error handling     | Handled by `wrapTool` — no try/catch in the handler body                  |
| Client access      | `c.v1.<resource>.*` or `c.v2.<resource>.*` from `@lightdash-tools/client` |
| Output format      | `{ content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }`  |

## Workflow

1. **Identify the client API**
   Browse `packages/client/src/api/v1/` and `packages/client/src/api/v2/` to find the
   relevant client class and its methods. Note the method signatures and return types.

2. **Create the tool file**
   Create `packages/mcp/src/tools/<resource>.ts` using the template below.
   - Use `READ_ONLY_DEFAULT` for list/get operations.
   - Use `WRITE_IDEMPOTENT` for create/upsert operations.
   - Use `WRITE_DESTRUCTIVE` for delete/reset operations.

3. **Register in the barrel**
   In `packages/mcp/src/tools/index.ts`:
   - Add the import: `import { register<Resource>Tools } from './<resource>.js';`
   - Add the call inside `registerTools()`: `register<Resource>Tools(server, client);`

4. **Build and test**
   Run `pnpm build && pnpm test` to verify the scaffold compiles and the guardrail
   suite still passes.

## File Template

```typescript
/**
 * MCP tools: <resource> (<list of operations>).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LightdashClient } from '@lightdash-tools/client';
import { z } from 'zod';
import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT } from './shared.js';
// Import WRITE_IDEMPOTENT and/or WRITE_DESTRUCTIVE if this file has write tools.

export function register<Resource>Tools(server: McpServer, client: LightdashClient): void {
  // ── Read-only example ────────────────────────────────────────────────────
  registerToolSafe(
    server,
    'list_<resource>',
    {
      title: 'List <resource>',
      description: 'List <resource> in a project',
      inputSchema: { projectUuid: z.string().describe('Project UUID') },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const result = await c.v1.<resource>.list<Resource>(projectUuid);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }),
  );

  // ── Write example (idempotent) ────────────────────────────────────────────
  // registerToolSafe(
  //   server,
  //   'upsert_<resource>',
  //   {
  //     title: 'Upsert <resource>',
  //     description: 'Create or update a <resource>',
  //     inputSchema: {
  //       projectUuid: z.string().describe('Project UUID'),
  //       payload: z.record(z.string(), z.unknown()).describe('<Resource> payload'),
  //     },
  //     annotations: WRITE_IDEMPOTENT,
  //   },
  //   wrapTool(
  //     client,
  //     (c) =>
  //       async ({ projectUuid, payload }: { projectUuid: string; payload: Record<string, unknown> }) => {
  //         type UpsertBody = Parameters<LightdashClient['v1']['<resource>']['upsert<Resource>']>[1];
  //         const result = await c.v1.<resource>.upsert<Resource>(projectUuid, payload as UpsertBody);
  //         return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  //       },
  //   ),
  // );
}
```

## Checklist Before Finishing

- [ ] Tool names follow `<resource>_<action>` (short name; prefix is added automatically)
- [ ] All inputs have explicit Zod types with `.describe()` strings
- [ ] Annotation preset matches the operation type (read / idempotent write / destructive write)
- [ ] `wrapTool` is used — no bare try/catch in handler bodies
- [ ] `register<Resource>Tools` is imported and called in `tools/index.ts`
- [ ] `pnpm build && pnpm test` passes

## Resources

- [shared.ts](../../../../packages/mcp/src/tools/shared.ts): `registerToolSafe`, `wrapTool`, annotation presets <!-- markdown-link-check-disable-line -->
- [index.ts](../../../../packages/mcp/src/tools/index.ts): Registration barrel to update <!-- markdown-link-check-disable-line -->
- [dashboards.ts](../../../../packages/mcp/src/tools/dashboards.ts): Minimal read-only example <!-- markdown-link-check-disable-line -->
- [charts.ts](../../../../packages/mcp/src/tools/charts.ts): Mixed read + write example <!-- markdown-link-check-disable-line -->
- [pnpm Commands](../common-references/pnpm-commands.md): Build and test commands

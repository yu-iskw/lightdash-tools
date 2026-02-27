# 31. Agent security guardrails: project allowlist, dry-run mode, and audit logging

Date: 2026-02-21

## Status

Accepted

## Context

ADR-0029 introduced hierarchical safety modes (`read-only`, `write-idempotent`, `write-destructive`) as a first layer of protection for AI-agent operations. Those modes restrict the _type_ of operation (read vs. write vs. destructive) but leave three gaps:

1. **Scope**: An agent with `write-idempotent` access can still read or write to _any_ project in the organisation, including production systems. There is no way to confine it to a specific project or set of projects.
2. **Simulation**: There is no safe way to verify what an agent _would_ do before allowing it to act. Operators cannot run a dry-run against production data.
3. **Observability**: There is no record of what tools were called, with which arguments, and whether they succeeded. Post-incident forensics are therefore impossible.

These gaps are especially important when:

- Multiple projects exist with different sensitivity levels (dev vs. staging vs. prod).
- AI agents are given write access for automation workflows and operators want an audit trail.
- Operators want to test a new agent configuration without any risk.

## Decision

We introduce three additional guardrail layers that compose on top of ADR-0029's safety modes. All three are implemented in the shared `registerToolSafe` function in `packages/mcp/src/tools/shared.ts` and in `wrapAction` in `packages/cli/src/utils/safety.ts`.

### 1. Project UUID allowlist

Restricts tool and command execution to a configured set of project UUIDs.

**Configuration (CLI flag takes strict priority over env var):**

| Source      | MCP                                            | CLI                                            |
| ----------- | ---------------------------------------------- | ---------------------------------------------- |
| CLI flag    | `--projects uuid1,uuid2`                       | `--projects uuid1,uuid2`                       |
| Environment | `LIGHTDASH_TOOLS_ALLOWED_PROJECTS=uuid1,uuid2` | `LIGHTDASH_TOOLS_ALLOWED_PROJECTS=uuid1,uuid2` |

- Empty allowlist (default) = all projects are allowed.
- CLI flag (`--projects`) always overrides the env var to prevent bypass via environment injection.

**Enforcement:**

The allowlist check extracts project UUIDs from both arg shapes a tool may use:

- `projectUuid: string` — the singular form used by most tools.
- `projectUuids: string[]` — the plural form used by tools like `search_content` that accept a list of projects. This prevents the allowlist from being bypassed by a tool that uses the array form.

If _any_ supplied UUID is not in the allowlist, the call is rejected before the API is reached and the response is marked `blocked`.

**Known limitation:** Tools with an _optional_ `projectUuids[]` argument (e.g., `search_content`) can still query all projects when that argument is omitted entirely. In this case the allowlist cannot determine the target project(s) at call time and the call proceeds. Operators requiring strict cross-project isolation should use `read-only` safety mode in conjunction with the allowlist.

### 2. Dry-run mode

Simulates write operations without executing any API call.

**Configuration:**

| Source      | Value                                      |
| ----------- | ------------------------------------------ |
| CLI flag    | `--dry-run`                                |
| Environment | `LIGHTDASH_DRY_RUN=true` (also `1`, `yes`) |

- Read-only tools are unaffected; they execute normally.
- Any tool with `readOnlyHint: false` returns a description of what would have been sent instead of calling the API. The MCP tool description is prefixed with `[DRY-RUN]` so the AI agent can see the restriction.
- Dry-run takes effect only when the tool is otherwise permitted by the safety mode. A tool already blocked by `read-only` mode is not additionally dry-run wrapped.

### 3. Structured audit log

Records every tool/command invocation as a single NDJSON line.

**Configuration:**

| Source      | Value                                       |
| ----------- | ------------------------------------------- |
| Environment | `LIGHTDASH_AUDIT_LOG=/path/to/audit.ndjson` |
| Default     | stderr with `[audit]` prefix                |

**Entry schema:**

```json
{
  "timestamp": "2026-02-21T12:00:00.000Z",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "tool": "lightdash_tools__upsert_chart_as_code",
  "projectUuids": ["abc-123"],
  "status": "success",
  "durationMs": 142
}
```

- `sessionId` is a UUID generated once per process lifetime; it correlates all entries from a single MCP or CLI invocation.
- `status` is one of `success`, `error`, or `blocked`. Guardrail-blocked calls (safety mode, dry-run, allowlist denial) are always `blocked` — the API is never reached.
- `tool` is the full MCP tool name (with `lightdash_tools__` prefix) for MCP, or the full command path (e.g. `lightdash-ai charts list`) for CLI.
- `projectUuids` is present only when the args contain a `projectUuid` or `projectUuids` field.

**Placement:** The canonical implementation lives in `packages/common/src/audit.ts` so both `packages/mcp` and `packages/cli` share the same logger without duplication. `packages/mcp/src/audit.ts` is a thin re-export.

**Initialisation:** Both MCP (`index.ts`, `http.ts`) and CLI (`index.ts`) call `initAuditLog()` at process startup, before any tool or command is registered.

### Guardrail execution order

All four guardrail layers (including safety modes from ADR-0029) are applied in `registerToolSafe` in the following order, from innermost to outermost:

```
[audit log wrapper]          ← outermost, always runs, logs final outcome
  [project allowlist wrapper]  ← runtime check per call
    [dry-run wrapper]          ← registration-time, wraps all write tools
      [safety-mode wrapper]    ← registration-time, wraps disallowed tools
        [raw handler]          ← actual tool implementation
```

The audit wrapper is outermost so it captures the true outcome of every call, including those blocked by inner layers.

### Internal blocking marker

Guardrail layers communicate blocked status to the audit wrapper via an internal `_lightdashBlocked: true` marker on the response object. This marker is stripped before the response is returned to the MCP client or CLI output.

## Consequences

- Operators can safely expose the MCP server or CLI to AI agents in environments with mixed-sensitivity projects by setting `LIGHTDASH_TOOLS_ALLOWED_PROJECTS`.
- Dry-run mode enables safe pre-flight verification of agent behaviour in production-like environments.
- Every MCP tool call and CLI command execution is traceable via the audit log, enabling post-incident forensics.
- All new guardrails are additive and do not affect existing deployments that do not configure them (empty allowlist = all projects allowed; dry-run off by default; audit log writes to stderr by default with no file rotation needed).
- The `common` package now depends on Node.js built-in modules (`node:fs`, `node:crypto`) for the audit logger. This is acceptable since all consumers (`mcp`, `cli`) are Node.js processes.

# Agent Tool Exposure Guidance

Persona-specific MCP packages reduce the agent-facing tool surface by controlling what the MCP server registers.

They do **not** reduce Lightdash backend permissions. If the underlying PAT (for example, an organization admin PAT) can perform destructive actions, the agent-facing MCP tools can still be dangerous if you expose them.

## Layered defenses (recommended)

1. **Curate the tool surface (package boundary).**
   Register only the tools required for the persona. Unregistered tools do not appear in `tools/list`.

2. **Enforce runtime safety modes.**
   Use `LIGHTDASH_TOOLS_SAFETY_MODE`:
   - `read-only`
   - `write-idempotent`
   - `write-destructive`

3. **Restrict scope with project allowlists.**
   Use `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` to prevent cross-project operations.

4. **Enable dry-run for write-capable personas (until validated).**
   Use `LIGHTDASH_TOOLS_DRY_RUN=1` to simulate write operations.

5. **Enable audit logging.**
   Use `LIGHTDASH_TOOLS_AUDIT_LOG` to capture NDJSON tool invocation outcomes.

6. **Review custom packages before enabling them.**
   OSS custom persona packages can register whatever tools the author chooses.

## Operational checklist

Before enabling a persona package for autonomous agent use:

- Confirm the package’s exposed tool surface (unit conformance tests).
- Confirm no destructive tools are exposed unless you have explicit process for approvals.
- Set `LIGHTDASH_TOOLS_SAFETY_MODE` and a project allowlist.
- Keep audit logging on during rollout.

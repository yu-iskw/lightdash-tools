# MCP client compatibility matrix

Real-client qualification is **mandatory before release**. Automated Vitest suites cover protocol handshake and transport wiring (stdio process smoke, in-memory `tools/list`); they do **not** exercise full IDE OAuth UX (browser redirects, token refresh, Cursor/Claude Code session binding).

Fill in **Client version**, **stdio**, **HTTP**, and **OAuth** after manual smoke checks. Use `Pass` / `Fail` / `Pending` / `N/A` / `Blocked`.

| Date       | Server version      | SDK   | Client      | Client version |   stdio |    HTTP |   OAuth | Notes                                                                                |
| ---------- | ------------------- | ----- | ----------- | -------------- | ------: | ------: | ------: | ------------------------------------------------------------------------------------ |
| 2026-07-29 | 0.6.0 (pre-release) | 2.0.0 | Claude Code | 2.1.220        | Pending |    Pass | Pending | HTTP `none` + `shared-key` via `claude mcp add --transport http`; health ✔ Connected |
| 2026-07-29 | 0.6.0 (pre-release) | 2.0.0 | Cursor CLI  | N/A            | Blocked | Blocked | Blocked | `cursor-agent`/`agent` not installable in this egress-restricted cloud environment   |

## Qualification evidence (2026-07-29)

### Claude Code CLI ↔ Streamable HTTP — Pass

Environment: Node 22 / built `packages/mcp/dist/http.js`, Claude Code `2.1.220`.

| Auth mode    | Command                                                                                                               | Result      |
| ------------ | --------------------------------------------------------------------------------------------------------------------- | ----------- |
| `shared-key` | `claude mcp add --transport http --header "Authorization: Bearer …" -s user lightdash-http http://127.0.0.1:3100/mcp` | ✔ Connected |
| `none`       | `claude mcp add --transport http -s user lightdash-http-none http://127.0.0.1:3101/mcp`                               | ✔ Connected |

Complementary protocol smoke against the same server (not via Claude UI): `initialize` → `tools/list` returned **59** tools including `ldt__list_projects` over Streamable HTTP with session header.

Not verified in this run: OAuth (`lightdash-oauth`), interactive tool call through Claude chat (requires Anthropic auth + real Lightdash credentials).

### Cursor CLI ↔ Streamable HTTP — Blocked (environment)

Could not install or run Cursor CLI (`cursor-agent` / `agent`) here:

- `docs.cursor.com` / `cursor.com` install endpoints are outside the cloud-agent egress allowlist
- No published npm package for the official Cursor agent CLI
- No `cursor-agent` binary present in the VM image

**Expected Cursor config when the CLI/IDE is available** (prefer `type: "http"` for CLI; avoid `streamable-http` — known silent drop in `cursor-agent mcp list`):

```json
{
  "mcpServers": {
    "lightdash": {
      "type": "http",
      "url": "http://127.0.0.1:3100/mcp",
      "headers": {
        "Authorization": "Bearer <LIGHTDASH_TOOLS_MCP_SHARED_KEY>"
      }
    }
  }
}
```

Then: `cursor-agent mcp list` / `cursor-agent mcp list-tools lightdash` (or IDE MCP panel). For OAuth, see [cursor-lightdash-oauth-mcp.md](../cursor-lightdash-oauth-mcp.md).

## How to run smoke checks

1. Build the MCP package: `pnpm --filter @lightdash-tools/mcp build`
2. Start HTTP (example shared-key):

   ```bash
   export LIGHTDASH_URL=https://app.lightdash.cloud
   export LIGHTDASH_API_KEY=…                 # required for none/shared-key
   export LIGHTDASH_TOOLS_MCP_AUTH_MODE=shared-key
   export LIGHTDASH_TOOLS_MCP_SHARED_KEY=…
   export LIGHTDASH_TOOLS_MCP_HTTP_PORT=3100
   node packages/mcp/dist/http.js
   ```

3. Claude Code:

   ```bash
   claude mcp add --transport http \
     --header "Authorization: Bearer ${LIGHTDASH_TOOLS_MCP_SHARED_KEY}" \
     -s user lightdash-http http://127.0.0.1:3100/mcp
   claude mcp list
   claude mcp get lightdash-http
   ```

4. For stdio configs see [RFC-0041 appendices](../rfc/0041-compatibility-first-mcp-sdk-v2-migration.md). Prefer env injection from the host; do not commit secrets.

### Semantic-layer MCP (stdio + HTTP OAuth)

`@lightdash-tools/semantic-layer-mcp` is **stdio-first** for local PAT wiring and supports **Streamable HTTP** with `lightdash-oauth` for Cloud Run. Same ADR-0041 transports as monolith MCP. Automated coverage: `stdio.process.test.ts`, `lightdash-oauth-middleware.test.ts`. OAuth client credentials stay on Cursor/Claude — not on the server.

```bash
pnpm --filter @lightdash-tools/semantic-layer-mcp build
# Stdio: node …/dist/bin.js stdio  (+ LIGHTDASH_URL + LIGHTDASH_API_KEY)
# HTTP:  node …/dist/bin.js serve-http  (+ PUBLIC_URL + EXPERIMENTAL_IDENTITY_OAUTH in prod)
```

Package README documents Cursor/Claude snippets and Cloud Run differences (no safety-mode; optional project allowlist).

### Streamable HTTP / OAuth

For remote HTTP and experimental `lightdash-oauth`, follow [mcp-oauth-http.md](../mcp-oauth-http.md) and [cursor-lightdash-oauth-mcp.md](../cursor-lightdash-oauth-mcp.md). Record OAuth column results separately from plain HTTP `none` / `shared-key`.

## Related

- [RFC-0041](../rfc/0041-compatibility-first-mcp-sdk-v2-migration.md)
- [ADR-0041](../adr/0041-compatibility-first-mcp-typescript-sdk-v2-migration.md)

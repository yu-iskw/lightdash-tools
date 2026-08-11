# 25. MCP progressive-disclosure prompt context policies

Date: 2026-08-11

## Status

Accepted

Amends [6. MCP profiles, shared registry, fixed paths](0006-mcp-profiles-shared-registry-fixed-paths.md)

Related to [10](0010-mcp-organization-audit-profile-read-only-boundary.md), [12](0012-mcp-content-reader-profile-saved-content-execution-boundary.md), [14](0014-mcp-content-developer-profile-mutation-boundary.md), [18](0018-mcp-ai-agent-ops-profile-thin-api-boundary.md), [22](0022-mcp-profile-owned-toolmodules-replace-operations-catalog.md)

Design detail: [RFC: Token-Efficient MCP Prompts](../rfc-token-efficient-mcp-prompts.md)

## Context

Profile prompts historically returned `prompts/get` messages that always embedded the full core playbook markdown plus selected topic playbooks (`createPromptPlaybookEmbedder`). Prompt bodies also pasted `*_HARD_BANS` strings that duplicated `core.md`. That is protocol-valid and host-portable, but it forces every invocation to pay for cold-path and conditionally relevant text. Peak cost was content-developer `create_dashboard` (~44KB embedded playbooks).

MCP treats prompts as user-controlled templates and resources as application-controlled data. Mentioning a resource URI in prompt text does **not** guarantee hosts will `resources/read`. Pure URI-only prompts therefore fail closed for many clients. Client-name sniffing (`clientInfo.name`) is unstable across proxies and forks.

SDK `@modelcontextprotocol/server@2.0.0` already supports resource `annotations` and `cacheHint` for static playbooks.

### Alternatives considered

- **Only shorten markdown:** low risk, does not change eager-load architecture.
- **URI-only default:** maximum token cut, unacceptable host dependency.
- **Atomic fragment router:** better asymptotic efficiency, higher coupling and selection complexity.
- **Coarse workflow mega-tools:** high reliability, violates profile ToolModule composability ([ADR-0022](0022-mcp-profile-owned-toolmodules-replace-operations-catalog.md) / [ADR-0010](0010-mcp-organization-audit-profile-read-only-boundary.md) host orchestration).

## Decision

1. **Compose prompts in layers:** task capsule + structured invariant capsule + playbook manifest; detailed playbooks remain MCP resources.
2. **Explicit policies** via `LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT` and CLI `--prompt-context`:
   - `compact` (package **default**): text only (task + invariants + manifest); no embedded playbook bodies
   - `compatible`: also embed `requiredTopics`
   - `embedded`: restore legacy eager core + required topic embedding (rollback / debug)
3. Precedence: CLI > env > default. Invalid values **fail closed** at startup. **No** client-name branching.
4. **Invariants are typed SSOT** per profile (`invariants.ts`); `*_HARD_BANS` are projections. Prompts must not manually paste ban blocks.
5. **Static playbooks** register with `annotations.audience=['assistant']`, priority hints, and `cacheHint: { cacheScope: 'public', ttlMs: long }`.
6. **Server errors** may additively include `recovery` + `playbookUri` (e.g. `PREVIEW_STALE`) without removing `code`/`message`.
7. **Acceptance gates are deterministic** (unit, budget, protocol assertions). Live LLM evals are out of band.
8. Profile ownership of prompts/resources/tools is unchanged ([ADR-0006](0006-mcp-profiles-shared-registry-fixed-paths.md) / [ADR-0022](0022-mcp-profile-owned-toolmodules-replace-operations-catalog.md)).

## Consequences

- Typical `prompts/get` context shrinks sharply under `compact` (measured ≥40% vs `embedded` on fixture scenarios).
- Hosts that never read resources still receive critical invariants eagerly; full SOPs require `resources/read` or `compatible`/`embedded`.
- Operators can roll back with `LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT=embedded` without code changes.
- Maintainers must keep invariant ids stable and budget tests green when growing prompt text.
- Playbook URI stability is preserved; content-developer adds `recovery/*` resources without removing existing topics.

# 36. Enforce deprecated API avoidance in CLI and MCP

Date: 2026-03-09

## Status

Accepted

## Context

Lightdash APIs evolve over time, and some endpoints are deprecated in favor of newer, more efficient ones. While `packages/client` must maintain these deprecated calls for backward compatibility and internal transitions, we want to ensure that our high-level tools (`packages/cli` and `packages/mcp`) always use the latest recommended APIs.

Without automated enforcement, developers might accidentally use deprecated endpoints (e.g., `QueryClient.runQuery` instead of `QueryClientV2.runMetricQuery`) because they're available in the client object. This leads to technical debt and potential breakage when deprecated APIs are removed.

## Decision

We will use TypeScript's native `@deprecated` JSDoc tag combined with ESLint enforcement to prevent deprecated API usage in CLI and MCP packages.

**Implementation:**

1. **Marking Deprecations**: All methods in `packages/client` that call deprecated Lightdash API endpoints (as identified in `packages/common/src/types/generated/openapi-types.ts`) are marked with the `@deprecated` JSDoc tag.

2. **Linting Tool**: We use `@typescript-eslint/no-deprecated` (part of typescript-eslint) to enforce deprecation rules. This rule is enabled as an error for `packages/cli` and `packages/mcp`, but disabled for `packages/client` and test files.

3. **Migration**: Existing deprecated calls in CLI and MCP are migrated to non-deprecated alternatives:
   - `ValidationClient.getValidationResults` → `ValidationClientV2.listValidationResults` or `ValidationClientV2.getValidationResult`
   - `ChartsClient.listCharts` → `ChartsClient.getChartsAsCode`
   - `QueryClient.runQuery` → `QueryClientV2.runMetricQuery` (when applicable)

**Architecture:**

```mermaid
graph TD
    subgraph "packages/common"
        T[OpenAPI Types] -- "@deprecated" --> G[Generated Types]
    end

    subgraph "packages/client"
        C[API Clients] -- Uses --> G
        C -- "@deprecated JSDoc" --> M[Client Methods]
    end

    subgraph "packages/cli"
        CLI[CLI Commands] -- Calls --> M
        ES1[@typescript-eslint/no-deprecated: 'error'] -- Blocks --> CLI
    end

    subgraph "packages/mcp"
        MCP[MCP Tools] -- Calls --> M
        ES2[@typescript-eslint/no-deprecated: 'error'] -- Blocks --> MCP
    end

    style ES1 fill:#f96,stroke:#333,stroke-width:2px
    style ES2 fill:#f96,stroke:#333,stroke-width:2px
```

## Consequences

**Positive:**

- **Immediate Feedback**: Developers see a visual strikethrough in VS Code when using a deprecated method.
- **Strict Enforcement**: CI/CD will fail if a deprecated API is introduced into the CLI or MCP.
- **Granular Control**: We can easily allow legacy calls in the client library itself while keeping consumers clean.
- **Minimal Effort**: Marking a new API as "forbidden" for consumers is as simple as adding a single line of JSDoc.

**Trade-offs:**

- **Migration Required**: Existing deprecated calls must be migrated to modern alternatives, which may require API structure changes (e.g., v1 validation returns single result, v2 returns paginated list).
- **Breaking Changes**: Some migrations change the API surface (e.g., `jobId: string` → `validationId: number`), requiring updates to CLI commands and MCP tools.
- **Maintenance**: When Lightdash deprecates new endpoints, we must audit `packages/client` and mark corresponding methods.

**Mitigations:**

- Deprecated methods remain available in `packages/client` for backward compatibility.
- Migration guides and examples are provided in code comments.
- The v2 validation client (`ValidationClientV2`) provides a clear migration path for validation APIs.

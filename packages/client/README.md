# [@lightdash-tools/client](https://www.npmjs.com/package/@lightdash-tools/client) <!-- markdown-link-check-disable-line -->

HTTP client for the [Lightdash API](https://docs.lightdash.com/api-reference/v1/introduction) with centralized rate limiting, async calls, and TypeScript types generated from the OpenAPI spec.

## Features

- **Rate limiting**: Token bucket (Bottleneck) to avoid hitting API limits
- **Async**: All methods return Promises
- **Type-safe**: Types generated from Lightdash OpenAPI spec
- **Environment variables**: Zero-config in CI using `LIGHTDASH_URL` and `LIGHTDASH_API_KEY`
- **Retries**: Exponential backoff for 5xx and network errors
- **Errors**: Typed `LightdashApiError`, `RateLimitError`, `NetworkError`
- **Shared models**: Domain models available from `@lightdash-tools/common` for cross-package reuse

## Installation

```bash
pnpm add @lightdash-tools/client
```

## Configuration

You can pass options when creating the client or use environment variables (aligned with the [Lightdash CLI](https://docs.lightdash.com/references/lightdash-cli#core-lightdash-configuration)).

| Option                | Env var                         | Description                  |
| --------------------- | ------------------------------- | ---------------------------- |
| `baseUrl`             | `LIGHTDASH_URL`                 | Lightdash server URL         |
| `personalAccessToken` | `LIGHTDASH_API_KEY`             | API key (PAT)                |
| `proxyAuthorization`  | `LIGHTDASH_PROXY_AUTHORIZATION` | Proxy auth header (optional) |

Explicit config overrides environment variables.

## Usage

### With explicit config

```typescript
import { LightdashClient } from '@lightdash-tools/client';

const client = new LightdashClient({
  baseUrl: 'https://app.lightdash.cloud',
  personalAccessToken: 'your-pat-token',
});

const project = await client.v1.projects.getProject('project-uuid');
const org = await client.v1.organizations.getCurrentOrganization();
const dashboards = await client.v1.dashboards.listDashboards('project-uuid');
```

### With environment variables (e.g. CI)

```bash
export LIGHTDASH_URL=https://app.lightdash.cloud
export LIGHTDASH_API_KEY=your-pat-token
```

```typescript
const client = new LightdashClient();
const project = await client.v1.projects.getProject('project-uuid');
```

### Request cancellation (AbortController)

Pass `signal` when calling the low-level HTTP client:

```typescript
const controller = new AbortController();
const http = client.getHttpClient();
const result = await http.get('/projects/p1', { signal: controller.signal });
controller.abort(); // cancels the request
```

### Logging and observability

```typescript
import { LightdashClient, consoleLogger } from '@lightdash-tools/client';

const client = new LightdashClient({
  baseUrl: 'https://app.lightdash.cloud',
  personalAccessToken: 'token',
  logger: consoleLogger,
  observability: {
    onRequestComplete: (info) => {
      console.log(`${info.method} ${info.url} ${info.statusCode} ${info.durationMs}ms`);
    },
  },
});
```

## API areas

### V1 API

- `client.v1.projects` – get project, list projects, list charts
- `client.v1.organizations` – get current organization
- `client.v1.explores` – list explores, get explore
- `client.v1.charts` – list charts, get/upsert charts-as-code
- `client.v1.dashboards` – list dashboards
- `client.v1.spaces` – list/get/create/update/delete spaces; grant/revoke user and group access to spaces
- `client.v1.projectAccess` – list/grant/get/update/revoke project access for users; list/add/remove/update project access for groups (see [Assign or update project access for a list of users](https://docs.lightdash.com/api-reference/v1/recipes))
- `client.v1.query` – run/compile metric queries
- `client.v1.users` – list/get/update/delete organization members
- `client.v1.groups` – list/create/update groups
- `client.v1.aiAgents` – list AI agents (admin), list threads (admin), get/update AI organization settings
- `client.v1.metrics` – list metrics in data catalog
- `client.v1.schedulers` – list/get/create/update/delete scheduled deliveries
- `client.v1.tags` – list/create/update/delete tags
- `client.v1.validation` – list/get/delete validation errors

### V2 API (Experimental)

- `client.v2.content` – search for charts, dashboards, and spaces across projects
- `client.v2.query` – execute async metric/SQL/saved chart queries
- `client.v2.organizationRoles` – list organization roles and their permissions
- `client.v2.projectRoleAssignments` – list/grant/revoke project role assignments for users and groups

Deprecated top-level aliases (`client.projects`, `client.organizations`, etc.) are still available but will be removed in a future major version.

For custom endpoints use `client.getHttpClientV1()` and call `get`, `post`, `put`, `patch`, `delete` with the path (relative to `/api/v1`).

## Package dependency

- Commander.js: <https://www.npmjs.com/package/commander> <!-- markdown-link-check-disable-line -->

This package depends on `@lightdash-tools/common` only (one-way: client → common). Types and API models are consumed from common; see [ADR 0004](../../docs/adr/0004-shared-api-models-in-common-package.md) for the architecture.

## Type Imports

Domain models (Project, Organization, etc.) are available from `@lightdash-tools/common`:

```typescript
import type { Project, Organization } from '@lightdash-tools/common';
```

Advanced types (`paths`, `components`, `operations`) are available from the client package:

```typescript
import type { paths, components, operations } from '@lightdash-tools/client';
```

## Regenerating types

OpenAPI types are generated in the `@lightdash-tools/common` package. To regenerate:

```bash
pnpm --filter @lightdash-tools/common generate:types
```

After regenerating types, rebuild both common and client packages:

```bash
pnpm build --filter @lightdash-tools/common
pnpm build --filter @lightdash-tools/client
```

## License

Apache-2.0

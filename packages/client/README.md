# @lightdash-ai/client

HTTP client for the [Lightdash API](https://docs.lightdash.com/api-reference/v1/introduction) with centralized rate limiting, async calls, and TypeScript types generated from the OpenAPI spec.

## Features

- **Rate limiting**: Token bucket (Bottleneck) to avoid hitting API limits
- **Async**: All methods return Promises
- **Type-safe**: Types generated from Lightdash OpenAPI spec
- **Environment variables**: Zero-config in CI using `LIGHTDASH_URL` and `LIGHTDASH_API_KEY`
- **Retries**: Exponential backoff for 5xx and network errors
- **Errors**: Typed `LightdashApiError`, `RateLimitError`, `NetworkError`
- **Shared models**: Domain models available from `@lightdash-ai/common` for cross-package reuse

## Installation

```bash
pnpm add @lightdash-ai/client
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
import { LightdashClient } from '@lightdash-ai/client';

const client = new LightdashClient({
  baseUrl: 'https://app.lightdash.cloud',
  personalAccessToken: 'your-pat-token',
});

const project = await client.projects.getProject('project-uuid');
const org = await client.organizations.getCurrentOrganization();
const dashboards = await client.dashboards.listDashboards('project-uuid');
```

### With environment variables (e.g. CI)

```bash
export LIGHTDASH_URL=https://app.lightdash.cloud
export LIGHTDASH_API_KEY=your-pat-token
```

```typescript
const client = new LightdashClient();
const project = await client.projects.getProject('project-uuid');
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
import { LightdashClient, consoleLogger } from '@lightdash-ai/client';

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

- `client.projects` – get project, list projects, list charts
- `client.organizations` – get current organization
- `client.charts` – list charts
- `client.dashboards` – list dashboards
- `client.spaces` – list spaces
- `client.query` – run metric queries

For custom endpoints use `client.getHttpClient()` and call `get`, `post`, `put`, `patch`, `delete` with the path (relative to `/api/v1`).

## Type Imports

Domain models (Project, Organization, etc.) are available from `@lightdash-ai/common`:

```typescript
import type { Project, Organization } from '@lightdash-ai/common';
```

Advanced types (`paths`, `components`, `operations`) are available from the client package:

```typescript
import type { paths, components, operations } from '@lightdash-ai/client';
```

## Regenerating types

Types are generated from the Lightdash OpenAPI spec. To regenerate:

```bash
cd packages/client
pnpm run generate:types
```

Note: After regenerating types, rebuild the common package to ensure models remain aligned:

```bash
pnpm build --filter @lightdash-ai/common
```

## License

ISC

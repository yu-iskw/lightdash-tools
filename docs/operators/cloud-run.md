# Cloud Run deployment: Lightdash OAuth MCP

Deploy `@lightdash-tools/mcp` on Google Cloud Run with the OAuth broker. OAuth mental model, limitations, and full env reference: [mcp-oauth.md](mcp-oauth.md).

## Dockerfile

Build from the monorepo root (prefer `packages/mcp/Dockerfile`). Example:

```dockerfile
FROM node:24-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages

RUN corepack enable && pnpm install --frozen-lockfile && pnpm build

ENV NODE_ENV=production
ENV LIGHTDASH_TOOLS_MCP_HTTP_HOST=0.0.0.0
ENV LIGHTDASH_TOOLS_MCP_HTTP_PORT=8080

CMD ["node", "packages/mcp/dist/bin.js", "http"]
```

## Health probes

Unauthenticated HTTP probes (always mounted, including when `LIGHTDASH_TOOLS_MCP_PROFILES` restricts MCP paths). They are not MCP tools and do not require OAuth. Prefer **`GET /health/live`** for Cloud Run [startup and liveness](https://docs.cloud.google.com/run/docs/configuring/healthchecks) — same path Compose uses. Contract: [packages/mcp/README.md](../../packages/mcp/README.md).

| Path            | When to use        | Success                       | Notes                                                                                      |
| :-------------- | :----------------- | :---------------------------- | :----------------------------------------------------------------------------------------- |
| `/health/live`  | startup + liveness | `200` `{ "status": "ok" }`    | Process is listening                                                                       |
| `/health/ready` | optional readiness | `200` `{ "status": "ready" }` | `503` if an API-key client cannot be constructed; hosted OAuth has no key, so ready ≈ live |

```bash
curl -fsS http://127.0.0.1:8080/health/live
```

Example deploy flags (container port `8080`):

```bash
gcloud run deploy lightdash-mcp \
  --image=gcr.io/PROJECT_ID/lightdash-mcp \
  --port=8080 \
  --startup-probe=httpGet.path=/health/live,httpGet.port=8080,periodSeconds=10,timeoutSeconds=1,failureThreshold=3 \
  --liveness-probe=httpGet.path=/health/live,httpGet.port=8080,periodSeconds=10,timeoutSeconds=1,failureThreshold=3
```

Do not treat `/health/ready` as an upstream Lightdash dependency check in hosted OAuth mode.

## Cloud Run environment variables

```bash
LIGHTDASH_URL=https://app.lightdash.cloud
LIGHTDASH_TOOLS_MCP_PUBLIC_URL=https://lightdash-mcp-xxxxx.a.run.app
LIGHTDASH_TOOLS_MCP_HTTP_PORT=8080
LIGHTDASH_TOOLS_OAUTH_CLIENT_ID=...   # from Secret Manager
LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET=...
```

Optional: `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS`, `LIGHTDASH_PROXY_AUTHORIZATION`, `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` (comma-separated project UUID hard allowlist shared with CLI), `LIGHTDASH_TOOLS_MCP_PROFILES` (comma-separated profile ids; unset = all eight HTTP mounts).

**Do not set `LIGHTDASH_TOOLS_AUDIT_LOG` on Cloud Run.** Tool audit entries are written as pure JSON NDJSON on **stderr** and are captured automatically by [Cloud Run logging](https://docs.cloud.google.com/run/docs/logging) into Cloud Logging (`jsonPayload`). A container file path is ephemeral and unsuitable as the primary audit sink. Use `LIGHTDASH_TOOLS_AUDIT_LOG` only for CLI/local file append.

Register in Lightdash:

```text
https://lightdash-mcp-xxxxx.a.run.app/oauth/callback
```

## Audit logs (Cloud Logging)

Each MCP tool call emits one structured line with `"channel":"audit"`, plus `severity`, `message`, `tool`, `status`, `subject` / `tokenHash` (OAuth), `clientSessionId`, `profileId`, and optional `projectUuids`. See [structured logging](https://docs.cloud.google.com/logging/docs/structured-logging).

### Logs Explorer filter

Replace `SERVICE` with your Cloud Run service name:

```text
resource.type="cloud_run_revision"
resource.labels.service_name="SERVICE"
jsonPayload.channel="audit"
```

Example CLI read:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="lightdash-mcp" AND jsonPayload.channel="audit"' \
  --project=PROJECT_ID --limit=20 --format=json
```

### Longer retention (recommended for compliance)

`_Default` log buckets retain **30 days** by default (configurable 1–3650 days on project buckets). For a dedicated audit trail, create a user log bucket and sink — see [Configure log buckets](https://docs.cloud.google.com/logging/docs/buckets) and [Route log entries](https://docs.cloud.google.com/logging/docs/routing/overview).

Example (365-day retention; raise up to 3650 if policy requires):

```bash
gcloud logging buckets create mcp-audit \
  --location=global \
  --retention-days=365 \
  --project=PROJECT_ID

gcloud logging sinks create mcp-audit-sink \
  logging.googleapis.com/projects/PROJECT_ID/locations/global/buckets/mcp-audit \
  --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="lightdash-mcp" AND jsonPayload.channel="audit"' \
  --project=PROJECT_ID
```

Grant the sink writer identity permission on the destination bucket after create (Cloud Logging prints the service account). Restrict who can delete the sink/bucket.

### Governance companions (already in the product)

- Profile URL + catalog membership (capability surface); optional `LIGHTDASH_TOOLS_MCP_PROFILES` mount ceiling
- OAuth identity + Lightdash RBAC
- `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` process ceiling for shared services
- Optional `X-Lightdash-Project` pin
- Sessionless HTTP (ADR-0019): sticky `/oauth/*` or single replica for in-memory OAuth broker pending state (profile MCP paths scale horizontally via `createMcpHandler`)

## Deploy example

```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/lightdash-mcp

gcloud run deploy lightdash-mcp \
  --image gcr.io/PROJECT_ID/lightdash-mcp \
  --port 8080 \
  --set-env-vars "LIGHTDASH_URL=https://app.lightdash.cloud,LIGHTDASH_TOOLS_MCP_HTTP_PORT=8080" \
  --set-env-vars "LIGHTDASH_TOOLS_MCP_PUBLIC_URL=https://lightdash-mcp-xxxxx.a.run.app" \
  --set-secrets "LIGHTDASH_TOOLS_OAUTH_CLIENT_ID=mcp-oauth-client-id:latest,LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET=mcp-oauth-client-secret:latest" \
  --allow-unauthenticated
```

`--allow-unauthenticated` on Cloud Run means Google IAM is open; **MCP still requires OAuth bearer** on profile paths. Use sticky sessions / single instance for `/oauth/*` until broker pending-auth uses signed state or CIMD (profile MCP paths need no sticky sessions).

## Checklist

- [ ] `PUBLIC_URL` matches the HTTPS URL clients use
- [ ] Lightdash redirect URI is `{PUBLIC_URL}/oauth/callback`
- [ ] Client secrets only in Secret Manager
- [ ] Cursor/Claude config is URL-only (`…/semantic-layer/v1/mcp`)
- [ ] `LIGHTDASH_TOOLS_AUDIT_LOG` unset (stderr → Cloud Logging)
- [ ] Audit sink / retention configured if compliance requires >30 days
- [ ] `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` set when the service must not see the whole org
- [ ] `LIGHTDASH_TOOLS_MCP_PROFILES` set when the service must not mount every persona
- [ ] Startup / liveness probe is `GET /health/live` on the container port

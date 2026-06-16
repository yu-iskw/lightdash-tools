# Cloud Run deployment: Lightdash OAuth MCP

Deploy `@lightdash-tools/mcp` on Google Cloud Run with `lightdash-oauth` auth mode. For env var reference and auth modes, see [mcp-oauth-http.md](mcp-oauth-http.md).

## Dockerfile

Build from the monorepo root:

```dockerfile
FROM node:24-slim

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages

RUN corepack enable && pnpm install --frozen-lockfile && pnpm build

ENV NODE_ENV=production
ENV LIGHTDASH_TOOLS_MCP_HTTP_HOST=0.0.0.0
ENV LIGHTDASH_TOOLS_MCP_HTTP_PORT=8080
ENV LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth
ENV LIGHTDASH_TOOLS_SAFETY_MODE=read-only
ENV LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH=1

CMD ["node", "packages/mcp/dist/bin.js", "serve-http"]
```

Cloud Run injects `PORT=8080`; set `LIGHTDASH_TOOLS_MCP_HTTP_PORT=8080` to match.

## Cloud Run environment variables

Set these in the Cloud Run service (Console, `gcloud`, or Secret Manager references):

```bash
LIGHTDASH_URL=https://app.lightdash.cloud
LIGHTDASH_TOOLS_MCP_PUBLIC_URL=https://lightdash-mcp-xxxxx.a.run.app
LIGHTDASH_TOOLS_MCP_HTTP_PORT=8080
LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth
LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH=1
LIGHTDASH_TOOLS_SAFETY_MODE=read-only
LIGHTDASH_TOOLS_ALLOWED_PROJECTS=project_uuid_1,project_uuid_2
```

Optional:

```bash
LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS=https://cursor.com
LIGHTDASH_PROXY_AUTHORIZATION=...
LIGHTDASH_TOOLS_AUDIT_LOG=/tmp/audit.log
```

## Deploy example

```bash
# Build and push (adjust project, region, and registry)
gcloud builds submit --tag gcr.io/PROJECT_ID/lightdash-mcp

gcloud run deploy lightdash-mcp \
  --image gcr.io/PROJECT_ID/lightdash-mcp \
  --port 8080 \
  --set-env-vars "LIGHTDASH_URL=https://app.lightdash.cloud,LIGHTDASH_TOOLS_MCP_AUTH_MODE=lightdash-oauth,LIGHTDASH_TOOLS_MCP_HTTP_PORT=8080,LIGHTDASH_TOOLS_SAFETY_MODE=read-only,LIGHTDASH_TOOLS_MCP_EXPERIMENTAL_IDENTITY_OAUTH=1" \
  --set-env-vars "LIGHTDASH_TOOLS_MCP_PUBLIC_URL=https://lightdash-mcp-xxxxx.a.run.app" \
  --set-env-vars "LIGHTDASH_TOOLS_ALLOWED_PROJECTS=project_uuid_1,project_uuid_2" \
  --allow-unauthenticated
```

`--allow-unauthenticated` on Cloud Run means the Cloud Run IAM layer does not require Google credentials. **MCP endpoint auth is still enforced** by `lightdash-oauth` at the application layer (bearer token required on `/mcp`).

After deploy, set `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` to the service's HTTPS URL (update and redeploy if the URL was unknown at first deploy).

## Operational checklist

| Item                    | Guidance                                                                                                                       |
| :---------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| **`LIGHTDASH_API_KEY`** | Do **not** set for OAuth mode unless you intentionally run a fallback PAT-based mode.                                          |
| **Request logs**        | Do not log `Authorization` headers. Redact bearer tokens in log pipelines.                                                     |
| **Ingress**             | Restrict if your MCP client environment allows (internal load balancer, VPC, Cloud Armor).                                     |
| **Rate limiting**       | Consider Cloud Armor or an API gateway; per-token rate limits are deferred in v1.                                              |
| **Sessions**            | In-memory sessions are per instance. Use min instances = 1 or session affinity if clients rely on long-lived `Mcp-Session-Id`. |
| **Health checks**       | Use `GET /health/live` (liveness) and `GET /health/ready` (readiness).                                                         |
| **Safety mode**         | Keep `read-only` unless write tools are explicitly required.                                                                   |
| **Project allowlist**   | Set `LIGHTDASH_TOOLS_ALLOWED_PROJECTS` to limit blast radius across all OAuth users.                                           |

## Post-deploy verification

```bash
SERVICE_URL="https://lightdash-mcp-xxxxx.a.run.app"

# Liveness
curl -sf "${SERVICE_URL}/health/live"

# Readiness (validates OAuth config; no PAT required)
curl -sf "${SERVICE_URL}/health/ready"

# OAuth metadata
curl -s "${SERVICE_URL}/.well-known/oauth-protected-resource" | jq .

# Unauthenticated MCP should challenge
curl -si -X POST "${SERVICE_URL}/mcp" -H "Content-Type: application/json" -d '{}' | head -20
```

Expect `401` with `WWW-Authenticate` containing `resource_metadata` on the last request.

Configure Cursor per [cursor-lightdash-oauth-mcp.md](cursor-lightdash-oauth-mcp.md) and verify with `ldt__get_authenticated_user`.

## See also

- [mcp-oauth-http.md](mcp-oauth-http.md)
- [cursor-lightdash-oauth-mcp.md](cursor-lightdash-oauth-mcp.md)
- [security/mcp-oauth-threat-model.md](security/mcp-oauth-threat-model.md)
- [secrets-and-credentials.md](secrets-and-credentials.md)

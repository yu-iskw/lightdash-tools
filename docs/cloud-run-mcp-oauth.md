# Cloud Run deployment: Lightdash OAuth MCP

Deploy `@lightdash-tools/mcp` on Google Cloud Run with the OAuth broker (server-held Lightdash confidential client). See [mcp-oauth-http.md](mcp-oauth-http.md).

## Production limitations

Bearer validation confirms **who** the user is (`GET /api/v1/user`). Opaque Lightdash tokens are not fully resource/audience-bound yet. Rely on Lightdash RBAC + persona tool surface + optional `X-Lightdash-Project` pin.

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

CMD ["node", "packages/mcp/dist/bin.js", "serve-http"]
```

## Cloud Run environment variables

```bash
LIGHTDASH_URL=https://app.lightdash.cloud
LIGHTDASH_TOOLS_MCP_PUBLIC_URL=https://lightdash-mcp-xxxxx.a.run.app
LIGHTDASH_TOOLS_MCP_HTTP_PORT=8080
LIGHTDASH_TOOLS_OAUTH_CLIENT_ID=...   # from Secret Manager
LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET=...
```

Optional: `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS`, `LIGHTDASH_TOOLS_AUDIT_LOG`, `LIGHTDASH_PROXY_AUTHORIZATION`.

Register in Lightdash:

```text
https://lightdash-mcp-xxxxx.a.run.app/oauth/callback
```

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

`--allow-unauthenticated` on Cloud Run means Google IAM is open; **MCP still requires OAuth bearer** on persona paths. Use sticky sessions / single instance until broker pending-auth and MCP sessions use an external store.

## Checklist

- [ ] `PUBLIC_URL` matches the HTTPS URL clients use
- [ ] Lightdash redirect URI is `{PUBLIC_URL}/oauth/callback`
- [ ] Client secrets only in Secret Manager
- [ ] Cursor/Claude config is URL-only (`…/semantic-layer/v1/mcp`)

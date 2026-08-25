# Cloud Run deployment: Lightdash OAuth MCP

Deploy `@lightdash-tools/mcp` on Google Cloud Run with the OAuth broker. OAuth mental model, limitations, and full env reference: [mcp-oauth.md](mcp-oauth.md). Control-plane split (edge vs platform vs app): [http-control-plane.md](http-control-plane.md) and [ADR-0032](../adr/0032-mcp-http-three-plane-security-control-ownership.md).

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
LIGHTDASH_TOOLS_MCP_PUBLIC_URL=https://mcp.example.com
# Smoke-only without GCLB: https://lightdash-mcp-xxxxx.a.run.app
LIGHTDASH_TOOLS_MCP_HTTP_PORT=8080
LIGHTDASH_TOOLS_OAUTH_CLIENT_ID=...   # from Secret Manager
LIGHTDASH_TOOLS_OAUTH_CLIENT_SECRET=...
```

Optional: `LIGHTDASH_TOOLS_MCP_ALLOWED_ORIGINS` (browser Origin allowlist — 403 if present and not listed; empty is correct for Cursor/Claude), `LIGHTDASH_PROXY_AUTHORIZATION`, `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` (comma-separated project UUID hard allowlist shared with CLI), `LIGHTDASH_TOOLS_MCP_PROFILES` (comma-separated profile ids; unset = all eight HTTP mounts).

**Do not set `LIGHTDASH_TOOLS_AUDIT_LOG` on Cloud Run.** Tool audit entries are written as pure JSON NDJSON on **stderr** and are captured automatically by [Cloud Run logging](https://docs.cloud.google.com/run/docs/logging) into Cloud Logging (`jsonPayload`). A container file path is ephemeral and unsuitable as the primary audit sink. Use `LIGHTDASH_TOOLS_AUDIT_LOG` only for CLI/local file append.

Register in Lightdash:

```text
https://mcp.example.com/oauth/callback
```

Use the **client-facing HTTPS origin** (`PUBLIC_URL`). A `*.run.app` callback is only for the smoke deploy below.

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
- Sessionless HTTP (ADR-0019): **single replica or a dedicated `/oauth/*` Cloud Run service** for in-memory OAuth broker pending state. GCLB session affinity does not pin Cloud Run instances. Profile MCP paths scale horizontally via `createMcpHandler`.

## Deploy example (smoke / direct Run URL)

Valid for a first bring-up. **Cloud Armor never sees this path** — clients hit `*.run.app` directly. Production public traffic should use [Production edge](#production-edge-gclb--cloud-armor).

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

`--allow-unauthenticated` on Cloud Run means Google IAM is open; **MCP still requires OAuth bearer** on profile paths. Do not put Identity-Aware Proxy in front of Cursor/Claude URL-only clients.

Until signed OAuth state or CIMD: run **one replica** (or a dedicated `/oauth/*` service) for the in-memory broker handshake. Profile MCP paths need no instance affinity after token issuance.

## Production edge (GCLB + Cloud Armor)

Operator recipe only — this repo does not ship Terraform. Follow Google’s [serverless NEG HTTPS load balancer](https://docs.cloud.google.com/load-balancing/docs/https/setup-global-ext-https-serverless) and [Armor + Cloud Run](https://docs.cloud.google.com/armor/docs/integrating-cloud-armor) docs for the full resource set (global IP, SSL cert, URL map, HTTPS proxy, forwarding rule).

After the Cloud Run service exists:

1. Create a serverless NEG and backend service; attach a Cloud Armor policy to that **backend service**.
2. Set Cloud Run ingress so internet clients cannot skip the load balancer.
3. Point `LIGHTDASH_TOOLS_MCP_PUBLIC_URL` (and the Lightdash redirect URI) at the **load-balancer HTTPS origin**.

```bash
# Lock the default URL so Armor cannot be bypassed
# (gcloud flag name: internal-and-cloud-load-balancing)
gcloud run services update lightdash-mcp \
  --ingress=internal-and-cloud-load-balancing \
  --region=REGION

gcloud compute network-endpoint-groups create lightdash-mcp-neg \
  --region=REGION \
  --network-endpoint-type=serverless \
  --cloud-run-service=lightdash-mcp

gcloud compute backend-services create lightdash-mcp-backend \
  --load-balancing-scheme=EXTERNAL_MANAGED \
  --global

gcloud compute backend-services add-backend lightdash-mcp-backend \
  --global \
  --network-endpoint-group=lightdash-mcp-neg \
  --network-endpoint-group-region=REGION

gcloud compute security-policies create lightdash-mcp-armor \
  --description="MCP HTTP: throttle, not OWASP CRS on JSON-RPC bodies"

# Default allow remains; add throttle rules above it.
# Tune counts from your logs. Armor thresholds are approximate — not app quotas.
gcloud compute security-policies rules create 1000 \
  --security-policy=lightdash-mcp-armor \
  --expression="true" \
  --action=throttle \
  --rate-limit-threshold-count=500 \
  --rate-limit-threshold-interval-sec=60 \
  --conform-action=allow \
  --exceed-action=deny-429 \
  --enforce-on-key=IP

gcloud compute security-policies rules create 900 \
  --security-policy=lightdash-mcp-armor \
  --expression="request.path.matches('/oauth/(authorize|register)')" \
  --action=throttle \
  --rate-limit-threshold-count=30 \
  --rate-limit-threshold-interval-sec=60 \
  --conform-action=allow \
  --exceed-action=deny-429 \
  --enforce-on-key=IP

gcloud compute backend-services update lightdash-mcp-backend \
  --global \
  --security-policy=lightdash-mcp-armor
```

Then finish the URL map, Google-managed (or uploaded) SSL certificate, HTTPS target proxy, and global forwarding rule per the serverless NEG guide. Bind the URL map / cert only to the `PUBLIC_URL` hostname — do not publish extra Hosts on that VIP ([ADR-0027](../adr/0027-mcp-oauth-extra-invoke-origins.md)). Optional Adaptive Protection on the backend is fine; **do not** enable stock OWASP CRS (SQLi/XSS) on profile MCP POSTs — tool arguments include SQL and Explore JSON, and Armor inspects at most 64 kB of the body.

Do **not**:

- Serve extra invoke-origin Hostnames on the public VIP (URL-map host rules / cert SAN)
- Set a process `TRUST_EDGE` / `DANGEROUSLY_*` env (rejected)
- Treat GCLB session affinity as OAuth sticky routing to a Cloud Run instance

Keep `--allow-unauthenticated` on the Run service. MCP OAuth still gates profile paths.

## Checklist

- [ ] `PUBLIC_URL` matches the HTTPS URL clients use (load-balancer origin in production, not `*.run.app`)
- [ ] Lightdash redirect URI is `{PUBLIC_URL}/oauth/callback`
- [ ] Production: GCLB + Armor throttle + Cloud Run `internal-and-cloud-load-balancing` ([control plane](http-control-plane.md))
- [ ] Production: no stock OWASP CRS on MCP JSON-RPC POSTs; no IAP in front of URL-only clients
- [ ] Client secrets only in Secret Manager
- [ ] Cursor/Claude config is URL-only (`…/semantic-layer/v1/mcp`)
- [ ] `LIGHTDASH_TOOLS_AUDIT_LOG` unset (stderr → Cloud Logging)
- [ ] Audit sink / retention configured if compliance requires >30 days
- [ ] `LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS` set when the service must not see the whole org
- [ ] `LIGHTDASH_TOOLS_MCP_PROFILES` set when the service must not mount every persona
- [ ] Startup / liveness probe is `GET /health/live` on the container port
- [ ] OAuth handshake: one replica or a dedicated `/oauth/*` service (GCLB affinity does not pin Cloud Run instances)

# syntax=docker/dockerfile:1
# Build from repo root (Docker reads .dockerignore from context root;
# repo root .dockerignore is a symlink to this package's ignore file):
#   docker build -f packages/mcp/Dockerfile \
#     -t lightdash-mcp:local .

FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /src
# Manifests first so dependency install stays cached when only source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/common/package.json packages/common/
COPY packages/client/package.json packages/client/
COPY packages/cli/package.json packages/cli/
COPY packages/mcp/package.json packages/mcp/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @lightdash-tools/mcp... build
# --legacy: monorepo does not use inject-workspace-packages (pnpm v10+ deploy default).
RUN pnpm --filter @lightdash-tools/mcp deploy --prod --legacy /out

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --gid 1001 mcp \
  && useradd --uid 1001 --gid mcp --shell /usr/sbin/nologin --create-home mcp
COPY --from=build --chown=mcp:mcp /out /app
RUN chmod +x /app/dist/bin.js \
  && ln -sf /app/dist/bin.js /usr/local/bin/lightdash-mcp
USER mcp
# No CMD — require explicit args (profile or http), matching CLI. HEALTHCHECK NONE for stdio.
HEALTHCHECK NONE
ENTRYPOINT ["lightdash-mcp"]

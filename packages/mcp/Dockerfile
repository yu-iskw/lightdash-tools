# syntax=docker/dockerfile:1
# Build from repo root (Docker reads .dockerignore from the context root;
# repo-root .dockerignore is a symlink to this package's ignore file):
#   docker build -f packages/mcp/Dockerfile -t lightdash-mcp:local .
#
# Keep NODE_VERSION in lockstep with .node-version. ENTRYPOINT is lightdash-mcp;
# pass `http` (Cloud Run / Compose) or `stdio --profile <id>`.

ARG NODE_VERSION=26.3.0

FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

FROM base AS build
WORKDIR /src
# Manifests first so dependency install stays cached when only source changes.
# Every workspace package.json must be present for --frozen-lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/common/package.json packages/common/
COPY packages/client/package.json packages/client/
COPY packages/cli/package.json packages/cli/
COPY packages/mcp/package.json packages/mcp/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile

COPY packages/common/tsconfig.json packages/common/
COPY packages/common/src packages/common/src
COPY packages/client/tsconfig.json packages/client/
COPY packages/client/src packages/client/src
COPY packages/mcp/tsconfig.json packages/mcp/
COPY packages/mcp/src packages/mcp/src
RUN pnpm --filter @lightdash-tools/mcp... build
# --legacy: monorepo does not use inject-workspace-packages (pnpm v10+ deploy default).
RUN pnpm --filter @lightdash-tools/mcp deploy --prod --legacy /out

FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --gid 1001 mcp \
  && useradd --uid 1001 --gid mcp --shell /usr/sbin/nologin --create-home mcp
COPY --from=build --chown=mcp:mcp /out /app
RUN chmod +x /app/dist/bin.js \
  && ln -sf /app/dist/bin.js /usr/local/bin/lightdash-mcp
USER mcp
# Metadata only (Cloud Run / Compose HTTP). Stdio does not listen.
EXPOSE 8080
# No CMD — require explicit args (profile or http), matching CLI. HEALTHCHECK NONE for stdio.
HEALTHCHECK NONE
ENTRYPOINT ["lightdash-mcp"]

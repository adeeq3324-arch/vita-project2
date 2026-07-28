# syntax=docker/dockerfile:1

# ---------- Stage 1: dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Resilient install: registry tarball fetches can be reset mid-download
# (ECONNRESET) under sustained parallel load. A persistent BuildKit cache mount
# keeps every already-downloaded tarball across build attempts, so a dropped
# connection resumes instead of restarting; capped concurrency plus retry
# backoff smooth over the remaining hiccups.
#
# --ignore-scripts: the only lifecycle scripts in this tree are the esbuild
# binary downloads pulled in transitively by the dev-only tools tsx/drizzle-kit.
# The image never executes esbuild (build = `nest build` via tsc; runtime =
# compiled `node dist/*.js`), and running that postinstall trips ETXTBSY on the
# Docker Desktop virtiofs share, so skipping scripts is both safe and faster.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts \
      --fetch-retries=5 \
      --fetch-retry-mintimeout=20000 \
      --fetch-retry-maxtimeout=120000 \
      --fetch-timeout=600000 \
      --maxsockets=3

# ---------- Stage 2: build ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build \
 && npm prune --omit=dev

# ---------- Stage 3: runtime ----------
FROM node:22-alpine AS runtime

# Build metadata, supplied by CI. Kept as late as possible: these change on
# every commit, and putting them earlier would invalidate the layers below them
# for no reason.
ARG VERSION=0.0.0
ARG REVISION=unknown
ARG BUILD_DATE

LABEL org.opencontainers.image.title="VITAL AI API" \
      org.opencontainers.image.description="VITAL AI backend — NestJS, Supabase, Drizzle, Redis, BullMQ." \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.licenses="UNLICENSED"

ENV NODE_ENV=production \
    # Surfaced on every error report, so an incident can be tied to the exact
    # build that produced it rather than to "whatever was deployed that day".
    SENTRY_RELEASE="${VERSION}"

WORKDIR /app

# `dumb-init` becomes PID 1 so signals reach the application and orphaned
# children are reaped. Without an init, Node runs as PID 1, where the kernel
# applies no default signal handling — a SIGTERM that arrives a moment before
# the app installs its own handlers is simply ignored, and the orchestrator
# waits out its grace period and SIGKILLs instead. That would cut short the
# graceful shutdown that drains queues and closes the database pool.
RUN apk add --no-cache dumb-init=~1.2

# Run as the built-in non-root `node` user.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --chown=node:node package.json ./

USER node
EXPOSE 3000

# Container-level liveness probe against the health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]

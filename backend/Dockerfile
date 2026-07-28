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
ENV NODE_ENV=production
WORKDIR /app

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

CMD ["node", "dist/main.js"]

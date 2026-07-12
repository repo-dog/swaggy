# Single, slim image for Swaggy.
#
# The Fastify server serves BOTH the built web UI (via @fastify/static, with SPA fallback)
# and the /api proxy from one process, so the whole tool ships as one image.
#
# `@swaggy/shared` is consumed as TypeScript source, so we bundle the server with esbuild
# (which inlines that workspace package) and keep the real node dependencies external. The
# runtime image then carries only the server's production deps — no dev deps, no tsx, no
# source — for a much smaller image.

# ---- builder: install, build the web UI, bundle the server, stage prod deps ----
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.30.0 --activate
WORKDIR /app

# Install dependencies first, cached until a manifest or the lockfile changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile

COPY . .

# Build the web UI (static assets → packages/web/dist).
RUN pnpm --filter @swaggy/web build

# Bundle the server into one ESM file, inlining the TS-source @swaggy/shared package and
# leaving node-module deps external (resolved from the prod node_modules at runtime).
RUN pnpm dlx esbuild@0.24.2 packages/server/src/index.ts \
      --bundle --platform=node --format=esm --target=node20 \
      --outfile=packages/server/dist/index.js \
      --external:fastify --external:@fastify/static --external:@fastify/multipart --external:pino \
      --external:undici --external:@apidevtools/swagger-parser --external:zod

# Self-contained production node_modules for just the server's runtime deps.
RUN pnpm --filter @swaggy/server deploy --prod --legacy /prod

# ---- runtime: minimal image with the bundle, prod deps, and web assets ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production PORT=8080
WORKDIR /app

COPY --from=builder /prod/node_modules ./node_modules
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/web/dist ./packages/web/dist
# Ship a runnable demo config + the bundled sample specs so `docker run` works out of the box.
# Point at your own specs by mounting a config over /app/specs.config.json or setting
# SWAGGY_CONFIG=/path/to/config.json (see README).
COPY --from=builder /app/specs.config.example.json ./specs.config.json
COPY --from=builder /app/test-specs ./test-specs

EXPOSE 8080

# Drop root — the copied files are world-readable and the server binds 8080 (>1024).
USER node

# Liveness probe hits the /api/health route (busybox wget ships in the alpine base).
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1

# cwd=/app so the server finds /app/specs.config.json (override by mounting a file over it
# or setting SWAGGY_CONFIG=/path/to/config.json). node resolves fastify/pino/etc. from
# /app/node_modules; the bundle derives the web-dist path from its own location.
CMD ["node", "packages/server/dist/index.js"]

# Development

## Prerequisites

- Node.js 20+ (see `.nvmrc`)
- [pnpm](https://pnpm.io) 10+

## Layout

A pnpm workspace with three packages:

| Package | Responsibility |
| --- | --- |
| `packages/shared` | Zod schemas + inferred types shared by server and web (the API contract). Consumed as TypeScript source. |
| `packages/server` | Fastify service: loads/normalizes specs, serves the built web UI, proxies requests, and exchanges OAuth2 tokens. |
| `packages/web` | React + Vite single-page UI. |

## Getting started

```bash
pnpm install
cp specs.config.example.json specs.config.json   # edit to point at your specs

# Two processes in dev:
pnpm dev                        # server (tsx watch) on http://localhost:8080
pnpm --filter @swaggy/web dev   # Vite dev server on http://localhost:5173, proxies /api → :8080
```

Develop against the Vite URL. The server needs a config on startup (see
[CONFIGURATION.md](CONFIGURATION.md)); a fresh clone has none until you copy the example.

## Scripts

Run from the repo root:

| Command | Does |
| --- | --- |
| `pnpm -r test` | Run every package's Vitest suite. |
| `pnpm -r build` | Type-check and build every package. |
| `pnpm dev` | Start the backend in watch mode. |

Per package, e.g. `pnpm --filter @swaggy/web test`.

## Testing

Tests use [Vitest](https://vitest.dev). The web suite uses Testing Library + jsdom; the server
suite exercises the normalizer, routes, and proxy. There are bundled sample specs in
`test-specs/` (Swagger 2.0, OpenAPI 3.0/3.1, plus edge cases) used by tests and the demo config.

Please keep `pnpm -r test` and `pnpm -r build` green before opening a PR.

## Building the Docker image

```bash
docker build -t swaggy .
docker run --rm -p 8080:8080 swaggy
```

The multi-stage build builds the web UI, bundles the server with esbuild (inlining the
TypeScript `@swaggy/shared` package), stages only production dependencies, and ships a slim
`node:20-alpine` runtime that serves the UI and API from one process.

## OAuth2 note

Redirect-based OAuth2 flows use a popup that returns to `public/oauth-callback.html`, which
posts the result back to the app. Register `<origin>/oauth-callback.html` as an allowed
redirect URI with your identity provider to test those flows end-to-end.

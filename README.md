<p align="center">
  <img src="docs/logo.svg" alt="Swaggy" width="420" />
</p>

<p align="center">
  A web-based <b>API exploration tool</b> driven by your OpenAPI/Swagger specs.
</p>

<p align="center">
  <a href="https://github.com/repo-dog/swaggy/actions/workflows/ci.yml"><img src="https://github.com/repo-dog/swaggy/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/OpenAPI-2.0%20%7C%203.0%20%7C%203.1-6BA539" alt="OpenAPI 2.0 / 3.0 / 3.1" />
</p>

---

Swaggy points at your OpenAPI/Swagger specs (by URL or file) and turns them into a fast UI for **trying real requests** — with the ergonomics of an API client (profiles, variables, history, snapshots) rather than a static docs page. It's built for *interacting with* and *exploring* APIs, not writing test assertions.

## Features

- **Any spec version** — Swagger 2.0, OpenAPI 3.0.x, and 3.1, loaded from a URL or a local file, multiple specs at once.
- **Send real requests** through a built-in proxy; see status, timing, size, headers, and a filterable JSON response tree.
- **Smart request forms** — path/query/header params and request bodies rendered from the schema, with enums, defaults, formats, and required/optional badges. Toggle to an **Advanced JSON editor** with a live **schema reference** (types, enums, defaults, descriptions).
- **Documented responses & a Models browser** — see declared response schemas/examples and browse the spec's component schemas.
- **Authorization, including full OAuth2** — bearer, API key, and basic, plus OAuth2 client-credentials, password, and redirect flows (authorization code with PKCE, and implicit).
- **Profiles** with per-profile **common headers**, **variables + `{{templating}}`** (capture a value from one response, reuse it in the next), **snapshots**, and **history**.
- **Fast navigation** — command palette (⌘K), bookmarks (pinnable), tag grouping, resizable/collapsible sidebars, deep-linkable `?op=` URLs, light/dark themes, and Markdown-rendered descriptions.
- **Ships as one small Docker image** — the server serves the built UI and the proxy from a single process.

## Quick start (Docker)

The image ships with a set of demo specs so you can try it immediately:

```bash
docker run --rm -p 8080:8080 repo-dog/swaggy   # replace with your published image
```

Open http://localhost:8080.

Point it at **your** specs by mounting a config over the default one:

```bash
docker run --rm -p 8080:8080 \
  -v "$(pwd)/specs.config.json:/app/specs.config.json:ro" \
  repo-dog/swaggy
```

See [`specs.config.example.json`](specs.config.example.json) for the format and [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for all options (env vars, file vs URL specs, proxy timeout, refresh interval).

## Run from source

Requires Node 20+ and [pnpm](https://pnpm.io) 10+.

```bash
pnpm install
cp specs.config.example.json specs.config.json   # then edit to point at your specs

pnpm dev                          # backend on http://localhost:8080 (serves /api)
pnpm --filter @swaggy/web dev     # web UI on http://localhost:5173 (proxies /api → :8080)
```

Open the Vite URL for development. For a production-style run, `pnpm -r build` then `pnpm --filter @swaggy/server start` serves the built UI and API from `:8080`.

## Configuration

Swaggy reads a JSON config listing the specs to load. It resolves, in order, `$SWAGGY_CONFIG`, then the nearest `specs.config.json` walking up from the working directory.

```json
{
  "refreshIntervalMs": 300000,
  "proxyTimeoutMs": 30000,
  "specs": [
    { "name": "petstore", "url": "https://petstore3.swagger.io/api/v3/openapi.json" },
    { "name": "local", "url": "./specs/my-api.yaml" }
  ]
}
```

Each spec's `url` may be an **HTTP(S) URL or a local file path**. Full details in [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Architecture

A pnpm monorepo, shipped as a single image:

| Package | What it is |
| --- | --- |
| `packages/shared` | The Zod contract shared by server and web (spec/operation/proxy types). |
| `packages/server` | A Fastify service: normalizes specs, serves the built UI, proxies requests, and does OAuth2 token exchange. |
| `packages/web` | The React + Vite UI. |

More in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Contributing

Issues and PRs welcome. Please run `pnpm -r test` and `pnpm -r build` before opening a PR. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## License

[MIT](LICENSE) © Akhil Bojedla

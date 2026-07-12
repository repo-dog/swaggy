# Contributing to Swaggy

Thanks for your interest! Issues and pull requests are welcome. Swaggy is in
beta, so bug reports, spec-compatibility findings, and focused improvements are
all valuable.

For security issues, **do not open a public issue** — see [SECURITY.md](SECURITY.md).

## Getting set up

Requires **Node 20+** and **pnpm 10+**.

```bash
pnpm install
cp specs.config.example.json specs.config.json   # then point it at your specs

pnpm dev                          # backend on http://localhost:8080 (serves /api)
pnpm --filter @swaggy/web dev     # web UI on http://localhost:5173 (proxies /api → :8080)
```

More detail — including the repo-only e2e/mock-backend fixtures — is in
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) and [docs/TESTING.md](docs/TESTING.md).

## Repo layout

A pnpm monorepo (see [README](README.md#architecture)):

| Package | What it is |
| --- | --- |
| `packages/shared` | Zod contract shared by server and web. |
| `packages/server` | Fastify service: normalizes specs, serves the UI, proxies requests, OAuth2. |
| `packages/web` | React + Vite UI. |
| `packages/e2e` | Repo-only e2e fixtures (mock backend, kitchen-sink specs). Never shipped. |

## Before opening a PR

Please make sure both of these pass:

```bash
pnpm -r test
pnpm -r build
```

Guidelines:

- **Keep PRs focused.** One logical change per PR is easier to review.
- **Add or update tests** for behavior you change. New features should ship with tests.
- **Match the surrounding style** — comment density, naming, and idioms of the files you touch.
- **Preserve the security invariants:** the proxy/OAuth host allow-list, and never persisting or exporting credentials (`authValues`) or history.
- Describe *what* changed and *why* in the PR body, and note anything you couldn't verify.

## Scope

Swaggy is for **interacting with and exploring** APIs — not writing test
assertions against them. Features that push it toward being a test/validation
framework are generally out of scope; open an issue to discuss before building
something large.

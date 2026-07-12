# Testing Swaggy

Swaggy has three layers of tests. The first two run everywhere with no setup; the third
(browser) needs a one-time Playwright install.

| Layer | Command | What it covers |
|-------|---------|----------------|
| **Unit** | `pnpm test` | Pure logic + component tests per package (Vitest). |
| **Integration e2e** | `pnpm e2e` | The real server + proxy + a mock backend, driven through `/api/*` (Vitest, no browser). |
| **Browser e2e** | `pnpm e2e:ui` | The actual web UI in a real browser against the mock backend (Playwright). |

Everything under `packages/e2e/` is a **repo-only test fixture** — it is never part of the
production build or the Docker image.

---

## The mock backend

`packages/e2e/src/mock-backend.ts` is a small echo-style upstream (httpbin-like) that the proxy
forwards to, so tests can assert exactly what reached the "server" without any external
dependency. It listens on a fixed port (`4599`) because the kitchen-sink specs point their
server URL at `http://localhost:4599` (which is also what the proxy's host allow-list resolves
to).

Endpoints include: `/anything` (echo), `/users/{id}` (path param), `/json` + `/form` (body
echo), `/upload` (multipart file report), `/status/{code}`, `/redirect`, `/content/{kind}`
(json / problem+json / xml / text / html / 204), `/secure/{apikey,bearer,basic}` (401 without
credentials), and `/oauth/token`.

## The kitchen-sink specs

`packages/e2e/specs/kitchen-sink-{2.0,3.0,3.1}.json` are one exhaustive spec per OpenAPI
version, wired to the mock backend. Between them they exercise:

- **Params** — path, query, header, cookie (3.x), and Swagger 2.0 `formData`.
- **Types/formats** — string (date-time, uuid, email, binary…), integer (int32/int64), number
  (float/double), boolean, arrays (with `style`/`explode` and 2.0 `collectionFormat`), enums,
  defaults, min/max/length, nullability (`nullable: true` in 3.0, `["type","null"]` in 3.1).
- **Bodies** — `application/json` (+ `oneOf`/`allOf` + recursive `$ref`), `multipart/form-data`
  with a file, and `application/x-www-form-urlencoded`.
- **Responses** — JSON, `+json`, XML/text (raw), `204`, redirects with `Location`, error codes.
- **Security** — `apiKey` (header + query), `http` basic + bearer, `oauth2` (all flows) and
  `openIdConnect`; global vs per-operation, and OR-alternatives.
- **Servers** — multiple servers + server variables (3.x), and 2.0 `host`/`basePath`/`schemes`.
- Plus deprecated operations, `externalDocs`, tags, and named component schemas/definitions
  (for the Models browser).

---

## Running

### Integration e2e (fast, no browser)

```bash
pnpm build          # once, so @swaggy/shared is built (the suite imports server source)
pnpm e2e            # boots the mock backend + real Swaggy app in-process, asserts /api/*
```

The suite (`packages/e2e/test/integration.test.ts`) loads all three specs, then drives spec
normalization, the proxy (params, arrays, JSON/urlencoded/multipart bodies, redirects, content
types, security), and the OAuth token exchange — end to end against the mock backend.

### Browser e2e (Playwright)

One-time browser install:

```bash
pnpm --filter @swaggy/e2e exec playwright install chromium
```

Then:

```bash
pnpm e2e:ui
```

Playwright's `webServer` builds the web bundle, boots the mock backend + Swaggy server serving
it (`packages/e2e/src/serve.ts`, port `4598`), and runs the specs in `packages/e2e/ui/`. The
smoke spec finds an operation via the command palette, sends it, and asserts the rendered
response, plus that a multipart operation renders a file picker.

To iterate on UI specs against a long-running server, start it yourself and let Playwright reuse
it:

```bash
pnpm --filter @swaggy/web build
pnpm --filter @swaggy/e2e serve          # http://localhost:4598
pnpm --filter @swaggy/e2e exec playwright test --ui
```

---

## Adding coverage

- **A new request/response shape to verify end to end** → add (or reuse) a mock endpoint, add an
  operation to the relevant kitchen-sink spec(s), and assert it in `integration.test.ts`.
- **A new UI interaction** → add a spec under `packages/e2e/ui/`.
- Keep the mock backend echo-style (reflect the input back) so assertions stay precise and the
  fixture stays dependency-free.

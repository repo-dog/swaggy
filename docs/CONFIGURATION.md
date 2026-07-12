# Configuration

Swaggy loads the specs it should serve from a JSON config file.

## Where the config comes from

On startup the server resolves the config path in this order:

1. `SWAGGY_CONFIG` environment variable, if set (absolute or relative path).
2. Otherwise, the nearest `specs.config.json` found by walking up from the current working directory.

Start from the template:

```bash
cp specs.config.example.json specs.config.json
```

> `specs.config.json` is git-ignored, since it often points at private/internal URLs. Commit
> changes to `specs.config.example.json` instead if you want to share a default.

## Format

```json
{
  "refreshIntervalMs": 300000,
  "proxyTimeoutMs": 30000,
  "specs": [
    { "name": "petstore", "url": "https://petstore3.swagger.io/api/v3/openapi.json" },
    { "name": "local-api", "url": "./specs/my-api.yaml" }
  ]
}
```

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `refreshIntervalMs` | number | `300000` | How often the server re-fetches specs to pick up changes. |
| `proxyTimeoutMs` | number | `30000` | Timeout for proxied requests and OAuth2 token exchanges. |
| `specs[].name` | string | — | Unique id for the spec (used in the UI and in operation ids). |
| `specs[].url` | string | — | An **HTTP(S) URL or a local file path** to an OpenAPI/Swagger document (JSON or YAML). |
| `specs[].defaultServer` | string \| null | `null` | Fallback base URL when the spec declares none. |

Both Swagger 2.0 and OpenAPI 3.0/3.1 documents are supported; `$ref`s are dereferenced.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `SWAGGY_CONFIG` | — | Path to the config file (overrides the default lookup). |
| `PORT` | `8080` | Port the server listens on. |
| `LOG_LEVEL` | `info` | Pino log level (`debug`, `info`, `warn`, `error`, …). |

## Docker

The image ships `specs.config.example.json` (pointing at the bundled demo specs in
`test-specs/`) as `/app/specs.config.json`, so `docker run` works out of the box. To use your
own specs, either mount a config file:

```bash
docker run --rm -p 8080:8080 \
  -v "$(pwd)/specs.config.json:/app/specs.config.json:ro" \
  repo-dog/swaggy
```

…or point at one with the env var (and mount whatever it references):

```bash
docker run --rm -p 8080:8080 \
  -e SWAGGY_CONFIG=/config/specs.json \
  -v "$(pwd)/my-config:/config:ro" \
  repo-dog/swaggy
```

## Networking / proxy

The server only proxies requests to hosts declared by the loaded specs' servers, and performs
OAuth2 token exchanges server-side (so client secrets stay off the page and CORS isn't an
issue). If a spec's servers are unreachable from where Swaggy runs, requests will fail with a
connection error — run Swaggy where it can reach the target APIs.

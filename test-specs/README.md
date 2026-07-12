# Test OpenAPI specs

Local specs for exercising Swaggy's rendering across OpenAPI versions and feature
combinations. Load them with the bundled config (paths are resolved from the repo root):

```bash
SWAGGY_CONFIG=./specs.config.test.json pnpm --filter @swaggy/server dev
# or copy specs.config.test.json over your specs.config.json
```

Spec `url` accepts a local file path (not just an HTTP URL), so no live server is needed.

## Coverage matrix

| File | Version | Notable features exercised |
|------|---------|----------------------------|
| `swagger-2.0.json` | Swagger 2.0 | `path`/`query`/`header`/`formData`/`body` params, `collectionFormat: multi`, enums + defaults, `file` upload, `#/definitions` `$ref`, all security types (`apiKey`, `basic`, `oauth2` accessCode) |
| `openapi-3.0.json` | OpenAPI 3.0.3 | multiple `servers`, `path`/`query`/`header`/`cookie` params, `requestBody` in JSON + urlencoded + multipart, `allOf`/`oneOf` + `discriminator`, `nullable`, `components` + security (`http` bearer, `apiKey`, `oauth2` authorizationCode) |
| `openapi-3.1.json` | OpenAPI 3.1.0 | JSON Schema 2020-12: `type` arrays incl. `null`, `const`, `prefixItems` tuple, `examples` arrays; `webhooks`; `http` bearer |
| `edge-cases-3.0.json` | OpenAPI 3.0.3 | recursive self-referencing schema, `anyOf`, deep nesting, 25-value enum, free-form `additionalProperties`, array-of-arrays |

These are representative combinations, not an exhaustive cross-product. To probe a specific
dimension (a particular auth flow, parameter style, or composition shape), copy the closest
file and adjust it, or add a new entry to `specs.config.test.json`.

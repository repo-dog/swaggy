# Security Policy

Swaggy is currently in **beta (0.x)**. Security fixes land on the latest
release only.

| Version | Supported |
| ------- | --------- |
| latest `0.x` release | ✅ |
| older releases | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub's
[private vulnerability reporting](https://github.com/repo-dog/swaggy/security/advisories/new)
(the **Security** tab → *Report a vulnerability*). If that is unavailable to
you, open a minimal public issue asking for a private contact channel — without
any exploit details — and we'll follow up.

Please include, where possible:

- affected version / commit and how you're running Swaggy (Docker image or from source),
- a description of the issue and its impact,
- reproduction steps or a proof of concept, and
- any relevant configuration (redact real hostnames, tokens, and spec URLs).

We aim to acknowledge a report within a few days and to keep you updated as we
investigate and ship a fix.

## Scope & threat model

Swaggy runs a backend that **proxies outbound HTTP requests** and performs
**OAuth2 token exchange** on the user's behalf, and it serves the built UI from
the same process. Areas that are especially in scope:

- **Server-Side Request Forgery (SSRF).** The proxy and OAuth token endpoints
  restrict outbound requests to a configured host allow-list. Reports that
  bypass this allow-list, reach internal/metadata endpoints, or otherwise abuse
  the proxy are high priority.
- **Secret handling.** Swaggy is designed never to persist or export
  credentials (`authValues`) or request history in profile exports. Any leak of
  credentials, tokens, or the local `specs.config.json` (which may contain
  private URLs) is in scope.
- **Response handling / injection** in the UI's rendering of spec content and
  proxied responses.

Out of scope: issues that require an already-compromised host or browser, and
findings against the demo/kitchen-sink specs used only for local testing.

## Deploying safely

Swaggy will call any host on its configured allow-list on behalf of whoever can
reach it. Do not expose an instance to untrusted networks without restricting
the allow-list and placing it behind your own authentication.

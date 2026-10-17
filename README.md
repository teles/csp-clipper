# csp-clipper

Cloudflare Worker that fetches the `Content-Security-Policy` header from any URL and returns it as JSON. Built to power [visual-csp.pages.dev](https://visual-csp.pages.dev).

## How it works

```mermaid
sequenceDiagram
    participant User as visual-csp.pages.dev
    participant Worker as csp-clipper (Cloudflare Worker)
    participant Target as Target Website

    User->>Worker: GET /csp?url=https://example.com
    Worker->>Worker: Validate URL & check rate limit
    alt Rate limit exceeded
        Worker-->>User: 429 Too Many Requests
    else
        Worker->>Target: GET https://example.com
        Target-->>Worker: HTTP Response with headers
        Worker->>Worker: Extract CSP and CSP-Report-Only policies
        alt CSP header found
            Worker-->>User: 200 { url, csp, reportOnly, policies }
        else No CSP header
            Worker-->>User: 200 { url, csp: null, policies: [] }
        end
    end
```

## API

### `GET /csp?url=<target>`

| Parameter | Description |
|-----------|-------------|
| `url` | Required. Absolute HTTP or HTTPS URL to fetch the CSP header from. |

### Response

```json
{
  "url": "https://example.com",
  "title": "Example Domain",
  "csp": "default-src 'self'; script-src 'none'",
  "reportOnly": false,
  "policies": [
    { "policy": "default-src 'self'; script-src 'none'", "reportOnly": false },
    { "policy": "default-src 'none'; report-uri /csp-reports", "reportOnly": true }
  ]
}
```

| Field | Description |
|-------|-------------|
| `policies` | Every policy the site sends, enforced ones first. Repeated headers and comma-separated policies in one header are split into separate entries. |
| `policies[].reportOnly` | `true` when the policy came from `Content-Security-Policy-Report-Only`, which browsers monitor but do not enforce. |
| `csp` | The first entry of `policies`, kept for clients that read a single string. |
| `reportOnly` | Whether `csp` came from the report-only header. |

When no CSP header is found:

```json
{
  "url": "https://example.com",
  "title": "Example Domain",
  "csp": null,
  "reportOnly": false,
  "policies": [],
  "message": "No CSP header found"
}
```

### Rate Limiting

Requests are limited to **30 per minute** per IP. Rate limit info is included in response headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per window |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |

### CORS

Only requests from `https://visual-csp.pages.dev` are allowed.

## Development

```bash
npm install
npm run dev       # Start local dev server on localhost:8787
npm test          # Run unit tests
```

## Deploy

```bash
npm run deploy
```

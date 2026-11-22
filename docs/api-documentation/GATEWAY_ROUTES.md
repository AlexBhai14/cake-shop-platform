# API Gateway Routes (http://localhost:3000)

The frontend talks ONLY to the gateway. The gateway removes the `/api` prefix and forwards to the owning service.

| Public URL | Service | Needs token? |
|---|---|---|
| POST /api/auth/register, /login, /refresh, /logout | auth (3001) | No |
| GET /api/auth/me | auth | Yes |
| GET /api/categories | product (3003) | No |
| GET /api/cakes, /api/cakes/:id, /api/variants/:id | product | No |
| POST/PATCH /api/categories, /api/cakes, /api/variants | product | Yes, ADMIN only |
| GET /api/cakes/admin/all, /api/categories/admin/all | product | Yes, ADMIN only |
| /api/users/me, /api/users/me/addresses... | user (3002) | Yes |
| GET /api/users | user | Yes, ADMIN only |
| /api/cart, /api/cart/items... | cart (3004) | Yes |

Gateway errors use one JSON shape: `statusCode`, `message`, `path`, `correlationId`, `timestamp`.
Status codes: 401 missing/invalid token, 404 unknown route, 429 rate limit, 502 service down, 504 service timeout.
Every response carries `X-Correlation-Id`. Rate-limited responses carry `Retry-After`.

Role checks (403) are done by each microservice, not by the gateway.

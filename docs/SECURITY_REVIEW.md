# Security review

Scope: the platform as built in this repository (development and demo deployment). Payments are simulated.

## 1. Assets and threats

| Asset | Threat | Control in this project |
|---|---|---|
| Customer credentials | Database leak | bcrypt (12 rounds) hashes; refresh tokens stored only as SHA-256 hashes |
| Sessions | Token theft | Short access token (15 min); refresh-token rotation with reuse detection; logout and suspension revoke refresh tokens |
| Admin functions | A customer calls an admin API | `JwtAuthGuard` + `RolesGuard` + `@Roles('ADMIN')` in every service; E2E tests check 401/403 on 12 admin endpoints |
| Other customers' data | Reading or changing somebody else's order, address, cart, payment | Ownership checks in the services (403 or 404); tests for orders, payments, addresses, cart lines |
| Admin accounts | Public admin registration | No endpoint creates admins; `npm run seed` provisions them; extra fields in the register body are rejected |
| Passwords and keys | Committed to Git or logged | `.env` ignored; `.env.example` has placeholders; Trivy secret scan in CI; Kubernetes Secret created from the local `.env`; logs never contain headers or bodies |
| Login endpoint | Brute force | Redis rate limit (default 5 per minute per IP), same error for unknown email and wrong password |
| Availability | Request floods | Rate limiting per IP and per user; timeouts to upstream services (502/504) |
| Money | Double charge, stale price, tampering | Idempotent payments (one per order), idempotency keys, prices always read from the product service, money as DECIMAL/integer paise, order price snapshots |
| Stock | Overselling | Conditional UPDATE under row lock, proved with a real MySQL (Testcontainers) |
| Input | Injection, bad data | `class-validator` with `whitelist` and `forbidNonWhitelisted`; Prisma parameterized queries (raw SQL uses tagged templates, which are parameterized); React escapes output; email templates escape HTML |
| Browser | Clickjacking, sniffing | Helmet on the gateway; security headers in the nginx of both front ends; CORS allow-list |
| Network | Direct access to internal services | Ports bound to 127.0.0.1 in Compose; Kubernetes Services are ClusterIP; `/metrics` is not routed publicly |
| Database | Over-privileged access | One MySQL user per service with rights only on its own database |
| Supply chain | Vulnerable dependencies | Dependabot, `npm audit` report, lock files committed |

## 2. OWASP Top 10 (2021) mapping

| Risk | Status |
|---|---|
| A01 Broken access control | Backend enforces roles and ownership; tested end to end |
| A02 Cryptographic failures | bcrypt, signed JWTs; no TLS in the local setup (terminate TLS at an ingress or load balancer in production) |
| A03 Injection | Parameterized queries, validation, output escaping |
| A04 Insecure design | State machine, saga compensation, idempotency, reconciliation |
| A05 Security misconfiguration | Helmet, no framework banner, least-privilege DB users; default passwords in `.env.example` must be changed |
| A06 Vulnerable components | Dependabot and audit; not yet enforced as a blocking gate |
| A07 Identification and authentication failures | Rate limiting, rotation, reuse detection; no multi-factor authentication, no password reset |
| A08 Software and data integrity failures | Lock files, CI before deploy, commit-SHA image tags; actions are not pinned to SHAs yet |
| A09 Logging and monitoring failures | Structured logs, correlation ids, Prometheus alerts |
| A10 Server-side request forgery | Services call only fixed, configured URLs |

## 3. Known limitations (honest list)

1. **Access tokens cannot be revoked.** A suspended user keeps a valid access token for up to 15 minutes.
2. **The refresh token is in `localStorage`** in the React apps (readable by injected scripts). A production shop should use an httpOnly, SameSite cookie.
3. **No HTTPS** in the local setup, so tokens travel in clear text on localhost only. Production needs TLS.
4. **JWT secret is shared** (HS256) by all services. A service that is compromised can forge tokens. Production should use asymmetric keys (RS256/EdDSA) so that only the auth service can sign.
5. **No password reset, no email verification, no MFA.**
6. **Kubernetes Secrets are base64, not encrypted** by default; no NetworkPolicies; containers run as root in the Node images.
7. **Rate limiting trusts `req.ip`.** Behind a proxy the real client address needs `trust proxy` to be configured.
8. **The mock payment lets the caller choose the outcome.** That is intentional for a simulation and would never exist in a real shop.
9. **No automated penetration test result** is included; `docs/SECURITY_REVIEW.md` lists manual checks below.

## 4. Manual checks to run and record in the report

| Check | How | Expected |
|---|---|---|
| Headers | `curl -I http://localhost:3000/api/cakes` | `x-content-type-options: nosniff`, no `x-powered-by` |
| Token tampering | change one character of a JWT | 401 |
| Algorithm "none" | send a token with `alg: none` | 401 |
| IDOR | request another customer's order id | 403 |
| Mass assignment | register with `"role":"ADMIN"` | 400 |
| SQL injection | search `' OR 1=1 --` in the cake search | normal empty result |
| XSS | create a cake whose description contains `<script>` and open it in the customer app | shown as text |
| Rate limit | 6 wrong logins in a minute | 429 with Retry-After |
| Optional scanner | OWASP ZAP baseline scan (Docker image `zaproxy/zap-stable`) against the gateway | review the report |

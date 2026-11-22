# Admin Application and Authorization

- **Two layers, only one is real.** The admin app hides pages from non-admins (`RequireAdmin`), but a determined user can call the API directly. The real protection is the backend: every admin endpoint is guarded by `JwtAuthGuard` + `RolesGuard` + `@Roles('ADMIN')`. A customer token gets HTTP 403, no token gets HTTP 401.
- **No public admin sign-up.** Admin accounts are created by the `npm run seed` script of the auth service (controlled provisioning).
- **Customer tokens are refused in the admin app.** On login the app checks the role in the token and signs the account out again if it is not ADMIN.
- **Account suspension.** Suspending revokes all refresh tokens, so sessions end at the next token refresh. Access tokens are stateless and stay valid until they expire (15 minutes). Shorter expiry or a token deny-list would make it immediate; this is a documented trade-off of JWT.
- **An admin cannot suspend their own account** (prevents locking yourself out).
- **Rate limits:** admins use their own policy (`RATE_ADMIN_LIMIT`), keyed by user id. Logged-in auth routes (`/api/auth/me`, `/api/auth/admin/*`) are NOT counted in the strict login/register limit.
- **Analytics** are computed by the order service with database aggregations (group by status, group by cake) and zero-filled daily buckets.

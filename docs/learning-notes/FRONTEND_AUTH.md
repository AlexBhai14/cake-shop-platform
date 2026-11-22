# Frontend Authentication (React)

- **Access token** (15 minutes): kept only in memory. Every request gets `Authorization: Bearer <token>` from an Axios request interceptor.
- **Refresh token** (7 days): kept in `localStorage`, so a page reload does not log the user out. Trade-off: scripts injected by an XSS attack could read it. A production shop would use an httpOnly cookie. We accept it here and say so.
- **401 handling:** an Axios response interceptor refreshes the token ONCE and repeats the failed request. Several requests failing together share one refresh call, because refresh tokens rotate (a second call with the old token would look like theft and log everyone out).
- **Login/register errors** skip the refresh logic (`_skipRefresh`): a wrong password is not an expired token.
- **ProtectedRoute** only hides pages. The real protection is the backend (401/403), which never trusts the frontend.
- The role decoded from the token is used only to choose what to show. It proves nothing; the services check the signature.
- **Polling:** after checkout the stock reservation, payment record and emails are created by events in the background, so the payment and order pages poll the API every 2 to 4 seconds until the order reaches a final status.
- **Idempotency-Key:** one random key per checkout attempt, so a double click returns the same order.

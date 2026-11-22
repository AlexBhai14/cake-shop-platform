# Rate Limiting (Redis)

**What:** limit how many requests one client can make in a time window. Over the limit: HTTP 429.
**Why:** stops password guessing (brute force), scraping, and one noisy client slowing everyone down.

| Algorithm | How it works | Trade-off |
|---|---|---|
| Fixed window (used here) | Count requests per window (for example 5 per 60 s). First request starts the window. | Simple and fast. A client can send a burst at the end of one window and the start of the next. |
| Sliding window | Counts requests in the last N seconds, moving continuously. | Smoother and more accurate, needs more memory or computation. |
| Token bucket | A bucket refills at a steady rate, each request takes a token. | Allows controlled bursts. |

**Distributed:** the counter lives in Redis, not in the gateway's memory. If we run 3 gateway pods, all of them share ONE counter. The INCR + PEXPIRE steps run in a single Lua script, so two requests at the same moment cannot corrupt the count.

**IP-based vs user-based:** login and register use the IP address (the user is not known yet). Logged-in users are counted by user id; admins have their own policy.

**Fail open:** if Redis is down, requests are allowed and an error is logged, so a Redis outage does not take the shop down. (A stricter shop could fail closed for the login route.)

Limits are configurable with `RATE_<NAME>_LIMIT` and `RATE_<NAME>_WINDOW_SEC` in the gateway `.env`.

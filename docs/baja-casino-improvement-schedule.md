# Baja Casino Improvement Schedule

Status date: November 27, 2026

## Current Live Status

- `https://baja-casino.com/` is reachable over HTTPS.
- `/health` reports the Express service as healthy.
- The Cosmic and six-theme slot pages are reachable.
- Production deployment is managed by GitHub push and Railway.
- `www.baja-casino.com` should be verified in Cloudflare and Railway domain configuration.

## Priority 0: Infrastructure and Deployment

1. Keep production deployed from `main` with zero-deploy overlap.
2. Use one replica for the current stateful SQLite-style prototype.
3. Configure persistent storage before enabling production authentication or database writes.
4. Keep the Node runtime and native dependencies on a compatible version.
5. Verify Cloudflare Full SSL mode, HTTPS redirects, WebSocket routing, and `/socket.io/*` cache bypass.
6. Verify all Railway custom-domain ownership and certificate records.

## Priority 1: Security

1. Remove demo or seeded credentials from public deployment instructions.
2. Require a secure administrator token and protect all admin routes.
3. Add email verification and password recovery before exposing accounts publicly.
4. Review session cookies, proxy trust, rate limits, CSP, CORS, and origin checks.
5. Remove or isolate any payment-labeled API that does not process real payments.
6. Add targeted security tests for authentication, admin access, and Socket.IO events.

## Priority 2: Product and Brand

1. Complete Baja Casino branding across every lobby and game screen.
2. Replace unfinished, mixed-language copy with consistent English-first or bilingual content.
3. Add required trust pages: About, Terms, Privacy, Responsible Play, and Support.
4. Label every wallet and credit as virtual and non-cash unless real-money licensing exists.

## Priority 3: Game Economy

1. Rebalance slot and wheel payout settings to match the intended RTP.
2. Persist operator-adjustable game settings safely across restarts.
3. Add deterministic test coverage for payouts, multipliers, and edge cases.
4. Verify starting balances and reload behavior with focused gameplay tests.

## Priority 4: Performance

1. Measure Core Web Vitals on mobile and desktop.
2. Split large standalone game pages where appropriate.
3. Optimize 3D asset loading and canvas pixel scaling.
4. Add cache rules for static assets and bypass caching for API and Socket.IO traffic.

## Priority 5: Legal and Launch Readiness

1. Perform a legal review for Mexican and Baja California requirements.
2. Confirm that all gameplay uses virtual credits and is clearly entertainment-only.
3. Complete an accessibility and responsible-play review.
4. Run load, reconnect, mobile, and failure-mode testing before launch.
5. Verify backup, restore, and rollback procedures.

## Release Sequence

1. Confirm the apex domain and health endpoint.
2. Repair `www` DNS or redirect routing.
3. Harden and test authentication and database persistence.
4. Finish legal and trust pages.
5. Balance game economy and test payouts.
6. Optimize performance and complete production launch checks.

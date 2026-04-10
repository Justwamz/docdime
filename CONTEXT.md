# DocDime — Session Context (2026-03-21)

## Current Status
All features implemented, building and deploying successfully on Render.

## Recent Work This Session

### Security Fixes
- Upgraded Next.js 14.2.3 → 14.2.29 (patches cache poisoning CVE)
- Added IP-based rate limiting (`lib/rate-limit.ts`): register 5/hr, payment 10/10min, login 10/15min
- Fixed payment initialization to fail-closed (503 instead of free access when Paystack unconfigured)
- Account deletion now requires password confirmation (UI + API)
- Removed default admin credentials from seed console output

### PWA + Push Notifications
- `public/manifest.json`, `public/sw.js`, `public/icons/` — PWA installable
- `app/icon.svg`, `public/favicon.svg` — Blue rounded square "D" favicon (SVG, crisp at all sizes)
- `components/pwa/service-worker-register.tsx` + `components/pwa/install-prompt.tsx`
- `PushSubscription` model in schema (synced to DB)
- `lib/push.ts` — VAPID web-push, lazy-initialized (avoids build failure when env absent)
- `/api/push/subscribe` + `/api/push/unsubscribe`
- Notifications tab in `/dashboard/settings`
- Push fires alongside emails: overdue invoices, expiring quotes, pro expired, payment confirmed

### VAPID Keys (in .env and render.yaml)
- NEXT_PUBLIC_VAPID_PUBLIC_KEY=BHHc5xaAhwzO092f2Azg009X0u9sRolnU5tqxNAixPL9ZFCWFHqTYOsaAlUAKmh6XzaBwMFytSvXB_0SQ5iRNMY
- VAPID_PRIVATE_KEY=01dC8GILYCNdUGcDv5x0-l8zDsAoLus-ynsfx1_2P8k
- VAPID_SUBJECT=mailto:admin@docdime.com

### Logo / Branding
- Real logo (`public/logo.png`) kept in public/ but NOT used in UI — too small
- All UI uses original blue "D" square + "DocDime" text
- Favicon is SVG: blue rounded square with white bold "D"

## Key Architectural Patterns
- **DB-first config**: empty DB value → fall back to env var
- **Fire-and-forget emails/push**: `.catch(() => {})` — never block API responses
- **Lazy init pattern**: Resend (`lib/email.ts`) and web-push (`lib/push.ts`) initialize inside functions, never at module level (prevents build failure when keys absent)
- **force-dynamic**: any server page reading DB must export this
- **Fail-closed**: payment and push silently skip when unconfigured — never grant free access

## Pending
Nothing. All features shipped.

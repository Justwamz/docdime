# DocDime — Session Context (2026-03-20)

## Current Status
Build passes, DB seeded (including `staff_welcome` template + integration AppSettings).

## Pending Work
None. All features implemented and seeded.

---

## What Was Built This Session

### Email System
- `lib/email.ts` — lazy Resend init (build-safe), DB-first API key, `sendTemplateEmail`
- `lib/email-triggers.ts` — 11 trigger functions (welcome, nudge_3/7/14/21/30day, pro_upgraded, pro_expired, payment_received, payment_received_notify, customer_created, invoice_sent, quote_sent, invoice_overdue, quote_expiring)
- `lib/cron.ts` — fully replaced: uses trigger functions, daily nudge job, quote expiry, overdue

### Pricing (DB-driven)
- `lib/pricing.ts` — reads doc_price_usd, pro_price_usd, pro_annual_price_usd, pro_monthly_docs from AppSettings
- `app/api/pricing/route.ts` — public GET endpoint for client components
- Pages updated: landing, subscription, documents/[id], documents/new

### Paystack (DB-first)
- `lib/paystack.ts` — `getSecretKey()`, `getPaystackPublicKey()` read from AppSettings with env var fallback

### Admin Settings
- `app/admin/(protected)/settings/page.tsx` + `settings-client.tsx`
  - Configuration card: pricing, maintenance mode, notification email
  - Integrations card: Resend (API key, From email) + Paystack (secret, public key) with password masking + show/hide

### Admin Team Page
- `app/admin/(protected)/team/page.tsx` — lists staff (isAdmin: true users)
- `app/api/admin/team/route.ts` — POST: create staff with auto-generated password
- `app/api/admin/team/[id]/route.ts` — DELETE: blocks self-deletion
- `create-staff-form.tsx` — inline form, auto-generated 14-char password, copy credentials on success
- `staff-actions.tsx` — Remove button

### Email Templates UI
- Tiptap rich-text editor (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`)
- `/admin/email-templates` — list with Edit/Delete
- `/admin/email-templates/new` — create with variable auto-detection
- `/admin/email-templates/[id]/edit` — edit existing

### Other Fixes
- Landing page: `force-dynamic` added, uses `getPricing()`
- Recent Users table: `whitespace-nowrap` on date/plan, `max-w-[180px] truncate` on email
- `app/api/documents/[id]/send/route.ts` — marks doc SENT, fires invoice/quote sent triggers

---

## DB Seed State
Run `npx tsx prisma/seed.ts` to apply. Last run: 2026-03-20 ✅

Templates seeded: welcome, nudge_3/7/14/21/30day, pro_upgraded, pro_expired, payment_received, payment_received_notify, customer_created, invoice_sent, invoice_overdue, quote_sent, quote_expiring, **staff_welcome**

AppSettings seeded: doc_price_usd, pro_price_usd, pro_annual_price_usd, pro_monthly_docs, maintenance_mode, admin_notification_email, resend_api_key, resend_from_email, paystack_secret_key, paystack_public_key

---

## Key Architectural Patterns
- **DB-first config**: empty DB value → fall back to env var. Non-empty DB value overrides.
- **Fire-and-forget emails**: `.catch(() => {})` — never block API responses.
- **Lazy Resend init**: `new Resend(key)` inside function body, never at module level (prevents build failure when key absent).
- **force-dynamic**: any server component/page that reads DB must export this to avoid stale static builds.

# Email Templates & Event Triggers — Design Spec

## Goal

Give admins a rich-text editor to create and edit email templates, wire all lifecycle and transactional events to those templates, and send admin notifications to a configurable email address. Everything is stub-safe — no emails fire until a real Resend API key is set.

## Architecture

### Approach: Direct trigger functions

`lib/email-triggers.ts` exports one function per event. Each function:
1. Fetches the template from DB by `name`
2. Returns silently if template is missing or `isActive = false`
3. Renders `{{variable}}` placeholders via existing `renderTemplate()`
4. Calls `sendEmail()` (already stub-safe)

Admin notification address is read from `AppSettings` where `key = "admin_notification_email"`.

---

## Templates (13 total)

### New templates to seed (9)

| Name | Recipient | Trigger | Variables |
|---|---|---|---|
| `welcome` | User | Signs up | `name`, `email` |
| `nudge_3day` | User | 3 days since signup, 0 docs | `name` |
| `nudge_7day` | User | 7 days since signup, 0 docs | `name` |
| `nudge_14day` | User | 14 days since signup, 0 docs | `name` |
| `nudge_21day` | User | 21 days since signup, 0 docs | `name` |
| `nudge_30day` | User | 30 days since signup, 0 docs | `name` |
| `pro_upgraded` | User | Upgrades to PRO | `name`, `expiresAt` |
| `pro_expired` | User | PRO expires / downgraded | `name` |
| `payment_received` | User | PDF payment success (receipt) | `name`, `docNumber`, `amount` |
| `payment_received_notify` | Admin email | PDF payment success | `userName`, `userEmail`, `docNumber`, `amount` |
| `customer_created` | Admin email | User adds a customer | `customerName`, `customerEmail`, `businessName`, `userName` |

### Existing templates to keep + rewire (4)

| Name | Rewire action |
|---|---|
| `invoice_sent` | Wire to DB template, remove hardcoded HTML |
| `invoice_overdue` | Wire to DB template, remove hardcoded HTML |
| `quote_sent` | Wire to DB template, remove hardcoded HTML |
| `quote_expiring` | Wire to DB template, remove hardcoded HTML |

Seed uses upsert — existing admin edits are never overwritten on redeploy.

---

## File Changes

### New files
- `lib/email-triggers.ts` — All trigger functions
- `app/admin/(protected)/email-templates/[id]/edit/page.tsx` — Edit page
- `app/admin/(protected)/email-templates/new/page.tsx` — Create page
- `app/admin/(protected)/email-templates/template-editor.tsx` — Tiptap client component

### Modified files
- `lib/email.ts` — Remove `sendInvoiceEmail` and `sendOverdueEmail` hardcoded functions; add `sendTemplateEmail(name, to, vars)` helper used by triggers
- `lib/cron.ts` — Add nudge cron (daily); rewire overdue + quote expiry to use DB templates; fire `pro_expired` trigger on downgrade
- `prisma/seed.ts` — Upsert 11 new templates with default subject + body
- `app/api/auth/signup/route.ts` — Call `triggerWelcomeEmail` after user creation
- `app/api/customers/route.ts` — Call `triggerCustomerCreatedEmail` after customer creation
- `app/api/payment/verify/route.ts` — Call `triggerPaymentReceivedEmail` + `triggerPaymentNotifyEmail`
- `app/api/subscription/route.ts` — Call `triggerProUpgradedEmail` on verify_upgrade success
- `app/api/documents/[id]/send/route.ts` — Call `triggerInvoiceSentEmail` or `triggerQuoteSentEmail`
- `app/admin/(protected)/email-templates/page.tsx` — Add New/Edit/Delete action buttons

---

## Trigger Hookup Points

| Event | File | Trigger function |
|---|---|---|
| User signup | `app/api/auth/signup/route.ts` | `triggerWelcomeEmail(user)` |
| Nudge (3/7/14/21/30 days) | `lib/cron.ts` daily job | `triggerNudgeEmail(user, days)` |
| PRO upgraded | `app/api/subscription/route.ts` | `triggerProUpgradedEmail(user)` |
| PRO expired | `lib/cron.ts` daily job | `triggerProExpiredEmail(user)` |
| Payment received | `app/api/payment/verify/route.ts` | `triggerPaymentReceivedEmail` + `triggerPaymentNotifyEmail` |
| Customer created | `app/api/customers/route.ts` | `triggerCustomerCreatedEmail(user, customer)` |
| Invoice sent | `app/api/documents/[id]/send/route.ts` | `triggerInvoiceSentEmail(doc, user, customer)` |
| Quote sent | `app/api/documents/[id]/send/route.ts` | `triggerQuoteSentEmail(doc, user, customer)` |
| Invoice overdue | `lib/cron.ts` daily 8am | `triggerInvoiceOverdueEmail(doc, user, customer)` |
| Quote expiring | `lib/cron.ts` daily 9am | `triggerQuoteExpiringEmail(doc, user, customer)` |

---

## Admin UI

### Template list page (`/admin/email-templates`)
- Existing responsive table + mobile cards
- Add "New Template" button (top right)
- Each row: Edit button (→ edit page) + Delete button (confirm dialog)

### Editor (`/admin/email-templates/new` and `/admin/email-templates/[id]/edit`)
- **Name**: text input (slug format, e.g. `welcome`) — disabled on edit
- **Subject**: text input with `{{variable}}` support
- **Body**: Tiptap rich text editor (bold, italic, links, headings, lists) — outputs HTML
- **Variables panel**: read-only list showing detected `{{variables}}` from subject + body
- **isActive**: toggle
- Save button → PUT/POST to existing admin API

### Rich text editor
- Library: `@tiptap/react` + `@tiptap/starter-kit`
- Toolbar: Bold, Italic, Heading (H1/H2), Bullet list, Ordered list, Link
- Output: HTML string stored in `body` field
- Client component only (no SSR issues)

---

## Cron additions

### New: Daily nudge check (runs at 11am)
```
For each interval in [3, 7, 14, 21, 30]:
  Find users where:
    - createdAt = exactly N days ago (± same day)
    - _count.documents = 0
    - isAdmin = false
  Call triggerNudgeEmail(user, N)
```

### Updated: Subscription expiry (10am)
After downgrading expired users, call `triggerProExpiredEmail(user)` for each.

### Updated: Invoice overdue (8am)
Replace `sendOverdueEmail()` call with `triggerInvoiceOverdueEmail()`.

### Updated: Quote expiry (9am)
Replace empty log with `triggerQuoteExpiringEmail()`.

---

## AppSettings

Add `admin_notification_email` to seed if not present. Editable from admin Settings page (read-only display for now — full settings editing is out of scope for this feature).

---

## Error handling

All trigger functions are fire-and-forget — they `catch` and `console.warn` so a failed email never blocks the main request. `sendEmail()` is already stub-safe (logs instead of sending when `RESEND_API_KEY` is not set).

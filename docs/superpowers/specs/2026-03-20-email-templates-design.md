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

All trigger functions are fire-and-forget — they `try/catch` internally and `console.warn` on failure so a failed email never blocks the main request.

Admin notification address is read from `AppSettings` where `key = "admin_notification_email"`.

### `sendTemplateEmail` helper (in `lib/email.ts`)

```ts
async function sendTemplateEmail(
  templateName: string,
  to: string | string[],
  vars: Record<string, string>
): Promise<void>
```

- Fetches template by name; returns silently (no throw) if not found or `isActive = false`
- Renders subject + body via `renderTemplate(template, vars)`
- Calls `sendEmail()`; on failure, logs warning and returns — does NOT throw
- All error handling lives inside `sendTemplateEmail`; trigger functions do not need their own try/catch

---

## Templates (15 total)

### New templates to seed (11)

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

### Existing templates to rewire (4)

| Name | Variables (updated) | Rewire action |
|---|---|---|
| `invoice_sent` | `docNumber`, `businessName`, `customerName`, `amount`, `dueDate`, `pdfUrl` | Wire to DB template, remove hardcoded HTML |
| `invoice_overdue` | `docNumber`, `businessName`, `customerName`, `amount` | Wire to DB template, remove hardcoded HTML |
| `quote_sent` | `docNumber`, `businessName`, `customerName`, `amount`, `expiryDate`, `pdfUrl` | Wire to DB template, remove hardcoded HTML |
| `quote_expiring` | `docNumber`, `businessName`, `customerName`, `amount`, `expiryDate` | Wire to DB template, remove hardcoded HTML |

Seed uses upsert — existing admin edits to `subject`/`body` are never overwritten on redeploy. The `variables` array is updated on each deploy to reflect additions like `pdfUrl`.

---

## File Changes

### New files
- `lib/email-triggers.ts` — All trigger functions
- `app/api/documents/[id]/send/route.ts` — **New route** (does not exist yet); POST endpoint to mark document as SENT and fire `triggerInvoiceSentEmail` or `triggerQuoteSentEmail`
- `app/admin/(protected)/email-templates/[id]/edit/page.tsx` — Edit page
- `app/admin/(protected)/email-templates/new/page.tsx` — Create page
- `app/admin/(protected)/email-templates/template-editor.tsx` — Tiptap client component (marked `"use client"`)

### Modified files
- `lib/email.ts` — Remove `sendInvoiceEmail` and `sendOverdueEmail`; add `sendTemplateEmail(name, to, vars)` helper
- `package.json` — Add `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`
- `lib/cron.ts` — Add nudge cron (daily 11am); refactor subscription expiry to `findMany` first; rewire overdue + quote expiry to use DB templates
- `prisma/seed.ts` — Upsert 11 new templates; upsert `admin_notification_email` in AppSettings
- `app/api/register/route.ts` — Call `triggerWelcomeEmail` after user creation
- `app/api/customers/route.ts` — Call `triggerCustomerCreatedEmail` after customer creation
- `app/api/payment/verify/route.ts` — Call `triggerPaymentReceivedEmail` + `triggerPaymentNotifyEmail`
- `app/api/subscription/route.ts` — Call `triggerProUpgradedEmail` on `verify_upgrade` success
- `app/admin/(protected)/email-templates/page.tsx` — Add New/Edit/Delete action buttons

---

## Trigger Hookup Points

| Event | File | Trigger function |
|---|---|---|
| User signup | `app/api/register/route.ts` | `triggerWelcomeEmail(user)` |
| Nudge (3/7/14/21/30 days) | `lib/cron.ts` daily 11am | `triggerNudgeEmail(user, days)` |
| PRO upgraded | `app/api/subscription/route.ts` | `triggerProUpgradedEmail(user)` |
| PRO expired | `lib/cron.ts` daily 10am | `triggerProExpiredEmail(user)` per downgraded user |
| Payment received | `app/api/payment/verify/route.ts` | `triggerPaymentReceivedEmail` + `triggerPaymentNotifyEmail` |
| Customer created | `app/api/customers/route.ts` | `triggerCustomerCreatedEmail(user, customer)` |
| Invoice sent | `app/api/documents/[id]/send/route.ts` | `triggerInvoiceSentEmail(doc, user, customer)` |
| Quote sent | `app/api/documents/[id]/send/route.ts` | `triggerQuoteSentEmail(doc, user, customer)` |
| Invoice overdue | `lib/cron.ts` daily 8am | `triggerInvoiceOverdueEmail(doc, user, customer)` |
| Quote expiring | `lib/cron.ts` daily 9am | `triggerQuoteExpiringEmail(doc, user, customer)` |

---

## Cron Changes

### Updated: Subscription expiry (10am) — refactored to findMany first

```ts
// Find expired PRO users BEFORE updating so we have their details
const expiredUsers = await prisma.user.findMany({
  where: { plan: "PRO", proExpiresAt: { lt: now } },
});

await prisma.user.updateMany({
  where: { plan: "PRO", proExpiresAt: { lt: now } },
  data: { plan: "PAY_PER_USE", docsThisMonth: 0 },
});

for (const user of expiredUsers) {
  await triggerProExpiredEmail(user);
}
```

### New: Nudge check (daily 11am)

For each interval N in `[3, 7, 14, 21, 30]`, query users using an explicit date range:

```ts
const now = new Date();
const start = startOfDay(subDays(now, N));   // midnight N days ago
const end = startOfDay(subDays(now, N - 1)); // midnight N-1 days ago

const users = await prisma.user.findMany({
  where: {
    isAdmin: false,
    createdAt: { gte: start, lt: end },
    documents: { none: {} },
  },
});
for (const user of users) {
  await triggerNudgeEmail(user, N);
}
```

Date helpers (`startOfDay`, `subDays`) implemented inline without external dependencies.

### Updated: Invoice overdue (8am)
Replace `sendOverdueEmail()` call with `triggerInvoiceOverdueEmail(invoice, user, customer)`.

### Updated: Quote expiry (9am)
Replace empty log with `triggerQuoteExpiringEmail(doc, user, customer)`.

---

## Trigger Function Details

### `triggerCustomerCreatedEmail`

Session user only has `id`, `email`, `name` — NOT `businessName`. This trigger must fetch the full user record from the DB:

```ts
export async function triggerCustomerCreatedEmail(userId: string, customer: { name: string; email?: string | null }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const adminEmail = await getAdminNotificationEmail();
  if (!adminEmail) return;
  await sendTemplateEmail("customer_created", adminEmail, {
    customerName: customer.name,
    customerEmail: customer.email ?? "—",
    businessName: user.businessName ?? user.name ?? "—",
    userName: user.name ?? user.email,
  });
}
```

All other triggers that need `businessName` follow the same pattern.

---

## Admin UI

### Template list page (`/admin/email-templates`)
- Existing responsive table + mobile cards
- Add "New Template" button (top right)
- Each row: Edit button (→ `/admin/email-templates/[id]/edit`) + Delete button (confirm dialog via JS `confirm()`)
- Delete calls `DELETE /api/admin/email-templates/[id]`

### Editor pages (`/admin/email-templates/new` and `/admin/email-templates/[id]/edit`)
- **Name**: text input (slug, e.g. `welcome`) — disabled on edit
- **Subject**: text input with `{{variable}}` support
- **Body**: Tiptap rich text editor — outputs HTML stored in `body` field
- **Variables panel**: auto-detected from `{{varName}}` occurrences in subject + body (read-only display)
- **isActive**: toggle checkbox
- Save → POST (new) or PUT (edit) to existing admin API endpoints

### Tiptap editor (`template-editor.tsx`)
- `"use client"` — no SSR concerns
- Dependencies: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`
- Toolbar: Bold, Italic, H1, H2, Bullet list, Ordered list, Link
- Exposes `value: string` (HTML) and `onChange: (html: string) => void`

---

## AppSettings

Seed upserts `{ key: "admin_notification_email", value: "waweru@kappanetics.com" }` if not already present. Editable from the admin Settings page (currently read-only display — a full settings editor is out of scope for this feature but the value can be changed directly in the DB or via Prisma Studio until then).

---

## Error Handling

- `sendTemplateEmail` catches all errors internally and logs warnings — never throws
- Missing or inactive templates return silently
- All trigger functions are therefore safe to call without try/catch at the call site
- Failed emails never block API responses or cron job completion

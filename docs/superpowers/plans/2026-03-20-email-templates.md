# Email Templates & Event Triggers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire 15 email templates to all lifecycle/transactional events, and give admins a Tiptap rich-text editor to create and edit templates.

**Architecture:** Trigger functions in `lib/email-triggers.ts` call `sendTemplateEmail()` (new helper in `lib/email.ts`) which fetches the template from DB, renders `{{variables}}`, and calls the existing stub-safe `sendEmail()`. All triggers are fire-and-forget. Admin UI gets full create/edit/delete with a Tiptap editor.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma, node-cron, Tiptap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`), Resend (stub-safe until API key is set)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `lib/email.ts` | Modify | Add `sendTemplateEmail`; remove hardcoded `sendInvoiceEmail`, `sendOverdueEmail` |
| `lib/email-triggers.ts` | Create | One exported function per event |
| `lib/cron.ts` | Modify | Rewire overdue/expiry; add nudge job; fix subscription expiry to `findMany` first |
| `prisma/seed.ts` | Modify | Upsert 11 new templates + `admin_notification_email` app setting |
| `app/api/register/route.ts` | Modify | Call `triggerWelcomeEmail` after user creation |
| `app/api/customers/route.ts` | Modify | Call `triggerCustomerCreatedEmail` after customer creation |
| `app/api/payment/verify/route.ts` | Modify | Call `triggerPaymentReceivedEmail` + `triggerPaymentNotifyEmail` |
| `app/api/subscription/route.ts` | Modify | Call `triggerProUpgradedEmail` on verify_upgrade |
| `app/api/documents/[id]/send/route.ts` | Create | Mark document SENT, fire invoice/quote sent trigger |
| `app/admin/(protected)/email-templates/page.tsx` | Modify | Add New/Edit/Delete actions |
| `app/admin/(protected)/email-templates/template-actions.tsx` | Create | Client component for Edit/Delete buttons per row |
| `app/admin/(protected)/email-templates/template-editor.tsx` | Create | Tiptap rich-text client component |
| `app/admin/(protected)/email-templates/new/page.tsx` | Create | Create template page |
| `app/admin/(protected)/email-templates/[id]/edit/page.tsx` | Create | Edit template page |

---

### Task 1: Install Tiptap dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
cd "c:/Users/kenneth.wamunyu/Desktop/Wawesh/DocDime"
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link
```

Expected: packages added to `dependencies` in `package.json`

- [ ] **Step 2: Verify install**

```bash
grep -E "@tiptap" package.json
```

Expected output contains all three: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Tiptap rich-text editor dependencies"
```

---

### Task 2: Add `sendTemplateEmail` to `lib/email.ts`

**Files:**
- Modify: `lib/email.ts`

> ⚠️ **IMPORTANT — do NOT commit `lib/email.ts` alone.** Removing `sendInvoiceEmail`/`sendOverdueEmail` here will break `lib/cron.ts` which still imports them. Hold the `lib/email.ts` change and commit it **together with `lib/cron.ts`** at the end of Task 5.

Remove the two hardcoded HTML functions (`sendInvoiceEmail`, `sendOverdueEmail`) and add the `sendTemplateEmail` helper. The existing `sendEmail` and `renderTemplate` exports stay unchanged.

- [ ] **Step 1: Replace `lib/email.ts` with updated version**

```typescript
// lib/email.ts
// Email service using Resend
// Stub: ready to activate when RESEND_API_KEY is set

import { prisma } from "./prisma";

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey === "re_your_resend_api_key") {
    console.log("[Email Stub] Would send email:", {
      to: options.to,
      subject: options.subject,
    });
    return { success: true };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    const from = options.from ?? "DocDime <noreply@docdime.com>";
    const to = Array.isArray(options.to) ? options.to : [options.to];

    const result = await resend.emails.send({ from, to, subject: options.subject, html: options.html });

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("[Email] Send error:", error);
    return { success: false, error: "Failed to send email" };
  }
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] ?? match);
}

/**
 * Fetch a template from DB by name, render variables, and send.
 * Returns silently if template is missing, inactive, or send fails.
 * Never throws — safe to call without try/catch.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string | string[],
  vars: Record<string, string>
): Promise<void> {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { name: templateName },
    });
    if (!template || !template.isActive) return;

    const subject = renderTemplate(template.subject, vars);
    const html = renderTemplate(template.body, vars);

    await sendEmail({ to, subject, html });
  } catch (error) {
    console.warn(`[Email] sendTemplateEmail("${templateName}") failed:`, error);
  }
}
```

- [ ] **Step 2: Stage but do NOT commit yet**

```bash
cd "c:/Users/kenneth.wamunyu/Desktop/Wawesh/DocDime"
git add lib/email.ts
```

> ⚠️ Do not commit. The commit happens at the end of Task 5 together with `lib/cron.ts`.

---

### Task 3: Create `lib/email-triggers.ts`

**Files:**
- Create: `lib/email-triggers.ts`

One exported function per event. All are fire-and-forget — they rely on `sendTemplateEmail` to catch errors internally.

- [ ] **Step 1: Create the file**

```typescript
// lib/email-triggers.ts
import { prisma } from "./prisma";
import { sendTemplateEmail } from "./email";
import { formatCurrency, formatDate } from "./utils";

async function getAdminNotificationEmail(): Promise<string | null> {
  const setting = await prisma.appSettings.findUnique({
    where: { key: "admin_notification_email" },
  });
  return setting?.value ?? null;
}

export async function triggerWelcomeEmail(user: {
  email: string;
  name: string | null;
}) {
  await sendTemplateEmail("welcome", user.email, {
    name: user.name ?? user.email,
    email: user.email,
  });
}

export async function triggerNudgeEmail(
  user: { email: string; name: string | null },
  days: 3 | 7 | 14 | 21 | 30
) {
  await sendTemplateEmail(`nudge_${days}day`, user.email, {
    name: user.name ?? user.email,
  });
}

export async function triggerProUpgradedEmail(user: {
  email: string;
  name: string | null;
  proExpiresAt: Date | null;
}) {
  await sendTemplateEmail("pro_upgraded", user.email, {
    name: user.name ?? user.email,
    expiresAt: user.proExpiresAt ? formatDate(user.proExpiresAt) : "—",
  });
}

export async function triggerProExpiredEmail(user: {
  email: string;
  name: string | null;
}) {
  await sendTemplateEmail("pro_expired", user.email, {
    name: user.name ?? user.email,
  });
}

export async function triggerPaymentReceivedEmail(
  user: { email: string; name: string | null },
  docNumber: string,
  amount: number,
  currency: string
) {
  await sendTemplateEmail("payment_received", user.email, {
    name: user.name ?? user.email,
    docNumber,
    amount: formatCurrency(amount, currency),
  });
}

export async function triggerPaymentNotifyEmail(
  user: { email: string; name: string | null },
  docNumber: string,
  amount: number,
  currency: string
) {
  const adminEmail = await getAdminNotificationEmail();
  if (!adminEmail) return;
  await sendTemplateEmail("payment_received_notify", adminEmail, {
    userName: user.name ?? user.email,
    userEmail: user.email,
    docNumber,
    amount: formatCurrency(amount, currency),
  });
}

export async function triggerCustomerCreatedEmail(
  userId: string,
  customer: { name: string; email: string | null }
) {
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

export async function triggerInvoiceSentEmail(
  doc: {
    docNumber: string;
    total: number;
    currency: string;
    dueDate: Date | null;
    pdfUrl: string | null;
  },
  user: { businessName: string | null; name: string | null },
  customer: { email: string | null; name: string }
) {
  if (!customer.email) return;
  await sendTemplateEmail("invoice_sent", customer.email, {
    docNumber: doc.docNumber,
    businessName: user.businessName ?? user.name ?? "—",
    customerName: customer.name,
    amount: formatCurrency(doc.total, doc.currency),
    dueDate: doc.dueDate ? formatDate(doc.dueDate) : "—",
    pdfUrl: doc.pdfUrl ?? "",
  });
}

export async function triggerQuoteSentEmail(
  doc: {
    docNumber: string;
    total: number;
    currency: string;
    expiryDate: Date | null;
    pdfUrl: string | null;
  },
  user: { businessName: string | null; name: string | null },
  customer: { email: string | null; name: string }
) {
  if (!customer.email) return;
  await sendTemplateEmail("quote_sent", customer.email, {
    docNumber: doc.docNumber,
    businessName: user.businessName ?? user.name ?? "—",
    customerName: customer.name,
    amount: formatCurrency(doc.total, doc.currency),
    expiryDate: doc.expiryDate ? formatDate(doc.expiryDate) : "—",
    pdfUrl: doc.pdfUrl ?? "",
  });
}

export async function triggerInvoiceOverdueEmail(
  doc: { docNumber: string; total: number; currency: string },
  user: { businessName: string | null; name: string | null },
  customer: { email: string; name: string }
) {
  await sendTemplateEmail("invoice_overdue", customer.email, {
    docNumber: doc.docNumber,
    businessName: user.businessName ?? user.name ?? "—",
    customerName: customer.name,
    amount: formatCurrency(doc.total, doc.currency),
  });
}

export async function triggerQuoteExpiringEmail(
  doc: {
    docNumber: string;
    total: number;
    currency: string;
    expiryDate: Date | null;
  },
  user: { businessName: string | null; name: string | null },
  customer: { email: string | null; name: string }
) {
  if (!customer.email) return;
  await sendTemplateEmail("quote_expiring", customer.email, {
    docNumber: doc.docNumber,
    businessName: user.businessName ?? user.name ?? "—",
    customerName: customer.name,
    amount: formatCurrency(doc.total, doc.currency),
    expiryDate: doc.expiryDate ? formatDate(doc.expiryDate) : "—",
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/email-triggers.ts
git commit -m "feat: add email trigger functions for all events"
```

---

### Task 4: Update `prisma/seed.ts` — add 11 templates + admin email setting

**Files:**
- Modify: `prisma/seed.ts`

Add 11 new template upserts after the existing 4, and add `admin_notification_email` to the settings block. Existing templates get their `variables` arrays updated to include `pdfUrl` where applicable (via the `update` field in upsert).

- [ ] **Step 1: Replace the templates array and settings in `prisma/seed.ts`**

Replace the existing `templates` array (lines 26–51) and the `settings` array (lines 64–71) with the following:

```typescript
  // Update existing templates to add pdfUrl variable where applicable
  await prisma.emailTemplate.upsert({
    where: { name: "invoice_sent" },
    update: { variables: ["docNumber", "businessName", "customerName", "amount", "dueDate", "pdfUrl"] },
    create: {
      name: "invoice_sent",
      subject: "Invoice {{docNumber}} from {{businessName}}",
      body: "<p>Dear {{customerName}},</p><p>Please find your Invoice <strong>{{docNumber}}</strong> for <strong>{{amount}}</strong>.</p><p><strong>Due Date:</strong> {{dueDate}}</p>{{pdfUrl}}<p>Thank you for your business.</p><p>{{businessName}}</p>",
      variables: ["docNumber", "businessName", "customerName", "amount", "dueDate", "pdfUrl"],
    },
  });

  await prisma.emailTemplate.upsert({
    where: { name: "invoice_overdue" },
    update: {},
    create: {
      name: "invoice_overdue",
      subject: "Overdue Invoice {{docNumber}} - Action Required",
      body: "<p>Dear {{customerName}},</p><p>Invoice <strong>{{docNumber}}</strong> for <strong>{{amount}}</strong> is now <strong>overdue</strong>.</p><p>Please make payment at your earliest convenience.</p><p>{{businessName}}</p>",
      variables: ["docNumber", "businessName", "customerName", "amount"],
    },
  });

  await prisma.emailTemplate.upsert({
    where: { name: "quote_sent" },
    update: { variables: ["docNumber", "businessName", "customerName", "amount", "expiryDate", "pdfUrl"] },
    create: {
      name: "quote_sent",
      subject: "Quote {{docNumber}} from {{businessName}}",
      body: "<p>Dear {{customerName}},</p><p>Please find your Quote <strong>{{docNumber}}</strong> for <strong>{{amount}}</strong>.</p><p><strong>Valid until:</strong> {{expiryDate}}</p>{{pdfUrl}}<p>{{businessName}}</p>",
      variables: ["docNumber", "businessName", "customerName", "amount", "expiryDate", "pdfUrl"],
    },
  });

  await prisma.emailTemplate.upsert({
    where: { name: "quote_expiring" },
    update: {},
    create: {
      name: "quote_expiring",
      subject: "Quote {{docNumber}} Expiring Soon",
      body: "<p>Dear {{customerName}},</p><p>Your quote <strong>{{docNumber}}</strong> for <strong>{{amount}}</strong> expires on <strong>{{expiryDate}}</strong>.</p><p>Please respond before the expiry date.</p><p>{{businessName}}</p>",
      variables: ["docNumber", "businessName", "customerName", "amount", "expiryDate"],
    },
  });

  // New templates
  const newTemplates = [
    {
      name: "welcome",
      subject: "Welcome to DocDime, {{name}}!",
      body: "<p>Hi {{name}},</p><p>Welcome to DocDime! You can now create professional invoices, quotes, and purchase orders in seconds.</p><p>Get started by creating your first document.</p><p>The DocDime Team</p>",
      variables: ["name", "email"],
    },
    {
      name: "nudge_3day",
      subject: "Your first document is waiting, {{name}}",
      body: "<p>Hi {{name}},</p><p>You signed up 3 days ago but haven't created a document yet.</p><p>It only takes a minute to create your first invoice or quote. Give it a try!</p><p>The DocDime Team</p>",
      variables: ["name"],
    },
    {
      name: "nudge_7day",
      subject: "Still here for you, {{name}}",
      body: "<p>Hi {{name}},</p><p>A week has passed and we'd love to see you create your first document on DocDime.</p><p>The DocDime Team</p>",
      variables: ["name"],
    },
    {
      name: "nudge_14day",
      subject: "DocDime tip: Create your first document",
      body: "<p>Hi {{name}},</p><p>You've had DocDime for 2 weeks. Creating a professional invoice takes less than 2 minutes.</p><p>The DocDime Team</p>",
      variables: ["name"],
    },
    {
      name: "nudge_21day",
      subject: "We miss you, {{name}}",
      body: "<p>Hi {{name}},</p><p>It's been 21 days — we're still here whenever you're ready to send your first invoice or quote.</p><p>The DocDime Team</p>",
      variables: ["name"],
    },
    {
      name: "nudge_30day",
      subject: "Last check-in from DocDime",
      body: "<p>Hi {{name}},</p><p>It's been 30 days since you signed up. We just wanted to check in — DocDime is ready whenever you are.</p><p>The DocDime Team</p>",
      variables: ["name"],
    },
    {
      name: "pro_upgraded",
      subject: "You're now on DocDime Pro!",
      body: "<p>Hi {{name}},</p><p>Your Pro subscription is now active. You get 20 free documents per month until <strong>{{expiresAt}}</strong>.</p><p>The DocDime Team</p>",
      variables: ["name", "expiresAt"],
    },
    {
      name: "pro_expired",
      subject: "Your DocDime Pro subscription has expired",
      body: "<p>Hi {{name}},</p><p>Your Pro subscription has expired and your account has been moved to Pay Per Use ($0.10/document).</p><p>You can renew at any time from your subscription page.</p><p>The DocDime Team</p>",
      variables: ["name"],
    },
    {
      name: "payment_received",
      subject: "Payment confirmed — {{docNumber}}",
      body: "<p>Hi {{name}},</p><p>We've received your payment of <strong>{{amount}}</strong> for document <strong>{{docNumber}}</strong>.</p><p>Your PDF is ready to download from your dashboard.</p><p>The DocDime Team</p>",
      variables: ["name", "docNumber", "amount"],
    },
    {
      name: "payment_received_notify",
      subject: "New payment received — {{docNumber}}",
      body: "<p>A payment has been received on DocDime.</p><ul><li><strong>User:</strong> {{userName}} ({{userEmail}})</li><li><strong>Document:</strong> {{docNumber}}</li><li><strong>Amount:</strong> {{amount}}</li></ul>",
      variables: ["userName", "userEmail", "docNumber", "amount"],
    },
    {
      name: "customer_created",
      subject: "New customer added — {{customerName}}",
      body: "<p>A new customer has been added on DocDime.</p><ul><li><strong>Customer:</strong> {{customerName}}</li><li><strong>Email:</strong> {{customerEmail}}</li><li><strong>Added by:</strong> {{userName}} ({{businessName}})</li></ul>",
      variables: ["customerName", "customerEmail", "businessName", "userName"],
    },
  ];

  for (const template of newTemplates) {
    await prisma.emailTemplate.upsert({
      where: { name: template.name },
      update: {},
      create: template,
    });
  }

  console.log("✅ Email templates seeded");

  // Seed default app settings
  const settings = [
    { key: "doc_price_usd", value: "0.10" },
    { key: "pro_price_usd", value: "2" },
    { key: "pro_annual_price_usd", value: "20" },
    { key: "pro_monthly_docs", value: "20" },
    { key: "maintenance_mode", value: "false" },
    { key: "admin_notification_email", value: "waweru@kappanetics.com" },
  ];

  for (const setting of settings) {
    await prisma.appSettings.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log("✅ App settings seeded");
  console.log("\n🎉 Seed complete!");
  console.log("Admin login: admin@docdime.com / Admin@123456");
  console.log("⚠️  Please change the admin password after first login!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Run the seed to verify it works locally**

```bash
cd "c:/Users/kenneth.wamunyu/Desktop/Wawesh/DocDime"
npx tsx prisma/seed.ts
```

Expected output ends with `🎉 Seed complete!` and `✅ Email templates seeded`

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: seed 11 new email templates and admin_notification_email setting"
```

---

### Task 5: Update `lib/cron.ts` — rewire all jobs

**Files:**
- Modify: `lib/cron.ts`

Four changes:
1. Import trigger functions
2. Replace `sendOverdueEmail()` with `triggerInvoiceOverdueEmail()`
3. Replace empty quote expiry log with `triggerQuoteExpiringEmail()`
4. Fix subscription expiry to `findMany` first, then fire `triggerProExpiredEmail` per user
5. Add daily 11am nudge job

- [ ] **Step 1: Replace `lib/cron.ts` entirely**

```typescript
import cron from "node-cron";
import { prisma } from "./prisma";
import {
  triggerInvoiceOverdueEmail,
  triggerQuoteExpiringEmail,
  triggerProExpiredEmail,
  triggerNudgeEmail,
} from "./email-triggers";

let initialized = false;

export function startCronJobs() {
  if (initialized) return;
  initialized = true;

  console.log("[Cron] Starting scheduled jobs...");

  // Daily at 8am: Check overdue invoices and send emails
  cron.schedule("0 8 * * *", async () => {
    console.log("[Cron] Checking overdue invoices...");
    try {
      const overdueInvoices = await prisma.document.findMany({
        where: {
          type: "INVOICE",
          status: { in: ["DRAFT", "SENT"] },
          dueDate: { lt: new Date() },
          paid: false,
        },
        include: { user: true, customer: true },
      });

      for (const invoice of overdueInvoices) {
        if (invoice.customer?.email) {
          await triggerInvoiceOverdueEmail(
            { docNumber: invoice.docNumber, total: invoice.total, currency: invoice.currency },
            { businessName: invoice.user.businessName, name: invoice.user.name },
            { email: invoice.customer.email, name: invoice.customer.name }
          );
        }
      }

      console.log(`[Cron] Processed ${overdueInvoices.length} overdue invoices`);
    } catch (error) {
      console.error("[Cron] Overdue check error:", error);
    }
  });

  // Daily at 9am: Check quote expiry (7-day warning)
  cron.schedule("0 9 * * *", async () => {
    console.log("[Cron] Checking quote expiry...");
    try {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const expiringQuotes = await prisma.document.findMany({
        where: {
          type: "QUOTE",
          status: { in: ["DRAFT", "SENT"] },
          expiryDate: { gte: new Date(), lte: sevenDaysFromNow },
        },
        include: { user: true, customer: true },
      });

      for (const quote of expiringQuotes) {
        await triggerQuoteExpiringEmail(
          { docNumber: quote.docNumber, total: quote.total, currency: quote.currency, expiryDate: quote.expiryDate },
          { businessName: quote.user.businessName, name: quote.user.name },
          { email: quote.customer?.email ?? null, name: quote.customer?.name ?? "Customer" }
        );
      }

      console.log(`[Cron] Processed ${expiringQuotes.length} expiring quotes`);
    } catch (error) {
      console.error("[Cron] Quote expiry check error:", error);
    }
  });

  // Monthly: Reset doc count for PRO users
  cron.schedule("0 0 1 * *", async () => {
    console.log("[Cron] Resetting monthly doc counts...");
    try {
      await prisma.user.updateMany({
        where: { plan: "PRO" },
        data: { docsThisMonth: 0, lastDocReset: new Date() },
      });
      console.log("[Cron] Monthly reset complete");
    } catch (error) {
      console.error("[Cron] Monthly reset error:", error);
    }
  });

  // Daily at 10am: Downgrade expired PRO subscriptions + notify users
  cron.schedule("0 10 * * *", async () => {
    console.log("[Cron] Checking subscription expiry...");
    try {
      const now = new Date();

      // Fetch first so we have user details for the email
      const expiredUsers = await prisma.user.findMany({
        where: { plan: "PRO", proExpiresAt: { lt: now } },
      });

      if (expiredUsers.length > 0) {
        await prisma.user.updateMany({
          where: { plan: "PRO", proExpiresAt: { lt: now } },
          data: { plan: "PAY_PER_USE", docsThisMonth: 0 },
        });

        for (const user of expiredUsers) {
          await triggerProExpiredEmail({ email: user.email, name: user.name });
        }

        console.log(`[Cron] Downgraded ${expiredUsers.length} expired PRO subscriptions`);
      }
    } catch (error) {
      console.error("[Cron] Subscription expiry check error:", error);
    }
  });

  // Daily at 11am: Nudge users who signed up N days ago with no documents
  cron.schedule("0 11 * * *", async () => {
    console.log("[Cron] Checking nudge emails...");
    try {
      const now = new Date();

      for (const days of [3, 7, 14, 21, 30] as const) {
        // startOfDay helpers (no external dependency)
        const start = new Date(now);
        start.setDate(start.getDate() - days);
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        const users = await prisma.user.findMany({
          where: {
            isAdmin: false,
            createdAt: { gte: start, lt: end },
            documents: { none: {} },
          },
        });

        for (const user of users) {
          await triggerNudgeEmail({ email: user.email, name: user.name }, days);
        }

        if (users.length > 0) {
          console.log(`[Cron] Sent ${days}-day nudge to ${users.length} users`);
        }
      }
    } catch (error) {
      console.error("[Cron] Nudge check error:", error);
    }
  });

  console.log("[Cron] All jobs scheduled");
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 3: Commit both `lib/email.ts` and `lib/cron.ts` together**

Both files must be committed atomically — `email.ts` removes the hardcoded functions that `cron.ts` used to import.

```bash
git add lib/email.ts lib/cron.ts
git commit -m "feat: sendTemplateEmail helper + rewire cron to DB templates, add nudge job"
```

---

### Task 6: Wire trigger call points

**Files:**
- Modify: `app/api/register/route.ts`
- Modify: `app/api/customers/route.ts`
- Modify: `app/api/payment/verify/route.ts`
- Modify: `app/api/subscription/route.ts`

- [ ] **Step 1: Add welcome email to `app/api/register/route.ts`**

After `const user = await prisma.user.create(...)` and before the `return NextResponse.json(...)`, add:

```typescript
import { triggerWelcomeEmail } from "@/lib/email-triggers";

// inside POST, after user is created:
triggerWelcomeEmail({ email: user.email, name: user.name }).catch(() => {});
```

The full updated POST handler:

```typescript
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { triggerWelcomeEmail } from "@/lib/email-triggers";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, password: hashed },
    });

    triggerWelcomeEmail({ email: user.email, name: user.name }).catch(() => {});

    return NextResponse.json(
      { success: true, data: { id: user.id, email: user.email } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Register]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add customer notification to `app/api/customers/route.ts`**

After `const customer = await prisma.customer.create(...)` and before the return:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { triggerCustomerCreatedEmail } from "@/lib/email-triggers";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const customers = await prisma.customer.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: customers });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, email, phone, address } = await req.json();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const customer = await prisma.customer.create({
      data: { userId: session.user.id, name, email, phone, address },
    });

    triggerCustomerCreatedEmail(session.user.id, { name: customer.name, email: customer.email }).catch(() => {});

    return NextResponse.json({ success: true, data: customer }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Add payment triggers to `app/api/payment/verify/route.ts`**

After `const updated = await prisma.document.update(...)` and before the return:

```typescript
import { triggerPaymentReceivedEmail, triggerPaymentNotifyEmail } from "@/lib/email-triggers";

// After document update, before return:
triggerPaymentReceivedEmail(
  { email: user.email, name: user.name },
  doc.docNumber,
  doc.total,
  doc.currency
).catch(() => {});

triggerPaymentNotifyEmail(
  { email: user.email, name: user.name },
  doc.docNumber,
  doc.total,
  doc.currency
).catch(() => {});
```

The full updated file — add the import at the top and two trigger calls before `return NextResponse.json({ success: true, data: updated })`:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { verifyPayment } from "@/lib/paystack";
import { generatePDF } from "@/lib/pdf";
import { uploadPDF, getPDFKey } from "@/lib/s3";
import { Buffer } from "buffer";
import { triggerPaymentReceivedEmail, triggerPaymentNotifyEmail } from "@/lib/email-triggers";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { reference, documentId } = await req.json();
    if (!reference || !documentId) {
      return NextResponse.json({ error: "Reference and document ID required" }, { status: 400 });
    }

    const paymentData = await verifyPayment(reference);

    if (paymentData.status !== "success") {
      await prisma.transaction.updateMany({
        where: { paystackRef: reference },
        data: { status: "FAILED" },
      });
      return NextResponse.json({ error: "Payment not successful" }, { status: 400 });
    }

    await prisma.transaction.updateMany({
      where: { paystackRef: reference },
      data: { status: "SUCCESS" },
    });

    const doc = await prisma.document.findFirst({
      where: { id: documentId, userId: session.user.id },
      include: { customer: true, lineItems: true },
    });

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const pdfBytes = await generatePDF({
      documentId: documentId,
      docNumber: doc.docNumber,
      type: doc.type,
      issueDate: doc.issueDate.toISOString(),
      dueDate: doc.dueDate?.toISOString(),
      expiryDate: doc.expiryDate?.toISOString(),
      businessName: user.businessName ?? user.name ?? "Business",
      businessEmail: user.businessEmail ?? undefined,
      businessPhone: user.businessPhone ?? undefined,
      businessAddress: user.businessAddress ?? undefined,
      customerName: doc.customer?.name,
      customerEmail: doc.customer?.email ?? undefined,
      customerAddress: doc.customer?.address ?? undefined,
      lineItems: doc.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        total: item.total,
      })),
      subtotal: doc.subtotal,
      taxAmount: doc.taxAmount,
      total: doc.total,
      currency: doc.currency,
      notes: doc.notes ?? undefined,
      terms: doc.terms ?? undefined,
      bankingDetails: (user.bankingDetails as Record<string, string>) ?? undefined,
    });

    const key = getPDFKey(session.user.id, doc.docNumber);
    const pdfUrl = await uploadPDF(key, Buffer.from(pdfBytes));

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: { pdfUrl },
    });

    triggerPaymentReceivedEmail(
      { email: user.email, name: user.name },
      doc.docNumber,
      doc.total,
      doc.currency
    ).catch(() => {});

    triggerPaymentNotifyEmail(
      { email: user.email, name: user.name },
      doc.docNumber,
      doc.total,
      doc.currency
    ).catch(() => {});

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[Payment Verify]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Add PRO upgrade trigger to `app/api/subscription/route.ts`**

In the `verify_upgrade` block, after `await prisma.user.update(...)`, add:

```typescript
import { triggerProUpgradedEmail } from "@/lib/email-triggers";

// after user.update in verify_upgrade block:
const updatedUser = await prisma.user.findUnique({ where: { id: session.user.id } });
if (updatedUser) {
  triggerProUpgradedEmail({
    email: updatedUser.email,
    name: updatedUser.name,
    proExpiresAt: updatedUser.proExpiresAt,
  }).catch(() => {});
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/api/register/route.ts app/api/customers/route.ts app/api/payment/verify/route.ts app/api/subscription/route.ts
git commit -m "feat: wire email triggers to register, customers, payment, subscription"
```

---

### Task 7: Create `app/api/documents/[id]/send/route.ts`

**Files:**
- Create: `app/api/documents/[id]/send/route.ts`

POST endpoint: marks document status as SENT, fires invoice or quote sent trigger.

- [ ] **Step 1: Create the route**

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { triggerInvoiceSentEmail, triggerQuoteSentEmail } from "@/lib/email-triggers";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const doc = await prisma.document.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: { customer: true },
    });

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const updated = await prisma.document.update({
      where: { id: params.id },
      data: { status: "SENT" },
    });

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user && doc.customer) {
      if (doc.type === "INVOICE") {
        triggerInvoiceSentEmail(
          { docNumber: doc.docNumber, total: doc.total, currency: doc.currency, dueDate: doc.dueDate, pdfUrl: doc.pdfUrl },
          { businessName: user.businessName, name: user.name },
          { email: doc.customer.email, name: doc.customer.name }
        ).catch(() => {});
      } else if (doc.type === "QUOTE") {
        triggerQuoteSentEmail(
          { docNumber: doc.docNumber, total: doc.total, currency: doc.currency, expiryDate: doc.expiryDate, pdfUrl: doc.pdfUrl },
          { businessName: user.businessName, name: user.name },
          { email: doc.customer.email, name: doc.customer.name }
        ).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[Document Send]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add "app/api/documents/[id]/send/route.ts"
git commit -m "feat: add document send endpoint with invoice/quote email triggers"
```

---

### Task 8: Create `template-editor.tsx` (Tiptap client component)

**Files:**
- Create: `app/admin/(protected)/email-templates/template-editor.tsx`

- [ ] **Step 1: Create the Tiptap editor component**

```typescript
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect } from "react";

interface TemplateEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export default function TemplateEditor({ value, onChange }: TemplateEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes (e.g. on load)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  if (!editor) return null;

  const btn = (active: boolean) =>
    `px-2 py-1 text-xs rounded border transition-colors ${
      active
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
    }`;

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 bg-gray-50 border-b border-gray-200">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}>Bold</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}>Italic</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btn(editor.isActive("heading", { level: 1 }))}>H1</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>• List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>1. List</button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("URL");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          className={btn(editor.isActive("link"))}
        >
          Link
        </button>
        <button type="button" onClick={() => editor.chain().focus().unsetLink().run()} className="px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Unlink</button>
      </div>
      {/* Editor */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[200px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[180px]"
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(protected)/email-templates/template-editor.tsx"
git commit -m "feat: add Tiptap rich-text editor component for email templates"
```

---

### Task 9: Create New and Edit admin pages

**Files:**
- Create: `app/admin/(protected)/email-templates/new/page.tsx`
- Create: `app/admin/(protected)/email-templates/[id]/edit/page.tsx`

- [ ] **Step 1: Create `new/page.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import TemplateEditor from "../template-editor";
import Link from "next/link";

function detectVariables(subject: string, body: string): string[] {
  const matches = new Set<string>();
  const re = /\{\{(\w+)\}\}/g;
  let m;
  while ((m = re.exec(subject + " " + body))) matches.add(m[1]);
  return Array.from(matches);
}

export default function NewTemplatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", subject: "", body: "", isActive: true });

  const variables = detectVariables(form.subject, form.body);

  async function handleSave() {
    if (!form.name || !form.subject || !form.body) {
      setError("Name, subject, and body are required.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/email-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, variables }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      router.push("/admin/email-templates");
    } else {
      setError(data.error ?? "Failed to save template");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/email-templates" className="text-gray-400 hover:text-gray-600 text-sm">← Back</Link>
        <h1 className="text-2xl font-bold text-gray-900">New Template</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <Card>
        <CardHeader><CardTitle>Template Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Template Name (slug, e.g. welcome)</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="welcome"
            />
          </div>
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Welcome to DocDime, {{name}}!"
            />
          </div>
          <div>
            <Label>Body</Label>
            <TemplateEditor value={form.body} onChange={(html) => setForm({ ...form, body: html })} />
            <p className="text-xs text-gray-400 mt-1">Use {"{{variableName}}"} for dynamic values.</p>
          </div>
          {variables.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Detected variables</p>
              <div className="flex flex-wrap gap-1">
                {variables.map((v) => (
                  <span key={v} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-mono">{`{{${v}}}`}</span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              id="isActive"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <Label htmlFor="isActive">Active (emails will be sent)</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSave} loading={saving}>Save Template</Button>
        <Link href="/admin/email-templates">
          <Button variant="outline" type="button">Cancel</Button>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `[id]/edit/page.tsx`**

```typescript
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import EditTemplateClient from "./edit-client";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const template = await prisma.emailTemplate.findUnique({ where: { id: params.id } });
  if (!template) notFound();
  return <EditTemplateClient template={template} />;
}
```

- [ ] **Step 3: Create `[id]/edit/edit-client.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import TemplateEditor from "../../template-editor";
import Link from "next/link";

function detectVariables(subject: string, body: string): string[] {
  const matches = new Set<string>();
  const re = /\{\{(\w+)\}\}/g;
  let m;
  while ((m = re.exec(subject + " " + body))) matches.add(m[1]);
  return Array.from(matches);
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
}

export default function EditTemplateClient({ template }: { template: Template }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    subject: template.subject,
    body: template.body,
    isActive: template.isActive,
  });

  const variables = detectVariables(form.subject, form.body);

  async function handleSave() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/email-templates/${template.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, variables }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      router.push("/admin/email-templates");
    } else {
      setError(data.error ?? "Failed to save");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/email-templates" className="text-gray-400 hover:text-gray-600 text-sm">← Back</Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Template</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <Card>
        <CardHeader><CardTitle>{template.name}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>
          <div>
            <Label>Body</Label>
            <TemplateEditor value={form.body} onChange={(html) => setForm({ ...form, body: html })} />
            <p className="text-xs text-gray-400 mt-1">Use {"{{variableName}}"} for dynamic values.</p>
          </div>
          {variables.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Detected variables</p>
              <div className="flex flex-wrap gap-1">
                {variables.map((v) => (
                  <span key={v} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-mono">{`{{${v}}}`}</span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              id="isActive"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <Label htmlFor="isActive">Active (emails will be sent)</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSave} loading={saving}>Save Changes</Button>
        <Link href="/admin/email-templates">
          <Button variant="outline" type="button">Cancel</Button>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(protected)/email-templates/new/" "app/admin/(protected)/email-templates/[id]/"
git commit -m "feat: add email template create and edit admin pages"
```

---

### Task 10: Update email-templates list page with actions

**Files:**
- Modify: `app/admin/(protected)/email-templates/page.tsx`
- Create: `app/admin/(protected)/email-templates/template-actions.tsx`

- [ ] **Step 1: Create `template-actions.tsx` client component**

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function TemplateActions({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/admin/email-templates/${id}`, { method: "DELETE" });
    setDeleting(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/admin/email-templates/${id}/edit`}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        Edit
      </Link>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
      >
        {deleting ? "..." : "Delete"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Update `page.tsx` — add New button, Edit/Delete per row**

```typescript
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import TemplateActions from "./template-actions";

export const dynamic = "force-dynamic";

export default async function AdminEmailTemplatesPage() {
  const templates = await prisma.emailTemplate.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
        <Link
          href="/admin/email-templates/new"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New Template
        </Link>
      </div>
      <Card>
        <CardContent className="p-0">
          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {templates.map((t) => (
              <div key={t.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs font-medium text-gray-900">{t.name}</p>
                  <Badge variant={t.isActive ? "success" : "gray"}>
                    {t.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{t.subject}</p>
                <p className="text-xs text-gray-400 truncate">{t.variables.join(", ")}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">{formatDate(t.updatedAt)}</p>
                  <TemplateActions id={t.id} />
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Variables</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Updated</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium font-mono text-xs">{t.name}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{t.subject}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.variables.join(", ")}</td>
                    <td className="px-4 py-3">
                      <Badge variant={t.isActive ? "success" : "gray"}>
                        {t.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(t.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <TemplateActions id={t.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` with no TypeScript errors

- [ ] **Step 5: Commit and push**

```bash
git add "app/admin/(protected)/email-templates/"
git commit -m "feat: email templates admin UI with create/edit/delete and Tiptap editor"
git push origin main
```

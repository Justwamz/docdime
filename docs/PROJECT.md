# DocDime — Project Reference Document

**Last updated:** 2026-03-20
**Status:** Active development

This document is the single source of truth for DocDime's scope, architecture, and implementation status. Update it whenever a significant feature is completed, changed, or descoped.

---

## 1. Product Overview

DocDime helps businesses create professional Invoices, Quotes, and Purchase Orders with two pricing models:

| Tier | Price | Features |
|------|-------|----------|
| Pay-per-document | $0.11 / document | Subtle security watermark, full feature access |
| Pro | $1/month ($12/year) | No watermarks, 20 free documents/month, overages at $0.11 |

**Security feature:** Before payment, all header information (logo, business details, customer info, document number) is hidden in the preview. Only line items are visible. This prevents unpaid screenshot abuse.

---

## 2. Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 App Router + SSR |
| Language | TypeScript (strict throughout) |
| Styling | Tailwind CSS, Poppins font |
| ORM | Prisma v5 + PostgreSQL |
| Auth | NextAuth.js v4 (JWT + Credentials) |
| Payments | Paystack (per-doc + subscriptions) |
| Storage | AWS S3 (PDFs + logos) |
| Email | Resend |
| PDF | pdf-lib |
| Jobs | node-cron |
| Deployment | Render (Frankfurt region) |

---

## 3. URL Structure

### Customer-facing
| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/signup` | User registration |
| `/login` | User login |
| `/reset-password` | Password reset |
| `/onboarding` | Post-signup: country, business name, phone, consent |
| `/dashboard` | User dashboard |
| `/dashboard/settings` | Business profile + banking details |
| `/dashboard/customers` | Customer CRUD |
| `/dashboard/taxes` | Tax configuration + Tax Groups |
| `/dashboard/documents` | Document list |
| `/dashboard/documents/new` | Create new document |
| `/dashboard/documents/[id]` | Document detail + actions |
| `/dashboard/subscription` | Plan management |
| `/dashboard/tutorials` | Tutorial library |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |

### Admin
| Route | Description |
|-------|-------------|
| `/admin/login` | Admin login |
| `/admin/dashboard` | Overview metrics |
| `/admin/users` | User management |
| `/admin/transactions` | Transaction monitoring |
| `/admin/analytics` | Document analytics |
| `/admin/email-templates` | Email template creator |
| `/admin/settings` | Paystack config, pricing |

---

## 4. Database Schema

### Current schema (as implemented)

```prisma
model User {
  id                  String       @id @default(cuid())
  email               String       @unique
  password            String
  name                String?
  businessName        String?
  businessEmail       String?
  businessPhone       String?
  businessAddress     String?
  businessLogo        String?      // S3 public URL (PNG/JPEG only)
  country             String?
  currency            String       @default("USD")
  bankingDetails      Json?
  plan                String       @default("FREE")
  subscriptionStatus  String       @default("INACTIVE")
  subscriptionEnds    DateTime?
  docsThisMonth       Int          @default(0)
  isAdmin             Boolean      @default(false)
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  customers     Customer[]
  documents     Document[]
  taxes         Tax[]
  taxGroups     TaxGroup[]
  transactions  Transaction[]
  appSettings   AppSettings[]
}

model Customer {
  id        String     @id @default(cuid())
  userId    String
  user      User       @relation(...)
  name      String
  email     String?
  phone     String?
  address   String?
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt

  documents Document[]
}

model Tax {
  id            String         @id @default(cuid())
  userId        String
  user          User           @relation(...)
  name          String
  rate          Float
  isDefault     Boolean        @default(false)
  isInclusive   Boolean        @default(false)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  taxGroupItems TaxGroupItem[]
}

model TaxGroup {
  id        String         @id @default(cuid())
  userId    String
  user      User           @relation(...)
  name      String
  isDefault Boolean        @default(false)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  items     TaxGroupItem[]
}

model TaxGroupItem {
  id         String   @id @default(cuid())
  groupId    String
  group      TaxGroup @relation(...)
  taxId      String
  tax        Tax      @relation(... onDelete: Restrict)
  order      Int
  isCompound Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([groupId, order])
  @@unique([groupId, taxId])
}

model Document {
  id            String     @id @default(cuid())
  userId        String
  user          User       @relation(...)
  customerId    String?
  customer      Customer?  @relation(...)
  type          String     // INVOICE | QUOTE | PURCHASE_ORDER
  docNumber     String
  status        String     @default("DRAFT")
  issueDate     DateTime
  dueDate       DateTime?
  expiryDate    DateTime?
  subtotal      Float
  taxAmount     Float
  total         Float
  currency      String     @default("USD")
  notes         String?
  terms         String?
  pdfUrl        String?
  paid          Boolean    @default(false)
  convertedFromId String?
  convertedToId   String?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  lineItems     LineItem[]
}

model LineItem {
  id           String   @id @default(cuid())
  documentId   String
  document     Document @relation(...)
  description  String
  quantity     Float
  unitPrice    Float
  taxRate      Float    @default(0)
  appliedTaxes Json?    // AppliedTaxSnapshot (see §6 Tax System)
  total        Float
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Transaction {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(...)
  documentId String?
  amount    Float
  currency  String   @default("USD")
  status    String
  reference String   @unique
  type      String   // document | subscription
  createdAt DateTime @default(now())
}

model EmailTemplate {
  id          String   @id @default(cuid())
  name        String
  eventType   String
  subject     String
  bodyHtml    String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model AppSettings {
  id        String   @id @default(cuid())
  userId    String
  key       String
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Deviations from original spec

| Original | Implemented | Reason |
|----------|-------------|--------|
| Separate `BusinessProfile` model | Fields merged into `User` | Simpler for v1; refactor when profile fields grow |
| `Tax.type` enum (EXCLUSIVE/INCLUSIVE/COMPOUND) | `Tax.isInclusive Boolean` + Tax Groups system | See §6 — Tax Groups is a superior design |
| `DocumentItem.taxId` FK | `LineItem.appliedTaxes Json` snapshot | Snapshot preserves tax values at document creation time |
| Country-specific banking validation fields | Single `bankingDetails Json` + UI validation | Flexible; avoids schema migration per country |
| `DocumentConsent` model | Not yet implemented | Planned for compliance phase |
| `EmailLog`, `EmailPreferences`, `DeletionRequest` models | Not yet implemented | Planned for later phases |

---

## 5. Document Number Format

- Invoices: `INV-001`, `INV-002`, …
- Quotes: `QTE-001`, `QTE-002`, …
- Purchase Orders: `PO-001`, `PO-002`, …

Zero-padded 3 digits, per type per user (not per customer as originally specified — simpler for v1).

---

## 6. Tax System

### Design (implemented 2026-03-19)

The original spec had a single `isCompound` flag on `Tax`. This was replaced with a **Tax Groups** system — the approach used by Xero, QuickBooks, and Wave.

**Individual Tax** — simple building block: name, rate, inclusive/exclusive flag. No compound flag.

**Tax Group** — an ordered collection of taxes where compound behavior is defined per step (not per tax). This correctly handles multi-tax scenarios like Kenya's telecom tax (Excise 15% on base → VAT 16% on base+excise).

**Display labels** are auto-generated: `"VAT 16% (Inclusive)"`, `"Excise Duty 15% (Exclusive)"`. This allows having both inclusive and exclusive variants of the same named tax without ambiguity.

**`isDefault` independence:** `Tax.isDefault` and `TaxGroup.isDefault` are independent. If both are set, the group default takes precedence in the line item selector.

### `AppliedTaxSnapshot` (stored in `LineItem.appliedTaxes`)

```ts
type AppliedTaxSnapshot =
  | { type: "tax"; taxId: string; name: string; rate: number; isInclusive: boolean; amount: number }
  | { type: "group"; groupId: string; groupName: string; items: AppliedTax[] }
```

`readAppliedTaxes()` in `lib/utils.ts` handles legacy `AppliedTax[]` array format for backward compatibility.

### Calculation rules (`computeLineTaxes` in `lib/utils.ts`)

For each step in order:
1. **Inclusive:** `amount = base × rate / (100 + rate)`. Does not add to total.
2. **Exclusive, not compound:** `amount = base × rate / 100`. Adds to `runningExclusiveSum`.
3. **Exclusive, compound:** `amount = (base + runningExclusiveSum) × rate / 100`. Adds to `runningExclusiveSum`.

`totalTax = runningExclusiveSum` (inclusive taxes are extracted from price, not added).

---

## 7. PDF Templates

Three distinct templates (implemented 2026-03-20):

| | Invoice | Quote | Purchase Order |
|---|---|---|---|
| **Accent colour** | Blue | Teal | Indigo |
| **Title** | INVOICE | QUOTATION | PURCHASE ORDER |
| **Customer label** | BILL TO | PREPARED FOR | VENDOR |
| **Total label** | AMOUNT DUE | QUOTE TOTAL | ORDER TOTAL |
| **Due date callout** | ✓ (header) | — | — |
| **Valid Until callout** | — | ✓ (header) | — |
| **Deliver To section** | — | — | ✓ |
| **Payment details** | ✓ Banking info | — | — |
| **Signature line** | — | Acceptance (name + date) | Authorization (name + date) |
| **Footer note** | "Payment due by…" | Validity callout box | "Please supply items…" |

Watermark: `DocDime • {docNumber} • {date}` diagonal across page, opacity 0.25.

Logo: PNG/JPEG only (pdf-lib limitation). Stored as permanent public S3 URL.

PDF download route: `GET /api/documents/[id]/download` — proxies PDF server-side with `Content-Disposition: attachment; filename="INV-001.pdf"`.

---

## 8. API Routes

### Documents
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/documents` | List user's documents |
| POST | `/api/documents` | Create document |
| GET | `/api/documents/[id]` | Get document |
| PUT | `/api/documents/[id]` | Update document / status |
| DELETE | `/api/documents/[id]` | Delete document |
| POST | `/api/documents/[id]/pdf` | Generate / regenerate PDF |
| GET | `/api/documents/[id]/download` | Download PDF with correct filename |
| POST | `/api/documents/[id]/convert` | Convert quote to invoice |

### Taxes
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/taxes` | List user's taxes |
| POST | `/api/taxes` | Create tax |
| PUT | `/api/taxes/[id]` | Update tax |
| DELETE | `/api/taxes/[id]` | Delete tax (409 if used in a group) |

### Tax Groups
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/tax-groups` | List groups with items + tax details embedded |
| POST | `/api/tax-groups` | Create group |
| PUT | `/api/tax-groups/[id]` | Full replace (transaction) |
| DELETE | `/api/tax-groups/[id]` | Delete group (items cascade) |

### Customers
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/customers` | List customers |
| POST | `/api/customers` | Create customer |
| PUT | `/api/customers/[id]` | Update customer |
| DELETE | `/api/customers/[id]` | Delete customer |

### Other
| Route | Description |
|-------|-------------|
| POST `/api/register` | Sign up |
| POST `/api/onboarding` | Complete onboarding |
| GET/PUT `/api/profile` | Business profile + settings |
| POST `/api/upload` | Logo upload (PNG/JPEG, max 5MB) |
| POST `/api/payment/initialize` | Paystack payment init |
| POST `/api/payment/verify` | Paystack payment verify |
| POST `/api/webhooks/paystack` | Paystack webhook handler |
| GET/PUT `/api/subscription` | Subscription management |
| POST `/api/documents/[id]/pdf` | PDF generation + S3 upload |

---

## 9. Authentication

- Provider: NextAuth v4, JWT strategy, Credentials provider
- Admin: `admin@docdime.com` / `Admin@123456` (change on first login)
- Middleware: `/dashboard/*` and `/admin/*` protected; admin routes check `isAdmin` flag
- Post-signup → `/onboarding` → `/dashboard`

---

## 10. File Storage (AWS S3)

| File type | S3 path | URL type |
|-----------|---------|----------|
| PDFs | `pdfs/{userId}/{docNumber}-{timestamp}.pdf` | Presigned URL (7 days) |
| Logos | `logos/{userId}/{timestamp}-{filename}` | Permanent public URL |

**Bucket policy:** `logos/*` must have public read access. Applied automatically on Render build via `scripts/setup-s3.ts`.

**Fallback (S3 not configured):** Files stored as base64 data URLs in the database. Works for development without AWS setup.

---

## 11. Build & Deploy

**Render build command:**
```
npx tsx scripts/setup-s3.ts && prisma db push --accept-data-loss && next build
```

This:
1. Applies S3 bucket policy for logo public reads
2. Syncs Prisma schema to the database
3. Builds the Next.js app

**Environment variables required:**
```
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
PAYSTACK_SECRET_KEY
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_BUCKET_NAME
RESEND_API_KEY
NEXT_PUBLIC_APP_URL
```

---

## 12. Implementation Status

### ✅ Completed

- [x] Next.js 14 App Router scaffold
- [x] Authentication (signup, login, onboarding, password reset)
- [x] Admin dashboard (users, transactions, analytics, email templates, settings)
- [x] Business profile settings (logo upload, banking details, currency)
- [x] Customer management (CRUD)
- [x] Tax configuration with Tax Groups system
- [x] Document creation (Invoice, Quote, PO)
- [x] Document status system (paid, overdue, accepted, cancelled, etc.)
- [x] Quote → Invoice conversion
- [x] Paystack payment integration (per-doc + Pro subscription)
- [x] PDF generation (pdf-lib) — distinct templates per document type
- [x] PDF download with correct document-number filename
- [x] Business logo in PDF
- [x] S3 file storage (PDFs + logos) with local fallback
- [x] Watermark on free-tier PDFs
- [x] Subscription management (Pro plan, 20 docs/month, overages)
- [x] node-cron jobs (overdue checks, expiry warnings, subscription reminders)
- [x] Landing page
- [x] Tutorial section
- [x] Admin email template creator
- [x] Resend email delivery (placeholder connected)
- [x] Responsive design (mobile-first)
- [x] Sitemap + robots.txt
- [x] Render deployment

### 🔲 Planned / Incomplete

- [ ] Email delivery fully wired (templates triggered by events)
- [ ] Email preferences per user (overdue alerts, expiry warnings, marketing opt-out)
- [ ] Account deletion flow with 7-day restore window
- [ ] Download My Data (metadata export)
- [ ] `DocumentConsent` model (GDPR/DPA consent per document)
- [ ] Country-specific banking field validation (currently UI-only, no server validation)
- [ ] Email verification on signup
- [ ] Bulk document operations
- [ ] Full data retention automation (10-year archive, 7-year transaction retention)
- [ ] JSON-LD structured data (SEO)
- [ ] QR code on PDF (verification link)

---

## 13. Out of Scope (V1)

- Email/WhatsApp sharing of documents to customers
- Bulk document operations
- API access for third-party integrations
- Multi-currency conversion / automatic exchange rates
- Refund automation
- Email open/click analytics
- Per-customer document numbering sequences (currently per-user per-type)

---

## 14. Key Design Decisions

### Why Tax Groups instead of per-tax `isCompound`?

The original spec had `isCompound` on the `Tax` model. This was replaced during implementation because compound tax only has meaning relative to other taxes applied in sequence. Moving it to `TaxGroupItem` (the join table) correctly models real-world tax rules (e.g., Kenya telecom: VAT applies to the excise-inclusive subtotal). This matches Xero, QuickBooks, and Wave.

### Why `appliedTaxes` as a JSON snapshot instead of a tax FK on `LineItem`?

Tax rates change over time. A document must permanently reflect the tax rate that was applied when it was created. A foreign key would cause historical documents to reflect updated tax rates. The snapshot freezes the effective rate and amount at document creation time.

### Why merge `BusinessProfile` into `User`?

For v1 there is a 1:1 relationship and merging avoids an extra join on every profile read. Separate model is the right call once the profile grows significantly.

### Why separate `uploadLogo` from `uploadPDF` in `lib/s3.ts`?

PDFs are short-lived (downloaded once, then replaced when regenerated). A 7-day presigned URL is sufficient. Logos are referenced indefinitely in the `User` record and embedded in every PDF. They need a permanent public URL.

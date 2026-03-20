# DocDime: Pricing Update & QR Code Verification — Design Spec

**Date:** 2026-03-20
**Status:** Approved
**Scope:** Pricing changes across all surfaces + QR code in PDFs + public document verification page

---

## 1. Pricing Updates

### New Pricing

| Tier | Old Price | New Price |
|------|-----------|-----------|
| Pay-per-document | $0.11 | $0.10 |
| Pro monthly equivalent | $1/month | $2/month |
| Pro annual | $12/year | $20/year |
| Pro savings callout | — | "save 17% vs monthly" |

**Savings math:** $2/month × 12 = $24/year vs $20/year = $4 saved = 16.7%, displayed as "17%". This is savings on the annual total vs paying monthly.

Pro tier benefits (unchanged): 20 free documents/month, no watermarks.

### Files to Update (13 total)

| File | Change |
|------|--------|
| `app/api/payment/initialize/route.ts` | `DOC_PRICE_USD = 0.10` |
| `app/dashboard/documents/[id]/document-actions.tsx` | Button: `"Generate PDF — $0.10"`; upgrade callout: `"$1/month"` → `"$2/month"` |
| `app/page.tsx` | Landing page pricing section + metadata |
| `app/dashboard/subscription/page.tsx` | Plan cards pricing |
| `app/dashboard/page.tsx` | Any "$1/month" references |
| `app/dashboard/documents/new/page.tsx` | Any pricing copy |
| `app/onboarding/page.tsx` | Any pricing copy |
| `app/terms/page.tsx` | Any pricing references |
| `app/layout.tsx` | Metadata pricing references |
| `components/layout/footer.tsx` | Footer pricing links/copy |
| `components/layout/navbar.tsx` | Nav pricing copy |
| `docs/PROJECT.md` | Documentation |

### Annual Billing Display Format

```
Pro Plan — $2/month
$20/year (save 17% vs monthly)
```

---

## 2. Database Schema

### New Fields and Models

```prisma
// Add to Document model:
verificationCode  String?  @unique @default(cuid())
verification      DocumentVerification?

// New model — summary record (created lazily on first verification visit):
model DocumentVerification {
  id             String   @id @default(cuid())
  documentId     String   @unique
  verifiedCount  Int      @default(0)
  lastVerifiedAt DateTime?
  createdAt      DateTime @default(now())
  document       Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  logs           VerificationLog[]
}

// New model — one row per verification visit (full audit trail):
model VerificationLog {
  id             String   @id @default(cuid())
  verificationId String
  ip             String?
  userAgent      String?
  verifiedAt     DateTime @default(now())
  verification   DocumentVerification @relation(fields: [verificationId], references: [id], onDelete: Cascade)
}
```

### Behavior

- `DocumentVerification` is created lazily on first visit to `/verify/{documentId}`.
- Every visit inserts one `VerificationLog` row (IP + userAgent + timestamp).
- After log insert, upsert the summary: `verifiedCount++`, `lastVerifiedAt = now()`.
- `Document.verificationCode` is a cuid auto-generated on document creation (available for future short-code URL scheme). The QR URL uses `documentId` as specified.
- `verificationCode` is nullable — existing documents safely get `null` (PostgreSQL treats nulls as distinct for unique constraints, so no conflicts).

### Migration

Run `npx prisma db push` after schema changes (no data loss — new nullable fields only).

---

## 3. QR Code in PDFs

### Dependency

- `qrcode` npm package (server-side, no DOM dependency). Generates PNG `Buffer` via `QRCode.toBuffer()`.
- `@types/qrcode` dev dependency.

### Required Environment Variable

`NEXT_PUBLIC_APP_URL` must be set for QR codes to point to the correct verification URL. If unset, the URL will be `"undefined/verify/{id}"` — a silent data quality failure. The implementation must guard against this:

```ts
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
// if appUrl is falsy, skip QR generation and log a warning
```

Add `NEXT_PUBLIC_APP_URL` to the project's required environment variable list (it belongs in `.env` and the deployment config).

### PDF Changes (`lib/pdf.ts`)

1. Add `documentId: string` parameter to `generatePDF()`.
2. At the end of generation (after footer, before `save()`):
   - Guard: if `NEXT_PUBLIC_APP_URL` is not set, skip QR generation entirely.
   - Generate QR PNG: `await QRCode.toBuffer(url, { width: 100, margin: 1 })`
   - URL: `${process.env.NEXT_PUBLIC_APP_URL}/verify/${documentId}`
   - **Wrap in try/catch:** if QR generation fails for any reason, log the error and continue — the PDF is saved without a QR code. This mirrors the existing `embedLogo` error handling pattern in the file.
   - Embed PNG into PDF: 36×36 pt (0.5 inch), bottom-right corner.
   - Coordinates (pdf-lib origin = bottom-left): `x = pageWidth - 10 - 36`, `y = 10`
   - Add label `"Scan to verify"` below the QR: 6pt gray text, centered under the QR at `y ≈ 6`.
   - Note: existing footer content sits at approximately `y = 25–40`. The QR at `y = 10` (bottom of image) to `y = 46` (top of image) may overlap the footer line. Implementor must verify against the actual footer `y` values in `lib/pdf.ts` and adjust the QR `y` upward if needed.

3. Applied to **all** PDFs — both PRO and PAY_PER_USE tiers.

### Callers Updated

| File | Flow | Change |
|------|------|--------|
| `app/api/documents/[id]/pdf/route.ts` | PRO free path (≤20 docs/month) | Pass `params.id` as `documentId` |
| `app/api/payment/verify/route.ts` | PAY_PER_USE paid path | Pass `documentId` from request body |

**Note on the free-path flow:** When `POST /api/payment/initialize` returns `{ free: true }`, `document-actions.tsx` calls `POST /api/documents/[id]/pdf` directly (the PRO quota path). This route is the first entry in the table above — it will also produce QR codes since it calls `generatePDF()` with `documentId`. Both tiers are covered.

---

## 4. Public Verification Page

### Route

`app/verify/[documentId]/page.tsx` — Server Component, no authentication required.

**Required directives at top of file:**
```ts
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
```

These prevent Next.js from statically rendering the page (which would make `headers()` return empty values) and prevent speculative prefetch from inserting spurious verification log entries.

**Do NOT add `/verify/:path*` to `middleware.ts`** — the middleware guards `/dashboard/*` and `/admin/*`. Adding `/verify` to the matcher would block public access.

### Server Component Flow

1. Extract `documentId` from params.
2. Query: `prisma.document.findFirst({ where: { id: documentId }, include: { customer: true } })`.
3. Separate query for business name: `prisma.user.findUnique({ where: { id: doc.userId }, select: { businessName: true, name: true } })`.
4. Extract IP from `headers().get('x-forwarded-for')` — take the first value if comma-separated (Render proxy forwards the real client IP first). Fall back to `"unknown"`.
5. Extract `userAgent` from `headers().get('user-agent')`. Fall back to `null`.
6. If document found: run verification tracking transaction (see below).
7. Render appropriate state.

### Verification Tracking Transaction

```ts
await prisma.$transaction(async (tx) => {
  const verification = await tx.documentVerification.upsert({
    where: { documentId },
    create: {
      documentId,
      verifiedCount: 1,
      lastVerifiedAt: new Date(),
    },
    update: {
      verifiedCount: { increment: 1 },
      lastVerifiedAt: new Date(),
    },
  });

  await tx.verificationLog.create({
    data: {
      verificationId: verification.id,
      ip,
      userAgent,
    },
  });
});
```

Using an interactive transaction (`async (tx) => {}` form) ensures the upsert and log insert are atomic and that the `verification.id` returned from the upsert is used in the log create. Note: `{ increment: 1 }` is valid in Prisma's `upsert` update block.

### Render States

**Document found:**
```
✓ Document Verified                          [green check badge]

Document Number:  INV-001
Document Type:    Invoice
Issue Date:       Mar 20, 2026
Total Amount:     KES 10,000.00
Status:           PAID

Business:         Acme Corp
Customer:         John Doe

Verified at: 2026-03-20 14:32:01 UTC

[This document was generated on DocDime]
```

**Document not found:**
```
✗ Cannot Verify                              [red X badge]

This document could not be found.
It may be fraudulent or the document ID may be incorrect.

[This document was generated on DocDime]
```

### Page Metadata

- Title: `"Verify Document | DocDime"`
- `<meta name="robots" content="noindex">` — verification pages must not be indexed by search engines.

---

## 5. File Change Summary

### New Files
- `app/verify/[documentId]/page.tsx`

### Modified Files
- `prisma/schema.prisma`
- `lib/pdf.ts`
- `app/api/payment/initialize/route.ts`
- `app/api/payment/verify/route.ts`
- `app/api/documents/[id]/pdf/route.ts`
- `app/page.tsx`
- `app/dashboard/subscription/page.tsx`
- `app/dashboard/page.tsx`
- `app/dashboard/documents/new/page.tsx`
- `app/dashboard/documents/[id]/document-actions.tsx`
- `app/onboarding/page.tsx`
- `app/terms/page.tsx`
- `app/layout.tsx`
- `components/layout/footer.tsx`
- `components/layout/navbar.tsx`
- `docs/PROJECT.md`

### New Dependencies
- `qrcode` (npm runtime)
- `@types/qrcode` (dev)

### Required Environment Variables
- `NEXT_PUBLIC_APP_URL` — must be set in production; QR codes will be skipped if absent

---

## 6. Out of Scope

- Payment gateway reconfiguration (Paystack dashboard pricing — done externally)
- Email notifications for verification events
- Admin dashboard for viewing verification logs
- Short-code URL scheme using `verificationCode`

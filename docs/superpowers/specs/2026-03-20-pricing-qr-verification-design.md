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

The 17% savings: $2/month × 12 = $24/year vs $20/year = 16.7%, displayed as "17%".

Pro tier benefits (unchanged): 20 free documents/month, no watermarks.

### Files to Update (13 total)

| File | Change |
|------|--------|
| `app/api/payment/initialize/route.ts` | `DOC_PRICE_USD = 0.10` |
| `app/dashboard/documents/[id]/document-actions.tsx` | Button: `"Generate PDF — $0.10"` |
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

### Migration

Run `npx prisma db push` after schema changes (no data loss on existing documents — new nullable fields only).

---

## 3. QR Code in PDFs

### Library

`qrcode` npm package (server-side, no DOM dependency). Generates PNG `Buffer` via `QRCode.toBuffer()`.

### PDF Changes (`lib/pdf.ts`)

1. Add `documentId: string` parameter to `generatePDF()`.
2. At the end of generation (after footer, before `save()`):
   - Generate QR PNG: `await QRCode.toBuffer(url, { width: 100, margin: 1 })`
   - URL: `${process.env.NEXT_PUBLIC_APP_URL}/verify/${documentId}`
   - Embed PNG into PDF: 36×36 pt (0.5 inch), bottom-right corner, 10pt margin from right and bottom edges
   - Add label `"Scan to verify"` below the QR, 6pt gray text, centered under the QR
3. Applied to **all** PDFs — both PRO and PAY_PER_USE tiers.

### Callers Updated

| File | Change |
|------|--------|
| `app/api/documents/[id]/pdf/route.ts` | Pass `params.id` as `documentId` |
| `app/api/payment/verify/route.ts` | Pass `documentId` from request body |

---

## 4. Public Verification Page

### Route

`app/verify/[documentId]/page.tsx` — Server Component, no authentication required.

### Server Component Flow

1. Extract `documentId` from params.
2. Query: `prisma.document.findFirst({ where: { id: documentId }, include: { customer: true, user: true } })`.
   - Note: `user` not currently in Document include — use separate `prisma.user.findUnique({ where: { id: doc.userId } })` call.
3. Extract IP from `headers().get('x-forwarded-for')` (first value if comma-separated). Fall back to `"unknown"`.
4. Extract `userAgent` from `headers().get('user-agent')`.
5. If document found:
   - Upsert `DocumentVerification` (create if not exists).
   - Insert `VerificationLog` with IP, userAgent, timestamp.
   - Update `DocumentVerification`: `verifiedCount++`, `lastVerifiedAt = now()`.
6. Render appropriate state.

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
- No index (`<meta name="robots" content="noindex">`) — verification pages should not be indexed.

### Notes

- No auth, no session check — fully public.
- The page should be fast: two DB queries max (document lookup, then upsert/log).
- Upsert uses `prisma.$transaction` to keep count + log atomic.

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

### New Dependency
- `qrcode` (npm) + `@types/qrcode` (dev)

---

## 6. Out of Scope

- Payment gateway changes (Paystack config for new pricing — handled by Paystack dashboard)
- Email notifications for verification events
- Admin dashboard for viewing verification logs
- Short-code URL scheme using `verificationCode`

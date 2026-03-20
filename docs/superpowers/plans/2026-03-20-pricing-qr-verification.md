# Pricing Update & QR Code Verification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update all pricing to $0.10/doc and $20/year Pro, embed a scannable QR verification code in every generated PDF, and create a public `/verify/[documentId]` page that logs audit trail per visit.

**Architecture:** Pricing changes are string/constant replacements across 10 files. QR codes are embedded server-side in `lib/pdf.ts` using the `qrcode` npm package after all other PDF content is drawn. The verification page is a Next.js 14 Server Component that performs a Prisma interactive transaction (upsert + log insert) during render, guarded by `force-dynamic`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma (PostgreSQL), pdf-lib, `qrcode` npm package.

**Spec:** `docs/superpowers/specs/2026-03-20-pricing-qr-verification-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `verificationCode` to Document, add `DocumentVerification` + `VerificationLog` models |
| `app/api/payment/initialize/route.ts` | Modify | `DOC_PRICE_USD = 0.10` |
| `lib/pdf.ts` | Modify | Add `documentId` param, embed QR code bottom-right |
| `app/api/documents/[id]/pdf/route.ts` | Modify | Pass `params.id` as `documentId` to `generatePDF` |
| `app/api/payment/verify/route.ts` | Modify | Pass `documentId` as `documentId` to `generatePDF` |
| `app/verify/[documentId]/page.tsx` | Create | Public verification page |
| `app/page.tsx` | Modify | Pricing: $0.10, $2/mo, $20/yr, save 17% |
| `app/layout.tsx` | Modify | Metadata description pricing |
| `app/dashboard/subscription/page.tsx` | Modify | Plan cards: $0.10, $2/mo, $20/yr |
| `app/dashboard/page.tsx` | Modify | Pro upsell: $2/month ($20/year) |
| `app/dashboard/documents/[id]/document-actions.tsx` | Modify | Button: $0.10, upgrade copy: $2/month |
| `app/dashboard/documents/new/page.tsx` | Modify | Any $0.11 or $1/month references |
| `app/onboarding/page.tsx` | Modify | Consent copy pricing |
| `app/terms/page.tsx` | Modify | Payment terms pricing |
| `components/layout/footer.tsx` | Modify | Footer pricing copy |
| `components/layout/navbar.tsx` | Modify | Nav pricing copy |
| `.env.example` | Modify | Add `NEXT_PUBLIC_APP_URL` |
| `docs/PROJECT.md` | Modify | Documentation pricing |

---

## Task 1: Install QR code dependency

**Files:** `package.json`

- [ ] **Step 1: Install packages**

```bash
cd "c:/Users/kenneth.wamunyu/Desktop/Wawesh/DocDime"
npm install qrcode
npm install --save-dev @types/qrcode
```

- [ ] **Step 2: Verify install**

```bash
node -e "const QRCode = require('qrcode'); console.log('qrcode OK')"
```

Expected output: `qrcode OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add qrcode dependency for PDF verification QR codes"
```

---

## Task 2: Update database schema

**Files:** `prisma/schema.prisma`

- [ ] **Step 1: Add `verificationCode` field to Document model**

In `prisma/schema.prisma`, find the `model Document` block. After line `convertedToId   String?`, add:

```prisma
  verificationCode  String?        @unique @default(cuid())
  verification      DocumentVerification?
```

- [ ] **Step 2: Add `DocumentVerification` model**

After the `model Transaction` block (around line 151), add:

```prisma
model DocumentVerification {
  id             String    @id @default(cuid())
  documentId     String    @unique
  verifiedCount  Int       @default(0)
  lastVerifiedAt DateTime?
  createdAt      DateTime  @default(now())
  document       Document  @relation(fields: [documentId], references: [id], onDelete: Cascade)
  logs           VerificationLog[]
}

model VerificationLog {
  id             String               @id @default(cuid())
  verificationId String
  ip             String?
  userAgent      String?
  verifiedAt     DateTime             @default(now())
  verification   DocumentVerification @relation(fields: [verificationId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 3: Push schema to database**

```bash
cd "c:/Users/kenneth.wamunyu/Desktop/Wawesh/DocDime"
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`
Note: `verificationCode` is nullable — existing documents get `null`. No data loss.

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add DocumentVerification and VerificationLog schema, verificationCode on Document"
```

---

## Task 3: Update pricing constant

**Files:** `app/api/payment/initialize/route.ts`

- [ ] **Step 1: Change `DOC_PRICE_USD`**

In `app/api/payment/initialize/route.ts`, line 7:

Change:
```ts
const DOC_PRICE_USD = 0.11;
```
To:
```ts
const DOC_PRICE_USD = 0.10;
```

Also update the comment on line 50 from `// $0.11 = 11 cents` to `// $0.10 = 10 cents`.

- [ ] **Step 2: Commit**

```bash
git add app/api/payment/initialize/route.ts
git commit -m "feat: update PAYG price from \$0.11 to \$0.10 per document"
```

---

## Task 4: Add QR code to PDF generation

**Files:** `lib/pdf.ts`, `app/api/documents/[id]/pdf/route.ts`, `app/api/payment/verify/route.ts`

### 4a: Update `lib/pdf.ts`

- [ ] **Step 1: Add QR import at top of file**

At the top of `lib/pdf.ts`, after existing imports, add:

```ts
import QRCode from "qrcode";
```

- [ ] **Step 2: Add `documentId` to `PDFData` interface**

Find the `PDFData` interface (or type) in `lib/pdf.ts`. Add `documentId?: string` as an optional field (optional to avoid hard compilation failures if any undiscovered call site is missed):

```ts
export interface PDFData {
  documentId?: string;  // ← add this line (optional — QR is skipped if absent)
  docNumber: string;
  // ... rest of existing fields unchanged
}
```

- [ ] **Step 3: Add QR code embedding after the footer line**

In `lib/pdf.ts`, find the `generatePDF` function. After the footer line block (currently lines 422–426) and before `return await pdfDoc.save()`, add:

```ts
  // QR verification code — bottom-right corner
  // y-coordinate note: the spec's initial suggestion of y=10 would overlap the footer
  // line at y=40. After checking lib/pdf.ts footer coordinates (line at y=40, text at y=25),
  // qrY=56 is used instead: QR spans y=56–92, label at y=48 — all above the footer line.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && data.documentId) {
    try {
      const verifyUrl = `${appUrl}/verify/${data.documentId}`;
      const qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 100, margin: 1 });
      const qrImage = await pdfDoc.embedPng(qrBuffer);
      const qrSize = 36; // 0.5 inch in points
      const qrX = width - 10 - qrSize;  // 10pt margin from right
      const qrY = 56;                    // bottom of QR, above footer line at y=40
      page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
      page.drawText("Scan to verify", {
        x: qrX + 1,
        y: qrY - 8,
        size: 5,
        font: regularFont,
        color: grayColor,
      });
    } catch (err) {
      console.warn("[PDF] QR code generation skipped:", err);
      // PDF is still saved without QR — non-fatal
    }
  }
```

The full end of the `generatePDF` function should now look like:

```ts
  // Footer line
  page.drawLine({ start: { x: 40, y: 40 }, end: { x: width - 40, y: 40 }, thickness: 0.5, color: lightGray });
  page.drawText("Generated by DocDime — docdime.com", {
    x: 40, y: 25, size: 8, font: regularFont, color: grayColor,
  });

  // QR verification code — bottom-right corner
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && data.documentId) {
    try {
      const verifyUrl = `${appUrl}/verify/${data.documentId}`;
      const qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 100, margin: 1 });
      const qrImage = await pdfDoc.embedPng(qrBuffer);
      const qrSize = 36;
      const qrX = width - 10 - qrSize;
      const qrY = 56;
      page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
      page.drawText("Scan to verify", {
        x: qrX + 1,
        y: qrY - 8,
        size: 5,
        font: regularFont,
        color: grayColor,
      });
    } catch (err) {
      console.warn("[PDF] QR code generation skipped:", err);
      // PDF is still saved without QR — non-fatal
    }
  }

  return await pdfDoc.save();
}
```

### 4b: Update `app/api/documents/[id]/pdf/route.ts`

- [ ] **Step 4: Pass `documentId` to `generatePDF`**

In `app/api/documents/[id]/pdf/route.ts`, find the `generatePDF({` call. Add `documentId: params.id,` as the first field:

```ts
    const pdfBytes = await generatePDF({
      documentId: params.id,   // ← add this line
      docNumber: doc.docNumber,
      // ... rest unchanged
    });
```

### 4c: Update `app/api/payment/verify/route.ts`

- [ ] **Step 5: Pass `documentId` to `generatePDF`**

In `app/api/payment/verify/route.ts`, find the `generatePDF({` call. Add `documentId: documentId,` as the first field (note: `documentId` is already in scope from `const { reference, documentId } = await req.json()`):

```ts
    const pdfBytes = await generatePDF({
      documentId: documentId,   // ← add this line
      docNumber: doc.docNumber,
      // ... rest unchanged
    });
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd "c:/Users/kenneth.wamunyu/Desktop/Wawesh/DocDime"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/pdf.ts app/api/documents/[id]/pdf/route.ts app/api/payment/verify/route.ts
git commit -m "feat: embed QR verification code in all generated PDFs"
```

---

## Task 5: Create public verification page

**Files:** `app/verify/[documentId]/page.tsx` (create new)

- [ ] **Step 1: Create directory**

```bash
mkdir -p "c:/Users/kenneth.wamunyu/Desktop/Wawesh/DocDime/app/verify/[documentId]"
```

- [ ] **Step 2: Create the verification page**

Create `app/verify/[documentId]/page.tsx` with this full content:

```tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Verify Document | DocDime",
  robots: { index: false, follow: false },
};

export default async function VerifyPage({
  params,
}: {
  params: { documentId: string };
}) {
  const { documentId } = params;

  // Fetch document
  const doc = await prisma.document.findFirst({
    where: { id: documentId },
    include: { customer: true },
  });

  // Track verification attempt (even for not-found to log scan attempts)
  const headersList = headers();
  const rawIp = headersList.get("x-forwarded-for");
  const ip = rawIp ? rawIp.split(",")[0].trim() : "unknown";
  const userAgent = headersList.get("user-agent") ?? null;
  const verifiedAt = new Date();

  if (doc) {
    await prisma.$transaction(async (tx) => {
      const verification = await tx.documentVerification.upsert({
        where: { documentId },
        create: {
          documentId,
          verifiedCount: 1,
          lastVerifiedAt: verifiedAt,
        },
        update: {
          verifiedCount: { increment: 1 },
          lastVerifiedAt: verifiedAt,
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

    // Fetch business name separately
    const user = await prisma.user.findUnique({
      where: { id: doc.userId },
      select: { businessName: true, name: true },
    });
    const businessName = user?.businessName ?? user?.name ?? "—";

    const typeLabel =
      doc.type === "INVOICE" ? "Invoice"
      : doc.type === "QUOTE" ? "Quote"
      : "Purchase Order";

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Status banner */}
          <div className="bg-green-50 border-b border-green-200 px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-green-900">Document Verified</p>
              <p className="text-xs text-green-700">This document exists in DocDime&apos;s records</p>
            </div>
          </div>

          {/* Document details */}
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <span className="text-gray-500">Document Number</span>
              <span className="font-medium text-gray-900 text-right">{doc.docNumber}</span>

              <span className="text-gray-500">Type</span>
              <span className="font-medium text-gray-900 text-right">{typeLabel}</span>

              <span className="text-gray-500">Issue Date</span>
              <span className="font-medium text-gray-900 text-right">{formatDate(doc.issueDate)}</span>

              <span className="text-gray-500">Total Amount</span>
              <span className="font-medium text-gray-900 text-right">{formatCurrency(doc.total, doc.currency)}</span>

              <span className="text-gray-500">Status</span>
              <span className="font-medium text-gray-900 text-right capitalize">{doc.status.toLowerCase()}</span>

              <span className="text-gray-500">Business</span>
              <span className="font-medium text-gray-900 text-right">{businessName}</span>

              {doc.customer && (
                <>
                  <span className="text-gray-500">Customer</span>
                  <span className="font-medium text-gray-900 text-right">{doc.customer.name}</span>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Verified at {verifiedAt.toISOString().replace("T", " ").slice(0, 19)} UTC
              </p>
            </div>
          </div>

          {/* DocDime badge */}
          <div className="bg-blue-50 border-t border-blue-100 px-6 py-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-blue-700 font-medium">
              This document was generated on DocDime
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Document not found
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Status banner */}
        <div className="bg-red-50 border-b border-red-200 px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-red-900">Cannot Verify</p>
            <p className="text-xs text-red-700">This document could not be found in our records</p>
          </div>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-gray-600">
            This document could not be found. It may be fraudulent or the document ID may be incorrect.
          </p>
        </div>

        {/* DocDime badge */}
        <div className="bg-blue-50 border-t border-blue-100 px-6 py-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-blue-700 font-medium">
            This document was generated on DocDime
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/verify/[documentId]/page.tsx"
git commit -m "feat: public document verification page at /verify/[documentId]"
```

---

## Task 6: Update pricing across all UI surfaces

### 6a: `app/api/payment/initialize/route.ts` — comment only (constant already updated in Task 3)

No extra changes needed.

### 6b: `app/page.tsx` — landing page

- [ ] **Step 1: Update metadata description (line 9)**

Change:
```ts
"Create professional invoices, quotes, and purchase orders in minutes. Pay $0.11/doc or go Pro at $1/month ($12/year). No subscriptions required.",
```
To:
```ts
"Create professional invoices, quotes, and purchase orders in minutes. Pay $0.10/doc or go Pro at $2/month ($20/year). No subscriptions required.",
```

- [ ] **Step 2: Update Schema.org structured data offer price (line 18–19)**

Change:
```ts
price: "0.11",
```
To:
```ts
price: "0.10",
```

- [ ] **Step 3: Update FAQ answer text (line 36)**

Change:
```ts
text: "DocDime offers pay-per-use at $0.11 per document, or a Pro plan at $1/month ($12/year) which includes 20 free documents per month.",
```
To:
```ts
text: "DocDime offers pay-per-use at $0.10 per document, or a Pro plan at $2/month ($20/year, save 17%) which includes 20 free documents per month.",
```

- [ ] **Step 4: Update stats section**

Find any reference to `"$0.11 Per document"` or `"$1/mo Pro plan"` in the stats array and update to `"$0.10 Per document"` and `"$2/mo Pro plan"`.

- [ ] **Step 5: Update Pay Per Use pricing card (around line 236)**

Change:
```tsx
<span className="text-5xl font-bold text-gray-900">$0.11</span>
```
To:
```tsx
<span className="text-5xl font-bold text-gray-900">$0.10</span>
```

- [ ] **Step 6: Update Pro pricing card (around lines 270–274)**

Change:
```tsx
<span className="text-5xl font-bold">$1</span>
<span className="text-blue-200">/ month</span>
</div>
<p className="text-blue-200 text-sm">Billed annually at $12/year</p>
<p className="mt-3 text-blue-100 text-sm">
  20 free documents per month, then $0.11 each.
</p>
```
To:
```tsx
<span className="text-5xl font-bold">$2</span>
<span className="text-blue-200">/ month</span>
</div>
<p className="text-blue-200 text-sm">$20/year (save 17% vs monthly)</p>
<p className="mt-3 text-blue-100 text-sm">
  20 free documents per month, then $0.10 each.
</p>
```

- [ ] **Step 7: Search for any remaining $0.11 or $1/month in the file**

```bash
grep -n "0\.11\|\\$1/" "c:/Users/kenneth.wamunyu/Desktop/Wawesh/DocDime/app/page.tsx"
```

Expected: no matches. Fix any found.

### 6c: `app/layout.tsx` — metadata

- [ ] **Step 8: Update metadata description**

Find any `$0.11` or `$1/month` in `app/layout.tsx` and replace with `$0.10` and `$2/month ($20/year)` respectively.

### 6d: `app/dashboard/subscription/page.tsx`

- [ ] **Step 9: Update Pay Per Use price display (line 66)**

Change:
```tsx
<p className="text-3xl font-bold mt-2">$0.11<span className="text-sm text-gray-500 font-normal">/doc</span></p>
```
To:
```tsx
<p className="text-3xl font-bold mt-2">$0.10<span className="text-sm text-gray-500 font-normal">/doc</span></p>
```

- [ ] **Step 10: Update Pay Per Use description (line 67)**

```tsx
<p className="text-sm text-gray-500 mt-2">Only pay when you generate a PDF</p>
```
(no change needed — generic text)

- [ ] **Step 11: Update Pro Plan price display (line 76)**

Change:
```tsx
<p className="text-3xl font-bold mt-2 text-blue-600">$1<span className="text-sm text-gray-500 font-normal">/month</span></p>
<p className="text-sm text-gray-500 mt-2">$12/year • 20 free docs/month</p>
```
To:
```tsx
<p className="text-3xl font-bold mt-2 text-blue-600">$2<span className="text-sm text-gray-500 font-normal">/month</span></p>
<p className="text-sm text-gray-500 mt-2">$20/year (save 17%) • 20 free docs/month</p>
```

- [ ] **Step 12: Update current plan display for PRO users (line 50)**

Change:
```tsx
$1/month • {user.docsThisMonth}/{20} free docs used this month
```
To:
```tsx
$2/month • {user.docsThisMonth}/{20} free docs used this month
```

- [ ] **Step 13: Update Pay Per Use current plan text (line 54)**

Change:
```tsx
<p className="text-sm text-gray-500">$0.11 per document generated</p>
```
To:
```tsx
<p className="text-sm text-gray-500">$0.10 per document generated</p>
```

### 6e: `app/dashboard/page.tsx` — Pro upsell

- [ ] **Step 14: Update Pro upsell text (line 173)**

Change:
```tsx
Get 20 free documents/month for only $1/month ($12/year).
```
To:
```tsx
Get 20 free documents/month for only $2/month ($20/year).
```

### 6f: `app/dashboard/documents/[id]/document-actions.tsx`

- [ ] **Step 15: Update button label**

Find `"Generate PDF — $0.11"` and change to `"Generate PDF — $0.10"`.

- [ ] **Step 16: Update upgrade callout**

Find `"$1/month"` in the upgrade callout paragraph and change to `"$2/month"`.

### 6g: `app/dashboard/documents/new/page.tsx`

- [ ] **Step 17: Search and update pricing**

```bash
grep -n "0\.11\|\\$1/" "c:/Users/kenneth.wamunyu/Desktop/Wawesh/DocDime/app/dashboard/documents/new/page.tsx"
```

Update any found references: `$0.11` → `$0.10`, `$1/month` → `$2/month`.

### 6h: `app/onboarding/page.tsx`

- [ ] **Step 18: Update consent text (line ~183)**

Find: `"Pay-per-use pricing ($0.11/document) or Pro plan charges"`
Change to: `"Pay-per-use pricing ($0.10/document) or Pro plan charges ($20/year)"`

### 6i: `app/terms/page.tsx`

- [ ] **Step 19: Update payment terms**

Find `$0.11` and `$1/month` / `$12/year` references in the Payments & Refunds section.
Change: `$0.11` → `$0.10`, `$12/year` → `$20/year`.

### 6k: `components/layout/footer.tsx`

- [ ] **Step 20k: Search and update**

```bash
grep -n "0\.11\|1/month\|12/year" "c:/Users/kenneth.wamunyu/Desktop/Wawesh/DocDime/components/layout/footer.tsx"
```

Update any found pricing references: `$0.11` → `$0.10`, `$1/month` → `$2/month`, `$12/year` → `$20/year`.

### 6l: `components/layout/navbar.tsx`

- [ ] **Step 20l: Search and update**

```bash
grep -n "0\.11\|1/month\|12/year" "c:/Users/kenneth.wamunyu/Desktop/Wawesh/DocDime/components/layout/navbar.tsx"
```

Update any found pricing references.

### 6m: `.env.example` — add `NEXT_PUBLIC_APP_URL`

- [ ] **Step 20m: Add to `.env.example`**

Open `.env.example` and add the following line in the appropriate section (public/app config):

```env
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 6n: Verify document creation route does not override `verificationCode`

- [ ] **Step 20n: Check `app/api/documents/route.ts`**

```bash
grep -n "verificationCode" "c:/Users/kenneth.wamunyu/Desktop/Wawesh/DocDime/app/api/documents/route.ts"
```

Expected: **no matches**. The Prisma `@default(cuid())` generates the code automatically on `prisma.document.create()`. If `verificationCode: null` or `verificationCode: undefined` appears, remove it so the default takes effect.

### 6j: `docs/PROJECT.md`

- [ ] **Step 20: Update documentation pricing table**

Find the pricing table rows and update:
- `$0.11/document` → `$0.10/document`
- `$1/month` → `$2/month`
- `$12/year` → `$20/year ($2/month billed annually, save 17%)`

- [ ] **Step 21: Final search across all files**

```bash
grep -rn "0\.11\|\\$1/month\|\\$12/year" "c:/Users/kenneth.wamunyu/Desktop/Wawesh/DocDime/app" "c:/Users/kenneth.wamunyu/Desktop/Wawesh/DocDime/components" "c:/Users/kenneth.wamunyu/Desktop/Wawesh/DocDime/docs"
```

Fix any remaining matches.

- [ ] **Step 22: Commit all pricing changes**

```bash
git add app/page.tsx app/layout.tsx app/dashboard/subscription/page.tsx app/dashboard/page.tsx "app/dashboard/documents/[id]/document-actions.tsx" app/dashboard/documents/new/page.tsx app/onboarding/page.tsx app/terms/page.tsx components/layout/footer.tsx components/layout/navbar.tsx .env.example docs/PROJECT.md
git commit -m "feat: update pricing to \$0.10/doc, \$2/month, \$20/year Pro (save 17%)"
```

---

## Task 7: Final verification

- [ ] **Step 1: TypeScript check — no errors**

```bash
cd "c:/Users/kenneth.wamunyu/Desktop/Wawesh/DocDime"
npx tsc --noEmit
```

Expected: exits with code 0, no errors.

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: build completes successfully. Note any new warnings.

- [ ] **Step 3: Manual smoke test — pricing**

Start dev server: `npm run dev`

- Visit `http://localhost:3000` → confirm pricing shows $0.10, $2/month, $20/year, save 17%
- Visit `http://localhost:3000/dashboard/subscription` → confirm plan cards show updated pricing
- Visit `http://localhost:3000/dashboard` → confirm Pro upsell shows $2/month ($20/year)

- [ ] **Step 4: Manual smoke test — verification page**

- Visit `http://localhost:3000/verify/nonexistent-id` → confirm "Cannot Verify" red banner renders
- Create a document, generate PDF (requires NEXT_PUBLIC_APP_URL to be set in `.env.local`)
- Scan the QR in the PDF → should navigate to the verification page for that document
- Visit the URL directly → confirm "Document Verified" green banner with correct details

- [ ] **Step 5: Final push**

```bash
git push origin main
```

---

## Environment Variable Checklist

Ensure `NEXT_PUBLIC_APP_URL` is set in production (Render):
```
NEXT_PUBLIC_APP_URL=https://your-docdime-domain.onrender.com
```

Without this, QR codes are silently skipped (PDFs still generate, no error).

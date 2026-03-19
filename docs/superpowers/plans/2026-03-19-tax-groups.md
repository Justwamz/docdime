# Tax Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-tax `isCompound` flag with a Tax Groups system where compound behavior is defined per step in an ordered group, enabling complex multi-tax scenarios globally.

**Architecture:** Individual taxes (name, rate, inclusive/exclusive) become simple building blocks. `TaxGroup` and `TaxGroupItem` models define ordered tax steps with per-step compound flags. A line item holds exactly one tax selection — either a single tax or a group — stored as a typed JSON snapshot.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma (PostgreSQL), React state, pdf-lib

**Spec:** `docs/superpowers/specs/2026-03-19-tax-groups-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Remove `isCompound` from Tax; add TaxGroup, TaxGroupItem; add `taxGroups` to User |
| `types/index.ts` | Modify | New TaxGroup, TaxGroupItem, AppliedTaxSnapshot types; update Tax and LineItem |
| `lib/utils.ts` | Modify | New `taxLabel()`, `readAppliedTaxes()`; refactor `computeLineTaxes()` |
| `app/api/taxes/route.ts` | Modify | Remove `isCompound` from POST body |
| `app/api/taxes/[id]/route.ts` | Modify | Remove `isCompound` from PUT; 409 on DELETE if tax is in a group |
| `app/api/tax-groups/route.ts` | Create | GET all groups (with embedded items+taxes), POST create group |
| `app/api/tax-groups/[id]/route.ts` | Create | PUT full-replace, DELETE group |
| `app/dashboard/taxes/page.tsx` | Modify | Remove compound toggle; add Tax Groups section with builder dialog |
| `components/documents/line-items-table.tsx` | Modify | Replace multi-checkbox TaxSelector with single unified dropdown |
| `app/dashboard/documents/new/page.tsx` | Modify | Fetch `/api/tax-groups`; pass groups to LineItemsTable |
| `lib/pdf.ts` | Modify | Render per-component tax breakdown from appliedTaxes snapshot |
| `prisma/migrations/migrate-applied-taxes.ts` | Create | Optional cleanup script: transform old `AppliedTax[]` to `AppliedTaxSnapshot` format |

---

## Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Remove `isCompound` from the Tax model and add the `taxGroupItems` relation**

In `prisma/schema.prisma`, find the `Tax` model and make these changes:

```prisma
model Tax {
  id            String         @id @default(cuid())
  userId        String
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  name          String
  rate          Float
  isDefault     Boolean        @default(false)
  isInclusive   Boolean        @default(false)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  taxGroupItems TaxGroupItem[]
}
```

- [ ] **Step 2: Add `taxGroups` relation to the User model**

In `prisma/schema.prisma`, find the `User` model and add this line after `taxes Tax[]`:

```prisma
  taxGroups    TaxGroup[]
```

- [ ] **Step 3: Add TaxGroup and TaxGroupItem models**

Append these two models to the end of `prisma/schema.prisma`:

```prisma
model TaxGroup {
  id        String         @id @default(cuid())
  userId    String
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  isDefault Boolean        @default(false)
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  items     TaxGroupItem[]
}

model TaxGroupItem {
  id         String    @id @default(cuid())
  groupId    String
  group      TaxGroup  @relation(fields: [groupId], references: [id], onDelete: Cascade)
  taxId      String
  tax        Tax       @relation(fields: [taxId], references: [id], onDelete: Restrict)
  order      Int
  isCompound Boolean   @default(false)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@unique([groupId, order])
  @@unique([groupId, taxId])
}
```

- [ ] **Step 4: Push the schema to the database**

```bash
npx prisma db push
```

Expected: prints migration steps and ends with `Your database is now in sync with your Prisma schema.`

- [ ] **Step 5: Regenerate the Prisma client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add TaxGroup and TaxGroupItem models, remove isCompound from Tax"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Replace the Tax interface and add new types**

Open `types/index.ts`. Replace the entire `Tax` interface and the `AppliedTax` interface and `LineItem` interface with the following. Leave all other types untouched.

Remove this:
```ts
export interface AppliedTax {
  taxId: string;
  name: string;
  rate: number;
  isCompound: boolean;
  isInclusive: boolean;
  amount: number;
}

export interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;        // effective combined rate (for display/PDF)
  appliedTaxes?: AppliedTax[];
  total: number;
}

export interface Tax {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
  isInclusive: boolean;
  isCompound: boolean;
}
```

Add this in its place:
```ts
export interface AppliedTax {
  taxId: string;
  name: string;
  rate: number;
  isInclusive: boolean;
  isCompound: boolean;
  amount: number;
}

export type AppliedTaxSnapshot =
  | {
      type: "tax";
      taxId: string;
      name: string;
      rate: number;
      isInclusive: boolean;
      amount: number;
    }
  | {
      type: "group";
      groupId: string;
      groupName: string;
      items: AppliedTax[];
    };

export interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  appliedTaxes?: AppliedTaxSnapshot | null;
  total: number;
}

export interface Tax {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
  isInclusive: boolean;
}

export interface TaxGroupItem {
  id: string;
  taxId: string;
  order: number;
  isCompound: boolean;
  tax: Tax;
}

export interface TaxGroup {
  id: string;
  name: string;
  isDefault: boolean;
  items: TaxGroupItem[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (there will be errors — proceed to Task 3 which fixes them)

> Note: TypeScript errors from `lib/utils.ts`, `components/documents/line-items-table.tsx`, and `app/dashboard/taxes/page.tsx` are expected here. They are fixed in subsequent tasks. Run `tsc` again after Task 5 to verify clean.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add AppliedTaxSnapshot, TaxGroup types; remove isCompound from Tax"
```

---

## Task 3: Update Core Utilities

**Files:**
- Modify: `lib/utils.ts`

- [ ] **Step 1: Add `taxLabel` helper**

In `lib/utils.ts`, add this function after `truncate`:

```ts
export function taxLabel(tax: { name: string; rate: number; isInclusive: boolean }): string {
  return `${tax.name} ${tax.rate}% (${tax.isInclusive ? "Inclusive" : "Exclusive"})`;
}
```

- [ ] **Step 2: Add `readAppliedTaxes` backward-compat reader**

Add this function after `taxLabel`:

```ts
import type { AppliedTax, AppliedTaxSnapshot } from "@/types";

export function readAppliedTaxes(raw: unknown): AppliedTaxSnapshot | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const items = raw as AppliedTax[];
    if (items.length === 0) return null;
    if (items.length === 1) {
      return {
        type: "tax",
        taxId: items[0].taxId,
        name: items[0].name,
        rate: items[0].rate,
        isInclusive: items[0].isInclusive,
        amount: items[0].amount,
      };
    }
    return { type: "group", groupId: "__legacy__", groupName: "Legacy Taxes", items };
  }
  return raw as AppliedTaxSnapshot;
}
```

> Note: The `import type` line goes at the top of the file with the other imports.

- [ ] **Step 3: Replace `computeLineTaxes` with the new unified version**

Remove the existing `computeLineTaxes` function entirely and replace with the code below. `TaxSelection` is defined in `types/index.ts` (Task 2) — import it at the top of `lib/utils.ts`:

```ts
import type { AppliedTax, AppliedTaxSnapshot, TaxSelection } from "@/types";
```

Then add the function:

```ts
/**
 * Compute tax breakdown for a line item.
 *
 * For a single tax, it is normalized internally to a single-item group with isCompound=false.
 * Items are processed in order:
 *  1. Inclusive taxes — extracted from base: amount = base × rate / (100 + rate)
 *  2. Exclusive, not compound — applied on base: amount = base × rate / 100
 *  3. Exclusive, compound — applied on (base + runningExclusiveSum): amount = (base + sum) × rate / 100
 *
 * totalTax = sum of exclusive tax amounts only (inclusive taxes are extracted, not added).
 * effectiveRate = (totalTax / base) × 100 — for display only.
 */
export function computeLineTaxes(
  base: number,
  selection: TaxSelection
): { snapshot: import("@/types").AppliedTaxSnapshot; totalTax: number; effectiveRate: number } {
  const steps: Array<{ taxId: string; name: string; rate: number; isInclusive: boolean; isCompound: boolean }> =
    selection.type === "tax"
      ? [{ taxId: selection.taxId, name: selection.name, rate: selection.rate, isInclusive: selection.isInclusive, isCompound: false }]
      : selection.items;

  if (!steps.length || base === 0) {
    const empty: import("@/types").AppliedTaxSnapshot =
      selection.type === "tax"
        ? { type: "tax", taxId: selection.taxId, name: selection.name, rate: selection.rate, isInclusive: selection.isInclusive, amount: 0 }
        : { type: "group", groupId: selection.groupId, groupName: selection.groupName, items: [] };
    return { snapshot: empty, totalTax: 0, effectiveRate: 0 };
  }

  let runningExclusiveSum = 0;
  const computed = steps.map((t) => {
    let amount: number;
    if (t.isInclusive) {
      amount = (base * t.rate) / (100 + t.rate);
    } else if (t.isCompound) {
      amount = ((base + runningExclusiveSum) * t.rate) / 100;
      runningExclusiveSum += amount;
    } else {
      amount = (base * t.rate) / 100;
      runningExclusiveSum += amount;
    }
    return { ...t, amount: Math.round(amount * 100) / 100 };
  });

  const totalTax = computed.reduce((s, t) => s + (t.isInclusive ? 0 : t.amount), 0);
  const effectiveRate = base > 0 ? (totalTax / base) * 100 : 0;

  let snapshot: import("@/types").AppliedTaxSnapshot;
  if (selection.type === "tax") {
    snapshot = {
      type: "tax",
      taxId: selection.taxId,
      name: selection.name,
      rate: selection.rate,
      isInclusive: selection.isInclusive,
      amount: computed[0].amount,
    };
  } else {
    snapshot = {
      type: "group",
      groupId: selection.groupId,
      groupName: selection.groupName,
      items: computed,
    };
  }

  return { snapshot, totalTax, effectiveRate };
}
```

- [ ] **Step 4: Verify the file compiles in isolation**

```bash
npx tsc --noEmit 2>&1 | grep "lib/utils"
```

Expected: no errors from `lib/utils.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts
git commit -m "feat: refactor computeLineTaxes for unified TaxSelection; add taxLabel, readAppliedTaxes"
```

---

## Task 4: Update Tax API Routes

**Files:**
- Modify: `app/api/taxes/route.ts`
- Modify: `app/api/taxes/[id]/route.ts`

- [ ] **Step 1: Remove `isCompound` from POST in `app/api/taxes/route.ts`**

In the POST handler, change:
```ts
const { name, rate, isDefault, isInclusive, isCompound } = await req.json();
```
to:
```ts
const { name, rate, isDefault, isInclusive } = await req.json();
```

And in the `prisma.tax.create` call, remove `isCompound: isCompound ?? false,`.

- [ ] **Step 2: Remove `isCompound` from PUT in `app/api/taxes/[id]/route.ts`**

In the PUT handler, change:
```ts
const { name, rate, isDefault, isInclusive, isCompound } = await req.json();
```
to:
```ts
const { name, rate, isDefault, isInclusive } = await req.json();
```

And in the `prisma.tax.update` call, remove `isCompound: isCompound ?? false,`.

- [ ] **Step 3: Update DELETE in `app/api/taxes/[id]/route.ts` to return 409 if tax is in a group**

Replace the entire DELETE handler with:

```ts
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tax = await prisma.tax.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: { taxGroupItems: { include: { group: true } } },
    });
    if (!tax) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (tax.taxGroupItems.length > 0) {
      const groupNames = tax.taxGroupItems.map((item) => item.group.name).join(", ");
      return NextResponse.json(
        { error: `This tax is used in the following groups: ${groupNames}. Remove it from those groups first.` },
        { status: 409 }
      );
    }

    await prisma.tax.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "api/taxes"
```

Expected: no errors from the tax API files.

- [ ] **Step 5: Commit**

```bash
git add app/api/taxes/route.ts app/api/taxes/[id]/route.ts
git commit -m "feat: remove isCompound from tax API; return 409 on delete if tax used in group"
```

---

## Task 5: Create Tax Groups API Routes

**Files:**
- Create: `app/api/tax-groups/route.ts`
- Create: `app/api/tax-groups/[id]/route.ts`

- [ ] **Step 1: Create `app/api/tax-groups/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const groups = await prisma.taxGroup.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: { tax: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: groups });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, isDefault, items } = await req.json();

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!items || items.length === 0)
      return NextResponse.json({ error: "A group must have at least one tax" }, { status: 400 });

    const taxIds: string[] = items.map((i: { taxId: string }) => i.taxId);
    if (new Set(taxIds).size !== taxIds.length)
      return NextResponse.json({ error: "A tax cannot appear more than once in a group" }, { status: 400 });

    if (isDefault) {
      await prisma.taxGroup.updateMany({ where: { userId: session.user.id }, data: { isDefault: false } });
    }

    const group = await prisma.taxGroup.create({
      data: {
        userId: session.user.id,
        name,
        isDefault: isDefault ?? false,
        items: {
          create: items.map((item: { taxId: string; order: number; isCompound: boolean }, idx: number) => ({
            taxId: item.taxId,
            order: idx + 1,
            isCompound: item.isCompound ?? false,
          })),
        },
      },
      include: { items: { orderBy: { order: "asc" }, include: { tax: true } } },
    });

    return NextResponse.json({ success: true, data: group }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/tax-groups/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, isDefault, items } = await req.json();

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!items || items.length === 0)
      return NextResponse.json({ error: "A group must have at least one tax" }, { status: 400 });

    const taxIds: string[] = items.map((i: { taxId: string }) => i.taxId);
    if (new Set(taxIds).size !== taxIds.length)
      return NextResponse.json({ error: "A tax cannot appear more than once in a group" }, { status: 400 });

    const existing = await prisma.taxGroup.findFirst({ where: { id: params.id, userId: session.user.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Full replace + isDefault clearing in a single transaction to prevent partial state
    const group = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.taxGroup.updateMany({ where: { userId: session.user.id }, data: { isDefault: false } });
      }
      await tx.taxGroupItem.deleteMany({ where: { groupId: params.id } });
      return tx.taxGroup.update({
        where: { id: params.id },
        data: {
          name,
          isDefault: isDefault ?? false,
          items: {
            create: items.map((item: { taxId: string; order: number; isCompound: boolean }, idx: number) => ({
              taxId: item.taxId,
              order: idx + 1,
              isCompound: item.isCompound ?? false,
            })),
          },
        },
        include: { items: { orderBy: { order: "asc" }, include: { tax: true } } },
      });
    });

    return NextResponse.json({ success: true, data: group });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await prisma.taxGroup.findFirst({ where: { id: params.id, userId: session.user.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.taxGroup.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "tax-groups"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/tax-groups/route.ts app/api/tax-groups/[id]/route.ts
git commit -m "feat: add tax groups CRUD API routes"
```

---

## Task 6: Update Taxes Page UI

**Files:**
- Modify: `app/dashboard/taxes/page.tsx`

This is the largest UI change. Replace the entire file content:

- [ ] **Step 1: Rewrite `app/dashboard/taxes/page.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from "@/components/ui/table";
import { taxLabel, computeLineTaxes } from "@/lib/utils";
import type { Tax, TaxGroup, TaxSelection } from "@/types";

// ─── Tax form dialog ────────────────────────────────────────────────────────

function TaxDialog({
  open,
  onClose,
  editTax,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editTax: Tax | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: "", rate: "", isDefault: false, isInclusive: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editTax) {
      setForm({ name: editTax.name, rate: String(editTax.rate), isDefault: editTax.isDefault, isInclusive: editTax.isInclusive });
    } else {
      setForm({ name: "", rate: "", isDefault: false, isInclusive: false });
    }
    setError("");
  }, [editTax, open]);

  async function handleSave() {
    setError("");
    setSaving(true);
    const url = editTax ? `/api/taxes/${editTax.id}` : "/api/taxes";
    const method = editTax ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, rate: parseFloat(form.rate) }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={editTax ? "Edit Tax" : "Add Tax"}>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}
      <div className="space-y-4">
        <div>
          <Label required>Tax Name</Label>
          <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. VAT, GST, Excise Duty" required />
        </div>
        <div>
          <Label required>Rate (%)</Label>
          <Input type="number" value={form.rate} onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))} placeholder="16" min="0" max="100" step="0.01" required />
        </div>
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
          <div className="flex items-start gap-3">
            <Switch checked={form.isInclusive} onCheckedChange={(v) => setForm((p) => ({ ...p, isInclusive: v }))} />
            <div>
              <p className="text-sm font-medium text-gray-900">Tax Inclusive</p>
              <p className="text-xs text-gray-500">Tax is already included in the unit price (extracted, not added)</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.isDefault} onCheckedChange={(v) => setForm((p) => ({ ...p, isDefault: v }))} />
          <Label className="mb-0">Set as default tax</Label>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1">Save</Button>
        </div>
      </div>
    </Dialog>
  );
}

// ─── Tax Group builder dialog ────────────────────────────────────────────────

interface GroupStep {
  taxId: string;
  isCompound: boolean;
}

function GroupDialog({
  open,
  onClose,
  allTaxes,
  editGroup,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  allTaxes: Tax[];
  editGroup: TaxGroup | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [steps, setSteps] = useState<GroupStep[]>([{ taxId: "", isCompound: false }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editGroup) {
      setName(editGroup.name);
      setIsDefault(editGroup.isDefault);
      setSteps(editGroup.items.map((i) => ({ taxId: i.taxId, isCompound: i.isCompound })));
    } else {
      setName("");
      setIsDefault(false);
      setSteps([{ taxId: "", isCompound: false }]);
    }
    setError("");
  }, [editGroup, open]);

  function addStep() { setSteps((s) => [...s, { taxId: "", isCompound: false }]); }
  function removeStep(i: number) { setSteps((s) => s.filter((_, idx) => idx !== i)); }
  function moveUp(i: number) {
    if (i === 0) return;
    setSteps((s) => { const n = [...s]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; });
  }
  function moveDown(i: number) {
    setSteps((s) => { if (i >= s.length - 1) return s; const n = [...s]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; return n; });
  }
  function updateStep(i: number, field: keyof GroupStep, value: string | boolean) {
    setSteps((s) => s.map((step, idx) => idx === i ? { ...step, [field]: value } : step));
  }

  // Live preview: compute for base=100
  const previewSteps = steps
    .map((s) => allTaxes.find((t) => t.id === s.taxId) ? { ...allTaxes.find((t) => t.id === s.taxId)!, isCompound: s.isCompound } : null)
    .filter(Boolean) as Array<Tax & { isCompound: boolean }>;

  let previewItems: Array<{ name: string; amount: number }> = [];
  let previewTotal = 0;
  if (previewSteps.length > 0) {
    const sel: TaxSelection = {
      type: "group",
      groupId: "__preview__",
      groupName: name || "Preview",
      items: previewSteps.map((t) => ({ taxId: t.id, name: t.name, rate: t.rate, isInclusive: t.isInclusive, isCompound: t.isCompound })),
    };
    const result = computeLineTaxes(100, sel);
    if (result.snapshot.type === "group") {
      previewItems = result.snapshot.items.map((i) => ({ name: taxLabel(i), amount: i.amount }));
    }
    previewTotal = result.totalTax;
  }

  async function handleSave() {
    setError("");
    const filledSteps = steps.filter((s) => s.taxId);
    if (!name.trim()) { setError("Group name is required"); return; }
    if (filledSteps.length === 0) { setError("A group must have at least one tax"); return; }
    const taxIds = filledSteps.map((s) => s.taxId);
    if (new Set(taxIds).size !== taxIds.length) { setError("A tax cannot appear more than once in a group"); return; }

    setSaving(true);
    const url = editGroup ? `/api/tax-groups/${editGroup.id}` : "/api/tax-groups";
    const method = editGroup ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, isDefault, items: filledSteps.map((s, idx) => ({ taxId: s.taxId, order: idx + 1, isCompound: s.isCompound })) }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={editGroup ? "Edit Tax Group" : "New Tax Group"}>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}
      <div className="space-y-4">
        <div>
          <Label required>Group Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Sales Tax" required />
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tax Steps (in order)</p>
          <div className="space-y-2">
            {steps.map((step, i) => {
              const selectedTax = allTaxes.find((t) => t.id === step.taxId);
              const isInclusive = selectedTax?.isInclusive ?? false;
              return (
                <div key={i} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex flex-col gap-0.5">
                    <button type="button" onClick={() => moveUp(i)} className="text-gray-400 hover:text-gray-700 text-xs leading-none" disabled={i === 0}>▲</button>
                    <button type="button" onClick={() => moveDown(i)} className="text-gray-400 hover:text-gray-700 text-xs leading-none" disabled={i === steps.length - 1}>▼</button>
                  </div>
                  <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                  <select
                    className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-white"
                    value={step.taxId}
                    onChange={(e) => updateStep(i, "taxId", e.target.value)}
                  >
                    <option value="">Select tax...</option>
                    {allTaxes.map((t) => (
                      <option key={t.id} value={t.id}>{taxLabel(t)}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1.5 min-w-max">
                    <Switch
                      checked={!isInclusive && step.isCompound}
                      onCheckedChange={(v) => updateStep(i, "isCompound", v)}
                      disabled={isInclusive}
                    />
                    <span className={`text-xs ${isInclusive ? "text-gray-300" : "text-gray-600"}`}>On running total</span>
                  </div>
                  <button type="button" onClick={() => removeStep(i)} className="text-gray-400 hover:text-red-500 text-sm px-1">✕</button>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={addStep} className="text-blue-600 text-sm hover:underline mt-2">+ Add Step</button>
        </div>

        {previewSteps.length > 0 && (
          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Preview (base = 100)</p>
            <div className="space-y-1">
              {previewItems.map((item, i) => (
                <div key={i} className="flex justify-between text-xs text-gray-600">
                  <span>{item.name}</span>
                  <span>{item.amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-semibold text-gray-900 border-t border-gray-200 pt-1">
                <span>Total tax</span>
                <span>{previewTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          <Label className="mb-0">Set as default group</Label>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} loading={saving} className="flex-1">Save Group</Button>
        </div>
      </div>
    </Dialog>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function TaxesPage() {
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [groups, setGroups] = useState<TaxGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showTaxDialog, setShowTaxDialog] = useState(false);
  const [editTax, setEditTax] = useState<Tax | null>(null);

  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editGroup, setEditGroup] = useState<TaxGroup | null>(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [taxRes, groupRes] = await Promise.all([fetch("/api/taxes"), fetch("/api/tax-groups")]);
    const taxData = await taxRes.json();
    const groupData = await groupRes.json();
    setTaxes(taxData.data ?? []);
    setGroups(groupData.data ?? []);
    setLoading(false);
  }

  async function handleDeleteTax(id: string) {
    if (!confirm("Delete this tax?")) return;
    setDeleteError(null);
    const res = await fetch(`/api/taxes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setDeleteError(data.error ?? "Failed to delete");
    } else {
      fetchAll();
    }
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm("Delete this tax group?")) return;
    await fetch(`/api/tax-groups/${id}`, { method: "DELETE" });
    fetchAll();
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-8">
      {/* Individual Taxes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Taxes</h1>
          <Button onClick={() => { setEditTax(null); setShowTaxDialog(true); }}>+ Add Tax</Button>
        </div>

        {deleteError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{deleteError}</div>
        )}

        <Card>
          <CardContent className="p-0">
            {taxes.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🧾</div>
                <p className="text-gray-500">No taxes configured yet.</p>
                <button onClick={() => { setEditTax(null); setShowTaxDialog(true); }} className="text-blue-600 text-sm hover:underline mt-2">Add your first tax</button>
              </div>
            ) : (
              <Table>
                <TableHead>
                  <tr>
                    <TableTh>Tax</TableTh>
                    <TableTh>Default</TableTh>
                    <TableTh></TableTh>
                  </tr>
                </TableHead>
                <TableBody>
                  {taxes.map((t) => (
                    <TableRow key={t.id}>
                      <TableTd className="font-medium">{taxLabel(t)}</TableTd>
                      <TableTd>{t.isDefault ? "✓ Default" : "—"}</TableTd>
                      <TableTd>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditTax(t); setShowTaxDialog(true); }} className="text-blue-600 text-xs hover:underline">Edit</button>
                          <button onClick={() => handleDeleteTax(t.id)} className="text-red-500 text-xs hover:underline">Delete</button>
                        </div>
                      </TableTd>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tax Groups */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Tax Groups</h2>
            <p className="text-sm text-gray-500 mt-0.5">Combine taxes with custom ordering and compound rules</p>
          </div>
          <Button onClick={() => { setEditGroup(null); setShowGroupDialog(true); }}>+ Add Group</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {groups.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm">No tax groups yet. Groups let you combine multiple taxes with compound rules.</p>
                <button onClick={() => { setEditGroup(null); setShowGroupDialog(true); }} className="text-blue-600 text-sm hover:underline mt-2">Create your first group</button>
              </div>
            ) : (
              <Table>
                <TableHead>
                  <tr>
                    <TableTh>Group Name</TableTh>
                    <TableTh>Taxes</TableTh>
                    <TableTh>Default</TableTh>
                    <TableTh></TableTh>
                  </tr>
                </TableHead>
                <TableBody>
                  {groups.map((g) => (
                    <TableRow key={g.id}>
                      <TableTd className="font-medium">{g.name}</TableTd>
                      <TableTd>
                        <div className="flex flex-wrap gap-1">
                          {g.items.map((item) => (
                            <span key={item.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                              {taxLabel(item.tax)}{item.isCompound ? " ↑" : ""}
                            </span>
                          ))}
                        </div>
                      </TableTd>
                      <TableTd>{g.isDefault ? "✓ Default" : "—"}</TableTd>
                      <TableTd>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditGroup(g); setShowGroupDialog(true); }} className="text-blue-600 text-xs hover:underline">Edit</button>
                          <button onClick={() => handleDeleteGroup(g.id)} className="text-red-500 text-xs hover:underline">Delete</button>
                        </div>
                      </TableTd>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <TaxDialog
        open={showTaxDialog}
        onClose={() => setShowTaxDialog(false)}
        editTax={editTax}
        onSaved={fetchAll}
      />
      <GroupDialog
        open={showGroupDialog}
        onClose={() => setShowGroupDialog(false)}
        allTaxes={taxes}
        editGroup={editGroup}
        onSaved={fetchAll}
      />
    </div>
  );
}
```

- [ ] **Step 2: Export `TaxSelection` from types**

In `types/index.ts`, add the `TaxSelection` export (needed for the page import):

```ts
export type TaxSelection =
  | { type: "tax"; taxId: string; name: string; rate: number; isInclusive: boolean }
  | {
      type: "group";
      groupId: string;
      groupName: string;
      items: Array<{ taxId: string; name: string; rate: number; isInclusive: boolean; isCompound: boolean }>;
    };
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard/taxes"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/taxes/page.tsx types/index.ts
git commit -m "feat: rework taxes page — remove compound toggle, add tax groups section with builder"
```

---

## Task 7: Update Line Items Table

**Files:**
- Modify: `components/documents/line-items-table.tsx`

- [ ] **Step 1: Rewrite the `TaxSelector` component and update `LineItemsTable`**

Replace the entire file with:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, taxLabel, computeLineTaxes, readAppliedTaxes } from "@/lib/utils";
import type { LineItem, Tax, TaxGroup, AppliedTaxSnapshot } from "@/types";

interface LineItemsTableProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  currency?: string;
  taxes?: Tax[];
  taxGroups?: TaxGroup[];
}

// ─── Unified tax dropdown ─────────────────────────────────────────────────

type TaxOption =
  | { kind: "none" }
  | { kind: "tax"; tax: Tax }
  | { kind: "group"; group: TaxGroup };

function TaxDropdown({
  taxes,
  taxGroups,
  value,
  base,
  onChange,
}: {
  taxes: Tax[];
  taxGroups: TaxGroup[];
  value: AppliedTaxSnapshot | null | undefined;
  base: number;  // quantity × unitPrice — used to compute amounts on selection
  onChange: (snapshot: AppliedTaxSnapshot | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const label = !value
    ? "No tax"
    : value.type === "tax"
    ? taxLabel({ name: value.name, rate: value.rate, isInclusive: value.isInclusive })
    : value.groupName;

  function select(option: TaxOption, base: number) {
    if (option.kind === "none") { onChange(null); setOpen(false); return; }
    const result =
      option.kind === "tax"
        ? computeLineTaxes(base, { type: "tax", taxId: option.tax.id, name: option.tax.name, rate: option.tax.rate, isInclusive: option.tax.isInclusive })
        : computeLineTaxes(base, {
            type: "group",
            groupId: option.group.id,
            groupName: option.group.name,
            items: option.group.items.map((i) => ({ taxId: i.taxId, name: i.tax.name, rate: i.tax.rate, isInclusive: i.tax.isInclusive, isCompound: i.isCompound })),
          });
    onChange(result.snapshot);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left rounded-lg border border-gray-300 px-2 py-2 text-sm bg-white truncate"
      >
        {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-64 bg-white rounded-xl border border-gray-200 shadow-lg p-2 space-y-1 max-h-72 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="w-full text-left text-xs text-gray-400 px-2 py-1.5 rounded hover:bg-gray-50"
            >
              No tax
            </button>

            {taxes.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 pt-1">Individual Taxes</p>
                {taxes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => select({ kind: "tax", tax: t }, base)}
                    className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-gray-50"
                  >
                    {taxLabel(t)}
                  </button>
                ))}
              </>
            )}

            {taxGroups.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 pt-1">Tax Groups</p>
                {taxGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => select({ kind: "group", group: g }, base)}
                    className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-gray-50"
                  >
                    {g.name}
                    <span className="text-xs text-gray-400 ml-1">({g.items.length} taxes)</span>
                  </button>
                ))}
              </>
            )}

            {taxes.length === 0 && taxGroups.length === 0 && (
              <p className="text-xs text-gray-400 px-2 py-1">No taxes configured</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Breakdown display under a line item cell ─────────────────────────────

function TaxBreakdown({ snapshot, currency }: { snapshot: AppliedTaxSnapshot | null | undefined; currency: string }) {
  if (!snapshot) return null;
  const items =
    snapshot.type === "tax"
      ? [{ name: taxLabel({ name: snapshot.name, rate: snapshot.rate, isInclusive: snapshot.isInclusive }), amount: snapshot.amount }]
      : snapshot.items.map((i) => ({ name: taxLabel(i), amount: i.amount }));

  return (
    <div className="mt-1 space-y-0.5">
      {items.map((item, i) => (
        <div key={i} className="text-xs text-gray-400 flex justify-between">
          <span>{item.name}</span>
          <span>{formatCurrency(item.amount, currency)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────

export function LineItemsTable({
  items,
  onChange,
  currency = "USD",
  taxes = [],
  taxGroups = [],
}: LineItemsTableProps) {
  const addItem = () => {
    // Pre-select default group, else default tax, else nothing
    const defaultGroup = taxGroups.find((g) => g.isDefault);
    const defaultTax = taxes.find((t) => t.isDefault);
    let defaultSnapshot: AppliedTaxSnapshot | null = null;
    if (defaultGroup) {
      const result = computeLineTaxes(0, {
        type: "group",
        groupId: defaultGroup.id,
        groupName: defaultGroup.name,
        items: defaultGroup.items.map((i) => ({ taxId: i.taxId, name: i.tax.name, rate: i.tax.rate, isInclusive: i.tax.isInclusive, isCompound: i.isCompound })),
      });
      defaultSnapshot = result.snapshot;
    } else if (defaultTax) {
      const result = computeLineTaxes(0, { type: "tax", taxId: defaultTax.id, name: defaultTax.name, rate: defaultTax.rate, isInclusive: defaultTax.isInclusive });
      defaultSnapshot = result.snapshot;
    }
    onChange([...items, { description: "", quantity: 1, unitPrice: 0, taxRate: 0, appliedTaxes: defaultSnapshot, total: 0 }]);
  };

  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      const newItem = { ...item, [field]: value };
      return recalc(newItem);
    });
    onChange(updated);
  };

  const updateTax = (index: number, snapshot: AppliedTaxSnapshot | null) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      return recalcWithSnapshot({ ...item, appliedTaxes: snapshot });
    });
    onChange(updated);
  };

  function recalc(item: LineItem): LineItem {
    return recalcWithSnapshot(item);
  }

  function recalcWithSnapshot(item: LineItem): LineItem {
    const base = item.quantity * item.unitPrice;
    // Use readAppliedTaxes to handle both the new discriminated union format
    // and legacy flat-array format stored in older documents
    const snap = readAppliedTaxes(item.appliedTaxes);
    if (!snap || base === 0) return { ...item, taxRate: 0, total: base };

    let sel: Parameters<typeof computeLineTaxes>[1];
    if (snap.type === "tax") {
      sel = { type: "tax", taxId: snap.taxId, name: snap.name, rate: snap.rate, isInclusive: snap.isInclusive };
    } else {
      sel = {
        type: "group",
        groupId: snap.groupId,
        groupName: snap.groupName,
        items: snap.items.map((i) => ({ taxId: i.taxId, name: i.name, rate: i.rate, isInclusive: i.isInclusive, isCompound: i.isCompound })),
      };
    }

    const { snapshot: newSnap, totalTax, effectiveRate } = computeLineTaxes(base, sel);
    return {
      ...item,
      appliedTaxes: newSnap,
      taxRate: Math.round(effectiveRate * 100) / 100,
      total: base + totalTax,
    };
  }

  const subtotal = items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
  const taxAmount = items.reduce((s, item) => s + (item.total - item.quantity * item.unitPrice), 0);
  const total = subtotal + taxAmount;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Description</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium w-20">Qty</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium w-28">Unit Price</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium w-44">Tax</th>
              <th className="text-right px-3 py-2 text-gray-500 font-medium w-28">Total</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, index) => (
              <tr key={index}>
                <td className="px-3 py-2">
                  <Input value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)} placeholder="Item description" />
                </td>
                <td className="px-3 py-2">
                  <Input type="number" value={item.quantity} onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)} min="0" step="0.01" />
                </td>
                <td className="px-3 py-2">
                  <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)} min="0" step="0.01" />
                </td>
                <td className="px-3 py-2">
                  <TaxDropdown
                    taxes={taxes}
                    taxGroups={taxGroups}
                    value={item.appliedTaxes}
                    base={item.quantity * item.unitPrice}
                    onChange={(snap) => updateTax(index, snap)}
                  />
                  <TaxBreakdown snapshot={item.appliedTaxes} currency={currency} />
                </td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.total, currency)}</td>
                <td className="px-3 py-2">
                  <button type="button" onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addItem}>+ Add Line Item</Button>

      <div className="flex justify-end">
        <div className="w-64 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Tax</span>
            <span>{formatCurrency(taxAmount, currency)}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-2">
            <span>Total</span>
            <span>{formatCurrency(total, currency)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "line-items-table"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/documents/line-items-table.tsx
git commit -m "feat: replace multi-checkbox tax selector with unified single dropdown supporting groups"
```

---

## Task 8: Update New Document Page

**Files:**
- Modify: `app/dashboard/documents/new/page.tsx`

- [ ] **Step 1: Add tax groups fetch and pass to `LineItemsTable`**

In `app/dashboard/documents/new/page.tsx`, add named imports at the top of the file with the other imports:
```ts
import type { Tax, TaxGroup } from "@/types";
```

Then find the `useState` for taxes:
```ts
const [taxes, setTaxes] = useState<Array<{ id: string; name: string; rate: number; isDefault: boolean; isInclusive: boolean; isCompound: boolean }>>([]);
```
Replace with:
```ts
const [taxes, setTaxes] = useState<Tax[]>([]);
const [taxGroups, setTaxGroups] = useState<TaxGroup[]>([]);
```

- [ ] **Step 2: Add the tax-groups fetch in `useEffect`**

Find:
```ts
fetch("/api/taxes").then((r) => r.json()).then((d) => setTaxes(d.data ?? []));
```
Replace with:
```ts
fetch("/api/taxes").then((r) => r.json()).then((d) => setTaxes(d.data ?? []));
fetch("/api/tax-groups").then((r) => r.json()).then((d) => setTaxGroups(d.data ?? []));
```

- [ ] **Step 3: Pass `taxGroups` to `LineItemsTable`**

Find:
```tsx
<LineItemsTable
  items={lineItems}
  onChange={setLineItems}
  currency={form.currency}
  taxes={taxes}
/>
```
Replace with:
```tsx
<LineItemsTable
  items={lineItems}
  onChange={setLineItems}
  currency={form.currency}
  taxes={taxes}
  taxGroups={taxGroups}
/>
```

- [ ] **Step 4: Fix the totals calculation**

The current totals in `new/page.tsx` use a stale simple formula. Replace:
```ts
const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
const taxAmount = lineItems.reduce(
  (sum, item) => sum + item.quantity * item.unitPrice * (item.taxRate / 100),
  0
);
const total = subtotal + taxAmount;
```
With:
```ts
const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
const taxAmount = lineItems.reduce((sum, item) => sum + (item.total - item.quantity * item.unitPrice), 0);
const total = subtotal + taxAmount;
```

- [ ] **Step 5: Verify TypeScript — full clean check**

```bash
npx tsc --noEmit
```

Expected: 0 errors. Fix any remaining errors before proceeding.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/documents/new/page.tsx
git commit -m "feat: pass tax groups to document line items table; fix totals calculation"
```

---

## Task 9: Update PDF Tax Breakdown

**Files:**
- Modify: `lib/pdf.ts`

- [ ] **Step 1: Update the `LineItem` interface in `lib/pdf.ts`**

At the top of `lib/pdf.ts`, the local `LineItem` interface is:
```ts
interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}
```
Add the `appliedTaxes` field:
```ts
interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  appliedTaxes?: import("@/types").AppliedTaxSnapshot | null;
  total: number;
}
```

- [ ] **Step 2: Add `taxLabel` and `readAppliedTaxes` imports**

At the top of `lib/pdf.ts`, update the import from `./utils`:
```ts
import { formatCurrency, formatDate, taxLabel, readAppliedTaxes } from "./utils";
```

- [ ] **Step 3: Replace the single "Tax:" line in the totals section with per-component breakdown**

Find the totals section in `lib/pdf.ts` (around line 320):
```ts
yPos -= 16;
page.drawText("Tax:", { x: totalsX, y: yPos, size: 9, font: regularFont, color: grayColor });
page.drawText(formatCurrency(data.taxAmount, data.currency), {
  x: 490,
  y: yPos,
  size: 9,
  font: regularFont,
  color: darkColor,
});
```

Replace with:

```ts
// Collect all unique tax components across all line items.
// readAppliedTaxes handles both new discriminated union format and legacy flat-array format.
// Snapshot amounts are per-line totals (base = quantity × unitPrice already applied).
const taxComponents: Map<string, { label: string; amount: number }> = new Map();
data.lineItems.forEach((item) => {
  const snap = readAppliedTaxes(item.appliedTaxes);
  if (!snap) return;
  if (snap.type === "tax") {
    const key = snap.taxId;
    const lbl = taxLabel({ name: snap.name, rate: snap.rate, isInclusive: snap.isInclusive });
    const existing = taxComponents.get(key);
    taxComponents.set(key, { label: lbl, amount: (existing?.amount ?? 0) + snap.amount });
  } else {
    snap.items.forEach((component) => {
      const key = component.taxId;
      const lbl = taxLabel(component);
      const existing = taxComponents.get(key);
      taxComponents.set(key, { label: lbl, amount: (existing?.amount ?? 0) + component.amount });
    });
  }
});

if (taxComponents.size > 0) {
  taxComponents.forEach(({ label, amount }) => {
    yPos -= 16;
    page.drawText(`${label}:`, { x: totalsX, y: yPos, size: 9, font: regularFont, color: grayColor });
    page.drawText(formatCurrency(amount, data.currency), { x: 490, y: yPos, size: 9, font: regularFont, color: darkColor });
  });
} else {
  yPos -= 16;
  page.drawText("Tax:", { x: totalsX, y: yPos, size: 9, font: regularFont, color: grayColor });
  page.drawText(formatCurrency(data.taxAmount, data.currency), { x: 490, y: yPos, size: 9, font: regularFont, color: darkColor });
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add lib/pdf.ts
git commit -m "feat: render per-component tax breakdown in PDF from appliedTaxes snapshot"
```

---

## Task 10: Create Migration Script (Optional Cleanup)

**Files:**
- Create: `prisma/migrations/migrate-applied-taxes.ts`

This script transforms existing `LineItem.appliedTaxes` records from the old flat `AppliedTax[]` format to the new `AppliedTaxSnapshot` format. It is optional — `readAppliedTaxes()` handles backward compatibility at read time — but running it cleans up the stored data permanently.

- [ ] **Step 1: Create `prisma/migrations/migrate-applied-taxes.ts`**

```ts
import { PrismaClient } from "@prisma/client";
import type { AppliedTax, AppliedTaxSnapshot } from "../../types";

const prisma = new PrismaClient();

async function main() {
  const lineItems = await prisma.lineItem.findMany({
    where: { appliedTaxes: { not: null } },
  });

  let migrated = 0;
  for (const item of lineItems) {
    const raw = item.appliedTaxes;
    if (!raw || !Array.isArray(raw)) continue; // already new format

    const items = raw as AppliedTax[];
    if (items.length === 0) continue;

    let snapshot: AppliedTaxSnapshot;
    if (items.length === 1) {
      snapshot = {
        type: "tax",
        taxId: items[0].taxId,
        name: items[0].name,
        rate: items[0].rate,
        isInclusive: items[0].isInclusive,
        amount: items[0].amount,
      };
    } else {
      snapshot = {
        type: "group",
        groupId: "__legacy__",
        groupName: "Legacy Taxes",
        items,
      };
    }

    await prisma.lineItem.update({
      where: { id: item.id },
      data: { appliedTaxes: snapshot as object },
    });
    migrated++;
  }

  console.log(`Migrated ${migrated} line items.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run the migration (optional)**

```bash
npx tsx prisma/migrations/migrate-applied-taxes.ts
```

Expected: `Migrated N line items.` with no errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations/migrate-applied-taxes.ts
git commit -m "chore: add optional migration script for legacy appliedTaxes format"
```

---

## Task 11: Manual Verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify tax management**

1. Go to `/dashboard/taxes`
2. Create a tax: name "Excise Duty", rate 15%, Exclusive → label shows "Excise Duty 15% (Exclusive)"
3. Create a tax: name "VAT", rate 16%, Exclusive → label shows "VAT 16% (Exclusive)"
4. Create a tax: name "VAT", rate 16%, Inclusive → label shows "VAT 16% (Inclusive)"
5. Try to delete "VAT 16% (Exclusive)" without creating a group → should succeed
6. Re-create "VAT 16% (Exclusive)"

- [ ] **Step 3: Verify tax group creation**

1. Click "+ Add Group" → dialog opens
2. Name: "Standard Sales Tax"
3. Add step 1: pick "Excise Duty 15% (Exclusive)", "On running total" toggle OFF
4. Add step 2: pick "VAT 16% (Exclusive)", "On running total" toggle ON
5. Live preview should show: Excise Duty: 15.00, VAT: 18.40, Total tax: 33.40
6. Save → group appears in list with tax chips

- [ ] **Step 4: Verify delete protection**

1. Try to delete "Excise Duty 15% (Exclusive)" → should show error listing "Standard Sales Tax"
2. Edit group, remove Excise Duty step, save
3. Try delete again → should succeed

- [ ] **Step 5: Verify document creation**

1. Go to `/dashboard/documents/new`
2. Add a line item, click the Tax dropdown
3. Should see "Individual Taxes" and "Tax Groups" sections
4. Select "Standard Sales Tax" group → breakdown shows Excise Duty and VAT amounts
5. Set unit price to 100, qty 1 → line total should be 133.40
6. Save as draft → navigate to document page

- [ ] **Step 6: Verify PDF generation**

1. Generate PDF for a document with a tax group applied
2. Download and open the PDF
3. Totals section should show "Excise Duty 15% (Exclusive): $X" and "VAT 16% (Exclusive): $Y" instead of a single "Tax: $Z"

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "chore: tax groups implementation complete"
```

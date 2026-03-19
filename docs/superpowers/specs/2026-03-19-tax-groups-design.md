# Tax Groups Design

**Date:** 2026-03-19
**Status:** Approved

## Summary

Replace the current `isCompound` flag on individual taxes with a Tax Groups system. A Tax Group is an ordered collection of individual taxes where compound behavior is defined per step in the group, not on the tax itself. This matches how professional accounting software (Xero, QuickBooks, Wave) handles complex multi-tax scenarios globally.

Individual taxes become simple building blocks (name, rate, inclusive/exclusive). Tax Groups define the order and compound rules for combining them. A line item takes one selection — either an individual tax or a group.

---

## 1. Data Model

### `Tax` (modified)

Remove `isCompound`. A tax is only a rate and an inclusive/exclusive flag.

```prisma
model Tax {
  id          String         @id @default(cuid())
  userId      String
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  rate        Float
  isDefault   Boolean        @default(false)
  isInclusive Boolean        @default(false)
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  taxGroupItems TaxGroupItem[]
}
```

### `TaxGroup` (new)

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
```

### `TaxGroupItem` (new)

Joins a group to a tax. `order` is 1-based. `isCompound` determines whether this step applies on the running total (base + all previous non-inclusive amounts) or just the base.

```prisma
model TaxGroupItem {
  id         String    @id @default(cuid())
  groupId    String
  group      TaxGroup  @relation(fields: [groupId], references: [id], onDelete: Cascade)
  taxId      String
  tax        Tax       @relation(fields: [taxId], references: [id], onDelete: Cascade)
  order      Int
  isCompound Boolean   @default(false)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@unique([groupId, order])
}
```

### `LineItem.appliedTaxes` JSON shape (updated)

The `appliedTaxes` JSON column stores a snapshot at document creation time. Two variants:

**Individual tax:**
```json
{
  "type": "tax",
  "taxId": "cuid",
  "name": "VAT",
  "rate": 16,
  "isInclusive": false,
  "amount": 16.00
}
```

**Tax group:**
```json
{
  "type": "group",
  "groupId": "cuid",
  "groupName": "Telecom Tax",
  "items": [
    { "taxId": "cuid", "name": "Excise Duty", "rate": 15, "isInclusive": false, "isCompound": false, "amount": 15.00 },
    { "taxId": "cuid", "name": "VAT", "rate": 16, "isInclusive": false, "isCompound": true, "amount": 18.40 }
  ]
}
```

Snapshotting ensures existing documents are unaffected if tax rates change after creation.

---

## 2. Display Labels

Tax names are always rendered as auto-generated display labels everywhere (tables, dropdowns, PDF):

```ts
function taxLabel(tax: { name: string; rate: number; isInclusive: boolean }): string {
  return `${tax.name} ${tax.rate}% (${tax.isInclusive ? "Inclusive" : "Exclusive"})`;
}
```

This allows a user to have both "VAT 16% (Inclusive)" and "VAT 16% (Exclusive)" as distinct selectable options with no naming ambiguity.

---

## 3. API

### Taxes (existing, simplified)

| Method | Route | Change |
|--------|-------|--------|
| GET | `/api/taxes` | No change |
| POST | `/api/taxes` | Remove `isCompound` field |
| PUT | `/api/taxes/[id]` | Remove `isCompound` field |
| DELETE | `/api/taxes/[id]` | No change |

### Tax Groups (new)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/tax-groups` | Returns all groups with items + tax details embedded |
| POST | `/api/tax-groups` | Create group: `{ name, isDefault, items: [{ taxId, order, isCompound }] }` |
| PUT | `/api/tax-groups/[id]` | Full replace — group name + items array |
| DELETE | `/api/tax-groups/[id]` | Cascades to items |

The GET response embeds full tax detail in each item so the client doesn't need a second request:
```json
{
  "id": "...",
  "name": "Telecom Tax",
  "isDefault": false,
  "items": [
    { "id": "...", "order": 1, "isCompound": false, "tax": { "id": "...", "name": "Excise Duty", "rate": 15, "isInclusive": false } },
    { "id": "...", "order": 2, "isCompound": true,  "tax": { "id": "...", "name": "VAT", "rate": 16, "isInclusive": false } }
  ]
}
```

---

## 4. Calculation Logic

`computeLineTaxes` in `lib/utils.ts` is updated to accept a unified input and always returns the same output shape.

### Input union type

```ts
type TaxSelection =
  | { type: "tax"; taxId: string; name: string; rate: number; isInclusive: boolean }
  | { type: "group"; groupId: string; groupName: string; items: Array<{ taxId: string; name: string; rate: number; isInclusive: boolean; isCompound: boolean }> }
```

### Calculation order (same logic, now explicit per step)

For each step in order:
1. **Inclusive** — extracted from base: `amount = base × rate / (100 + rate)`
2. **Exclusive, not compound** — applied on base: `amount = base × rate / 100`
3. **Exclusive, compound** — applied on running total: `amount = (base + runningExclusiveSum) × rate / 100`

`runningExclusiveSum` accumulates non-inclusive amounts as steps are processed in order.

### Output

```ts
{
  totalTax: number        // net tax to add (exclusive taxes) or 0 for inclusive
  effectiveRate: number   // for display only
  snapshot: AppliedTaxes  // persisted in LineItem.appliedTaxes
}
```

The function remains pure (no DB calls) so it works identically on the client (live preview) and server (document save).

---

## 5. UI

### Taxes Page (simplified)

- **Form:** name, rate, inclusive/exclusive toggle, default toggle. No compound toggle.
- **Table columns:** Display label (auto-generated), Default badge, Edit / Delete actions.

### Tax Groups (new section on same page, below taxes table)

- "+ Add Group" button opens a dialog.
- **Group builder dialog:**
  - Group name field
  - Ordered list of steps. Each step:
    - Tax picker dropdown (shows display labels of all user taxes)
    - "Apply on running total" toggle (the `isCompound` flag for this step)
    - Up/Down arrows to reorder; remove button
  - "+ Add Step" button
  - **Live preview panel:** shows calculation for a 100-unit base, updating as steps change
- **Group list:** group name, member taxes as chips, default badge, edit/delete

### Line Item Tax Selector (replaces multi-checkbox)

- Single dropdown. Two labeled sections:
  - **Individual Taxes** — lists each tax by display label
  - **Tax Groups** — lists each group by name
- After selection, a small breakdown beneath the cell shows each component and its computed amount.
- Selecting "None" clears the tax.

---

## 6. Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Remove `isCompound` from Tax; add TaxGroup, TaxGroupItem models |
| `lib/utils.ts` | Refactor `computeLineTaxes` to accept unified TaxSelection input |
| `types/index.ts` | Add TaxGroup, TaxGroupItem, update AppliedTaxes shape |
| `app/api/taxes/route.ts` | Remove isCompound from POST |
| `app/api/taxes/[id]/route.ts` | Remove isCompound from PUT |
| `app/api/tax-groups/route.ts` | New: GET, POST |
| `app/api/tax-groups/[id]/route.ts` | New: PUT, DELETE |
| `app/dashboard/taxes/page.tsx` | Remove compound toggle; add Tax Groups section |
| `components/documents/line-items-table.tsx` | Replace multi-checkbox TaxSelector with single dropdown |
| `app/dashboard/documents/new/page.tsx` | Pass groups to LineItemsTable |

---

## 7. Out of Scope

- No country-specific tax presets or defaults
- No expression-based tax calculation
- No mixing of individual taxes and groups on the same line item
- No per-document tax overrides (taxes are managed in settings, applied at line item level)

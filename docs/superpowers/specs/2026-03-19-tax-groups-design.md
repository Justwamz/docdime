# Tax Groups Design

**Date:** 2026-03-19
**Status:** Approved

## Summary

Replace the current `isCompound` flag on individual taxes with a Tax Groups system. A Tax Group is an ordered collection of individual taxes where compound behavior is defined per step in the group, not on the tax itself. This matches how professional accounting software (Xero, QuickBooks, Wave) handles complex multi-tax scenarios globally.

Individual taxes become simple building blocks (name, rate, inclusive/exclusive). Tax Groups define the order and compound rules for combining them. A line item takes one selection — either an individual tax or a tax group (not mixed).

---

## 1. Data Model

### `Tax` (modified)

Remove `isCompound`. A tax is only a rate and an inclusive/exclusive flag.

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

Joins a group to a tax. `order` is 1-based. `isCompound` determines whether this step applies on the running total (base + all previous non-inclusive amounts) or just the base. `isCompound` is silently ignored when the referenced tax is inclusive (inclusive taxes are always extracted from base regardless).

```prisma
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

**Note on `onDelete: Restrict`:** Deleting a `Tax` that is used in one or more groups is blocked at the DB level. The `DELETE /api/taxes/[id]` route must catch this constraint error and return HTTP 409 with a message listing the group names that reference this tax. The user must remove the tax from those groups first.

**Note on `@@unique([groupId, taxId])`:** Prevents the same tax appearing more than once in a group. The API returns 400 if a duplicate taxId appears in the items array.

### `User` (relation update)

Add the `taxGroups` relation to the existing `User` model:

```prisma
model User {
  // ...existing fields unchanged...
  taxes        Tax[]
  taxGroups    TaxGroup[]   // add this line
  // ...other relations...
}
```

### `LineItem.appliedTaxes` — TypeScript type definition

The `appliedTaxes` JSON column shape changes from `AppliedTax[]` (flat array) to a discriminated union. The TypeScript definition in `types/index.ts`:

```ts
export interface AppliedTax {
  taxId: string
  name: string
  rate: number
  isInclusive: boolean
  isCompound: boolean   // always false for individual tax selection
  amount: number
}

export type AppliedTaxSnapshot =
  | {
      type: "tax"
      taxId: string
      name: string
      rate: number
      isInclusive: boolean
      amount: number
    }
  | {
      type: "group"
      groupId: string
      groupName: string
      items: AppliedTax[]
    }

// LineItem updated:
export interface LineItem {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number           // effective rate, for display only
  appliedTaxes?: AppliedTaxSnapshot | null
  total: number
}
```

### Migration for existing documents

Existing `LineItem` records have `appliedTaxes` stored as `AppliedTax[]` (the old flat array format, e.g. `[{ taxId, name, rate, isCompound, isInclusive, amount }]`). A Prisma data migration script (`prisma/migrations/migrate-applied-taxes.ts`) must:

1. Fetch all `LineItem` records where `appliedTaxes IS NOT NULL`
2. For each record, check if `appliedTaxes` is an array (old format) or has a `type` field (new format)
3. If old format: wrap as `{ type: "tax", taxId: items[0].taxId, name: items[0].name, rate: items[0].rate, isInclusive: items[0].isInclusive, amount: items[0].amount }` for single-item arrays, or as `{ type: "group", groupId: "__legacy__", groupName: "Legacy Taxes", items: [...] }` for multi-item arrays
4. Write back the transformed value

A backward-compatible reader utility is also provided in `lib/utils.ts`:

```ts
export function readAppliedTaxes(raw: unknown): AppliedTaxSnapshot | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    // Legacy format: flat array
    const items = raw as AppliedTax[]
    if (items.length === 0) return null
    if (items.length === 1) return { type: "tax", taxId: items[0].taxId, name: items[0].name, rate: items[0].rate, isInclusive: items[0].isInclusive, amount: items[0].amount }
    return { type: "group", groupId: "__legacy__", groupName: "Legacy Taxes", items }
  }
  return raw as AppliedTaxSnapshot
}
```

This ensures all existing documents render correctly without a required data migration, and the data migration can be run separately as a cleanup step.

---

## 2. Display Labels

Tax names are always rendered as auto-generated display labels everywhere (tables, dropdowns, PDF):

```ts
export function taxLabel(tax: { name: string; rate: number; isInclusive: boolean }): string {
  return `${tax.name} ${tax.rate}% (${tax.isInclusive ? "Inclusive" : "Exclusive"})`
}
```

This allows a user to have both "VAT 16% (Inclusive)" and "VAT 16% (Exclusive)" as distinct selectable options with no naming ambiguity. Applied everywhere: taxes table, tax group builder, line item dropdown, applied tax breakdown, PDF.

---

## 3. API

### Taxes (existing, simplified)

| Method | Route | Change |
|--------|-------|--------|
| GET | `/api/taxes` | No change |
| POST | `/api/taxes` | Remove `isCompound` field |
| PUT | `/api/taxes/[id]` | Remove `isCompound` field |
| DELETE | `/api/taxes/[id]` | Return 409 with group names if tax is used in any group |

**DELETE `/api/taxes/[id]` conflict response:**
```json
{ "error": "This tax is used in the following groups: Telecom Tax, Standard Rates. Remove it from those groups first." }
```

### Tax Groups (new)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/tax-groups` | Returns all groups with items + tax details embedded |
| POST | `/api/tax-groups` | Create group: `{ name, isDefault, items: [{ taxId, order, isCompound }] }` |
| PUT | `/api/tax-groups/[id]` | Full replace (see semantics below) |
| DELETE | `/api/tax-groups/[id]` | Cascades to items |

**GET response shape:**
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

**PUT full replace semantics:** The implementation must delete all existing `TaxGroupItem` records for the group inside a transaction, then insert the new items array. This avoids partial-update bugs. The group name and `isDefault` are also updated in the same transaction.

**POST/PUT validation:**
- `items` array must have at least 1 entry → 400 "A group must have at least one tax"
- Duplicate `taxId` in items array → 400 "A tax cannot appear more than once in a group"
- `isDefault: true` → clear all other `TaxGroup.isDefault` for this user (same pattern as Tax)

### `isDefault` coordination rule

`Tax.isDefault` and `TaxGroup.isDefault` are independent. Setting a group as default does not clear individual tax defaults, and vice versa. When a new line item is added, the UI pre-selects whichever is marked default — if both exist, the group default takes precedence (groups are the primary recommended mechanism). If neither is set, the line item starts with no tax selected.

---

## 4. Calculation Logic

`computeLineTaxes` in `lib/utils.ts` is updated to accept a unified input and always returns the same output shape. The function remains pure (no DB calls) so it works identically on the client (live preview) and server (document save).

### Input union type

```ts
type TaxSelection =
  | { type: "tax"; taxId: string; name: string; rate: number; isInclusive: boolean }
  | {
      type: "group"
      groupId: string
      groupName: string
      items: Array<{ taxId: string; name: string; rate: number; isInclusive: boolean; isCompound: boolean }>
    }
```

For an individual tax input, it is internally normalized to a single-item group with `isCompound: false` before calculation. This keeps the calculation logic to one path.

### Calculation order (applied to items in `order` sequence)

For each step:
1. **Inclusive** — extracted from base: `amount = base × rate / (100 + rate)`. `isCompound` is ignored for inclusive taxes.
2. **Exclusive, not compound** — applied on base: `amount = base × rate / 100`. Accumulates into `runningExclusiveSum`.
3. **Exclusive, compound** — applied on running total: `amount = (base + runningExclusiveSum) × rate / 100`. Accumulates into `runningExclusiveSum`.

### Output

```ts
{
  totalTax: number        // sum of all exclusive tax amounts (inclusive taxes are extracted, not added)
  effectiveRate: number   // (totalTax / base) × 100 — exclusive taxes only, for display
  snapshot: AppliedTaxSnapshot
}
```

**`effectiveRate` note:** For a group containing both inclusive and exclusive taxes, `effectiveRate` only reflects the exclusive portion (the amount added to the total). This is the correct value for the `LineItem.taxRate` column and is consistent with how the existing implementation works. The PDF must use the per-component `amount` values from the snapshot for accurate breakdown display, not `effectiveRate`.

---

## 5. UI

### Taxes Page (simplified)

- **Form:** name, rate, inclusive/exclusive toggle, default toggle. No compound toggle.
- **Table columns:** Display label (auto-generated via `taxLabel()`), Default badge, Edit / Delete actions.
- **Delete:** If the tax is used in a group, show an inline error message instead of deleting.

### Tax Groups (new section on same page, below taxes table)

- "+ Add Group" button opens a dialog.
- **Group builder dialog:**
  - Group name field (required)
  - Ordered list of steps. Each step:
    - Tax picker dropdown showing `taxLabel()` display labels for all user taxes
    - "Apply on running total" toggle (the `isCompound` flag for this step) — **disabled and unchecked when the selected tax is inclusive** (inclusive taxes are always extracted from base; compound has no meaning)
    - Up/Down buttons to reorder; remove button
  - "+ Add Step" button
  - Validation: at least 1 step required before saving
  - **Live preview panel:** displays a table showing each step's name, rate type, and computed tax amount for a dimensionless base of 100. No currency symbol — just plain numbers (e.g. "Excise Duty: 15.00", "VAT: 18.40", "Total tax: 33.40"). Labeled "Preview (base = 100)". Updates live as steps change.
  - `order` values are always compacted to sequential integers (1, 2, 3, ...) when saving, regardless of UI reordering or step deletion.
- **Group list:** group name, member taxes as display label chips, default badge, edit/delete.
- **Default toggle:** setting a group as default is independent of the individual tax default. If both are set, the group takes precedence in the line item selector.

### Line Item Tax Selector (replaces multi-checkbox)

- Single dropdown. Two labeled sections:
  - **Individual Taxes** — lists each tax by `taxLabel()` display label
  - **Tax Groups** — lists each group by group name
- After selection, a small breakdown beneath the cell shows each component and its computed amount (formatted in the document currency).
- "None" option at the top clears the tax selection.
- On page load, pre-select the default group (if set), else the default individual tax (if set), else no tax.

---

## 6. Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Remove `isCompound` from Tax; add TaxGroup, TaxGroupItem; add `taxGroups` relation to User |
| `lib/utils.ts` | Refactor `computeLineTaxes` to accept unified `TaxSelection` input; add `taxLabel()` helper; add `readAppliedTaxes()` backward-compat reader |
| `types/index.ts` | Add TaxGroup, TaxGroupItem types; replace `AppliedTax[]` on LineItem with `AppliedTaxSnapshot` discriminated union |
| `app/api/taxes/route.ts` | Remove `isCompound` from POST |
| `app/api/taxes/[id]/route.ts` | Remove `isCompound` from PUT; return 409 with group names on DELETE conflict |
| `app/api/tax-groups/route.ts` | New: GET, POST |
| `app/api/tax-groups/[id]/route.ts` | New: PUT (full replace in transaction), DELETE |
| `app/dashboard/taxes/page.tsx` | Remove compound toggle; add Tax Groups section with group builder dialog |
| `components/documents/line-items-table.tsx` | Replace multi-checkbox `TaxSelector` with single dropdown accepting both taxes and groups |
| `app/dashboard/documents/new/page.tsx` | Fetch both `/api/taxes` and `/api/tax-groups`; pass both to `LineItemsTable` |
| `lib/pdf.ts` | Update totals section to render per-component tax breakdown from `appliedTaxes` snapshot (e.g. "Excise Duty: $15.00", "VAT: $18.40") instead of a single "Tax" line |
| `prisma/migrations/migrate-applied-taxes.ts` | Optional cleanup script to transform old `AppliedTax[]` format to new `AppliedTaxSnapshot` format |

---

## 7. Out of Scope

- No country-specific tax presets or defaults
- No expression-based tax calculation
- No mixing of individual taxes and groups on the same line item
- No per-document tax overrides (taxes are managed in settings, applied at line item level)

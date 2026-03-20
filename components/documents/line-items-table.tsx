"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, taxLabel, computeLineTaxes } from "@/lib/utils";
import type { LineItem, Tax, TaxGroup, TaxSelection, AppliedTaxSnapshot } from "@/types";

interface LineItemsTableProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  currency?: string;
  taxes?: Tax[];
  taxGroups?: TaxGroup[];
}

// ---------------------------------------------------------------------------
// TaxDropdown
// ---------------------------------------------------------------------------

interface TaxDropdownProps {
  taxes: Tax[];
  taxGroups: TaxGroup[];
  value: string; // "", "tax:{id}", or "group:{id}"
  onChange: (key: string) => void;
  base: number;
}

function TaxDropdown({ taxes, taxGroups, value, onChange }: TaxDropdownProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm bg-white"
    >
      <option value="">None</option>

      {taxes.length > 0 && (
        <optgroup label="Individual Taxes">
          {taxes.map((t) => (
            <option key={t.id} value={`tax:${t.id}`}>
              {taxLabel(t)}
            </option>
          ))}
        </optgroup>
      )}

      {taxGroups.length > 0 && (
        <optgroup label="Tax Groups">
          {taxGroups.map((g) => (
            <option key={g.id} value={`group:${g.id}`}>
              {g.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive the selection key stored on a line item's appliedTaxes snapshot. */
function selectionKeyFromItem(item: LineItem): string {
  if (!item.appliedTaxes) return "";
  if (item.appliedTaxes.type === "tax") return `tax:${item.appliedTaxes.taxId}`;
  if (item.appliedTaxes.type === "group" && item.appliedTaxes.groupId !== "__legacy__") {
    return `group:${item.appliedTaxes.groupId}`;
  }
  return "";
}

/** Build a TaxSelection from a selection key, using the available taxes/groups. */
function buildSelection(
  key: string,
  taxes: Tax[],
  taxGroups: TaxGroup[]
): TaxSelection | null {
  if (!key) return null;

  if (key.startsWith("tax:")) {
    const id = key.slice(4);
    const tax = taxes.find((t) => t.id === id);
    if (!tax) return null;
    return {
      type: "tax",
      taxId: tax.id,
      name: tax.name,
      rate: tax.rate,
      isInclusive: tax.isInclusive,
    };
  }

  if (key.startsWith("group:")) {
    const id = key.slice(6);
    const group = taxGroups.find((g) => g.id === id);
    if (!group) return null;
    return {
      type: "group",
      groupId: group.id,
      groupName: group.name,
      isCompound: group.isCompound,
      items: group.items.map((item) => ({
        taxId: item.taxId,
        name: item.tax.name,
        rate: item.tax.rate,
        isInclusive: item.tax.isInclusive,
      })),
    };
  }

  return null;
}

/** Recalculate totals for a line item given a selection key. */
function recalcItem(
  item: LineItem,
  key: string,
  taxes: Tax[],
  taxGroups: TaxGroup[]
): LineItem {
  const base = item.quantity * item.unitPrice;
  const selection = buildSelection(key, taxes, taxGroups);

  if (!selection) {
    return {
      ...item,
      taxRate: 0,
      appliedTaxes: null,
      total: base,
    };
  }

  const { snapshot, totalTax, effectiveRate } = computeLineTaxes(base, selection);

  // For a group snapshot with no items (empty group), treat as no tax.
  const resolvedSnapshot: AppliedTaxSnapshot | null =
    snapshot.type === "group" && snapshot.items.length === 0 ? null : snapshot;

  return {
    ...item,
    taxRate: Math.round(effectiveRate * 100) / 100,
    appliedTaxes: resolvedSnapshot,
    total: base + totalTax,
  };
}

/** Determine the default selection key (group > tax > none). */
function defaultSelectionKey(taxes: Tax[], taxGroups: TaxGroup[]): string {
  const defaultGroup = taxGroups.find((g) => g.isDefault);
  if (defaultGroup) return `group:${defaultGroup.id}`;
  const defaultTax = taxes.find((t) => t.isDefault);
  if (defaultTax) return `tax:${defaultTax.id}`;
  return "";
}

// ---------------------------------------------------------------------------
// LineItemsTable
// ---------------------------------------------------------------------------

export function LineItemsTable({
  items,
  onChange,
  currency = "USD",
  taxes = [],
  taxGroups = [],
}: LineItemsTableProps) {
  const hasTaxOptions = taxes.length > 0 || taxGroups.length > 0;

  const defaultKey = useMemo(
    () => defaultSelectionKey(taxes, taxGroups),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [taxes.map((t) => t.id).join(","), taxGroups.map((g) => g.id).join(",")]
  );

  const addItem = () => {
    const base = 0;
    const newItem: LineItem = {
      description: "",
      quantity: 1,
      unitPrice: 0,
      taxRate: 0,
      appliedTaxes: null,
      total: base,
    };
    const prepped = recalcItem(newItem, defaultKey, taxes, taxGroups);
    onChange([...items, prepped]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      const newItem = { ...item, [field]: value };
      // Re-run tax computation using the existing selection key when qty/price change.
      const key = selectionKeyFromItem(newItem);
      return recalcItem(newItem, key, taxes, taxGroups);
    });
    onChange(updated);
  };

  const updateTaxSelection = (index: number, key: string) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      return recalcItem(item, key, taxes, taxGroups);
    });
    onChange(updated);
  };

  const subtotal = items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
  const taxAmount = items.reduce((s, item) => {
    const base = item.quantity * item.unitPrice;
    return s + (item.total - base);
  }, 0);
  const total = subtotal + taxAmount;

  return (
    <div className="space-y-4">
      {/* Mobile: stacked cards */}
      <div className="sm:hidden space-y-3">
        {items.map((item, index) => {
          const selKey = selectionKeyFromItem(item);
          const snapshot = item.appliedTaxes;
          return (
            <div key={index} className="border border-gray-200 rounded-xl p-3 space-y-2 bg-gray-50">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Item description"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-gray-400 hover:text-red-500 transition-colors mt-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Qty</p>
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Unit Price</p>
                  <Input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              {hasTaxOptions && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Tax</p>
                  <TaxDropdown
                    taxes={taxes}
                    taxGroups={taxGroups}
                    value={selKey}
                    onChange={(key) => updateTaxSelection(index, key)}
                    base={item.quantity * item.unitPrice}
                  />
                  {snapshot && (
                    <div className="mt-1 space-y-0.5">
                      {snapshot.type === "tax" ? (
                        <div className="text-xs text-gray-400 flex justify-between">
                          <span>{taxLabel({ name: snapshot.name, rate: snapshot.rate, isInclusive: snapshot.isInclusive })}</span>
                          <span>{formatCurrency(snapshot.amount, currency)}</span>
                        </div>
                      ) : (
                        snapshot.items.map((a) => (
                          <div key={a.taxId} className="text-xs text-gray-400 flex justify-between">
                            <span>{taxLabel({ name: a.name, rate: a.rate, isInclusive: a.isInclusive })}{a.isCompound ? " (cmpd.)" : ""}</span>
                            <span>{formatCurrency(a.amount, currency)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                <span className="text-xs text-gray-500">Total</span>
                <span className="text-sm font-semibold">{formatCurrency(item.total, currency)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
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
            {items.map((item, index) => {
              const selKey = selectionKeyFromItem(item);
              const snapshot = item.appliedTaxes;

              return (
                <tr key={index}>
                  <td className="px-3 py-2">
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      placeholder="Item description"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(index, "quantity", parseFloat(e.target.value) || 0)
                      }
                      min="0"
                      step="0.01"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)
                      }
                      min="0"
                      step="0.01"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {hasTaxOptions ? (
                      <div>
                        <TaxDropdown
                          taxes={taxes}
                          taxGroups={taxGroups}
                          value={selKey}
                          onChange={(key) => updateTaxSelection(index, key)}
                          base={item.quantity * item.unitPrice}
                        />
                        {/* Tax breakdown below the dropdown */}
                        {snapshot && (
                          <div className="mt-1 space-y-0.5">
                            {snapshot.type === "tax" ? (
                              <div className="text-xs text-gray-400 flex justify-between">
                                <span>
                                  {taxLabel({
                                    name: snapshot.name,
                                    rate: snapshot.rate,
                                    isInclusive: snapshot.isInclusive,
                                  })}
                                </span>
                                <span>{formatCurrency(snapshot.amount, currency)}</span>
                              </div>
                            ) : (
                              snapshot.items.map((a) => (
                                <div
                                  key={a.taxId}
                                  className="text-xs text-gray-400 flex justify-between"
                                >
                                  <span>
                                    {taxLabel({
                                      name: a.name,
                                      rate: a.rate,
                                      isInclusive: a.isInclusive,
                                    })}
                                                                      </span>
                                  <span>{formatCurrency(a.amount, currency)}</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Input
                        type="number"
                        value={item.taxRate}
                        onChange={(e) =>
                          updateItem(index, "taxRate", parseFloat(e.target.value) || 0)
                        }
                        min="0"
                        max="100"
                        step="0.01"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatCurrency(item.total, currency)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addItem}>
        + Add Line Item
      </Button>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-full sm:w-64 space-y-2">
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

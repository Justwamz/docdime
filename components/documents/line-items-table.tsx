"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { computeLineTaxes } from "@/lib/utils";
import type { AppliedTax, LineItem, Tax } from "@/types";

interface LineItemsTableProps {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  currency?: string;
  taxes?: Tax[];
}

function TaxSelector({
  allTaxes,
  selectedIds,
  onChange,
}: {
  allTaxes: Tax[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    );
  };

  const label =
    selectedIds.length === 0
      ? "No tax"
      : allTaxes
          .filter((t) => selectedIds.includes(t.id))
          .map((t) => t.name)
          .join(", ");

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
          <div className="absolute z-20 mt-1 w-56 bg-white rounded-xl border border-gray-200 shadow-lg p-2 space-y-1">
            {allTaxes.length === 0 && (
              <p className="text-xs text-gray-400 px-2 py-1">No taxes configured</p>
            )}
            {allTaxes.map((tax) => (
              <label key={tax.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(tax.id)}
                  onChange={() => toggle(tax.id)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm flex-1">{tax.name}</span>
                <span className="text-xs text-gray-400">{tax.rate}%{tax.isInclusive ? " incl." : ""}</span>
              </label>
            ))}
            <button
              type="button"
              onClick={() => { onChange([]); setOpen(false); }}
              className="w-full text-left text-xs text-gray-400 px-2 py-1 hover:text-red-500"
            >
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function LineItemsTable({
  items,
  onChange,
  currency = "USD",
  taxes = [],
}: LineItemsTableProps) {
  const addItem = () => {
    onChange([
      ...items,
      { description: "", quantity: 1, unitPrice: 0, taxRate: 0, appliedTaxes: null, total: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      const newItem = { ...item, [field]: value };
      return recalc(newItem);
    });
    onChange(updated);
  };

  const updateTaxes = (index: number, selectedIds: string[]) => {
    const updated = items.map((item, i) => {
      if (i !== index) return item;
      const selectedTaxes = taxes.filter((t) => selectedIds.includes(t.id));
      const newItem = { ...item, _selectedTaxIds: selectedIds, _selectedTaxes: selectedTaxes };
      return recalcWithTaxes(newItem, selectedTaxes);
    });
    onChange(updated);
  };

  function recalc(item: LineItem & { _selectedTaxes?: Tax[] }) {
    return recalcWithTaxes(item, item._selectedTaxes ?? getSelectedTaxes(item));
  }

  function getAppliedTaxItems(item: LineItem): AppliedTax[] {
    if (!item.appliedTaxes) return [];
    if (item.appliedTaxes.type === "group") return item.appliedTaxes.items;
    // type === "tax": single-tax snapshot
    const s = item.appliedTaxes;
    return [{ taxId: s.taxId, name: s.name, rate: s.rate, isInclusive: s.isInclusive, isCompound: false, amount: s.amount }];
  }

  function getSelectedTaxes(item: LineItem): Tax[] {
    const applied = getAppliedTaxItems(item);
    if (!applied.length) return [];
    return taxes.filter((t) => applied.some((a) => a.taxId === t.id));
  }

  function recalcWithTaxes(item: LineItem & { _selectedTaxes?: Tax[]; _selectedTaxIds?: string[] }, selectedTaxes: Tax[]): LineItem {
    const base = item.quantity * item.unitPrice;
    const taxItems = selectedTaxes.map((t) => ({
      taxId: t.id,
      name: t.name,
      rate: t.rate,
      isCompound: false, // TODO Task 7: isCompound comes from TaxGroupItem, not Tax
      isInclusive: t.isInclusive,
    }));
    const selection: import("@/types").TaxSelection = {
      type: "group",
      groupId: "",
      groupName: "",
      items: taxItems,
    };
    const { snapshot: rawSnapshot, totalTax, effectiveRate } = computeLineTaxes(base, selection);
    const snapshot = rawSnapshot && rawSnapshot.type === "group" && rawSnapshot.items.length > 0
      ? rawSnapshot
      : null;
    return {
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: Math.round(effectiveRate * 100) / 100,
      appliedTaxes: snapshot,
      total: base + totalTax,
    };
  }

  const subtotal = items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
  const taxAmount = items.reduce((s, item) => {
    const base = item.quantity * item.unitPrice;
    return s + (item.total - base);
  }, 0);
  const total = subtotal + taxAmount;

  // Build a map of selected tax IDs per item from appliedTaxes
  function getSelectedIds(item: LineItem): string[] {
    return getAppliedTaxItems(item).map((a) => a.taxId);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-3 py-2 text-gray-500 font-medium">Description</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium w-20">Qty</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium w-28">Unit Price</th>
              <th className="text-left px-3 py-2 text-gray-500 font-medium w-36">Tax</th>
              <th className="text-right px-3 py-2 text-gray-500 font-medium w-28">Total</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, index) => (
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
                    onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.01"
                  />
                </td>
                <td className="px-3 py-2">
                  {taxes.length > 0 ? (
                    <div>
                      <TaxSelector
                        allTaxes={taxes}
                        selectedIds={getSelectedIds(item)}
                        onChange={(ids) => updateTaxes(index, ids)}
                      />
                      {getAppliedTaxItems(item).length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {getAppliedTaxItems(item).map((a) => (
                            <div key={a.taxId} className="text-xs text-gray-400 flex justify-between">
                              <span>{a.name}{a.isInclusive ? " (incl.)" : a.isCompound ? " (cmpd.)" : ""}</span>
                              <span>{formatCurrency(a.amount, currency)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Input
                      type="number"
                      value={item.taxRate}
                      onChange={(e) => updateItem(index, "taxRate", parseFloat(e.target.value) || 0)}
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
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addItem}>
        + Add Line Item
      </Button>

      {/* Totals */}
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

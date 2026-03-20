import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { AppliedTax, AppliedTaxSnapshot, TaxSelection } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function generateDocNumber(type: string, count: number): string {
  const prefix = type === "INVOICE" ? "INV" : type === "QUOTE" ? "QTE" : "PO";
  const num = String(count + 1).padStart(3, "0");
  return `${prefix}-${num}`;
}

export function isOverdue(doc: {
  type: string;
  status: string;
  dueDate?: Date | string | null;
}): boolean {
  if (doc.type !== "INVOICE") return false;
  if (doc.status === "PAID" || doc.status === "CANCELLED") return false;
  if (!doc.dueDate) return false;
  return new Date(doc.dueDate) < new Date();
}

export function isExpired(doc: {
  type: string;
  status: string;
  expiryDate?: Date | string | null;
}): boolean {
  if (doc.type !== "QUOTE") return false;
  if (doc.status === "ACCEPTED" || doc.status === "CANCELLED") return false;
  if (!doc.expiryDate) return false;
  return new Date(doc.expiryDate) < new Date();
}

export function taxLabel(tax: { name: string; rate: number; isInclusive: boolean }): string {
  return `${tax.name} ${tax.rate}% (${tax.isInclusive ? "Inclusive" : "Exclusive"})`;
}

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

/**
 * Compute tax breakdown for a line item given a TaxSelection.
 *
 * Simple tax / simple group: each tax applied independently on base.
 * Compound group: taxes applied in order, each on (base + all previous exclusive amounts).
 * Inclusive taxes: always extracted from base price (never added to total).
 */
export function computeLineTaxes(
  base: number,
  selection: TaxSelection
): { totalTax: number; effectiveRate: number; snapshot: AppliedTaxSnapshot } {
  const isCompoundGroup = selection.type === "group" && selection.isCompound;

  const items =
    selection.type === "tax"
      ? [{ taxId: selection.taxId, name: selection.name, rate: selection.rate, isInclusive: selection.isInclusive }]
      : selection.items;

  let runningExclusiveSum = 0;
  const itemAmounts: number[] = new Array(items.length).fill(0);

  if (isCompoundGroup && items.every((t) => t.isInclusive)) {
    // Compound inclusive: retail = trueBase × Π(1 + rate_i/100)
    // Work backwards to find trueBase, then distribute forward
    const factor = items.reduce((f, t) => f * (1 + t.rate / 100), 1);
    let running = base / factor; // true pre-tax base
    items.forEach((t, i) => {
      const amount = (running * t.rate) / 100;
      itemAmounts[i] = Math.round(amount * 100) / 100;
      running += amount;
    });
    // runningExclusiveSum stays 0 — taxes are embedded in retail price, total unchanged
  } else {
    items.forEach((t, i) => {
      let amount: number;
      if (t.isInclusive) {
        // Simple inclusive: extract from original base, does not add to total
        amount = (base * t.rate) / (100 + t.rate);
      } else if (isCompoundGroup) {
        // Compound exclusive: apply on base + all previous exclusive amounts (tax-on-tax)
        amount = ((base + runningExclusiveSum) * t.rate) / 100;
        runningExclusiveSum += amount;
      } else {
        // Simple exclusive: apply on base independently
        amount = (base * t.rate) / 100;
        runningExclusiveSum += amount;
      }
      itemAmounts[i] = Math.round(amount * 100) / 100;
    });
  }

  const totalTax = runningExclusiveSum;
  const effectiveRate = base > 0 ? (totalTax / base) * 100 : 0;

  let snapshot: AppliedTaxSnapshot;
  if (selection.type === "tax") {
    snapshot = {
      type: "tax",
      taxId: selection.taxId,
      name: selection.name,
      rate: selection.rate,
      isInclusive: selection.isInclusive,
      amount: itemAmounts[0],
    };
  } else {
    snapshot = {
      type: "group",
      groupId: selection.groupId,
      groupName: selection.groupName,
      items: items.map((t, i) => ({
        taxId: t.taxId,
        name: t.name,
        rate: t.rate,
        isInclusive: t.isInclusive,
        isCompound: isCompoundGroup,
        amount: itemAmounts[i],
      })),
    };
  }

  return { totalTax, effectiveRate, snapshot };
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

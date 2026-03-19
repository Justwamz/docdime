import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "KES"): string {
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

/**
 * Compute tax breakdown for a line item.
 *
 * Order of application:
 *  1. Inclusive taxes  — extracted from the unit price, don't change the total
 *  2. Non-compound exclusive taxes — applied on base
 *  3. Compound exclusive taxes     — applied on (base + non-compound exclusive amounts)
 *
 * Returns each tax with its computed amount, plus the total tax amount.
 */
export function computeLineTaxes(
  base: number, // quantity × unitPrice
  taxes: Array<{ taxId: string; name: string; rate: number; isCompound: boolean; isInclusive: boolean }>
): { breakdown: Array<{ taxId: string; name: string; rate: number; isCompound: boolean; isInclusive: boolean; amount: number }>; totalTax: number; effectiveRate: number } {
  if (!taxes.length || base === 0) return { breakdown: [], totalTax: 0, effectiveRate: 0 };

  let nonCompoundSum = 0;
  const breakdown = taxes.map((t) => {
    let amount: number;
    if (t.isInclusive) {
      // Tax is already inside the price: amount = base × rate / (100 + rate)
      amount = (base * t.rate) / (100 + t.rate);
    } else if (t.isCompound) {
      // Applied on (base + all non-compound exclusive taxes accumulated so far)
      amount = ((base + nonCompoundSum) * t.rate) / 100;
    } else {
      amount = (base * t.rate) / 100;
      nonCompoundSum += amount;
    }
    return { ...t, amount: Math.round(amount * 100) / 100 };
  });

  const totalTax = breakdown.reduce((s, t) => s + (t.isInclusive ? 0 : t.amount), 0);
  const effectiveRate = base > 0 ? (totalTax / base) * 100 : 0;
  return { breakdown, totalTax, effectiveRate };
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

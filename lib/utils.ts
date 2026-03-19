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

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

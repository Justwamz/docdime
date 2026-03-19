import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      isAdmin: boolean;
      plan: string;
      onboardingDone: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    isAdmin: boolean;
    plan: string;
    onboardingDone: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    isAdmin: boolean;
    plan: string;
    onboardingDone: boolean;
  }
}

export type DocumentType = "INVOICE" | "QUOTE" | "PURCHASE_ORDER";
export type DocumentStatus =
  | "DRAFT"
  | "SENT"
  | "PAID"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED";
export type Plan = "PAY_PER_USE" | "PRO";

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

export interface Document {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  docNumber: string;
  issueDate: string;
  dueDate?: string;
  expiryDate?: string;
  notes?: string;
  terms?: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  pdfUrl?: string;
  paid: boolean;
  customer?: Customer;
  lineItems: LineItem[];
  createdAt: string;
  updatedAt: string;
  isOverdue?: boolean;
  isExpired?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface Tax {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
  isInclusive: boolean;
}

export interface BankingDetails {
  // Mobile money (e.g. M-Pesa)
  mpesaNumber?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  // Nigeria
  bankCode?: string;
  // South Africa
  branchCode?: string;
  // International
  iban?: string;
  swift?: string;
  routingNumber?: string;
  bsb?: string;
}

export interface CountryConfig {
  name: string;
  currency: string;
  bankingFields: string[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

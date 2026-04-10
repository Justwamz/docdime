import { prisma } from "./prisma";

const PAYSTACK_BASE = "https://api.paystack.co";

async function getSecretKey(): Promise<string> {
  const setting = await prisma.appSettings.findUnique({
    where: { key: "paystack_secret_key" },
  });
  if (setting?.value) return setting.value;
  return process.env.PAYSTACK_SECRET_KEY ?? "";
}

export async function getPaystackPublicKey(): Promise<string> {
  const setting = await prisma.appSettings.findUnique({
    where: { key: "paystack_public_key" },
  });
  if (setting?.value) return setting.value;
  return process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "";
}

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface VerifyData {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at: string;
  metadata?: Record<string, unknown>;
  customer: { email: string };
}

export async function verifyPayment(reference: string): Promise<VerifyData> {
  const secretKey = await getSecretKey();
  const response = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${reference}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    }
  );

  const result: PaystackResponse<VerifyData> = await response.json();
  if (!result.status) throw new Error(result.message || "Payment verification failed");
  return result.data;
}

export function generateReference(): string {
  return `DOCDIME-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

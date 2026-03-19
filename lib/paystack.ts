const PAYSTACK_BASE = "https://api.paystack.co";
const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;

interface InitializePaymentParams {
  email: string;
  amount: number; // in kobo/cents (amount * 100)
  currency?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
  callback_url?: string;
}

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface InitializeData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

interface VerifyData {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at: string;
  metadata?: Record<string, unknown>;
  customer: {
    email: string;
  };
}

export async function initializePayment(
  params: InitializePaymentParams
): Promise<InitializeData> {
  const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...params,
      amount: Math.round(params.amount * 100), // convert to kobo/cents
    }),
  });

  const result: PaystackResponse<InitializeData> = await response.json();

  if (!result.status) {
    throw new Error(result.message || "Payment initialization failed");
  }

  return result.data;
}

export async function verifyPayment(reference: string): Promise<VerifyData> {
  const response = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
      },
    }
  );

  const result: PaystackResponse<VerifyData> = await response.json();

  if (!result.status) {
    throw new Error(result.message || "Payment verification failed");
  }

  return result.data;
}

export function generateReference(): string {
  return `DOCDIME-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MockPaystackModal } from "@/components/paystack/mock-paystack-modal";

declare global {
  interface Window {
    PaystackPop: {
      setup: (config: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

export default function SubscriptionActions({
  action,
  email,
  proAnnualUsd = 20,
  paystackPublicKey,
}: {
  action: "upgrade" | "cancel";
  email?: string;
  proAnnualUsd?: number;
  paystackPublicKey?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mockPayment, setMockPayment] = useState<{
    reference: string;
    amountInKobo: number;
  } | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    const res = await fetch("/api/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "initialize_upgrade" }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) return;

    // Test mode — show mock Paystack modal
    if (data.testMode) {
      setMockPayment({ reference: data.reference, amountInKobo: data.amountInKobo });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => {
      const handler = window.PaystackPop.setup({
        key: paystackPublicKey || process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
        email,
        amount: data.amountInKobo,
        currency: "USD",
        ref: data.reference,
        callback: async (response: { reference: string }) => {
          setLoading(true);
          await fetch("/api/subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "verify_upgrade", reference: response.reference }),
          });
          setLoading(false);
          router.refresh();
        },
        onClose: () => setLoading(false),
      });
      handler.openIframe();
    };
    document.body.appendChild(script);
  }

  async function handleMockPaymentSuccess(reference: string) {
    setMockPayment(null);
    setLoading(true);
    await fetch("/api/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify_upgrade", reference }),
    });
    setLoading(false);
    router.refresh();
  }

  async function handleCancel() {
    if (!confirm("Cancel your Pro subscription? Access continues until period end.")) return;
    setLoading(true);
    await fetch("/api/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    setLoading(false);
    router.refresh();
  }

  if (mockPayment) {
    return (
      <MockPaystackModal
        email={email ?? ""}
        amount={mockPayment.amountInKobo}
        reference={mockPayment.reference}
        currency="USD"
        onSuccess={handleMockPaymentSuccess}
        onClose={() => setMockPayment(null)}
      />
    );
  }

  if (action === "upgrade") {
    return (
      <Button className="mt-4 w-full" onClick={handleUpgrade} loading={loading}>
        Upgrade to Pro — ${proAnnualUsd}/year
      </Button>
    );
  }

  return (
    <Button variant="outline" className="mt-4 w-full" onClick={handleCancel} loading={loading}>
      Cancel Plan
    </Button>
  );
}

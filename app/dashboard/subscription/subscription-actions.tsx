"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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

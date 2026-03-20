"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";

declare global {
  interface Window {
    PaystackPop: {
      setup: (config: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

interface DocumentActionsProps {
  docId: string;
  docNumber: string;
  docType: string;
  docStatus: string;
  pdfUrl?: string;
  convertedToId?: string | null;
  unlocked?: boolean;
  userEmail?: string;
  docPriceUsd?: number;
  proMonthlyUsd?: number;
  proMonthlyDocs?: number;
}

export function DocumentActions({
  docId,
  docNumber,
  docType,
  docStatus,
  pdfUrl,
  convertedToId,
  unlocked = false,
  userEmail,
  docPriceUsd = 0.10,
  proMonthlyUsd = 2,
  proMonthlyDocs = 20,
}: DocumentActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function updateStatus(status: string) {
    setLoading(status);
    await fetch(`/api/documents/${docId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(null);
    router.refresh();
  }

  async function generatePDF() {
    setLoading("pdf");
    const res = await fetch(`/api/documents/${docId}/pdf`, { method: "POST" });
    const data = await res.json();
    setLoading(null);
    if (data.success) {
      router.refresh();
    } else {
      alert("PDF generation failed. Please try again.");
    }
  }

  async function payAndGeneratePDF() {
    setLoading("pay");

    // Initialize payment
    const res = await fetch("/api/payment/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: docId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setLoading(null);
      alert("Could not initialize payment. Please try again.");
      return;
    }

    // Free doc (PRO user with remaining quota)
    if (data.free) {
      const pdfRes = await fetch(`/api/documents/${docId}/pdf`, { method: "POST" });
      const pdfData = await pdfRes.json();
      setLoading(null);
      if (pdfData.success) {
        router.refresh();
      } else {
        alert("PDF generation failed. Please try again.");
      }
      return;
    }

    // Load Paystack and open payment popup
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => {
      const handler = window.PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
        email: userEmail,
        amount: data.amountInKobo,
        currency: "USD",
        ref: data.reference,
        callback: async (response: { reference: string }) => {
          const verifyRes = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: response.reference, documentId: docId }),
          });
          const verifyData = await verifyRes.json();
          setLoading(null);
          if (verifyData.success) {
            router.refresh();
          } else {
            alert("Payment verified but PDF generation failed. Contact support.");
          }
        },
        onClose: () => setLoading(null),
      });
      handler.openIframe();
    };
    document.body.appendChild(script);
  }

  async function convertToInvoice() {
    setLoading("convert");
    const res = await fetch(`/api/documents/${docId}/convert`, {
      method: "POST",
    });
    const data = await res.json();
    setLoading(null);
    if (data.success && data.data?.id) {
      router.push(`/dashboard/documents/${data.data.id}`);
    }
  }

  // ── Locked state (PAY_PER_USE, no PDF generated yet) ────────────────────────
  if (!unlocked) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={payAndGeneratePDF}
            loading={loading === "pay"}
          >
            Generate PDF — ${docPriceUsd.toFixed(2)}
          </Button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-sm text-blue-700">
            Generate a PDF to get the full formatted document. Alternatively,{" "}
            <Link href="/dashboard/subscription" className="font-semibold underline underline-offset-2">
              upgrade to Pro
            </Link>{" "}
            for ${proMonthlyUsd}/month and get {proMonthlyDocs} free documents monthly.
          </p>
        </div>
      </div>
    );
  }

  // ── Unlocked state ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex gap-2">
        {pdfUrl && (
          <a href={`/api/documents/${docId}/download`} download={`${docNumber}.pdf`}>
            <Button variant="outline" size="sm">
              Download PDF
            </Button>
          </a>
        )}
        <Button
          size="sm"
          variant={pdfUrl ? "outline" : "primary"}
          onClick={generatePDF}
          loading={loading === "pdf"}
        >
          {pdfUrl ? "Regenerate PDF" : "Generate PDF"}
        </Button>
      </div>

      {/* Invoice status actions */}
      {docType === "INVOICE" &&
        docStatus !== "PAID" &&
        docStatus !== "CANCELLED" && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-blue-700">Update invoice status:</p>
            <div className="flex gap-2">
              {docStatus === "DRAFT" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus("SENT")}
                  loading={loading === "SENT"}
                >
                  Mark as Sent
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => updateStatus("PAID")}
                loading={loading === "PAID"}
              >
                Mark as Paid
              </Button>
            </div>
          </div>
        )}

      {/* Quote actions */}
      {docType === "QUOTE" &&
        docStatus !== "ACCEPTED" &&
        docStatus !== "CANCELLED" && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-blue-700">Quote actions:</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateStatus("ACCEPTED")}
                loading={loading === "ACCEPTED"}
              >
                Mark Accepted
              </Button>
              {!convertedToId && (
                <Button
                  size="sm"
                  onClick={convertToInvoice}
                  loading={loading === "convert"}
                >
                  Convert to Invoice
                </Button>
              )}
            </div>
          </div>
        )}
    </div>
  );
}

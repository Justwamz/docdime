"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface DocumentActionsProps {
  docId: string;
  docNumber: string;
  docType: string;
  docStatus: string;
  pdfUrl?: string;
  convertedToId?: string | null;
}

export function DocumentActions({
  docId,
  docNumber,
  docType,
  docStatus,
  pdfUrl,
  convertedToId,
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
        {!pdfUrl && (
          <Button
            size="sm"
            onClick={generatePDF}
            loading={loading === "pdf"}
          >
            Generate PDF
          </Button>
        )}
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

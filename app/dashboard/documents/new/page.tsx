"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineItemsTable } from "@/components/documents/line-items-table";
import type { LineItem } from "@/types";

declare global {
  interface Window {
    PaystackPop: {
      setup: (config: Record<string, unknown>) => { openIframe: () => void };
    };
  }
}

export default function NewDocumentPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [taxes, setTaxes] = useState<Array<{ id: string; name: string; rate: number }>>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0, taxRate: 0, total: 0 },
  ]);
  const [form, setForm] = useState({
    type: "INVOICE",
    customerId: "",
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    expiryDate: "",
    notes: "",
    terms: "",
    currency: "KES",
  });

  useEffect(() => {
    fetch("/api/customers").then((r) => r.json()).then((d) => setCustomers(d.data ?? []));
    fetch("/api/taxes").then((r) => r.json()).then((d) => setTaxes(d.data ?? []));
  }, []);

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice * (item.taxRate / 100),
    0
  );
  const total = subtotal + taxAmount;

  async function handleGeneratePDF() {
    setError("");
    setLoading(true);

    // First save the document
    const saveRes = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, lineItems, subtotal, taxAmount, total }),
    });

    const saveData = await saveRes.json();

    if (!saveRes.ok) {
      setError(saveData.error ?? "Failed to create document");
      setLoading(false);
      return;
    }

    const docId = saveData.data.id;

    // Check if pro with free docs remaining
    const checkRes = await fetch("/api/payment/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: docId }),
    });

    const checkData = await checkRes.json();

    if (!checkRes.ok) {
      setError(checkData.error ?? "Payment initialization failed");
      setLoading(false);
      return;
    }

    if (checkData.free) {
      // Free doc (Pro plan quota or test mode) — generate PDF directly
      await fetch(`/api/documents/${docId}/pdf`, { method: "POST" });
      setLoading(false);
      router.push(`/dashboard/documents/${docId}`);
      return;
    }

    // Load Paystack inline script and open popup
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.onload = () => {
      setLoading(false);
      const handler = window.PaystackPop.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
        email: session?.user.email,
        amount: checkData.amountInKobo,
        currency: "USD",
        ref: checkData.reference,
        metadata: { documentId: docId },
        callback: async (response: { reference: string }) => {
          setLoading(true);
          const verifyRes = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reference: response.reference, documentId: docId }),
          });
          const verifyData = await verifyRes.json();
          setLoading(false);
          if (verifyData.success) {
            router.push(`/dashboard/documents/${docId}`);
          } else {
            setError("Payment verification failed");
          }
        },
        onClose: () => {
          setLoading(false);
        },
      });
      handler.openIframe();
    };
    document.body.appendChild(script);
  }

  async function handleSaveDraft() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, lineItems, subtotal, taxAmount, total }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      router.push(`/dashboard/documents/${data.data.id}`);
    } else {
      setError(data.error ?? "Failed to save");
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">New Document</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Document type */}
      <Card>
        <CardHeader>
          <CardTitle>Document Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {[
              { value: "INVOICE", label: "Invoice" },
              { value: "QUOTE", label: "Quote" },
              { value: "PURCHASE_ORDER", label: "Purchase Order" },
            ].map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => updateForm("type", type.value)}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                  form.type === type.value
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="customerId">Customer</Label>
              <Select
                id="customerId"
                value={form.customerId}
                onChange={(e) => updateForm("customerId", e.target.value)}
              >
                <option value="">Select customer (optional)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select
                id="currency"
                value={form.currency}
                onChange={(e) => updateForm("currency", e.target.value)}
              >
                {["KES", "NGN", "USD", "GBP", "EUR", "ZAR", "GHS"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="issueDate" required>Issue Date</Label>
              <Input
                id="issueDate"
                type="date"
                value={form.issueDate}
                onChange={(e) => updateForm("issueDate", e.target.value)}
                required
              />
            </div>
            {form.type === "INVOICE" && (
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => updateForm("dueDate", e.target.value)}
                />
              </div>
            )}
            {form.type === "QUOTE" && (
              <div>
                <Label htmlFor="expiryDate">Valid Until</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => updateForm("expiryDate", e.target.value)}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <LineItemsTable
            items={lineItems}
            onChange={setLineItems}
            currency={form.currency}
            taxes={taxes}
          />
        </CardContent>
      </Card>

      {/* Notes & Terms */}
      <Card>
        <CardHeader>
          <CardTitle>Notes & Terms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => updateForm("notes", e.target.value)}
              placeholder="Thank you for your business..."
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="terms">Terms & Conditions</Label>
            <Textarea
              id="terms"
              value={form.terms}
              onChange={(e) => updateForm("terms", e.target.value)}
              placeholder="Payment due within 30 days..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 pb-6">
        <Button variant="outline" onClick={handleSaveDraft} loading={loading}>
          Save Draft
        </Button>
        <Button onClick={handleGeneratePDF} loading={loading}>
          Generate PDF — $0.11
        </Button>
      </div>
    </div>
  );
}

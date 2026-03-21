"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { countries } from "@/lib/countries";
import { currencies } from "@/lib/currencies";

export default function OnboardingPage() {
  const router = useRouter();
  const { update } = useSession();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    businessName: "",
    businessEmail: "",
    businessPhone: "",
    businessAddress: "",
    country: "US",
    currency: "USD",
    consentGiven: false,
  });

  function update2(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step < 3) {
      setStep((s) => s + 1);
      return;
    }

    if (!form.consentGiven) {
      setError("Please accept the terms to continue");
      return;
    }

    setLoading(true);
    setError("");

    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Failed to save");
      setLoading(false);
      return;
    }

    await update({ onboardingDone: true });
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="flex justify-center mb-4">
          <img src="/logo.png" alt="DocDime" className="h-9 w-auto" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Set up your account</h1>
        <p className="text-gray-500 text-sm mt-1">Step {step} of 3</p>

        {/* Progress */}
        <div className="flex gap-2 justify-center mt-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 w-16 rounded-full transition-colors ${
                s <= step ? "bg-blue-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>
      </div>

      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 && (
              <>
                <h2 className="text-lg font-semibold text-gray-900">Business Details</h2>
                <div>
                  <Label htmlFor="businessName" required>Business Name</Label>
                  <Input
                    id="businessName"
                    value={form.businessName}
                    onChange={(e) => update2("businessName", e.target.value)}
                    placeholder="Acme Ltd"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="businessEmail">Business Email</Label>
                  <Input
                    id="businessEmail"
                    type="email"
                    value={form.businessEmail}
                    onChange={(e) => update2("businessEmail", e.target.value)}
                    placeholder="hello@acme.com"
                  />
                </div>
                <div>
                  <Label htmlFor="businessPhone">Phone Number</Label>
                  <Input
                    id="businessPhone"
                    value={form.businessPhone}
                    onChange={(e) => update2("businessPhone", e.target.value)}
                    placeholder="+1 555 000 0000"
                  />
                </div>
                <div>
                  <Label htmlFor="businessAddress">Business Address</Label>
                  <Input
                    id="businessAddress"
                    value={form.businessAddress}
                    onChange={(e) => update2("businessAddress", e.target.value)}
                    placeholder="123 Main St, City"
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-lg font-semibold text-gray-900">Location & Currency</h2>
                <div>
                  <Label htmlFor="country" required>Country</Label>
                  <Select
                    id="country"
                    value={form.country}
                    onChange={(e) => update2("country", e.target.value)}
                  >
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="currency" required>Default Currency</Label>
                  <Select
                    id="currency"
                    value={form.currency}
                    onChange={(e) => update2("currency", e.target.value)}
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                    ))}
                  </Select>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <h2 className="text-lg font-semibold text-gray-900">Terms & Consent</h2>
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 leading-relaxed">
                  <p>By continuing, you agree to:</p>
                  <ul className="list-disc ml-4 mt-2 space-y-1">
                    <li>DocDime&apos;s <a href="/terms" className="text-blue-600 underline" target="_blank">Terms of Service</a></li>
                    <li>Our <a href="/privacy" className="text-blue-600 underline" target="_blank">Privacy Policy</a></li>
                    <li>Pay-per-use pricing ($0.10/document) or Pro plan charges ($20/year)</li>
                    <li>Receiving transactional emails</li>
                  </ul>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.consentGiven}
                    onChange={(e) => update2("consentGiven", e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    I have read and agree to the Terms of Service and Privacy Policy.
                  </span>
                </label>
              </>
            )}

            <div className="flex gap-3 pt-2">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((s) => s - 1)}
                  className="flex-1"
                >
                  Back
                </Button>
              )}
              <Button type="submit" loading={loading} className="flex-1">
                {step === 3 ? "Complete Setup" : "Continue"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

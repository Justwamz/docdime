"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CONFIG_KEYS = [
  "doc_price_usd",
  "pro_price_usd",
  "pro_annual_price_usd",
  "pro_monthly_docs",
  "maintenance_mode",
  "admin_notification_email",
];

const INTEGRATION_KEYS = [
  "resend_api_key",
  "resend_from_email",
  "paystack_secret_key",
  "paystack_public_key",
];

const SECRET_KEYS = new Set(["resend_api_key", "paystack_secret_key"]);

const LABELS: Record<string, string> = {
  doc_price_usd: "Document Price (USD)",
  pro_price_usd: "Pro Monthly Price (USD)",
  pro_annual_price_usd: "Pro Annual Price (USD)",
  pro_monthly_docs: "Pro Monthly Doc Limit",
  maintenance_mode: "Maintenance Mode",
  admin_notification_email: "Admin Notification Email",
  resend_api_key: "Resend API Key",
  resend_from_email: "From Email Address",
  paystack_secret_key: "Paystack Secret Key",
  paystack_public_key: "Paystack Public Key",
};

const HINTS: Record<string, string> = {
  resend_api_key: "Overrides RESEND_API_KEY env var. Leave blank to use env var.",
  resend_from_email: "e.g. DocDime <noreply@yourdomain.com>",
  paystack_secret_key: "Overrides PAYSTACK_SECRET_KEY env var. Leave blank to use env var.",
  paystack_public_key: "Overrides NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY env var. Leave blank to use env var.",
};

interface Setting {
  key: string;
  value: string;
}

export default function SettingsClient({ initial }: { initial: Setting[] }) {
  const [settings, setSettings] = useState<Setting[]>(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(key: string) {
    const value = settings.find((x) => x.key === key)?.value ?? "";
    setSaving(key);
    setError(null);
    setSaved(null);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    setSaving(null);
    if (res.ok) {
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
    }
  }

  function onChange(key: string, val: string) {
    setSettings((prev) => prev.map((x) => (x.key === key ? { ...x, value: val } : x)));
  }

  const configSettings = settings.filter((s) => CONFIG_KEYS.includes(s.key));
  const integrationSettings = settings.filter((s) => INTEGRATION_KEYS.includes(s.key));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">App Settings</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Pricing & general config */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {configSettings.map((s) => (
              <SettingRow
                key={s.key}
                label={LABELS[s.key] ?? s.key}
                keyName={s.key}
                value={s.value}
                isSecret={false}
                isSaving={saving === s.key}
                isSaved={saved === s.key}
                onChange={(val) => onChange(s.key, val)}
                onSave={() => handleSave(s.key)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-400 mb-4">
            DB values take priority over environment variables. Leave blank to fall back to env vars.
          </p>

          {/* Resend */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">R</span>
              </div>
              <p className="font-semibold text-gray-900 text-sm">Resend</p>
              <span className="text-xs text-gray-400">Email delivery</span>
            </div>
            <div className="space-y-1 pl-9">
              {integrationSettings
                .filter((s) => s.key.startsWith("resend_"))
                .map((s) => (
                  <SettingRow
                    key={s.key}
                    label={LABELS[s.key] ?? s.key}
                    keyName={s.key}
                    hint={HINTS[s.key]}
                    value={s.value}
                    isSecret={SECRET_KEYS.has(s.key)}
                    isSaving={saving === s.key}
                    isSaved={saved === s.key}
                    onChange={(val) => onChange(s.key, val)}
                    onSave={() => handleSave(s.key)}
                  />
                ))}
            </div>
          </div>

          {/* Paystack */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">P</span>
              </div>
              <p className="font-semibold text-gray-900 text-sm">Paystack</p>
              <span className="text-xs text-gray-400">Payment processing</span>
            </div>
            <div className="space-y-1 pl-9">
              {integrationSettings
                .filter((s) => s.key.startsWith("paystack_"))
                .map((s) => (
                  <SettingRow
                    key={s.key}
                    label={LABELS[s.key] ?? s.key}
                    keyName={s.key}
                    hint={HINTS[s.key]}
                    value={s.value}
                    isSecret={SECRET_KEYS.has(s.key)}
                    isSaving={saving === s.key}
                    isSaved={saved === s.key}
                    onChange={(val) => onChange(s.key, val)}
                    onSave={() => handleSave(s.key)}
                  />
                ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingRow({
  label,
  keyName,
  hint,
  value,
  isSecret,
  isSaving,
  isSaved,
  onChange,
  onSave,
}: {
  label: string;
  keyName: string;
  hint?: string;
  value: string;
  isSecret: boolean;
  isSaving: boolean;
  isSaved: boolean;
  onChange: (val: string) => void;
  onSave: () => void;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 py-3 border-b last:border-0">
      <div className="sm:w-56 shrink-0 pt-0.5">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="font-mono text-xs text-gray-400">{keyName}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex items-center gap-2 flex-1">
        <input
          type={isSecret && !revealed ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSave()}
          placeholder={isSecret ? "Leave blank to use env var" : undefined}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />
        {isSecret && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="shrink-0 text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 border border-gray-300 rounded-lg"
          >
            {revealed ? "Hide" : "Show"}
          </button>
        )}
        <button
          onClick={onSave}
          disabled={isSaving}
          className="shrink-0 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          {isSaving ? "Saving…" : isSaved ? "Saved ✓" : "Save"}
        </button>
      </div>
    </div>
  );
}

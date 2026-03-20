"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LABELS: Record<string, string> = {
  doc_price_usd: "Document Price (USD)",
  pro_price_usd: "Pro Monthly Price (USD)",
  pro_annual_price_usd: "Pro Annual Price (USD)",
  pro_monthly_docs: "Pro Monthly Doc Limit",
  maintenance_mode: "Maintenance Mode",
  admin_notification_email: "Admin Notification Email",
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

  async function handleSave(key: string, value: string) {
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">App Settings</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {settings.map((s) => (
              <SettingRow
                key={s.key}
                label={LABELS[s.key] ?? s.key}
                keyName={s.key}
                value={s.value}
                isSaving={saving === s.key}
                isSaved={saved === s.key}
                onChange={(val) =>
                  setSettings((prev) =>
                    prev.map((x) => (x.key === s.key ? { ...x, value: val } : x))
                  )
                }
                onSave={() => handleSave(s.key, settings.find((x) => x.key === s.key)!.value)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingRow({
  label,
  keyName,
  value,
  isSaving,
  isSaved,
  onChange,
  onSave,
}: {
  label: string;
  keyName: string;
  value: string;
  isSaving: boolean;
  isSaved: boolean;
  onChange: (val: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b last:border-0">
      <div className="sm:w-64 shrink-0">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="font-mono text-xs text-gray-400">{keyName}</p>
      </div>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSave()}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
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

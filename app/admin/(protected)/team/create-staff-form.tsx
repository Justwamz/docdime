"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function CreateStaffForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: generatePassword() });

  async function handleSubmit() {
    if (!form.name || !form.email || !form.password) {
      setError("All fields are required.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setCreated({ email: form.email, password: form.password });
      setForm({ name: "", email: "", password: generatePassword() });
      router.refresh();
    } else {
      setError(data.error ?? "Failed to create staff account");
    }
  }

  function copyCredentials() {
    navigator.clipboard.writeText(`Email: ${created!.email}\nPassword: ${created!.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        + Add Staff
      </button>
    );
  }

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>New Staff Account</CardTitle>
          <button
            onClick={() => { setOpen(false); setCreated(null); setError(""); }}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            Cancel
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {created ? (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-800 mb-2">Account created — save these credentials now</p>
              <div className="font-mono text-sm text-green-900 space-y-1">
                <p>Email: {created.email}</p>
                <p>Password: {created.password}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={copyCredentials} variant="outline" className="flex-1">
                {copied ? "Copied ✓" : "Copy Credentials"}
              </Button>
              <Button onClick={() => { setCreated(null); setOpen(false); }} className="flex-1">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jane@docdime.com"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="flex gap-2">
                <Input
                  id="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="font-mono"
                />
                <button
                  type="button"
                  onClick={() => setForm({ ...form, password: generatePassword() })}
                  className="shrink-0 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 px-3 rounded-lg"
                >
                  Regenerate
                </button>
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={saving} className="w-full sm:w-auto">
              {saving ? "Creating…" : "Create Account"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

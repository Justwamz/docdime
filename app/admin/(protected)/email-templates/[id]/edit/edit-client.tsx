"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import TemplateEditor from "../../template-editor";
import Link from "next/link";

function detectVariables(subject: string, body: string): string[] {
  const matches = new Set<string>();
  const re = /\{\{(\w+)\}\}/g;
  let m;
  while ((m = re.exec(subject + " " + body))) matches.add(m[1]);
  return Array.from(matches);
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
}

export default function EditTemplateClient({ template }: { template: Template }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    subject: template.subject,
    body: template.body,
    isActive: template.isActive,
  });

  const variables = detectVariables(form.subject, form.body);

  async function handleSave() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/email-templates/${template.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, variables }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      router.push("/admin/email-templates");
    } else {
      setError(data.error ?? "Failed to save");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/email-templates" className="text-gray-400 hover:text-gray-600 text-sm">← Back</Link>
        <h1 className="text-2xl font-bold text-gray-900">Edit Template</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <Card>
        <CardHeader><CardTitle>{template.name}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>
          <div>
            <Label>Body</Label>
            <TemplateEditor value={form.body} onChange={(html) => setForm({ ...form, body: html })} />
            <p className="text-xs text-gray-400 mt-1">Use {"{{variableName}}"} for dynamic values.</p>
          </div>
          {variables.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Detected variables</p>
              <div className="flex flex-wrap gap-1">
                {variables.map((v) => (
                  <span key={v} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-mono">{`{{${v}}}`}</span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              id="isActive"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <Label htmlFor="isActive">Active (emails will be sent)</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
        <Link href="/admin/email-templates">
          <Button variant="outline" type="button">Cancel</Button>
        </Link>
      </div>
    </div>
  );
}

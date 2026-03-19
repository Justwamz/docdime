"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from "@/components/ui/table";

interface Tax {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
  isInclusive: boolean;
  isCompound: boolean;
}

export default function TaxesPage() {
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editTax, setEditTax] = useState<Tax | null>(null);
  const [form, setForm] = useState({ name: "", rate: "", isDefault: false, isInclusive: false, isCompound: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTaxes();
  }, []);

  async function fetchTaxes() {
    const res = await fetch("/api/taxes");
    const data = await res.json();
    setTaxes(data.data ?? []);
    setLoading(false);
  }

  function openCreate() {
    setEditTax(null);
    setForm({ name: "", rate: "", isDefault: false, isInclusive: false, isCompound: false });
    setError("");
    setShowDialog(true);
  }

  function openEdit(tax: Tax) {
    setEditTax(tax);
    setForm({ name: tax.name, rate: String(tax.rate), isDefault: tax.isDefault, isInclusive: tax.isInclusive, isCompound: tax.isCompound });
    setError("");
    setShowDialog(true);
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    const url = editTax ? `/api/taxes/${editTax.id}` : "/api/taxes";
    const method = editTax ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, rate: parseFloat(form.rate) }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
    setShowDialog(false);
    fetchTaxes();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this tax?")) return;
    await fetch(`/api/taxes/${id}`, { method: "DELETE" });
    fetchTaxes();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Taxes</h1>
        <Button onClick={openCreate}>+ Add Tax</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : taxes.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🧾</div>
              <p className="text-gray-500">No taxes configured yet.</p>
              <button onClick={openCreate} className="text-blue-600 text-sm hover:underline mt-2">Add your first tax</button>
            </div>
          ) : (
            <Table>
              <TableHead>
                <tr>
                  <TableTh>Name</TableTh>
                  <TableTh>Rate</TableTh>
                  <TableTh>Type</TableTh>
                  <TableTh>Default</TableTh>
                  <TableTh></TableTh>
                </tr>
              </TableHead>
              <TableBody>
                {taxes.map((t) => (
                  <TableRow key={t.id}>
                    <TableTd className="font-medium">{t.name}</TableTd>
                    <TableTd>{t.rate}%</TableTd>
                    <TableTd>
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded w-fit ${t.isInclusive ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                          {t.isInclusive ? "Inclusive" : "Exclusive"}
                        </span>
                        {t.isCompound && (
                          <span className="text-xs px-1.5 py-0.5 rounded w-fit bg-orange-100 text-orange-700">Compound</span>
                        )}
                      </div>
                    </TableTd>
                    <TableTd>{t.isDefault ? "✓ Default" : "—"}</TableTd>
                    <TableTd>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(t)} className="text-blue-600 text-xs hover:underline">Edit</button>
                        <button onClick={() => handleDelete(t.id)} className="text-red-500 text-xs hover:underline">Delete</button>
                      </div>
                    </TableTd>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={editTax ? "Edit Tax" : "Add Tax"}>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}
        <div className="space-y-4">
          <div>
            <Label required>Tax Name</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. VAT, GST" required />
          </div>
          <div>
            <Label required>Rate (%)</Label>
            <Input type="number" value={form.rate} onChange={(e) => setForm((p) => ({ ...p, rate: e.target.value }))} placeholder="16" min="0" max="100" step="0.01" required />
          </div>
          <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tax Behaviour</p>
            <div className="flex items-start gap-3">
              <Switch checked={form.isInclusive} onCheckedChange={(v) => setForm((p) => ({ ...p, isInclusive: v, isCompound: v ? false : p.isCompound }))} />
              <div>
                <p className="text-sm font-medium text-gray-900">Tax Inclusive</p>
                <p className="text-xs text-gray-500">Tax is already included in the unit price (extracted, not added)</p>
              </div>
            </div>
            {!form.isInclusive && (
              <div className="flex items-start gap-3">
                <Switch checked={form.isCompound} onCheckedChange={(v) => setForm((p) => ({ ...p, isCompound: v }))} />
                <div>
                  <p className="text-sm font-medium text-gray-900">Compound Tax</p>
                  <p className="text-xs text-gray-500">Applied on (base + all non-compound taxes). e.g. VAT on excise-inclusive amount</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.isDefault} onCheckedChange={(v) => setForm((p) => ({ ...p, isDefault: v }))} />
            <Label className="mb-0">Set as default tax</Label>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowDialog(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">Save</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

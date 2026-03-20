"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from "@/components/ui/table";
import { taxLabel, computeLineTaxes } from "@/lib/utils";
import type { Tax, TaxGroup, TaxSelection } from "@/types";

// ─── Tax form state ───────────────────────────────────────────────────────────

interface TaxFormState {
  name: string;
  rate: string;
  isDefault: boolean;
  isInclusive: boolean;
}

// ─── Group builder step ───────────────────────────────────────────────────────

interface Step {
  taxId: string;
}

interface GroupFormState {
  name: string;
  isDefault: boolean;
  isCompound: boolean;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TaxesPage() {
  // ── Taxes ──────────────────────────────────────────────────────────────────
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [taxesLoading, setTaxesLoading] = useState(true);

  // Tax dialog
  const [showTaxDialog, setShowTaxDialog] = useState(false);
  const [editTax, setEditTax] = useState<Tax | null>(null);
  const [taxForm, setTaxForm] = useState<TaxFormState>({
    name: "",
    rate: "",
    isDefault: false,
    isInclusive: false,
  });
  const [taxSaving, setTaxSaving] = useState(false);
  const [taxDialogError, setTaxDialogError] = useState("");

  // Delete inline error: keyed by tax id
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  // ── Tax Groups ─────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<TaxGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  // Group dialog
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editGroup, setEditGroup] = useState<TaxGroup | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormState>({ name: "", isDefault: false, isCompound: false });
  const [steps, setSteps] = useState<Step[]>([]);
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupDialogError, setGroupDialogError] = useState("");

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchTaxes();
    fetchGroups();
  }, []);

  async function fetchTaxes() {
    setTaxesLoading(true);
    const res = await fetch("/api/taxes");
    const data = await res.json();
    setTaxes(data.data ?? []);
    setTaxesLoading(false);
  }

  async function fetchGroups() {
    setGroupsLoading(true);
    const res = await fetch("/api/tax-groups");
    const data = await res.json();
    setGroups(data.data ?? []);
    setGroupsLoading(false);
  }

  // ── Tax dialog handlers ────────────────────────────────────────────────────

  function openCreateTax() {
    setEditTax(null);
    setTaxForm({ name: "", rate: "", isDefault: false, isInclusive: false });
    setTaxDialogError("");
    setShowTaxDialog(true);
  }

  function openEditTax(tax: Tax) {
    setEditTax(tax);
    setTaxForm({
      name: tax.name,
      rate: String(tax.rate),
      isDefault: tax.isDefault,
      isInclusive: tax.isInclusive,
    });
    setTaxDialogError("");
    setShowTaxDialog(true);
  }

  async function handleSaveTax() {
    setTaxDialogError("");
    setTaxSaving(true);
    const url = editTax ? `/api/taxes/${editTax.id}` : "/api/taxes";
    const method = editTax ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: taxForm.name,
        rate: parseFloat(taxForm.rate),
        isDefault: taxForm.isDefault,
        isInclusive: taxForm.isInclusive,
      }),
    });
    const data = await res.json();
    setTaxSaving(false);
    if (!res.ok) {
      setTaxDialogError(data.error ?? "Failed to save");
      return;
    }
    setShowTaxDialog(false);
    fetchTaxes();
  }

  async function handleDeleteTax(id: string) {
    if (!confirm("Delete this tax?")) return;
    // clear any prior error
    setDeleteErrors((prev) => ({ ...prev, [id]: "" }));
    const res = await fetch(`/api/taxes/${id}`, { method: "DELETE" });
    if (res.status === 409) {
      const data = await res.json();
      setDeleteErrors((prev) => ({ ...prev, [id]: data.error ?? "Cannot delete: tax is used in a group." }));
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDeleteErrors((prev) => ({ ...prev, [id]: data.error ?? "Failed to delete tax." }));
      return;
    }
    fetchTaxes();
  }

  // ── Group dialog handlers ──────────────────────────────────────────────────

  function openCreateGroup() {
    setEditGroup(null);
    setGroupForm({ name: "", isDefault: false, isCompound: false });
    setSteps([{ taxId: "" }]);
    setGroupDialogError("");
    setShowGroupDialog(true);
  }

  function openEditGroup(group: TaxGroup) {
    setEditGroup(group);
    setGroupForm({ name: group.name, isDefault: group.isDefault, isCompound: group.isCompound });
    const sorted = [...group.items].sort((a, b) => a.order - b.order);
    setSteps(sorted.map((item) => ({ taxId: item.taxId })));
    setGroupDialogError("");
    setShowGroupDialog(true);
  }

  async function handleSaveGroup() {
    setGroupDialogError("");
    const filledSteps = steps.filter((s) => s.taxId);
    if (filledSteps.length === 0) {
      setGroupDialogError("At least one tax step is required.");
      return;
    }
    if (!groupForm.name.trim()) {
      setGroupDialogError("Group name is required.");
      return;
    }
    setGroupSaving(true);
    const url = editGroup ? `/api/tax-groups/${editGroup.id}` : "/api/tax-groups";
    const method = editGroup ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: groupForm.name.trim(),
        isDefault: groupForm.isDefault,
        isCompound: groupForm.isCompound,
        items: filledSteps.map((s, i) => ({ taxId: s.taxId, order: i + 1 })),
      }),
    });
    const data = await res.json();
    setGroupSaving(false);
    if (!res.ok) {
      setGroupDialogError(data.error ?? "Failed to save group");
      return;
    }
    setShowGroupDialog(false);
    fetchGroups();
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm("Delete this tax group?")) return;
    await fetch(`/api/tax-groups/${id}`, { method: "DELETE" });
    fetchGroups();
  }

  // ── Step helpers ───────────────────────────────────────────────────────────

  function addStep() {
    setSteps((prev) => [...prev, { taxId: "" }]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function moveStep(index: number, direction: "up" | "down") {
    setSteps((prev) => {
      const next = [...prev];
      const swapIdx = direction === "up" ? index - 1 : index + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
      return next;
    });
  }

  function updateStep(index: number, patch: Partial<Step>) {
    setSteps((prev) =>
      prev.map((s, i) => (i !== index ? s : { ...s, ...patch }))
    );
  }

  // ── Live preview ───────────────────────────────────────────────────────────

  const previewRows = useMemo(() => {
    const filledSteps = steps.filter((s) => s.taxId);
    if (filledSteps.length === 0) return null;

    const items = filledSteps
      .map((s) => {
        const t = taxes.find((tx) => tx.id === s.taxId);
        if (!t) return null;
        return { taxId: s.taxId, name: t.name, rate: t.rate, isInclusive: t.isInclusive };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (items.length === 0) return null;

    const selection: TaxSelection = {
      type: "group",
      groupId: "preview",
      groupName: groupForm.name || "Preview",
      isCompound: groupForm.isCompound,
      items,
    };

    const { snapshot } = computeLineTaxes(100, selection);
    if (snapshot.type !== "group") return null;

    return snapshot.items;
  }, [steps, taxes, groupForm.name, groupForm.isCompound]);

  const previewTotal = useMemo(() => {
    if (!previewRows) return null;
    return previewRows.reduce((sum, r) => sum + r.amount, 0);
  }, [previewRows]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ── Individual Taxes ── */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Taxes</h1>
          <Button onClick={openCreateTax}>+ Add Tax</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {taxesLoading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : taxes.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">🧾</div>
                <p className="text-gray-500">No taxes configured yet.</p>
                <button
                  onClick={openCreateTax}
                  className="text-blue-600 text-sm hover:underline mt-2"
                >
                  Add your first tax
                </button>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {taxes.map((t) => (
                    <div key={t.id}>
                      <div className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{taxLabel(t)}</p>
                          {t.isDefault && <Badge variant="success">Default</Badge>}
                        </div>
                        <div className="flex gap-3 ml-3">
                          <button onClick={() => openEditTax(t)} className="text-blue-600 text-sm hover:underline">Edit</button>
                          <button onClick={() => handleDeleteTax(t.id)} className="text-red-500 text-sm hover:underline">Delete</button>
                        </div>
                      </div>
                      {deleteErrors[t.id] && (
                        <div className="mx-4 mb-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                          {deleteErrors[t.id]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHead>
                      <tr>
                        <TableTh>Tax</TableTh>
                        <TableTh>Default</TableTh>
                        <TableTh></TableTh>
                      </tr>
                    </TableHead>
                    <TableBody>
                      {taxes.map((t) => (
                        <>
                          <TableRow key={t.id}>
                            <TableTd className="font-medium">{taxLabel(t)}</TableTd>
                            <TableTd>
                              {t.isDefault ? (
                                <Badge variant="success">Default</Badge>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </TableTd>
                            <TableTd>
                              <div className="flex gap-2">
                                <button onClick={() => openEditTax(t)} className="text-blue-600 text-xs hover:underline">Edit</button>
                                <button onClick={() => handleDeleteTax(t.id)} className="text-red-500 text-xs hover:underline">Delete</button>
                              </div>
                            </TableTd>
                          </TableRow>
                          {deleteErrors[t.id] && (
                            <TableRow key={`${t.id}-err`}>
                              <TableTd colSpan={3}>
                                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                                  {deleteErrors[t.id]}
                                </div>
                              </TableTd>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tax Groups ── */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Tax Groups</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Combine multiple taxes into a group for easy document application.
            </p>
          </div>
          <Button onClick={openCreateGroup} className="sm:shrink-0">+ Add Group</Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {groupsLoading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : groups.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-3">📦</div>
                <p className="text-gray-500">No tax groups configured yet.</p>
                <button
                  onClick={openCreateGroup}
                  className="text-blue-600 text-sm hover:underline mt-2"
                >
                  Create your first group
                </button>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-gray-100">
                  {groups.map((g) => {
                    const sortedItems = [...g.items].sort((a, b) => a.order - b.order);
                    return (
                      <div key={g.id} className="px-4 py-3">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-900">{g.name}</p>
                              {g.isDefault && <Badge variant="success">Default</Badge>}
                              {g.isCompound && <Badge variant="warning">Compound</Badge>}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {sortedItems.map((item) => (
                                <span key={item.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                                  {taxLabel(item.tax)}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-3 ml-3 shrink-0">
                            <button onClick={() => openEditGroup(g)} className="text-blue-600 text-sm hover:underline">Edit</button>
                            <button onClick={() => handleDeleteGroup(g.id)} className="text-red-500 text-sm hover:underline">Delete</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHead>
                      <tr>
                        <TableTh>Group Name</TableTh>
                        <TableTh>Taxes</TableTh>
                        <TableTh>Default</TableTh>
                        <TableTh></TableTh>
                      </tr>
                    </TableHead>
                    <TableBody>
                      {groups.map((g) => {
                        const sortedItems = [...g.items].sort((a, b) => a.order - b.order);
                        return (
                          <TableRow key={g.id}>
                            <TableTd className="font-medium">
                              <div className="flex items-center gap-2">
                                {g.name}
                                {g.isCompound && <Badge variant="warning">Compound</Badge>}
                              </div>
                            </TableTd>
                            <TableTd>
                              <div className="flex flex-wrap gap-1">
                                {sortedItems.map((item) => (
                                  <span
                                    key={item.id}
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700"
                                  >
                                    {taxLabel(item.tax)}
                                  </span>
                                ))}
                              </div>
                            </TableTd>
                            <TableTd>
                              {g.isDefault ? <Badge variant="success">Default</Badge> : <span className="text-gray-400">—</span>}
                            </TableTd>
                            <TableTd>
                              <div className="flex gap-2">
                                <button onClick={() => openEditGroup(g)} className="text-blue-600 text-xs hover:underline">Edit</button>
                                <button onClick={() => handleDeleteGroup(g.id)} className="text-red-500 text-xs hover:underline">Delete</button>
                              </div>
                            </TableTd>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tax dialog ── */}
      <Dialog
        open={showTaxDialog}
        onClose={() => setShowTaxDialog(false)}
        title={editTax ? "Edit Tax" : "Add Tax"}
      >
        {taxDialogError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            {taxDialogError}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <Label required>Tax Name</Label>
            <Input
              value={taxForm.name}
              onChange={(e) => setTaxForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. VAT, GST"
            />
          </div>
          <div>
            <Label required>Rate (%)</Label>
            <Input
              type="number"
              value={taxForm.rate}
              onChange={(e) => setTaxForm((p) => ({ ...p, rate: e.target.value }))}
              placeholder="16"
              min="0"
              max="100"
              step="0.01"
            />
          </div>
          <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Tax Behaviour
            </p>
            <div className="flex items-start gap-3">
              <Switch
                checked={taxForm.isInclusive}
                onCheckedChange={(v) => setTaxForm((p) => ({ ...p, isInclusive: v }))}
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Tax Inclusive</p>
                <p className="text-xs text-gray-500">
                  Tax is already included in the unit price (extracted, not added)
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={taxForm.isDefault}
              onCheckedChange={(v) => setTaxForm((p) => ({ ...p, isDefault: v }))}
            />
            <Label className="mb-0">Set as default tax</Label>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowTaxDialog(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSaveTax} loading={taxSaving} className="flex-1">
              Save
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Group builder dialog ── */}
      <Dialog
        open={showGroupDialog}
        onClose={() => setShowGroupDialog(false)}
        title={editGroup ? "Edit Tax Group" : "Add Tax Group"}
        className="max-w-2xl"
      >
        {groupDialogError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            {groupDialogError}
          </div>
        )}
        <div className="space-y-5">
          {/* Group name */}
          <div>
            <Label required>Group Name</Label>
            <Input
              value={groupForm.name}
              onChange={(e) => setGroupForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. VAT + Excise"
            />
          </div>

          {/* Default + Compound toggles */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch
                checked={groupForm.isDefault}
                onCheckedChange={(v) => setGroupForm((p) => ({ ...p, isDefault: v }))}
              />
              <Label className="mb-0">Set as default group</Label>
            </div>
            <div className="border border-gray-200 rounded-xl p-4 space-y-1 bg-gray-50">
              <div className="flex items-start gap-3">
                <Switch
                  checked={groupForm.isCompound}
                  onCheckedChange={(v) => setGroupForm((p) => ({ ...p, isCompound: v }))}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Compound (tax-on-tax)</p>
                  <p className="text-xs text-gray-500">
                    Each tax is applied on the running total (base + all previous taxes), in step order.
                    e.g. Excise 20% on 100 = 20, then VAT 16% on 120 = 19.20.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Tax Steps</p>
            <div className="space-y-3">
              {steps.map((step, index) => {
                return (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row sm:items-start gap-2 p-3 border border-gray-200 rounded-lg bg-gray-50"
                  >
                    {/* Order controls */}
                    <div className="flex sm:flex-col gap-1 sm:gap-0.5 mt-1">
                      <button
                        type="button"
                        onClick={() => moveStep(index, "up")}
                        disabled={index === 0}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none"
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(index, "down")}
                        disabled={index === steps.length - 1}
                        className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none"
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>

                    {/* Step number */}
                    <span className="text-xs font-mono text-gray-400 mt-2 w-4 shrink-0">
                      {index + 1}.
                    </span>

                    {/* Tax picker */}
                    <div className="flex-1 min-w-0">
                      <Select
                        value={step.taxId}
                        onChange={(e) => updateStep(index, { taxId: e.target.value })}
                      >
                        <option value="">— Select tax —</option>
                        {taxes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {taxLabel(t)}
                          </option>
                        ))}
                      </Select>
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="text-red-400 hover:text-red-600 text-sm mt-1.5 shrink-0"
                      title="Remove step"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={addStep}
              className="mt-2 text-blue-600 text-sm hover:underline"
            >
              + Add Step
            </button>
          </div>

          {/* Live preview */}
          {previewRows && previewRows.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Preview (base = 100)
                </p>
                {groupForm.isCompound && (
                  <span className="text-xs text-orange-600 font-medium">Compound mode</span>
                )}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Tax</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="px-4 py-2 text-gray-700">
                        {taxLabel({ name: row.name, rate: row.rate, isInclusive: row.isInclusive })}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-900 font-mono">
                        {row.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td className="px-4 py-2 text-sm font-semibold text-gray-700">Total tax</td>
                    <td className="px-4 py-2 text-right font-semibold font-mono text-gray-900">
                      {previewTotal?.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowGroupDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={handleSaveGroup} loading={groupSaving} className="flex-1">
              Save Group
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from "@/components/ui/table";

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    const res = await fetch("/api/customers");
    const data = await res.json();
    setCustomers(data.data ?? []);
    setLoading(false);
  }

  function openCreate() {
    setEditCustomer(null);
    setForm({ name: "", email: "", phone: "", address: "" });
    setError("");
    setShowDialog(true);
  }

  function openEdit(customer: Customer) {
    setEditCustomer(customer);
    setForm({
      name: customer.name,
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      address: customer.address ?? "",
    });
    setError("");
    setShowDialog(true);
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    const url = editCustomer ? `/api/customers/${editCustomer.id}` : "/api/customers";
    const method = editCustomer ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to save");
      return;
    }
    setShowDialog(false);
    fetchCustomers();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this customer?")) return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    fetchCustomers();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <Button onClick={openCreate}>+ Add Customer</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : customers.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-gray-500">No customers yet.</p>
              <button onClick={openCreate} className="text-blue-600 text-sm hover:underline mt-2">
                Add your first customer
              </button>
            </div>
          ) : (
            <div className="sm:hidden divide-y divide-gray-100">
              {customers.map((c) => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                      {c.email && <p className="text-xs text-gray-500">{c.email}</p>}
                      {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                    </div>
                    <div className="flex gap-3 ml-3">
                      <button onClick={() => openEdit(c)} className="text-blue-600 text-sm hover:underline">Edit</button>
                      <button onClick={() => handleDelete(c.id)} className="text-red-500 text-sm hover:underline">Delete</button>
                    </div>
                  </div>
                  {c.address && <p className="text-xs text-gray-400 mt-1 truncate">{c.address}</p>}
                </div>
              ))}
            </div>
            <div className="hidden sm:block">
              <Table>
                <TableHead>
                  <tr>
                    <TableTh>Name</TableTh>
                    <TableTh>Email</TableTh>
                    <TableTh>Phone</TableTh>
                    <TableTh>Address</TableTh>
                    <TableTh></TableTh>
                  </tr>
                </TableHead>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableTd className="font-medium">{c.name}</TableTd>
                      <TableTd>{c.email ?? "—"}</TableTd>
                      <TableTd>{c.phone ?? "—"}</TableTd>
                      <TableTd>{c.address ?? "—"}</TableTd>
                      <TableTd>
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(c)} className="text-blue-600 text-xs hover:underline">Edit</button>
                          <button onClick={() => handleDelete(c.id)} className="text-red-500 text-xs hover:underline">Delete</button>
                        </div>
                      </TableTd>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        title={editCustomer ? "Edit Customer" : "Add Customer"}
      >
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <Label required>Name</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Customer name" required />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="customer@email.com" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+1 555 000 0000" />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="123 Main St" />
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

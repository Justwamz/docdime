"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { countries, getCountryConfig } from "@/lib/countries";
import { currencies } from "@/lib/currencies";

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState({
    name: "",
    businessName: "",
    businessEmail: "",
    businessPhone: "",
    businessAddress: "",
    country: "KE",
    currency: "KES",
  });
  const [banking, setBanking] = useState<Record<string, string>>({});
  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((d) => {
      if (d.data) {
        setProfile({
          name: d.data.name ?? "",
          businessName: d.data.businessName ?? "",
          businessEmail: d.data.businessEmail ?? "",
          businessPhone: d.data.businessPhone ?? "",
          businessAddress: d.data.businessAddress ?? "",
          country: d.data.country ?? "KE",
          currency: d.data.currency ?? "KES",
        });
        if (d.data.bankingDetails) setBanking(d.data.bankingDetails);
      }
    });
  }, []);

  const countryConfig = getCountryConfig(profile.country);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...profile, bankingDetails: banking }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
    setSuccess("Profile saved successfully");
    await update();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwords.newPass !== passwords.confirm) {
      setError("New passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.newPass }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Failed to change password"); return; }
    setSuccess("Password changed successfully");
    setPasswords({ current: "", newPass: "", confirm: "" });
  }

  async function exportData() {
    const res = await fetch("/api/account/data-export");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "docdime-export.json";
    a.click();
  }

  async function deleteAccount() {
    if (!confirm("Are you sure? This cannot be undone. All your data will be permanently deleted.")) return;
    const res = await fetch("/api/account/delete", { method: "DELETE" });
    if (res.ok) { window.location.href = "/"; }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Business Profile</TabsTrigger>
          <TabsTrigger value="banking">Banking</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <form onSubmit={saveProfile} className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Personal Info</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label required>Full Name</Label>
                  <Input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <Label required>Business Name</Label>
                  <Input value={profile.businessName} onChange={(e) => setProfile((p) => ({ ...p, businessName: e.target.value }))} />
                </div>
                <div>
                  <Label>Business Email</Label>
                  <Input type="email" value={profile.businessEmail} onChange={(e) => setProfile((p) => ({ ...p, businessEmail: e.target.value }))} />
                </div>
                <div>
                  <Label>Business Phone</Label>
                  <Input value={profile.businessPhone} onChange={(e) => setProfile((p) => ({ ...p, businessPhone: e.target.value }))} />
                </div>
                <div>
                  <Label>Business Address</Label>
                  <Textarea value={profile.businessAddress} onChange={(e) => setProfile((p) => ({ ...p, businessAddress: e.target.value }))} rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Country</Label>
                    <Select value={profile.country} onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))}>
                      {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label>Currency</Label>
                    <Select value={profile.currency} onChange={(e) => setProfile((p) => ({ ...p, currency: e.target.value }))}>
                      {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Button type="submit" loading={loading}>Save Profile</Button>
          </form>
        </TabsContent>

        <TabsContent value="banking">
          <form onSubmit={saveProfile} className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Banking Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-500">These details appear on your invoices and purchase orders.</p>
                {countryConfig.bankingFields.map((field) => (
                  <div key={field.key}>
                    <Label required={field.required}>{field.label}</Label>
                    <Input
                      value={banking[field.key] ?? ""}
                      onChange={(e) => setBanking((p) => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Button type="submit" loading={loading}>Save Banking Details</Button>
          </form>
        </TabsContent>

        <TabsContent value="account">
          <div className="space-y-4">
            {/* Change Password */}
            <Card>
              <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={changePassword} className="space-y-4">
                  <div>
                    <Label required>Current Password</Label>
                    <Input type="password" value={passwords.current} onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))} />
                  </div>
                  <div>
                    <Label required>New Password</Label>
                    <Input type="password" value={passwords.newPass} onChange={(e) => setPasswords((p) => ({ ...p, newPass: e.target.value }))} />
                  </div>
                  <div>
                    <Label required>Confirm New Password</Label>
                    <Input type="password" value={passwords.confirm} onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))} />
                  </div>
                  <Button type="submit" loading={loading}>Update Password</Button>
                </form>
              </CardContent>
            </Card>

            {/* Data Export */}
            <Card>
              <CardHeader><CardTitle>Export Your Data</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">Download all your documents, customers, and transactions as JSON.</p>
                <Button variant="outline" onClick={exportData}>Export Data</Button>
              </CardContent>
            </Card>

            {/* Delete Account */}
            <Card className="border-red-200">
              <CardHeader><CardTitle className="text-red-600">Danger Zone</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">Permanently delete your account and all associated data. This cannot be undone.</p>
                <Button variant="danger" onClick={deleteAccount}>Delete Account</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

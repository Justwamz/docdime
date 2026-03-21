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
import { Switch } from "@/components/ui/switch";

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
    country: "US",
    currency: "USD",
    businessLogo: "",
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const [banking, setBanking] = useState<Record<string, string>>({});
  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
  const [deletePassword, setDeletePassword] = useState("");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const arr = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
    return arr;
  }

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator) {
      setNotifPermission(Notification.permission);
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      });
    }
  }, []);

  async function handleSubscribe() {
    setNotifLoading(true);
    setError("");
    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""
        ),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setSubscribed(true);
    } catch {
      setError("Could not enable notifications. Please try again.");
    } finally {
      setNotifLoading(false);
    }
  }

  async function handleUnsubscribe() {
    setNotifLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/push/unsubscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setSubscribed(false);
    } catch {
      setError("Could not disable notifications.");
    } finally {
      setNotifLoading(false);
    }
  }

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((d) => {
      if (d.data) {
        setProfile({
          name: d.data.name ?? "",
          businessName: d.data.businessName ?? "",
          businessEmail: d.data.businessEmail ?? "",
          businessPhone: d.data.businessPhone ?? "",
          businessAddress: d.data.businessAddress ?? "",
          country: d.data.country ?? "US",
          currency: d.data.currency ?? "USD",
          businessLogo: d.data.businessLogo ?? "",
        });
        if (d.data.bankingDetails) setBanking(d.data.bankingDetails);
      }
    });
  }, []);

  const countryConfig = getCountryConfig(profile.country);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setError("");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    setLogoUploading(false);
    if (!res.ok) { setError(data.error ?? "Upload failed"); return; }
    setProfile((p) => ({ ...p, businessLogo: data.data.url }));
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...profile, bankingDetails: banking, businessLogo: profile.businessLogo }),
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

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm("Are you absolutely sure? This will permanently delete your account and all data. This cannot be undone.")) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/account/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: deletePassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Failed to delete account"); return; }
    window.location.href = "/";
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
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="profile">Business Profile</TabsTrigger>
          <TabsTrigger value="banking">Banking</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <form onSubmit={saveProfile} className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Personal Info</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Business Logo</Label>
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    {profile.businessLogo ? (
                      <img
                        src={profile.businessLogo}
                        alt="Business logo"
                        className="h-16 w-16 object-contain rounded-lg border border-gray-200 bg-white p-1"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs">
                        No logo
                      </div>
                    )}
                    <div>
                      <label className="cursor-pointer">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                          {logoUploading ? "Uploading..." : "Upload Logo"}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/svg+xml"
                          className="sr-only"
                          onChange={handleLogoUpload}
                          disabled={logoUploading}
                        />
                      </label>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG up to 5MB</p>
                      {profile.businessLogo && (
                        <button
                          type="button"
                          onClick={() => setProfile((p) => ({ ...p, businessLogo: "" }))}
                          className="text-xs text-red-500 hover:underline mt-1 block"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <form onSubmit={deleteAccount} className="space-y-3">
                  <div>
                    <Label required>Confirm your password</Label>
                    <Input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Enter your password to confirm"
                    />
                  </div>
                  <Button type="submit" variant="danger" loading={loading} disabled={!deletePassword}>Delete Account</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="notifications">
          <Card>
            <CardHeader><CardTitle>Push Notifications</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">
                Receive alerts for overdue invoices, expiring quotes, and payment confirmations directly on your device.
              </p>
              {typeof window !== "undefined" && "Notification" in window ? (
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {subscribed ? "Notifications enabled" : "Notifications disabled"}
                    </p>
                    {notifPermission === "denied" && (
                      <p className="text-xs text-red-500 mt-1">
                        Notifications are blocked in your browser settings. Update your browser permissions to enable them.
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={subscribed}
                    onCheckedChange={subscribed ? handleUnsubscribe : handleSubscribe}
                    disabled={notifLoading || notifPermission === "denied"}
                  />
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  Push notifications are not supported in this browser.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

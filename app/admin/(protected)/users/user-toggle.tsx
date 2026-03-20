"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UserDowngrade({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDowngrade() {
    if (!confirm("Downgrade this user to Pay Per Use? Their PRO access will end immediately.")) return;
    setLoading(true);
    await fetch(`/api/admin/users/${userId}`, { method: "PATCH" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDowngrade}
      disabled={loading}
      className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50 whitespace-nowrap"
    >
      {loading ? "..." : "Downgrade"}
    </button>
  );
}

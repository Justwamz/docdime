"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StaffActions({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Remove this staff member? They will lose admin access immediately.")) return;
    setDeleting(true);
    await fetch(`/api/admin/team/${id}`, { method: "DELETE" });
    setDeleting(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
    >
      {deleting ? "Removing…" : "Remove"}
    </button>
  );
}

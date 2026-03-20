"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function TemplateActions({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    setDeleting(true);
    await fetch(`/api/admin/email-templates/${id}`, { method: "DELETE" });
    setDeleting(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/admin/email-templates/${id}/edit`}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        Edit
      </Link>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
      >
        {deleting ? "..." : "Delete"}
      </button>
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import TemplateActions from "./template-actions";

export const dynamic = "force-dynamic";

export default async function AdminEmailTemplatesPage() {
  const templates = await prisma.emailTemplate.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
        <Link
          href="/admin/email-templates/new"
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New Template
        </Link>
      </div>
      <Card>
        <CardContent className="p-0">
          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {templates.map((t) => (
              <div key={t.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs font-medium text-gray-900">{t.name}</p>
                  <Badge variant={t.isActive ? "success" : "gray"}>
                    {t.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{t.subject}</p>
                <p className="text-xs text-gray-400 truncate">{t.variables.join(", ")}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">{formatDate(t.updatedAt)}</p>
                  <TemplateActions id={t.id} />
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Variables</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Updated</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium font-mono text-xs">{t.name}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{t.subject}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.variables.join(", ")}</td>
                    <td className="px-4 py-3">
                      <Badge variant={t.isActive ? "success" : "gray"}>
                        {t.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(t.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <TemplateActions id={t.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

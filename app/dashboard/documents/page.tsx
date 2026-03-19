import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatCurrency, formatDate, isOverdue, isExpired } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/documents/status-badge";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { type?: string; status?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const where: Record<string, unknown> = { userId: session.user.id };
  if (searchParams.type) where.type = searchParams.type;
  if (searchParams.status) where.status = searchParams.status;

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { customer: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <Link href="/dashboard/documents/new">
          <Button>+ New Document</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Link href="/dashboard/documents">
          <Button variant={!searchParams.type ? "primary" : "outline"} size="sm">All</Button>
        </Link>
        {["INVOICE", "QUOTE", "PURCHASE_ORDER"].map((type) => (
          <Link key={type} href={`/dashboard/documents?type=${type}`}>
            <Button
              variant={searchParams.type === type ? "primary" : "outline"}
              size="sm"
            >
              {type === "PURCHASE_ORDER" ? "Purchase Orders" : type.charAt(0) + type.slice(1).toLowerCase() + "s"}
            </Button>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-gray-500">No documents found.</p>
              <Link href="/dashboard/documents/new" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
                Create your first document
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Doc #</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Customer</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.map((doc) => {
                    const overdue = isOverdue(doc);
                    const expired = isExpired(doc);
                    return (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/documents/${doc.id}`} className="font-medium text-blue-600 hover:underline">
                            {doc.docNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {doc.type === "PURCHASE_ORDER" ? "PO" : doc.type}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{doc.customer?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(doc.issueDate)}</td>
                        <td className="px-4 py-3 font-medium">{formatCurrency(doc.total, doc.currency)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={doc.status} isOverdue={overdue} isExpired={expired} />
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/documents/${doc.id}`} className="text-gray-400 hover:text-gray-600">
                            →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

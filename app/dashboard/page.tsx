import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const userId = session.user.id;

  const [user, totalDocs, recentDocs, paidInvoices] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.document.count({ where: { userId } }),
    prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { customer: true },
    }),
    prisma.document.count({ where: { userId, type: "INVOICE", status: "PAID" } }),
  ]);

  const overdue = await prisma.document.count({
    where: {
      userId,
      type: "INVOICE",
      status: { in: ["DRAFT", "SENT"] },
      dueDate: { lt: new Date() },
    },
  });

  const stats = [
    {
      label: "Total Documents",
      value: totalDocs,
      icon: "📄",
      color: "bg-blue-50 text-blue-700",
    },
    {
      label: "Paid Invoices",
      value: paidInvoices,
      icon: "💰",
      color: "bg-green-50 text-green-700",
    },
    {
      label: "Overdue Invoices",
      value: overdue,
      icon: "⚠️",
      color: "bg-red-50 text-red-700",
    },
    {
      label: "Plan",
      value: user?.plan === "PRO" ? "Pro" : "Pay Per Use",
      icon: "⭐",
      color: "bg-yellow-50 text-yellow-700",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {session.user.name?.split(" ")[0] ?? "there"}!
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Here&apos;s what&apos;s happening with your business.</p>
        </div>
        <Link href="/dashboard/documents/new">
          <Button>+ New Document</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-5 min-w-0">
              <div className={`inline-flex p-2 rounded-lg text-xl mb-3 ${stat.color}`}>
                {stat.icon}
              </div>
              <p className="text-sm text-gray-500 truncate">{stat.label}</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 break-words leading-tight">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent documents */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Documents</h2>
          <Link href="/dashboard/documents" className="text-sm text-blue-600 hover:underline">
            View all
          </Link>
        </div>
        <CardContent className="p-0">
          {recentDocs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">No documents yet.</p>
              <Link href="/dashboard/documents/new" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
                Create your first document
              </Link>
            </div>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="sm:hidden divide-y divide-gray-100">
                {recentDocs.map((doc) => (
                  <Link key={doc.id} href={`/dashboard/documents/${doc.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-blue-600 text-sm">{doc.docNumber}</p>
                      <p className="text-xs text-gray-400">{doc.customer?.name ?? "—"} · {doc.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatCurrency(doc.total, doc.currency)}</p>
                      <Badge variant={doc.status === "PAID" ? "success" : doc.status === "SENT" ? "info" : "gray"}>{doc.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Document</th>
                      <th className="px-4 py-3 text-left font-medium">Customer</th>
                      <th className="px-4 py-3 text-left font-medium">Amount</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentDocs.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/documents/${doc.id}`} className="font-medium text-blue-600 hover:underline">
                            {doc.docNumber}
                          </Link>
                          <span className="ml-2 text-xs text-gray-400">{doc.type}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{doc.customer?.name ?? "—"}</td>
                        <td className="px-4 py-3 font-medium">{formatCurrency(doc.total, doc.currency)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={doc.status === "PAID" ? "success" : doc.status === "SENT" ? "info" : "gray"}>
                            {doc.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pro upsell */}
      {user?.plan !== "PRO" && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-5">
            <div>
              <p className="font-semibold text-blue-900">Upgrade to Pro</p>
              <p className="text-sm text-blue-700 mt-0.5">
                Get 20 free documents/month for only $1/month ($12/year).
              </p>
            </div>
            <Link href="/dashboard/subscription">
              <Button size="sm">Upgrade</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

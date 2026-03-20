import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminTransactionsPage() {
  const transactions = await prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: true, document: true },
    take: 100,
  });

  const totalRevenue = transactions
    .filter((t) => t.status === "SUCCESS")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <div className="bg-green-50 border border-green-200 px-4 py-2 rounded-lg self-start sm:self-auto">
          <p className="text-sm text-green-700 font-medium">Total Revenue: ${totalRevenue.toFixed(2)}</p>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {transactions.map((t) => (
              <div key={t.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">${t.amount.toFixed(2)}</p>
                  <Badge variant={t.status === "SUCCESS" ? "success" : t.status === "FAILED" ? "danger" : "warning"}>
                    {t.status}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 truncate">{t.user.email}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{t.type}</span>
                  {t.document && <><span>·</span><span>{t.document.docNumber}</span></>}
                  <span>·</span>
                  <span>{formatDate(t.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Document</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.paystackRef ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{t.user.email}</td>
                    <td className="px-4 py-3 text-gray-600">{t.document?.docNumber ?? "—"}</td>
                    <td className="px-4 py-3 font-medium">${t.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-600">{t.type}</td>
                    <td className="px-4 py-3">
                      <Badge variant={t.status === "SUCCESS" ? "success" : t.status === "FAILED" ? "danger" : "warning"}>
                        {t.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(t.createdAt)}</td>
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

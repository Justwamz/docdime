import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [
    totalUsers,
    totalDocs,
    proUsers,
    totalRevenue,
    recentTransactions,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count({ where: { isAdmin: false } }),
    prisma.document.count(),
    prisma.user.count({ where: { plan: "PRO" } }),
    prisma.transaction.aggregate({
      where: { status: "SUCCESS" },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: { status: "SUCCESS" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: true },
    }),
    prisma.user.findMany({
      where: { isAdmin: false },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const stats = [
    { label: "Total Users", value: totalUsers, icon: "👥" },
    { label: "Total Documents", value: totalDocs, icon: "📄" },
    { label: "Pro Users", value: proUsers, icon: "⭐" },
    { label: "Total Revenue", value: `$${(totalRevenue._sum.amount ?? 0).toFixed(2)}`, icon: "💰" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-5">
              <div className="text-2xl mb-2">{stat.icon}</div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent transactions */}
        <Card>
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
          </div>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentTransactions.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 text-gray-600">{t.user.email}</td>
                    <td className="px-4 py-3 font-medium">${t.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Recent users */}
        <Card>
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Users</h2>
          </div>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.plan === "PRO" ? "success" : "gray"}>{u.plan}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

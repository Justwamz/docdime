import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const [
    usersByPlan,
    docsByType,
    docsByStatus,
    monthlyRevenue,
  ] = await Promise.all([
    prisma.user.groupBy({
      by: ["plan"],
      where: { isAdmin: false },
      _count: true,
    }),
    prisma.document.groupBy({
      by: ["type"],
      _count: true,
    }),
    prisma.document.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.transaction.findMany({
      where: {
        status: "SUCCESS",
        createdAt: {
          gte: new Date(new Date().getFullYear(), 0, 1),
        },
      },
      select: { amount: true, createdAt: true },
    }),
  ]);

  const totalRevenue = monthlyRevenue.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Users by Plan</CardTitle></CardHeader>
          <CardContent>
            {usersByPlan.map((r) => (
              <div key={r.plan} className="flex justify-between py-2 border-b last:border-0">
                <span className="text-sm text-gray-600">{r.plan}</span>
                <span className="font-medium">{r._count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Documents by Type</CardTitle></CardHeader>
          <CardContent>
            {docsByType.map((r) => (
              <div key={r.type} className="flex justify-between py-2 border-b last:border-0">
                <span className="text-sm text-gray-600">{r.type}</span>
                <span className="font-medium">{r._count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Documents by Status</CardTitle></CardHeader>
          <CardContent>
            {docsByStatus.map((r) => (
              <div key={r.status} className="flex justify-between py-2 border-b last:border-0">
                <span className="text-sm text-gray-600">{r.status}</span>
                <span className="font-medium">{r._count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Revenue This Year</CardTitle></CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-green-600">${totalRevenue.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">{monthlyRevenue.length} transactions</p>
        </CardContent>
      </Card>
    </div>
  );
}

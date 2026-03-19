import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SubscriptionActions from "./subscription-actions";

export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return null;

  const totalDocs = await prisma.document.count({
    where: { userId: user.id },
  });

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id, status: "SUCCESS" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Subscription</h1>

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${user.plan === "PRO" ? "bg-blue-100" : "bg-gray-100"}`}>
              {user.plan === "PRO" ? "⭐" : "💼"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">
                  {user.plan === "PRO" ? "Pro Plan" : "Pay Per Use"}
                </p>
                <Badge variant={user.plan === "PRO" ? "success" : "gray"}>
                  {user.plan === "PRO" ? "Active" : "Free Tier"}
                </Badge>
              </div>
              {user.plan === "PRO" ? (
                <p className="text-sm text-gray-500">
                  $1/month • {user.docsThisMonth}/{20} free docs used this month
                  {user.proExpiresAt && ` • Renews ${formatDate(user.proExpiresAt)}`}
                </p>
              ) : (
                <p className="text-sm text-gray-500">$0.11 per document generated</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className={user.plan !== "PRO" ? "border-2 border-gray-200" : "border-2 border-gray-100 opacity-60"}>
          <CardContent className="pt-5">
            <h3 className="font-semibold text-gray-900">Pay Per Use</h3>
            <p className="text-3xl font-bold mt-2">$0.11<span className="text-sm text-gray-500 font-normal">/doc</span></p>
            <p className="text-sm text-gray-500 mt-2">Only pay when you generate a PDF</p>
            {user.plan === "PRO" && (
              <SubscriptionActions action="cancel" />
            )}
          </CardContent>
        </Card>

        <Card className={user.plan === "PRO" ? "border-2 border-blue-500" : "border-2 border-blue-200"}>
          <CardContent className="pt-5">
            <h3 className="font-semibold text-gray-900">Pro Plan</h3>
            <p className="text-3xl font-bold mt-2 text-blue-600">$1<span className="text-sm text-gray-500 font-normal">/month</span></p>
            <p className="text-sm text-gray-500 mt-2">$12/year • 20 free docs/month</p>
            {user.plan !== "PRO" && (
              <SubscriptionActions action="upgrade" email={user.email} />
            )}
            {user.plan === "PRO" && (
              <p className="mt-3 text-sm text-green-600 font-medium">✓ Active plan</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <Card>
        <CardHeader><CardTitle>Usage</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalDocs}</p>
              <p className="text-sm text-gray-500">Total documents</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{transactions.length}</p>
              <p className="text-sm text-gray-500">Transactions</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-600">{t.type}</td>
                    <td className="px-4 py-3 font-medium">${t.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="success">Paid</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

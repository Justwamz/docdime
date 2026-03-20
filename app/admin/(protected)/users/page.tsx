import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import UserDowngrade from "./user-toggle";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    where: { isAdmin: false },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { documents: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Users ({users.length})</h1>
      <Card>
        <CardContent className="p-0">
          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {users.map((u) => (
              <div key={u.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={u.plan === "PRO" ? "success" : "gray"}>{u.plan}</Badge>
                    {u.plan === "PRO" && <UserDowngrade userId={u.id} />}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{u.name ?? "—"}</span>
                  <span>·</span>
                  <span>{u.country}</span>
                  <span>·</span>
                  <span>{u._count.documents} docs</span>
                </div>
                <p className="text-xs text-gray-400">{formatDate(u.createdAt)}</p>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Country</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Docs</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600">{u.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{u.country}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.plan === "PRO" ? "success" : "gray"}>{u.plan}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u._count.documents}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      {u.plan === "PRO" ? <UserDowngrade userId={u.id} /> : <span className="text-xs text-gray-400">—</span>}
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

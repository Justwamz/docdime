import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import CreateStaffForm from "./create-staff-form";
import StaffActions from "./staff-actions";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);

  const staff = await prisma.user.findMany({
    where: { isAdmin: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Team ({staff.length})</h1>
        <CreateStaffForm />
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-gray-100">
            {staff.map((u) => (
              <div key={u.id} className="px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{u.name ?? "—"}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  {u.id !== session?.user.id && <StaffActions id={u.id} />}
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
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Joined</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{u.email}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      {u.id === session?.user.id ? (
                        <span className="text-xs text-gray-400">You</span>
                      ) : (
                        <StaffActions id={u.id} />
                      )}
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

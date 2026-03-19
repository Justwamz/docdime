import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [usersByPlan, docsByType, docsByStatus, totalRevenue, totalUsers, totalDocs] =
    await Promise.all([
      prisma.user.groupBy({ by: ["plan"], where: { isAdmin: false }, _count: true }),
      prisma.document.groupBy({ by: ["type"], _count: true }),
      prisma.document.groupBy({ by: ["status"], _count: true }),
      prisma.transaction.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
      prisma.user.count({ where: { isAdmin: false } }),
      prisma.document.count(),
    ]);

  return NextResponse.json({
    success: true,
    data: {
      usersByPlan,
      docsByType,
      docsByStatus,
      totalRevenue: totalRevenue._sum.amount ?? 0,
      totalUsers,
      totalDocs,
    },
  });
}

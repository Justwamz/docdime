import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [user, customers, taxes, documents, transactions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          businessName: true,
          country: true,
          currency: true,
          plan: true,
          createdAt: true,
        },
      }),
      prisma.customer.findMany({ where: { userId: session.user.id } }),
      prisma.tax.findMany({ where: { userId: session.user.id } }),
      prisma.document.findMany({
        where: { userId: session.user.id },
        include: { lineItems: true, customer: true },
      }),
      prisma.transaction.findMany({
        where: { userId: session.user.id },
        select: { id: true, amount: true, currency: true, status: true, type: true, createdAt: true },
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user,
      customers,
      taxes,
      documents,
      transactions,
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="docdime-export-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

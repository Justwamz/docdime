import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({ where: { id: params.id } });
  if (!user || user.isAdmin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (user.plan !== "PRO") {
    return NextResponse.json({ error: "User is not on a paid plan" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: { plan: "PAY_PER_USE", proExpiresAt: null, docsThisMonth: 0 },
    select: { id: true, plan: true },
  });

  return NextResponse.json({ success: true, data: updated });
}

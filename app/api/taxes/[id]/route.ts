import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, rate, isDefault, isInclusive, isCompound } = await req.json();

    const tax = await prisma.tax.findFirst({ where: { id: params.id, userId: session.user.id } });
    if (!tax) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (isDefault) {
      await prisma.tax.updateMany({ where: { userId: session.user.id }, data: { isDefault: false } });
    }

    const updated = await prisma.tax.update({
      where: { id: params.id },
      data: {
        name,
        rate: parseFloat(rate),
        isDefault: isDefault ?? false,
        isInclusive: isInclusive ?? false,
        isCompound: isCompound ?? false,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tax = await prisma.tax.findFirst({ where: { id: params.id, userId: session.user.id } });
    if (!tax) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.tax.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

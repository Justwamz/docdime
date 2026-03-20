import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

const groupInclude = {
  items: {
    orderBy: { order: "asc" as const },
    select: {
      id: true,
      order: true,
      tax: {
        select: { id: true, name: true, rate: true, isInclusive: true },
      },
    },
  },
};

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, isDefault, isCompound, items } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "A group must have at least one tax" }, { status: 400 });
    }

    const taxIds = items.map((item: { taxId: string }) => item.taxId);
    const uniqueTaxIds = new Set(taxIds);
    if (uniqueTaxIds.size !== taxIds.length) {
      return NextResponse.json({ error: "A tax cannot appear more than once in a group" }, { status: 400 });
    }

    const existing = await prisma.taxGroup.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.taxGroup.updateMany({
          where: { userId: session.user.id, id: { not: params.id } },
          data: { isDefault: false },
        });
      }

      await tx.taxGroupItem.deleteMany({ where: { groupId: params.id } });

      await tx.taxGroupItem.createMany({
        data: items.map((item: { taxId: string; order: number }) => ({
          groupId: params.id,
          taxId: item.taxId,
          order: item.order,
        })),
      });

      return tx.taxGroup.update({
        where: { id: params.id },
        data: { name, isDefault: isDefault ?? false, isCompound: isCompound ?? false },
        include: groupInclude,
      });
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

    const existing = await prisma.taxGroup.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.taxGroup.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const groups = await prisma.taxGroup.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
      include: groupInclude,
    });

    return NextResponse.json({ success: true, data: groups });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    const group = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.taxGroup.updateMany({
          where: { userId: session.user.id },
          data: { isDefault: false },
        });
      }

      return tx.taxGroup.create({
        data: {
          userId: session.user.id,
          name,
          isDefault: isDefault ?? false,
          isCompound: isCompound ?? false,
          items: {
            create: items.map((item: { taxId: string; order: number }) => ({
              taxId: item.taxId,
              order: item.order,
            })),
          },
        },
        include: groupInclude,
      });
    });

    return NextResponse.json({ success: true, data: group }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

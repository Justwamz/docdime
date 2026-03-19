import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const taxes = await prisma.tax.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: taxes });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, rate, isDefault, isInclusive, isCompound } = await req.json();
    if (!name || rate === undefined) {
      return NextResponse.json({ error: "Name and rate are required" }, { status: 400 });
    }

    if (isDefault) {
      await prisma.tax.updateMany({
        where: { userId: session.user.id },
        data: { isDefault: false },
      });
    }

    const tax = await prisma.tax.create({
      data: {
        userId: session.user.id,
        name,
        rate: parseFloat(rate),
        isDefault: isDefault ?? false,
        isInclusive: isInclusive ?? false,
        isCompound: isCompound ?? false,
      },
    });

    return NextResponse.json({ success: true, data: tax }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const doc = await prisma.document.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: { customer: true, lineItems: true },
    });

    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: doc });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const doc = await prisma.document.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const { status, notes, terms, dueDate, expiryDate } = body;

    const updated = await prisma.document.update({
      where: { id: params.id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(terms !== undefined && { terms }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(expiryDate && { expiryDate: new Date(expiryDate) }),
        ...(status === "PAID" && { paid: true }),
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

    const doc = await prisma.document.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.document.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

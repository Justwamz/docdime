import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { generateDocNumber } from "@/lib/utils";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { userId: session.user.id };
    if (type) where.type = type;
    if (status) where.status = status;

    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { customer: true, lineItems: true },
    });

    return NextResponse.json({ success: true, data: documents });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      type = "INVOICE",
      customerId,
      issueDate,
      dueDate,
      expiryDate,
      notes,
      terms,
      currency,
      lineItems = [],
      subtotal = 0,
      taxAmount = 0,
      total = 0,
    } = body;

    // Generate doc number
    const existingCount = await prisma.document.count({
      where: { userId: session.user.id, type },
    });
    const docNumber = generateDocNumber(type, existingCount);

    const document = await prisma.document.create({
      data: {
        userId: session.user.id,
        customerId: customerId || null,
        type,
        docNumber,
        issueDate: issueDate ? new Date(issueDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        notes,
        terms,
        currency: currency ?? "USD",
        subtotal,
        taxAmount,
        total,
        lineItems: {
          create: lineItems.map((item: {
            description: string;
            quantity: number;
            unitPrice: number;
            taxRate: number;
            total: number;
          }) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            total: item.total,
          })),
        },
      },
      include: { lineItems: true, customer: true },
    });

    return NextResponse.json({ success: true, data: document }, { status: 201 });
  } catch (error) {
    console.error("[Documents POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

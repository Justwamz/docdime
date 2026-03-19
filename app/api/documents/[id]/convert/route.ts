import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { generateDocNumber } from "@/lib/utils";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const quote = await prisma.document.findFirst({
      where: { id: params.id, userId: session.user.id, type: "QUOTE" },
      include: { lineItems: true },
    });

    if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    if (quote.convertedToId) {
      return NextResponse.json({ error: "Already converted" }, { status: 400 });
    }

    const existingInvoiceCount = await prisma.document.count({
      where: { userId: session.user.id, type: "INVOICE" },
    });

    const invoice = await prisma.document.create({
      data: {
        userId: session.user.id,
        customerId: quote.customerId,
        type: "INVOICE",
        docNumber: generateDocNumber("INVOICE", existingInvoiceCount),
        issueDate: new Date(),
        notes: quote.notes,
        terms: quote.terms,
        currency: quote.currency,
        subtotal: quote.subtotal,
        taxAmount: quote.taxAmount,
        total: quote.total,
        convertedFromId: quote.id,
        lineItems: {
          create: quote.lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            total: item.total,
          })),
        },
      },
    });

    // Link quote to new invoice
    await prisma.document.update({
      where: { id: quote.id },
      data: { convertedToId: invoice.id, status: "ACCEPTED" },
    });

    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    console.error("[Convert]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

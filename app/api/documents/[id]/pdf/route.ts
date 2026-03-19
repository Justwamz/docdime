import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { generatePDF } from "@/lib/pdf";
import { uploadPDF, getPDFKey } from "@/lib/s3";
import { Buffer } from "buffer";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const doc = await prisma.document.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: { customer: true, lineItems: true },
    });

    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const pdfBytes = await generatePDF({
      docNumber: doc.docNumber,
      type: doc.type,
      issueDate: doc.issueDate.toISOString(),
      dueDate: doc.dueDate?.toISOString(),
      expiryDate: doc.expiryDate?.toISOString(),
      businessName: user.businessName ?? user.name ?? "Business",
      businessEmail: user.businessEmail ?? undefined,
      businessPhone: user.businessPhone ?? undefined,
      businessAddress: user.businessAddress ?? undefined,
      businessLogo: user.businessLogo ?? undefined,
      customerName: doc.customer?.name,
      customerEmail: doc.customer?.email ?? undefined,
      customerAddress: doc.customer?.address ?? undefined,
      lineItems: doc.lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        total: item.total,
      })),
      subtotal: doc.subtotal,
      taxAmount: doc.taxAmount,
      total: doc.total,
      currency: doc.currency,
      notes: doc.notes ?? undefined,
      terms: doc.terms ?? undefined,
      bankingDetails: (user.bankingDetails as Record<string, string>) ?? undefined,
    });

    const key = getPDFKey(session.user.id, doc.docNumber);
    const pdfUrl = await uploadPDF(key, Buffer.from(pdfBytes));

    // Update monthly doc count for PRO users
    if (user.plan === "PRO") {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { docsThisMonth: { increment: 1 } },
      });
    }

    const updated = await prisma.document.update({
      where: { id: params.id },
      data: { pdfUrl },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[PDF Generate]", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}

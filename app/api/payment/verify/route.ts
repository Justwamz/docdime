import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { verifyPayment } from "@/lib/paystack";
import { generatePDF } from "@/lib/pdf";
import { uploadPDF, getPDFKey } from "@/lib/s3";
import { Buffer } from "buffer";
import { triggerPaymentReceivedEmail, triggerPaymentNotifyEmail } from "@/lib/email-triggers";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { reference, documentId } = await req.json();
    if (!reference || !documentId) {
      return NextResponse.json({ error: "Reference and document ID required" }, { status: 400 });
    }

    // Verify payment — bypass Paystack for test-mode mock references
    if (!reference.startsWith("mock_")) {
      const paymentData = await verifyPayment(reference);
      if (paymentData.status !== "success") {
        await prisma.transaction.updateMany({
          where: { paystackRef: reference },
          data: { status: "FAILED" },
        });
        return NextResponse.json({ error: "Payment not successful" }, { status: 400 });
      }
    }

    // Update transaction to SUCCESS
    await prisma.transaction.updateMany({
      where: { paystackRef: reference },
      data: { status: "SUCCESS" },
    });

    // Generate PDF
    const doc = await prisma.document.findFirst({
      where: { id: documentId, userId: session.user.id },
      include: { customer: true, lineItems: true },
    });

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const pdfBytes = await generatePDF({
      documentId: documentId,
      docNumber: doc.docNumber,
      type: doc.type,
      issueDate: doc.issueDate.toISOString(),
      dueDate: doc.dueDate?.toISOString(),
      expiryDate: doc.expiryDate?.toISOString(),
      businessName: user.businessName ?? user.name ?? "Business",
      businessEmail: user.businessEmail ?? undefined,
      businessPhone: user.businessPhone ?? undefined,
      businessAddress: user.businessAddress ?? undefined,
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

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: { pdfUrl },
    });

    triggerPaymentReceivedEmail(
      { email: user.email, name: user.name },
      doc.docNumber,
      doc.total,
      doc.currency
    ).catch(() => {});

    triggerPaymentNotifyEmail(
      { email: user.email, name: user.name },
      doc.docNumber,
      doc.total,
      doc.currency
    ).catch(() => {});

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[Payment Verify]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

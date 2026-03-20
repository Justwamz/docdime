import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { triggerInvoiceSentEmail, triggerQuoteSentEmail } from "@/lib/email-triggers";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const doc = await prisma.document.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: { customer: true },
    });

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const updated = await prisma.document.update({
      where: { id: params.id },
      data: { status: "SENT" },
    });

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user && doc.customer) {
      if (doc.type === "INVOICE") {
        triggerInvoiceSentEmail(
          { docNumber: doc.docNumber, total: doc.total, currency: doc.currency, dueDate: doc.dueDate, pdfUrl: doc.pdfUrl },
          { businessName: user.businessName, name: user.name },
          { email: doc.customer.email, name: doc.customer.name }
        ).catch(() => {});
      } else if (doc.type === "QUOTE") {
        triggerQuoteSentEmail(
          { docNumber: doc.docNumber, total: doc.total, currency: doc.currency, expiryDate: doc.expiryDate, pdfUrl: doc.pdfUrl },
          { businessName: user.businessName, name: user.name },
          { email: doc.customer.email, name: doc.customer.name }
        ).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[Document Send]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

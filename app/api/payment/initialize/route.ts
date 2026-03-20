import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { initializePayment, generateReference } from "@/lib/paystack";
import { getPricing } from "@/lib/pricing";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { documentId } = await req.json();
    if (!documentId) return NextResponse.json({ error: "Document ID required" }, { status: 400 });

    const doc = await prisma.document.findFirst({
      where: { id: documentId, userId: session.user.id },
    });
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { docPriceUsd, proMonthlyDocs } = await getPricing();

    // Check if PRO user has free docs remaining
    if (user.plan === "PRO") {
      // Reset monthly count if needed
      const now = new Date();
      const lastReset = new Date(user.lastDocReset);
      const sameMonth =
        now.getMonth() === lastReset.getMonth() &&
        now.getFullYear() === lastReset.getFullYear();

      let docsUsed = user.docsThisMonth;
      if (!sameMonth) {
        docsUsed = 0;
        await prisma.user.update({
          where: { id: session.user.id },
          data: { docsThisMonth: 0, lastDocReset: now },
        });
      }

      if (docsUsed < proMonthlyDocs) {
        // Free doc — skip payment
        return NextResponse.json({ success: true, free: true });
      }
    }

    // If Paystack is not configured (testing mode), generate PDF for free
    const paystackKey = process.env.PAYSTACK_SECRET_KEY ?? "";
    if (!paystackKey || paystackKey.includes("your_paystack")) {
      console.log("[Payment] Paystack not configured — generating PDF directly (test mode)");
      return NextResponse.json({ success: true, free: true, testMode: true });
    }

    // Initialize Paystack payment
    const reference = generateReference();
    const amountInKobo = Math.round(docPriceUsd * 100);

    // Create pending transaction
    await prisma.transaction.create({
      data: {
        userId: session.user.id,
        documentId,
        paystackRef: reference,
        amount: docPriceUsd,
        currency: "USD",
        status: "PENDING",
        type: "DOC_GENERATION",
      },
    });

    return NextResponse.json({
      success: true,
      free: false,
      reference,
      amountInKobo,
      amount: docPriceUsd,
    });
  } catch (error) {
    console.error("[Payment Initialize]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { verifyPayment, generateReference } from "@/lib/paystack";
import { triggerProUpgradedEmail } from "@/lib/email-triggers";
import { getPricing } from "@/lib/pricing";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, docsThisMonth: true, proExpiresAt: true },
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { action, reference } = await req.json();

    if (action === "initialize_upgrade") {
      const { proAnnualUsd } = await getPricing();
      const ref = generateReference();
      const amountInKobo = Math.round(proAnnualUsd * 100);

      await prisma.transaction.create({
        data: {
          userId: session.user.id,
          paystackRef: ref,
          amount: proAnnualUsd,
          currency: "USD",
          status: "PENDING",
          type: "SUBSCRIPTION",
        },
      });

      return NextResponse.json({ success: true, reference: ref, amountInKobo });
    }

    if (action === "verify_upgrade") {
      const paymentData = await verifyPayment(reference);
      if (paymentData.status !== "success") {
        return NextResponse.json({ error: "Payment failed" }, { status: 400 });
      }

      await prisma.transaction.updateMany({
        where: { paystackRef: reference },
        data: { status: "SUCCESS" },
      });

      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      await prisma.user.update({
        where: { id: session.user.id },
        data: { plan: "PRO", proExpiresAt: expiresAt, docsThisMonth: 0 },
      });

      const upgradedUser = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (upgradedUser) {
        triggerProUpgradedEmail({
          email: upgradedUser.email,
          name: upgradedUser.name,
          proExpiresAt: upgradedUser.proExpiresAt,
        }).catch(() => {});
      }

      return NextResponse.json({ success: true, plan: "PRO" });
    }

    if (action === "cancel") {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { plan: "PAY_PER_USE" },
      });
      return NextResponse.json({ success: true, plan: "PAY_PER_USE" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Subscription]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

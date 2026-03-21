import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";
import { sendPushToUser } from "@/lib/push";

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    // Verify webhook signature
    const hash = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY ?? "")
      .update(body)
      .digest("hex");

    if (hash !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);

    if (event.event === "charge.success") {
      const { reference, status } = event.data;

      if (status === "success") {
        await prisma.transaction.updateMany({
          where: { paystackRef: reference },
          data: { status: "SUCCESS" },
        });

        const tx = await prisma.transaction.findFirst({
          where: { paystackRef: reference },
          select: { userId: true, documentId: true },
        });
        if (tx) {
          sendPushToUser(tx.userId, {
            title: "Payment Confirmed",
            body: "Your document payment was successful. Your PDF is ready.",
            url: tx.documentId ? `/dashboard/documents/${tx.documentId}` : "/dashboard",
            tag: `payment-${reference}`,
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook]", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}

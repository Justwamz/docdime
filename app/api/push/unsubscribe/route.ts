import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Push Unsubscribe]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

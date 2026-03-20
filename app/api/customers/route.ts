import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { triggerCustomerCreatedEmail } from "@/lib/email-triggers";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const customers = await prisma.customer.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: customers });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, email, phone, address } = await req.json();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const customer = await prisma.customer.create({
      data: { userId: session.user.id, name, email, phone, address },
    });

    triggerCustomerCreatedEmail(session.user.id, { name: customer.name, email: customer.email }).catch(() => {});

    return NextResponse.json({ success: true, data: customer }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

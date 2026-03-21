import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { password } = body;
    if (!password) return NextResponse.json({ error: "Password is required to delete your account" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const valid = await bcrypt.compare(password, user.password ?? "");
    if (!valid) return NextResponse.json({ error: "Incorrect password" }, { status: 403 });

    await prisma.user.delete({ where: { id: session.user.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Account Delete]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

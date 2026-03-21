import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { triggerWelcomeEmail } from "@/lib/email-triggers";
import { rateLimit, getIp } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    // 5 registrations per hour per IP
    const { allowed } = rateLimit(`register:${getIp(req)}`, 5, 60 * 60 * 1000);
    if (!allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });

    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, password: hashed },
    });

    triggerWelcomeEmail({ email: user.email, name: user.name }).catch(() => {});

    return NextResponse.json(
      { success: true, data: { id: user.id, email: user.email } },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Register]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

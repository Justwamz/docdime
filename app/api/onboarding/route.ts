import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { businessName, businessEmail, businessPhone, businessAddress, country, currency, consentGiven } = body;

    if (!consentGiven) {
      return NextResponse.json({ error: "Consent required" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        businessName,
        businessEmail,
        businessPhone,
        businessAddress,
        country,
        currency,
        consentGiven,
        onboardingDone: true,
      },
    });

    return NextResponse.json({ success: true, data: { onboardingDone: true } });
  } catch (error) {
    console.error("[Onboarding]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

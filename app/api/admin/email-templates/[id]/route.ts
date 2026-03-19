import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { subject, body, variables, isActive } = await req.json();

  const template = await prisma.emailTemplate.update({
    where: { id: params.id },
    data: {
      ...(subject && { subject }),
      ...(body && { body }),
      ...(variables && { variables }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json({ success: true, data: template });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.emailTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}

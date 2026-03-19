import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.document.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { docNumber: true, pdfUrl: true },
  });

  if (!doc || !doc.pdfUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = `${doc.docNumber}.pdf`;

  // Data URL (S3 not configured) — decode base64 and stream back
  if (doc.pdfUrl.startsWith("data:")) {
    const base64 = doc.pdfUrl.split(",")[1];
    const buffer = Buffer.from(base64, "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // S3 presigned URL — fetch server-side and proxy back with correct filename
  const res = await fetch(doc.pdfUrl);
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch PDF" }, { status: 502 });
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

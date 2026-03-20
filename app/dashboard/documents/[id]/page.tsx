import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { formatDate, isOverdue, isExpired } from "@/lib/utils";
import Link from "next/link";
import { DocumentPreview } from "@/components/documents/document-preview";
import { StatusBadge } from "@/components/documents/status-badge";
import { DocumentActions } from "./document-actions";
import type { Document } from "@/types";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const doc = await prisma.document.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { customer: true, lineItems: true },
  });

  if (!doc) notFound();

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });

  const overdue = isOverdue(doc);
  const expired = isExpired(doc);

  // Unlocked: PRO users always have access; PAY_PER_USE users unlock per-doc after payment (pdfUrl is set)
  const unlocked = user?.plan === "PRO" || !!doc.pdfUrl;

  const docForDisplay: Document = {
    id: doc.id,
    type: doc.type as Document["type"],
    status: doc.status as Document["status"],
    docNumber: doc.docNumber,
    issueDate: doc.issueDate.toISOString(),
    dueDate: doc.dueDate?.toISOString(),
    expiryDate: doc.expiryDate?.toISOString(),
    notes: doc.notes ?? undefined,
    terms: doc.terms ?? undefined,
    subtotal: doc.subtotal,
    taxAmount: doc.taxAmount,
    total: doc.total,
    currency: doc.currency,
    pdfUrl: doc.pdfUrl ?? undefined,
    paid: doc.paid,
    customer: doc.customer
      ? {
          id: doc.customer.id,
          name: doc.customer.name,
          email: doc.customer.email ?? undefined,
          address: doc.customer.address ?? undefined,
        }
      : undefined,
    lineItems: doc.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      total: item.total,
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    isOverdue: overdue,
    isExpired: expired,
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/documents" className="text-gray-400 hover:text-gray-600">
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{doc.docNumber}</h1>
            <p className="text-sm text-gray-500">{formatDate(doc.issueDate)}</p>
          </div>
          <StatusBadge status={doc.status} isOverdue={overdue} isExpired={expired} />
        </div>

      </div>

      <DocumentActions
        docId={doc.id}
        docNumber={doc.docNumber}
        docType={doc.type}
        docStatus={doc.status}
        pdfUrl={doc.pdfUrl ?? undefined}
        convertedToId={doc.convertedToId}
        unlocked={unlocked}
        userEmail={user?.email ?? undefined}
      />

      <DocumentPreview
        document={docForDisplay}
        businessName={user?.businessName ?? user?.name ?? ""}
        businessEmail={user?.businessEmail ?? undefined}
        businessAddress={user?.businessAddress ?? undefined}
        locked={!unlocked}
      />
    </div>
  );
}

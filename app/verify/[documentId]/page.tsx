import { headers } from "next/headers";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Verify Document | DocDime",
  robots: { index: false, follow: false },
};

export default async function VerifyPage({
  params,
}: {
  params: { documentId: string };
}) {
  const { documentId } = params;

  const doc = await prisma.document.findFirst({
    where: { id: documentId },
    include: { customer: true },
  });

  const headersList = headers();
  const rawIp = headersList.get("x-forwarded-for");
  const ip = rawIp ? rawIp.split(",")[0].trim() : "unknown";
  const userAgent = headersList.get("user-agent") ?? null;
  const verifiedAt = new Date();

  if (doc) {
    await prisma.$transaction(async (tx) => {
      const verification = await tx.documentVerification.upsert({
        where: { documentId },
        create: {
          documentId,
          verifiedCount: 1,
          lastVerifiedAt: verifiedAt,
        },
        update: {
          verifiedCount: { increment: 1 },
          lastVerifiedAt: verifiedAt,
        },
      });

      await tx.verificationLog.create({
        data: {
          verificationId: verification.id,
          ip,
          userAgent,
        },
      });
    });

    const user = await prisma.user.findUnique({
      where: { id: doc.userId },
      select: { businessName: true, name: true },
    });
    const businessName = user?.businessName ?? user?.name ?? "—";

    const typeLabel =
      doc.type === "INVOICE" ? "Invoice"
      : doc.type === "QUOTE" ? "Quote"
      : "Purchase Order";

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-green-50 border-b border-green-200 px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-green-900">Document Verified</p>
              <p className="text-xs text-green-700">This document exists in DocDime&apos;s records</p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <span className="text-gray-500">Document Number</span>
              <span className="font-medium text-gray-900 text-right">{doc.docNumber}</span>

              <span className="text-gray-500">Type</span>
              <span className="font-medium text-gray-900 text-right">{typeLabel}</span>

              <span className="text-gray-500">Issue Date</span>
              <span className="font-medium text-gray-900 text-right">{formatDate(doc.issueDate)}</span>

              <span className="text-gray-500">Total Amount</span>
              <span className="font-medium text-gray-900 text-right">{formatCurrency(doc.total, doc.currency)}</span>

              <span className="text-gray-500">Status</span>
              <span className="font-medium text-gray-900 text-right capitalize">{doc.status.toLowerCase()}</span>

              <span className="text-gray-500">Business</span>
              <span className="font-medium text-gray-900 text-right">{businessName}</span>

              {doc.customer && (
                <>
                  <span className="text-gray-500">Customer</span>
                  <span className="font-medium text-gray-900 text-right">{doc.customer.name}</span>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Verified at {verifiedAt.toISOString().replace("T", " ").slice(0, 19)} UTC
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border-t border-blue-100 px-6 py-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-blue-700 font-medium">
              This document was generated on DocDime
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Document not found
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-red-50 border-b border-red-200 px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-red-900">Cannot Verify</p>
            <p className="text-xs text-red-700">This document could not be found in our records</p>
          </div>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-gray-600">
            This document could not be found. It may be fraudulent or the document ID may be incorrect.
          </p>
        </div>

        <div className="bg-blue-50 border-t border-blue-100 px-6 py-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-blue-700 font-medium">
            This document was generated on DocDime
          </p>
        </div>
      </div>
    </div>
  );
}

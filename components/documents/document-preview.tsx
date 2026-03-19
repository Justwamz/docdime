"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import { StatusBadge } from "./status-badge";
import type { Document } from "@/types";

interface DocumentPreviewProps {
  document: Document;
  businessName?: string;
  businessEmail?: string;
  businessAddress?: string;
  hideHeader?: boolean;
}

export function DocumentPreview({
  document,
  businessName,
  businessEmail,
  businessAddress,
  hideHeader = false,
}: DocumentPreviewProps) {
  const typeLabel =
    document.type === "INVOICE"
      ? "INVOICE"
      : document.type === "QUOTE"
      ? "QUOTE"
      : "PURCHASE ORDER";

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header - hidden in preview mode if hideHeader is true */}
      {!hideHeader && (
        <div className="bg-blue-600 px-8 py-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">{typeLabel}</h1>
              <p className="text-blue-200 mt-1">{document.docNumber}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{businessName}</p>
              {businessEmail && <p className="text-blue-200 text-sm">{businessEmail}</p>}
              {businessAddress && <p className="text-blue-200 text-sm">{businessAddress}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="px-8 py-6 space-y-6">
        {/* Meta info */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium text-gray-900">Issue Date: </span>
                {formatDate(document.issueDate)}
              </div>
              {document.dueDate && (
                <div>
                  <span className="font-medium text-gray-900">Due Date: </span>
                  {formatDate(document.dueDate)}
                </div>
              )}
              {document.expiryDate && (
                <div>
                  <span className="font-medium text-gray-900">Valid Until: </span>
                  {formatDate(document.expiryDate)}
                </div>
              )}
            </div>
          </div>
          <StatusBadge
            status={document.status}
            isOverdue={document.isOverdue}
            isExpired={document.isExpired}
          />
        </div>

        {/* Bill to */}
        {document.customer && (
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Bill To</p>
            <p className="font-semibold text-gray-900">{document.customer.name}</p>
            {document.customer.email && <p className="text-sm text-gray-500">{document.customer.email}</p>}
            {document.customer.address && <p className="text-sm text-gray-500">{document.customer.address}</p>}
          </div>
        )}

        {/* Line items */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-gray-500 font-medium">Description</th>
                <th className="text-right px-4 py-2 text-gray-500 font-medium">Qty</th>
                <th className="text-right px-4 py-2 text-gray-500 font-medium">Unit Price</th>
                <th className="text-right px-4 py-2 text-gray-500 font-medium">Tax</th>
                <th className="text-right px-4 py-2 text-gray-500 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {document.lineItems.map((item, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-gray-900">{item.description}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {formatCurrency(item.unitPrice, document.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{item.taxRate}%</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(item.total, document.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-56 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(document.subtotal, document.currency)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax</span>
              <span>{formatCurrency(document.taxAmount, document.currency)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Total</span>
              <span className="text-blue-600">{formatCurrency(document.total, document.currency)}</span>
            </div>
          </div>
        </div>

        {/* Notes / Terms */}
        {(document.notes || document.terms) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            {document.notes && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Notes</p>
                <p className="text-sm text-gray-600">{document.notes}</p>
              </div>
            )}
            {document.terms && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Terms</p>
                <p className="text-sm text-gray-600">{document.terms}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

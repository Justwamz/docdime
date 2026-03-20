import { PDFDocument, rgb, StandardFonts, degrees, PDFImage, PDFPage, PDFFont, RGB } from "pdf-lib";
import { formatCurrency, formatDate, readAppliedTaxes } from "./utils";
import QRCode from "qrcode";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
  appliedTaxes?: unknown; // AppliedTaxSnapshot | AppliedTax[] | null
}

interface PDFData {
  documentId?: string;
  docNumber: string;
  type: string;
  issueDate: string;
  dueDate?: string;
  expiryDate?: string;
  businessName: string;
  businessEmail?: string;
  businessPhone?: string;
  businessAddress?: string;
  customerName?: string;
  customerEmail?: string;
  customerAddress?: string;
  lineItems: LineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  notes?: string;
  terms?: string;
  bankingDetails?: Record<string, string>;
  businessLogo?: string;
}

async function embedLogo(pdfDoc: PDFDocument, logoUrl: string): Promise<PDFImage | null> {
  try {
    let bytes: Uint8Array;
    let isJpeg = false;

    if (logoUrl.startsWith("data:")) {
      const [header, base64] = logoUrl.split(",");
      if (!base64) return null;
      isJpeg = header.includes("jpeg") || header.includes("jpg");
      if (!header.includes("png") && !isJpeg) return null;
      bytes = Buffer.from(base64, "base64");
    } else {
      const res = await fetch(logoUrl);
      if (!res.ok) return null;
      const ct = res.headers.get("content-type") ?? "";
      isJpeg = ct.includes("jpeg") || ct.includes("jpg");
      if (!ct.includes("png") && !isJpeg) return null;
      bytes = new Uint8Array(await res.arrayBuffer());
    }

    return isJpeg ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
  } catch {
    return null;
  }
}

// ─── Theme colours per document type ────────────────────────────────────────

function themeColor(type: string): RGB {
  if (type === "QUOTE") return rgb(0.05, 0.56, 0.49);          // teal
  if (type === "PURCHASE_ORDER") return rgb(0.27, 0.16, 0.70); // indigo
  return rgb(0.15, 0.39, 0.92);                                 // blue (invoice)
}

// ─── Shared drawing helpers ──────────────────────────────────────────────────

function drawHeader(
  page: PDFPage,
  data: PDFData,
  logoImage: PDFImage | null,
  regularFont: PDFFont,
  boldFont: PDFFont,
  primary: RGB,
  width: number,
  height: number
) {
  // Background band
  page.drawRectangle({ x: 0, y: height - 120, width, height: 120, color: primary });

  const typeLabel =
    data.type === "INVOICE" ? "INVOICE"
    : data.type === "QUOTE" ? "QUOTATION"
    : "PURCHASE ORDER";

  page.drawText(typeLabel, {
    x: 40, y: height - 50, size: 28, font: boldFont, color: rgb(1, 1, 1),
  });

  page.drawText(data.docNumber, {
    x: 40, y: height - 78, size: 13, font: regularFont, color: rgb(0.8, 0.9, 1),
  });

  page.drawText(`Date: ${formatDate(data.issueDate)}`, {
    x: 40, y: height - 100, size: 9, font: regularFont, color: rgb(0.8, 0.9, 1),
  });

  if (data.type === "INVOICE" && data.dueDate) {
    page.drawText(`Due: ${formatDate(data.dueDate)}`, {
      x: 190, y: height - 100, size: 9, font: boldFont, color: rgb(1, 1, 0.6),
    });
  }
  if (data.type === "QUOTE" && data.expiryDate) {
    page.drawText(`Valid Until: ${formatDate(data.expiryDate)}`, {
      x: 190, y: height - 100, size: 9, font: boldFont, color: rgb(1, 1, 0.6),
    });
  }

  // Right side — logo or business info
  if (logoImage) {
    const maxW = 100, maxH = 80;
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height);
    page.drawImage(logoImage, {
      x: width - 40 - logoImage.width * scale,
      y: height - 20 - logoImage.height * scale,
      width: logoImage.width * scale,
      height: logoImage.height * scale,
    });
  } else {
    [data.businessName, data.businessEmail ?? "", data.businessPhone ?? ""]
      .filter(Boolean)
      .forEach((line, i) => {
        const tw = (i === 0 ? boldFont : regularFont).widthOfTextAtSize(line, 10);
        page.drawText(line, {
          x: width - 40 - tw, y: height - 45 - i * 15,
          size: 10, font: i === 0 ? boldFont : regularFont, color: rgb(1, 1, 1),
        });
      });
  }
}

function drawParties(
  page: PDFPage,
  data: PDFData,
  regularFont: PDFFont,
  boldFont: PDFFont,
  primary: RGB,
  darkColor: RGB,
  grayColor: RGB,
  yStart: number
): number {
  let yPos = yStart;

  // Left label = FROM for all types
  // Right label depends on type
  const rightLabel =
    data.type === "INVOICE" ? "BILL TO"
    : data.type === "QUOTE" ? "PREPARED FOR"
    : "VENDOR";

  page.drawText("FROM", { x: 40, y: yPos, size: 8, font: boldFont, color: primary });
  page.drawText(rightLabel, { x: 300, y: yPos, size: 8, font: boldFont, color: primary });

  yPos -= 16;
  page.drawText(data.businessName, { x: 40, y: yPos, size: 11, font: boldFont, color: darkColor });
  if (data.customerName) {
    page.drawText(data.customerName, { x: 300, y: yPos, size: 11, font: boldFont, color: darkColor });
  }

  yPos -= 14;
  if (data.businessAddress) {
    page.drawText(data.businessAddress.slice(0, 40), { x: 40, y: yPos, size: 9, font: regularFont, color: grayColor });
  }
  if (data.customerAddress) {
    page.drawText(data.customerAddress.slice(0, 40), { x: 300, y: yPos, size: 9, font: regularFont, color: grayColor });
  }

  yPos -= 13;
  if (data.businessEmail) {
    page.drawText(data.businessEmail, { x: 40, y: yPos, size: 9, font: regularFont, color: grayColor });
  }
  if (data.customerEmail) {
    page.drawText(data.customerEmail, { x: 300, y: yPos, size: 9, font: regularFont, color: grayColor });
  }

  // For PO: add a "DELIVER TO" section on the right below vendor
  if (data.type === "PURCHASE_ORDER") {
    yPos -= 20;
    page.drawText("DELIVER TO", { x: 40, y: yPos, size: 8, font: boldFont, color: primary });
    yPos -= 14;
    page.drawText(data.businessName, { x: 40, y: yPos, size: 10, font: boldFont, color: darkColor });
    yPos -= 13;
    if (data.businessAddress) {
      page.drawText(data.businessAddress.slice(0, 40), { x: 40, y: yPos, size: 9, font: regularFont, color: grayColor });
    }
  }

  return yPos;
}

function drawLineItems(
  page: PDFPage,
  data: PDFData,
  regularFont: PDFFont,
  boldFont: PDFFont,
  primary: RGB,
  darkColor: RGB,
  lightGray: RGB,
  width: number,
  yStart: number
): number {
  let yPos = yStart - 30;

  page.drawRectangle({ x: 40, y: yPos - 4, width: width - 80, height: 20, color: primary });
  page.drawText("DESCRIPTION", { x: 50, y: yPos + 3, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText("QTY",         { x: 320, y: yPos + 3, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText("UNIT PRICE",  { x: 368, y: yPos + 3, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText("AMOUNT",      { x: 487, y: yPos + 3, size: 8, font: boldFont, color: rgb(1, 1, 1) });

  yPos -= 20;

  data.lineItems.forEach((item, i) => {
    if (i % 2 === 0) {
      page.drawRectangle({ x: 40, y: yPos - 4, width: width - 80, height: 18, color: lightGray });
    }
    page.drawText(item.description.slice(0, 45), { x: 50,  y: yPos + 2, size: 9, font: regularFont, color: darkColor });
    page.drawText(String(item.quantity),           { x: 320, y: yPos + 2, size: 9, font: regularFont, color: darkColor });
    page.drawText(formatCurrency(item.unitPrice, data.currency), { x: 363, y: yPos + 2, size: 9, font: regularFont, color: darkColor });
    page.drawText(formatCurrency(item.total, data.currency),     { x: 483, y: yPos + 2, size: 9, font: regularFont, color: darkColor });
    yPos -= 18;
  });

  return yPos;
}

function drawTotals(
  page: PDFPage,
  data: PDFData,
  regularFont: PDFFont,
  boldFont: PDFFont,
  primary: RGB,
  darkColor: RGB,
  grayColor: RGB,
  yStart: number
): number {
  let yPos = yStart - 18;
  const totalsX = 380;

  page.drawText("Subtotal:", { x: totalsX, y: yPos, size: 9, font: regularFont, color: grayColor });
  page.drawText(formatCurrency(data.subtotal, data.currency), { x: 490, y: yPos, size: 9, font: regularFont, color: darkColor });

  // Per-component tax breakdown
  const taxComponents = new Map<string, { label: string; amount: number }>();
  data.lineItems.forEach((item) => {
    const snap = readAppliedTaxes(item.appliedTaxes);
    if (!snap) return;
    if (snap.type === "tax") {
      const label = `${snap.name} ${snap.rate}%${snap.isInclusive ? " (incl.)" : ""}`;
      const prev = taxComponents.get(snap.taxId);
      taxComponents.set(snap.taxId, { label, amount: (prev?.amount ?? 0) + snap.amount });
    } else {
      snap.items.forEach((t) => {
        const label = `${t.name} ${t.rate}%${t.isInclusive ? " (incl.)" : ""}`;
        const prev = taxComponents.get(t.taxId);
        taxComponents.set(t.taxId, { label, amount: (prev?.amount ?? 0) + t.amount });
      });
    }
  });

  if (taxComponents.size === 0) {
    yPos -= 16;
    page.drawText("Tax:", { x: totalsX, y: yPos, size: 9, font: regularFont, color: grayColor });
    page.drawText(formatCurrency(data.taxAmount, data.currency), { x: 490, y: yPos, size: 9, font: regularFont, color: darkColor });
  } else {
    for (const { label, amount } of Array.from(taxComponents.values())) {
      yPos -= 16;
      page.drawText(label, { x: totalsX, y: yPos, size: 9, font: regularFont, color: grayColor });
      page.drawText(formatCurrency(amount, data.currency), { x: 490, y: yPos, size: 9, font: regularFont, color: darkColor });
    }
  }

  yPos -= 6;
  page.drawLine({ start: { x: totalsX, y: yPos }, end: { x: 555, y: yPos }, thickness: 1, color: primary });

  yPos -= 18;

  const totalLabel =
    data.type === "INVOICE" ? "AMOUNT DUE"
    : data.type === "QUOTE" ? "QUOTE TOTAL"
    : "ORDER TOTAL";

  page.drawText(totalLabel, { x: totalsX, y: yPos, size: 11, font: boldFont, color: primary });
  page.drawText(formatCurrency(data.total, data.currency), { x: 478, y: yPos, size: 11, font: boldFont, color: primary });

  return yPos;
}

function drawFooterSections(
  page: PDFPage,
  data: PDFData,
  regularFont: PDFFont,
  boldFont: PDFFont,
  primary: RGB,
  darkColor: RGB,
  grayColor: RGB,
  lightGray: RGB,
  yStart: number
): number {
  let yPos = yStart;

  // Invoice: payment details
  if (data.type === "INVOICE" && data.bankingDetails && Object.keys(data.bankingDetails).some((k) => data.bankingDetails![k])) {
    yPos -= 28;
    page.drawText("PAYMENT DETAILS", { x: 40, y: yPos, size: 9, font: boldFont, color: primary });
    yPos -= 4;
    page.drawLine({ start: { x: 40, y: yPos }, end: { x: 200, y: yPos }, thickness: 0.5, color: lightGray });
    yPos -= 12;
    Object.entries(data.bankingDetails).forEach(([key, value]) => {
      if (value) {
        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
        page.drawText(`${label}: ${value}`, { x: 40, y: yPos, size: 9, font: regularFont, color: darkColor });
        yPos -= 13;
      }
    });

    if (data.dueDate) {
      yPos -= 4;
      page.drawText(`Payment is due by ${formatDate(data.dueDate)}.`, {
        x: 40, y: yPos, size: 9, font: regularFont, color: grayColor,
      });
    }
  }

  // Quote: validity callout + acceptance line
  if (data.type === "QUOTE") {
    yPos -= 28;
    page.drawRectangle({ x: 40, y: yPos - 6, width: 515, height: 28, color: rgb(0.93, 0.99, 0.97) });
    const validMsg = data.expiryDate
      ? `This quotation is valid until ${formatDate(data.expiryDate)}.`
      : "Please contact us to confirm pricing before placing an order.";
    page.drawText(validMsg, { x: 48, y: yPos + 6, size: 9, font: regularFont, color: rgb(0.05, 0.45, 0.39) });
    page.drawText("To accept, sign below or contact us to proceed.", {
      x: 48, y: yPos - 6, size: 8, font: regularFont, color: grayColor,
    });

    yPos -= 40;
    page.drawText("Acceptance", { x: 40, y: yPos, size: 9, font: boldFont, color: primary });
    yPos -= 18;
    page.drawLine({ start: { x: 40, y: yPos }, end: { x: 240, y: yPos }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    page.drawLine({ start: { x: 300, y: yPos }, end: { x: 460, y: yPos }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    yPos -= 12;
    page.drawText("Signature", { x: 40, y: yPos, size: 8, font: regularFont, color: grayColor });
    page.drawText("Date", { x: 300, y: yPos, size: 8, font: regularFont, color: grayColor });
  }

  // PO: authorization line
  if (data.type === "PURCHASE_ORDER") {
    yPos -= 28;
    page.drawText("Please supply the items listed above in accordance with the terms below.", {
      x: 40, y: yPos, size: 9, font: regularFont, color: grayColor,
    });

    yPos -= 30;
    page.drawText("Authorization", { x: 40, y: yPos, size: 9, font: boldFont, color: primary });
    yPos -= 18;
    page.drawLine({ start: { x: 40, y: yPos }, end: { x: 240, y: yPos }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    page.drawLine({ start: { x: 300, y: yPos }, end: { x: 460, y: yPos }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
    yPos -= 12;
    page.drawText("Authorized Signature", { x: 40, y: yPos, size: 8, font: regularFont, color: grayColor });
    page.drawText("Date", { x: 300, y: yPos, size: 8, font: regularFont, color: grayColor });
  }

  // Notes
  if (data.notes) {
    yPos -= 24;
    page.drawText("NOTES", { x: 40, y: yPos, size: 9, font: boldFont, color: primary });
    yPos -= 14;
    page.drawText(data.notes.slice(0, 200), { x: 40, y: yPos, size: 9, font: regularFont, color: grayColor });
  }

  // Terms
  if (data.terms) {
    yPos -= 22;
    page.drawText("TERMS & CONDITIONS", { x: 40, y: yPos, size: 9, font: boldFont, color: primary });
    yPos -= 14;
    page.drawText(data.terms.slice(0, 200), { x: 40, y: yPos, size: 9, font: regularFont, color: grayColor });
  }

  return yPos;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generatePDF(data: PDFData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logoImage = data.businessLogo ? await embedLogo(pdfDoc, data.businessLogo) : null;

  const primary   = themeColor(data.type);
  const darkColor = rgb(0.1, 0.1, 0.1);
  const grayColor = rgb(0.5, 0.5, 0.5);
  const lightGray = rgb(0.95, 0.95, 0.95);

  drawHeader(page, data, logoImage, regularFont, boldFont, primary, width, height);

  let yPos = drawParties(page, data, regularFont, boldFont, primary, darkColor, grayColor, height - 150);

  yPos = drawLineItems(page, data, regularFont, boldFont, primary, darkColor, lightGray, width, yPos);

  yPos = drawTotals(page, data, regularFont, boldFont, primary, darkColor, grayColor, yPos);

  drawFooterSections(page, data, regularFont, boldFont, primary, darkColor, grayColor, lightGray, yPos);

  // Watermark
  const watermarkText = `DocDime • ${data.docNumber} • ${formatDate(data.issueDate)}`;
  for (let i = 0; i < 5; i++) {
    page.drawText(watermarkText, {
      x: 80 + i * 20, y: 150 + i * 120, size: 14, font: regularFont,
      color: rgb(0.85, 0.85, 0.85), rotate: degrees(35), opacity: 0.25,
    });
  }

  // Footer line
  page.drawLine({ start: { x: 40, y: 40 }, end: { x: width - 40, y: 40 }, thickness: 0.5, color: lightGray });
  page.drawText("Generated by DocDime — docdime.com", {
    x: 40, y: 25, size: 8, font: regularFont, color: grayColor,
  });

  // QR verification code — bottom-right corner
  // y-coordinate note: the spec's initial suggestion of y=10 would overlap the footer
  // line at y=40. After checking footer coordinates (line at y=40, text at y=25),
  // qrY=56 is used instead: QR spans y=56–92, label at y=48 — all above the footer line.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && data.documentId) {
    try {
      const verifyUrl = `${appUrl}/verify/${data.documentId}`;
      const qrBuffer = await QRCode.toBuffer(verifyUrl, { width: 100, margin: 1 });
      const qrImage = await pdfDoc.embedPng(qrBuffer);
      const qrSize = 36; // 0.5 inch in points
      const qrX = width - 10 - qrSize; // 10pt margin from right
      const qrY = 56;                   // bottom of QR, above footer line at y=40
      page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
      page.drawText("Scan to verify", {
        x: qrX + 1,
        y: qrY - 8,
        size: 5,
        font: regularFont,
        color: grayColor,
      });
    } catch (err) {
      console.warn("[PDF] QR code generation skipped:", err);
      // PDF is still saved without QR — non-fatal
    }
  }

  return await pdfDoc.save();
}

import { PDFDocument, rgb, StandardFonts, degrees, PDFImage } from "pdf-lib";
import { formatCurrency, formatDate } from "./utils";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

interface PDFData {
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
      if (!header.includes("png") && !isJpeg) return null; // svg/webp not supported by pdf-lib
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

export async function generatePDF(data: PDFData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const logoImage = data.businessLogo ? await embedLogo(pdfDoc, data.businessLogo) : null;

  const primaryColor = rgb(0.15, 0.39, 0.92); // Blue
  const darkColor = rgb(0.1, 0.1, 0.1);
  const grayColor = rgb(0.5, 0.5, 0.5);
  const lightGray = rgb(0.95, 0.95, 0.95);

  // Header background
  page.drawRectangle({
    x: 0,
    y: height - 120,
    width,
    height: 120,
    color: primaryColor,
  });

  // Document type title
  const typeLabel =
    data.type === "INVOICE" ? "INVOICE" : data.type === "QUOTE" ? "QUOTE" : "PURCHASE ORDER";
  page.drawText(typeLabel, {
    x: 40,
    y: height - 50,
    size: 28,
    font: boldFont,
    color: rgb(1, 1, 1),
  });

  // Doc number
  page.drawText(data.docNumber, {
    x: 40,
    y: height - 80,
    size: 14,
    font: regularFont,
    color: rgb(0.8, 0.9, 1),
  });

  // Issue date
  page.drawText(`Date: ${formatDate(data.issueDate)}`, {
    x: 40,
    y: height - 100,
    size: 10,
    font: regularFont,
    color: rgb(0.8, 0.9, 1),
  });

  if (data.dueDate) {
    page.drawText(`Due: ${formatDate(data.dueDate)}`, {
      x: 200,
      y: height - 100,
      size: 10,
      font: regularFont,
      color: rgb(0.8, 0.9, 1),
    });
  }

  if (data.expiryDate) {
    page.drawText(`Valid Until: ${formatDate(data.expiryDate)}`, {
      x: 200,
      y: height - 100,
      size: 10,
      font: regularFont,
      color: rgb(0.8, 0.9, 1),
    });
  }

  // Right side of header: logo if available, else business text
  if (logoImage) {
    const maxW = 100;
    const maxH = 80;
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height);
    const logoW = logoImage.width * scale;
    const logoH = logoImage.height * scale;
    page.drawImage(logoImage, {
      x: width - 40 - logoW,
      y: height - 20 - logoH,
      width: logoW,
      height: logoH,
    });
  } else {
    const businessLines = [
      data.businessName,
      data.businessEmail ?? "",
      data.businessPhone ?? "",
    ].filter(Boolean);

    businessLines.forEach((line, i) => {
      const textWidth = boldFont.widthOfTextAtSize(line, 10);
      page.drawText(line, {
        x: width - 40 - textWidth,
        y: height - 45 - i * 16,
        size: 10,
        font: i === 0 ? boldFont : regularFont,
        color: rgb(1, 1, 1),
      });
    });
  }

  // FROM / TO sections
  let yPos = height - 155;

  page.drawText("FROM", {
    x: 40,
    y: yPos,
    size: 9,
    font: boldFont,
    color: primaryColor,
  });
  page.drawText("TO", {
    x: 300,
    y: yPos,
    size: 9,
    font: boldFont,
    color: primaryColor,
  });

  yPos -= 16;
  page.drawText(data.businessName, {
    x: 40,
    y: yPos,
    size: 11,
    font: boldFont,
    color: darkColor,
  });

  if (data.customerName) {
    page.drawText(data.customerName, {
      x: 300,
      y: yPos,
      size: 11,
      font: boldFont,
      color: darkColor,
    });
  }

  yPos -= 14;
  if (data.businessAddress) {
    page.drawText(data.businessAddress, {
      x: 40,
      y: yPos,
      size: 9,
      font: regularFont,
      color: grayColor,
    });
  }
  if (data.customerAddress) {
    page.drawText(data.customerAddress, {
      x: 300,
      y: yPos,
      size: 9,
      font: regularFont,
      color: grayColor,
    });
  }

  yPos -= 14;
  if (data.businessEmail) {
    page.drawText(data.businessEmail, {
      x: 40,
      y: yPos,
      size: 9,
      font: regularFont,
      color: grayColor,
    });
  }
  if (data.customerEmail) {
    page.drawText(data.customerEmail, {
      x: 300,
      y: yPos,
      size: 9,
      font: regularFont,
      color: grayColor,
    });
  }

  // Line items table
  yPos -= 40;

  // Table header
  page.drawRectangle({
    x: 40,
    y: yPos - 4,
    width: width - 80,
    height: 20,
    color: primaryColor,
  });

  page.drawText("DESCRIPTION", { x: 50, y: yPos + 3, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText("QTY", { x: 320, y: yPos + 3, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText("UNIT PRICE", { x: 370, y: yPos + 3, size: 8, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText("TOTAL", { x: 490, y: yPos + 3, size: 8, font: boldFont, color: rgb(1, 1, 1) });

  yPos -= 20;

  // Line items
  data.lineItems.forEach((item, i) => {
    if (i % 2 === 0) {
      page.drawRectangle({
        x: 40,
        y: yPos - 4,
        width: width - 80,
        height: 18,
        color: lightGray,
      });
    }

    page.drawText(item.description.slice(0, 45), {
      x: 50,
      y: yPos + 2,
      size: 9,
      font: regularFont,
      color: darkColor,
    });
    page.drawText(String(item.quantity), {
      x: 320,
      y: yPos + 2,
      size: 9,
      font: regularFont,
      color: darkColor,
    });
    page.drawText(formatCurrency(item.unitPrice, data.currency), {
      x: 365,
      y: yPos + 2,
      size: 9,
      font: regularFont,
      color: darkColor,
    });
    page.drawText(formatCurrency(item.total, data.currency), {
      x: 485,
      y: yPos + 2,
      size: 9,
      font: regularFont,
      color: darkColor,
    });

    yPos -= 18;
  });

  // Totals section
  yPos -= 20;
  const totalsX = 380;

  page.drawText("Subtotal:", { x: totalsX, y: yPos, size: 9, font: regularFont, color: grayColor });
  page.drawText(formatCurrency(data.subtotal, data.currency), {
    x: 490,
    y: yPos,
    size: 9,
    font: regularFont,
    color: darkColor,
  });

  yPos -= 16;
  page.drawText("Tax:", { x: totalsX, y: yPos, size: 9, font: regularFont, color: grayColor });
  page.drawText(formatCurrency(data.taxAmount, data.currency), {
    x: 490,
    y: yPos,
    size: 9,
    font: regularFont,
    color: darkColor,
  });

  yPos -= 4;
  page.drawLine({
    start: { x: totalsX, y: yPos },
    end: { x: width - 40, y: yPos },
    thickness: 1,
    color: primaryColor,
  });

  yPos -= 18;
  page.drawText("TOTAL", { x: totalsX, y: yPos, size: 12, font: boldFont, color: primaryColor });
  page.drawText(formatCurrency(data.total, data.currency), {
    x: 480,
    y: yPos,
    size: 12,
    font: boldFont,
    color: primaryColor,
  });

  // Banking details
  if (data.bankingDetails && Object.keys(data.bankingDetails).length > 0) {
    yPos -= 40;
    page.drawText("PAYMENT DETAILS", {
      x: 40,
      y: yPos,
      size: 9,
      font: boldFont,
      color: primaryColor,
    });

    yPos -= 14;
    Object.entries(data.bankingDetails).forEach(([key, value]) => {
      if (value) {
        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
        page.drawText(`${label}: ${value}`, {
          x: 40,
          y: yPos,
          size: 9,
          font: regularFont,
          color: darkColor,
        });
        yPos -= 13;
      }
    });
  }

  // Notes
  if (data.notes) {
    yPos -= 20;
    page.drawText("NOTES", { x: 40, y: yPos, size: 9, font: boldFont, color: primaryColor });
    yPos -= 14;
    page.drawText(data.notes.slice(0, 200), {
      x: 40,
      y: yPos,
      size: 9,
      font: regularFont,
      color: grayColor,
    });
  }

  // Terms
  if (data.terms) {
    yPos -= 20;
    page.drawText("TERMS & CONDITIONS", { x: 40, y: yPos, size: 9, font: boldFont, color: primaryColor });
    yPos -= 14;
    page.drawText(data.terms.slice(0, 200), {
      x: 40,
      y: yPos,
      size: 9,
      font: regularFont,
      color: grayColor,
    });
  }

  // Watermark
  const watermarkText = `DocDime • ${data.docNumber} • ${formatDate(data.issueDate)}`;
  for (let i = 0; i < 5; i++) {
    page.drawText(watermarkText, {
      x: 80 + i * 20,
      y: 150 + i * 120,
      size: 14,
      font: regularFont,
      color: rgb(0.85, 0.85, 0.85),
      rotate: degrees(35),
      opacity: 0.25,
    });
  }

  // Footer
  page.drawLine({
    start: { x: 40, y: 40 },
    end: { x: width - 40, y: 40 },
    thickness: 0.5,
    color: lightGray,
  });

  page.drawText("Generated by DocDime — docdime.com", {
    x: 40,
    y: 25,
    size: 8,
    font: regularFont,
    color: grayColor,
  });

  return await pdfDoc.save();
}

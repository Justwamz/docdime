import { prisma } from "./prisma";

interface Pricing {
  docPriceUsd: number;       // e.g. 0.10
  proMonthlyUsd: number;     // e.g. 2  (display-only monthly equivalent)
  proAnnualUsd: number;      // e.g. 20 (actual annual charge)
  proMonthlyDocs: number;    // e.g. 20
  annualDiscountPct: number; // e.g. 17 (% saved vs paying monthly × 12)
}

export async function getPricing(): Promise<Pricing> {
  const rows = await prisma.appSettings.findMany({
    where: {
      key: { in: ["doc_price_usd", "pro_price_usd", "pro_annual_price_usd", "pro_monthly_docs"] },
    },
  });

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const docPriceUsd = parseFloat(map.doc_price_usd ?? "0.10");
  const proMonthlyUsd = parseFloat(map.pro_price_usd ?? "2");
  const proAnnualUsd = parseFloat(map.pro_annual_price_usd ?? "20");
  const proMonthlyDocs = parseInt(map.pro_monthly_docs ?? "20", 10);
  const annualDiscountPct = Math.max(
    0,
    Math.round((1 - proAnnualUsd / (proMonthlyUsd * 12)) * 100)
  );

  return { docPriceUsd, proMonthlyUsd, proAnnualUsd, proMonthlyDocs, annualDiscountPct };
}

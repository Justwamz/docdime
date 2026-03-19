import { PrismaClient, Prisma } from "@prisma/client";
import type { AppliedTax, AppliedTaxSnapshot } from "../../types";

const prisma = new PrismaClient();

async function main() {
  // Fetch all LineItem records where appliedTaxes IS NOT NULL
  // Fetch all line items and filter in JS — Prisma nullable JSON filtering varies by provider
  const allLineItems = await prisma.lineItem.findMany({
    select: { id: true, appliedTaxes: true },
  });
  const lineItems = allLineItems.filter((item) => item.appliedTaxes !== null);

  console.log(`Found ${lineItems.length} line items with non-null appliedTaxes`);

  let migrated = 0;
  let skipped = 0;

  for (const item of lineItems) {
    const raw = item.appliedTaxes;

    // Skip if already in new format (has 'type' field)
    if (raw && typeof raw === "object" && !Array.isArray(raw) && "type" in raw) {
      skipped++;
      continue;
    }

    // Convert old format (array) to new format
    if (!Array.isArray(raw)) {
      skipped++;
      continue;
    }

    const items = raw as unknown as AppliedTax[];
    let snapshot: AppliedTaxSnapshot;

    if (items.length === 0) {
      // Set to null
      await prisma.lineItem.update({
        where: { id: item.id },
        data: { appliedTaxes: Prisma.DbNull },
      });
      migrated++;
      continue;
    }

    if (items.length === 1) {
      snapshot = {
        type: "tax",
        taxId: items[0].taxId,
        name: items[0].name,
        rate: items[0].rate,
        isInclusive: items[0].isInclusive,
        amount: items[0].amount,
      };
    } else {
      snapshot = {
        type: "group",
        groupId: "__legacy__",
        groupName: "Legacy Taxes",
        items,
      };
    }

    await prisma.lineItem.update({
      where: { id: item.id },
      data: { appliedTaxes: snapshot as object },
    });
    migrated++;
  }

  console.log(`Migrated: ${migrated}, Skipped (already new format): ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

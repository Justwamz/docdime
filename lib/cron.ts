import cron from "node-cron";
import { prisma } from "./prisma";
import { sendOverdueEmail } from "./email";
import { formatCurrency } from "./utils";

let initialized = false;

export function startCronJobs() {
  if (initialized) return;
  initialized = true;

  console.log("[Cron] Starting scheduled jobs...");

  // Daily at 8am: Check overdue invoices and send emails
  cron.schedule("0 8 * * *", async () => {
    console.log("[Cron] Checking overdue invoices...");
    try {
      const overdueInvoices = await prisma.document.findMany({
        where: {
          type: "INVOICE",
          status: { in: ["DRAFT", "SENT"] },
          dueDate: { lt: new Date() },
          paid: false,
        },
        include: {
          user: true,
          customer: true,
        },
      });

      for (const invoice of overdueInvoices) {
        if (invoice.customer?.email) {
          await sendOverdueEmail({
            to: invoice.customer.email,
            businessName: invoice.user.businessName ?? invoice.user.name ?? "Business",
            customerName: invoice.customer.name,
            docNumber: invoice.docNumber,
            amount: formatCurrency(invoice.total, invoice.currency),
          });
        }
      }

      console.log(`[Cron] Processed ${overdueInvoices.length} overdue invoices`);
    } catch (error) {
      console.error("[Cron] Overdue check error:", error);
    }
  });

  // Daily at 9am: Check quote expiry (7-day warning)
  cron.schedule("0 9 * * *", async () => {
    console.log("[Cron] Checking quote expiry...");
    try {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const expiringQuotes = await prisma.document.findMany({
        where: {
          type: "QUOTE",
          status: { in: ["DRAFT", "SENT"] },
          expiryDate: {
            gte: new Date(),
            lte: sevenDaysFromNow,
          },
        },
        include: { user: true, customer: true },
      });

      console.log(`[Cron] Found ${expiringQuotes.length} expiring quotes`);
    } catch (error) {
      console.error("[Cron] Quote expiry check error:", error);
    }
  });

  // Monthly: Reset doc count for PRO users
  cron.schedule("0 0 1 * *", async () => {
    console.log("[Cron] Resetting monthly doc counts...");
    try {
      await prisma.user.updateMany({
        where: { plan: "PRO" },
        data: {
          docsThisMonth: 0,
          lastDocReset: new Date(),
        },
      });
      console.log("[Cron] Monthly reset complete");
    } catch (error) {
      console.error("[Cron] Monthly reset error:", error);
    }
  });

  // Daily at 10am: Downgrade expired PRO subscriptions to PAY_PER_USE
  cron.schedule("0 10 * * *", async () => {
    console.log("[Cron] Checking subscription expiry...");
    try {
      const now = new Date();

      const result = await prisma.user.updateMany({
        where: {
          plan: "PRO",
          proExpiresAt: { lt: now },
        },
        data: {
          plan: "PAY_PER_USE",
          docsThisMonth: 0,
        },
      });

      if (result.count > 0) {
        console.log(`[Cron] Downgraded ${result.count} expired PRO subscriptions to PAY_PER_USE`);
      }
    } catch (error) {
      console.error("[Cron] Subscription expiry check error:", error);
    }
  });

  console.log("[Cron] All jobs scheduled");
}

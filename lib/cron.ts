import cron from "node-cron";
import { prisma } from "./prisma";
import {
  triggerInvoiceOverdueEmail,
  triggerQuoteExpiringEmail,
  triggerProExpiredEmail,
  triggerNudgeEmail,
} from "./email-triggers";
import { sendPushToUser } from "./push";

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
        include: { user: true, customer: true },
      });

      for (const invoice of overdueInvoices) {
        if (invoice.customer?.email) {
          await triggerInvoiceOverdueEmail(
            { docNumber: invoice.docNumber, total: invoice.total, currency: invoice.currency },
            { businessName: invoice.user.businessName, name: invoice.user.name },
            { email: invoice.customer.email, name: invoice.customer.name }
          );
        }
        sendPushToUser(invoice.userId, {
          title: "Invoice Overdue",
          body: `${invoice.docNumber} is past due. Follow up with your client.`,
          url: `/dashboard/documents/${invoice.id}`,
          tag: `overdue-${invoice.id}`,
        }).catch(() => {});
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
          expiryDate: { gte: new Date(), lte: sevenDaysFromNow },
        },
        include: { user: true, customer: true },
      });

      for (const quote of expiringQuotes) {
        await triggerQuoteExpiringEmail(
          { docNumber: quote.docNumber, total: quote.total, currency: quote.currency, expiryDate: quote.expiryDate },
          { businessName: quote.user.businessName, name: quote.user.name },
          { email: quote.customer?.email ?? null, name: quote.customer?.name ?? "Customer" }
        );
        sendPushToUser(quote.userId, {
          title: "Quote Expiring Soon",
          body: `${quote.docNumber} expires in 7 days.`,
          url: `/dashboard/documents/${quote.id}`,
          tag: `expiring-${quote.id}`,
        }).catch(() => {});
      }

      console.log(`[Cron] Processed ${expiringQuotes.length} expiring quotes`);
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
        data: { docsThisMonth: 0, lastDocReset: new Date() },
      });
      console.log("[Cron] Monthly reset complete");
    } catch (error) {
      console.error("[Cron] Monthly reset error:", error);
    }
  });

  // Daily at 10am: Downgrade expired PRO subscriptions + notify users
  cron.schedule("0 10 * * *", async () => {
    console.log("[Cron] Checking subscription expiry...");
    try {
      const now = new Date();

      // Fetch first so we have user details for the email
      const expiredUsers = await prisma.user.findMany({
        where: { plan: "PRO", proExpiresAt: { lt: now } },
      });

      if (expiredUsers.length > 0) {
        await prisma.user.updateMany({
          where: { plan: "PRO", proExpiresAt: { lt: now } },
          data: { plan: "PAY_PER_USE", docsThisMonth: 0 },
        });

        for (const user of expiredUsers) {
          await triggerProExpiredEmail({ email: user.email, name: user.name });
          sendPushToUser(user.id, {
            title: "DocDime Pro Expired",
            body: "Your Pro subscription has ended. Renew to keep your monthly free docs.",
            url: "/dashboard/subscription",
            tag: "pro-expired",
          }).catch(() => {});
        }

        console.log(`[Cron] Downgraded ${expiredUsers.length} expired PRO subscriptions`);
      }
    } catch (error) {
      console.error("[Cron] Subscription expiry check error:", error);
    }
  });

  // Daily at 11am: Nudge users who signed up N days ago with no documents
  cron.schedule("0 11 * * *", async () => {
    console.log("[Cron] Checking nudge emails...");
    try {
      const now = new Date();

      for (const days of [3, 7, 14, 21, 30] as const) {
        // startOfDay helpers (no external dependency)
        const start = new Date(now);
        start.setDate(start.getDate() - days);
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        const users = await prisma.user.findMany({
          where: {
            isAdmin: false,
            createdAt: { gte: start, lt: end },
            documents: { none: {} },
          },
        });

        for (const user of users) {
          await triggerNudgeEmail({ email: user.email, name: user.name }, days);
        }

        if (users.length > 0) {
          console.log(`[Cron] Sent ${days}-day nudge to ${users.length} users`);
        }
      }
    } catch (error) {
      console.error("[Cron] Nudge check error:", error);
    }
  });

  console.log("[Cron] All jobs scheduled");
}

import { prisma } from "./prisma";
import { sendTemplateEmail } from "./email";
import { formatCurrency, formatDate } from "./utils";

async function getAdminNotificationEmail(): Promise<string | null> {
  const setting = await prisma.appSettings.findUnique({
    where: { key: "admin_notification_email" },
  });
  return setting?.value ?? null;
}

export async function triggerWelcomeEmail(user: {
  email: string;
  name: string | null;
}) {
  await sendTemplateEmail("welcome", user.email, {
    name: user.name ?? user.email,
    email: user.email,
  });
}

export async function triggerNudgeEmail(
  user: { email: string; name: string | null },
  days: 3 | 7 | 14 | 21 | 30
) {
  await sendTemplateEmail(`nudge_${days}day`, user.email, {
    name: user.name ?? user.email,
  });
}

export async function triggerProUpgradedEmail(user: {
  email: string;
  name: string | null;
  proExpiresAt: Date | null;
}) {
  await sendTemplateEmail("pro_upgraded", user.email, {
    name: user.name ?? user.email,
    expiresAt: user.proExpiresAt ? formatDate(user.proExpiresAt) : "—",
  });
}

export async function triggerProExpiredEmail(user: {
  email: string;
  name: string | null;
}) {
  await sendTemplateEmail("pro_expired", user.email, {
    name: user.name ?? user.email,
  });
}

export async function triggerPaymentReceivedEmail(
  user: { email: string; name: string | null },
  docNumber: string,
  total: number,
  currency: string
) {
  await sendTemplateEmail("payment_received", user.email, {
    name: user.name ?? user.email,
    docNumber,
    amount: formatCurrency(total, currency),
  });
}

export async function triggerPaymentNotifyEmail(
  user: { email: string; name: string | null },
  docNumber: string,
  total: number,
  currency: string
) {
  const adminEmail = await getAdminNotificationEmail();
  if (!adminEmail) return;
  await sendTemplateEmail("payment_received_notify", adminEmail, {
    userName: user.name ?? user.email,
    userEmail: user.email,
    docNumber,
    amount: formatCurrency(total, currency),
  });
}

export async function triggerCustomerCreatedEmail(
  userId: string,
  customer: { name: string; email?: string | null }
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const adminEmail = await getAdminNotificationEmail();
  if (!adminEmail) return;
  await sendTemplateEmail("customer_created", adminEmail, {
    customerName: customer.name,
    customerEmail: customer.email ?? "—",
    businessName: user.businessName ?? user.name ?? "—",
    userName: user.name ?? user.email,
  });
}

export async function triggerInvoiceSentEmail(
  doc: {
    docNumber: string;
    total: number;
    currency: string;
    dueDate: Date | null;
    pdfUrl: string | null;
  },
  user: { businessName: string | null; name: string | null },
  customer: { email: string | null; name: string }
) {
  if (!customer.email) return;
  await sendTemplateEmail("invoice_sent", customer.email, {
    docNumber: doc.docNumber,
    businessName: user.businessName ?? user.name ?? "—",
    customerName: customer.name,
    amount: formatCurrency(doc.total, doc.currency),
    dueDate: doc.dueDate ? formatDate(doc.dueDate) : "—",
    pdfUrl: doc.pdfUrl ?? "",
  });
}

export async function triggerQuoteSentEmail(
  doc: {
    docNumber: string;
    total: number;
    currency: string;
    expiryDate: Date | null;
    pdfUrl: string | null;
  },
  user: { businessName: string | null; name: string | null },
  customer: { email: string | null; name: string }
) {
  if (!customer.email) return;
  await sendTemplateEmail("quote_sent", customer.email, {
    docNumber: doc.docNumber,
    businessName: user.businessName ?? user.name ?? "—",
    customerName: customer.name,
    amount: formatCurrency(doc.total, doc.currency),
    expiryDate: doc.expiryDate ? formatDate(doc.expiryDate) : "—",
    pdfUrl: doc.pdfUrl ?? "",
  });
}

export async function triggerInvoiceOverdueEmail(
  doc: { docNumber: string; total: number; currency: string },
  user: { businessName: string | null; name: string | null },
  customer: { email: string; name: string }
) {
  await sendTemplateEmail("invoice_overdue", customer.email, {
    docNumber: doc.docNumber,
    businessName: user.businessName ?? user.name ?? "—",
    customerName: customer.name,
    amount: formatCurrency(doc.total, doc.currency),
  });
}

export async function triggerStaffWelcomeEmail(user: {
  email: string;
  name: string | null;
  password: string;
}) {
  const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/login`;
  await sendTemplateEmail("staff_welcome", user.email, {
    name: user.name ?? user.email,
    email: user.email,
    password: user.password,
    loginUrl,
  });
}

export async function triggerQuoteExpiringEmail(
  doc: {
    docNumber: string;
    total: number;
    currency: string;
    expiryDate: Date | null;
  },
  user: { businessName: string | null; name: string | null },
  customer: { email: string | null; name: string }
) {
  if (!customer.email) return;
  await sendTemplateEmail("quote_expiring", customer.email, {
    docNumber: doc.docNumber,
    businessName: user.businessName ?? user.name ?? "—",
    customerName: customer.name,
    amount: formatCurrency(doc.total, doc.currency),
    expiryDate: doc.expiryDate ? formatDate(doc.expiryDate) : "—",
  });
}

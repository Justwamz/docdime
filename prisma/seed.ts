import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Seed admin user
  const existing = await prisma.user.findUnique({
    where: { email: "admin@docdime.com" },
  });

  if (!existing) {
    const hashed = await bcrypt.hash("Admin@123456", 12);
    await prisma.user.create({
      data: {
        email: "admin@docdime.com",
        name: "Admin",
        password: hashed,
        isAdmin: true,
        plan: "PRO",
      },
    });
    console.log("✅ Admin user created");
  } else {
    console.log("ℹ️  Admin user already exists");
  }

  // Seed email templates
  // Update existing templates to add pdfUrl variable where applicable
  await prisma.emailTemplate.upsert({
    where: { name: "invoice_sent" },
    update: { variables: ["docNumber", "businessName", "customerName", "amount", "dueDate", "pdfUrl"] },
    create: {
      name: "invoice_sent",
      subject: "Invoice {{docNumber}} from {{businessName}}",
      body: "<p>Dear {{customerName}},</p><p>Please find your Invoice <strong>{{docNumber}}</strong> for <strong>{{amount}}</strong>.</p><p><strong>Due Date:</strong> {{dueDate}}</p>{{pdfUrl}}<p>Thank you for your business.</p><p>{{businessName}}</p>",
      variables: ["docNumber", "businessName", "customerName", "amount", "dueDate", "pdfUrl"],
    },
  });

  await prisma.emailTemplate.upsert({
    where: { name: "invoice_overdue" },
    update: {},
    create: {
      name: "invoice_overdue",
      subject: "Overdue Invoice {{docNumber}} - Action Required",
      body: "<p>Dear {{customerName}},</p><p>Invoice <strong>{{docNumber}}</strong> for <strong>{{amount}}</strong> is now <strong>overdue</strong>.</p><p>Please make payment at your earliest convenience.</p><p>{{businessName}}</p>",
      variables: ["docNumber", "businessName", "customerName", "amount"],
    },
  });

  await prisma.emailTemplate.upsert({
    where: { name: "quote_sent" },
    update: { variables: ["docNumber", "businessName", "customerName", "amount", "expiryDate", "pdfUrl"] },
    create: {
      name: "quote_sent",
      subject: "Quote {{docNumber}} from {{businessName}}",
      body: "<p>Dear {{customerName}},</p><p>Please find your Quote <strong>{{docNumber}}</strong> for <strong>{{amount}}</strong>.</p><p><strong>Valid until:</strong> {{expiryDate}}</p>{{pdfUrl}}<p>{{businessName}}</p>",
      variables: ["docNumber", "businessName", "customerName", "amount", "expiryDate", "pdfUrl"],
    },
  });

  await prisma.emailTemplate.upsert({
    where: { name: "quote_expiring" },
    update: {},
    create: {
      name: "quote_expiring",
      subject: "Quote {{docNumber}} Expiring Soon",
      body: "<p>Dear {{customerName}},</p><p>Your quote <strong>{{docNumber}}</strong> for <strong>{{amount}}</strong> expires on <strong>{{expiryDate}}</strong>.</p><p>Please respond before the expiry date.</p><p>{{businessName}}</p>",
      variables: ["docNumber", "businessName", "customerName", "amount", "expiryDate"],
    },
  });

  // New templates
  const newTemplates = [
    {
      name: "welcome",
      subject: "Welcome to DocDime, {{name}}!",
      body: "<p>Hi {{name}},</p><p>Welcome to DocDime! You can now create professional invoices, quotes, and purchase orders in seconds.</p><p>Get started by creating your first document.</p><p>The DocDime Team</p>",
      variables: ["name", "email"],
    },
    {
      name: "nudge_3day",
      subject: "Your first document is waiting, {{name}}",
      body: "<p>Hi {{name}},</p><p>You signed up 3 days ago but haven't created a document yet.</p><p>It only takes a minute to create your first invoice or quote. Give it a try!</p><p>The DocDime Team</p>",
      variables: ["name"],
    },
    {
      name: "nudge_7day",
      subject: "Still here for you, {{name}}",
      body: "<p>Hi {{name}},</p><p>A week has passed and we'd love to see you create your first document on DocDime.</p><p>The DocDime Team</p>",
      variables: ["name"],
    },
    {
      name: "nudge_14day",
      subject: "DocDime tip: Create your first document",
      body: "<p>Hi {{name}},</p><p>You've had DocDime for 2 weeks. Creating a professional invoice takes less than 2 minutes.</p><p>The DocDime Team</p>",
      variables: ["name"],
    },
    {
      name: "nudge_21day",
      subject: "We miss you, {{name}}",
      body: "<p>Hi {{name}},</p><p>It's been 21 days — we're still here whenever you're ready to send your first invoice or quote.</p><p>The DocDime Team</p>",
      variables: ["name"],
    },
    {
      name: "nudge_30day",
      subject: "Last check-in from DocDime",
      body: "<p>Hi {{name}},</p><p>It's been 30 days since you signed up. We just wanted to check in — DocDime is ready whenever you are.</p><p>The DocDime Team</p>",
      variables: ["name"],
    },
    {
      name: "pro_upgraded",
      subject: "You're now on DocDime Pro!",
      body: "<p>Hi {{name}},</p><p>Your Pro subscription is now active. You get 20 free documents per month until <strong>{{expiresAt}}</strong>.</p><p>The DocDime Team</p>",
      variables: ["name", "expiresAt"],
    },
    {
      name: "pro_expired",
      subject: "Your DocDime Pro subscription has expired",
      body: "<p>Hi {{name}},</p><p>Your Pro subscription has expired and your account has been moved to Pay Per Use ($0.10/document).</p><p>You can renew at any time from your subscription page.</p><p>The DocDime Team</p>",
      variables: ["name"],
    },
    {
      name: "payment_received",
      subject: "Payment confirmed — {{docNumber}}",
      body: "<p>Hi {{name}},</p><p>We've received your payment of <strong>{{amount}}</strong> for document <strong>{{docNumber}}</strong>.</p><p>Your PDF is ready to download from your dashboard.</p><p>The DocDime Team</p>",
      variables: ["name", "docNumber", "amount"],
    },
    {
      name: "payment_received_notify",
      subject: "New payment received — {{docNumber}}",
      body: "<p>A payment has been received on DocDime.</p><ul><li><strong>User:</strong> {{userName}} ({{userEmail}})</li><li><strong>Document:</strong> {{docNumber}}</li><li><strong>Amount:</strong> {{amount}}</li></ul>",
      variables: ["userName", "userEmail", "docNumber", "amount"],
    },
    {
      name: "customer_created",
      subject: "New customer added — {{customerName}}",
      body: "<p>A new customer has been added on DocDime.</p><ul><li><strong>Customer:</strong> {{customerName}}</li><li><strong>Email:</strong> {{customerEmail}}</li><li><strong>Added by:</strong> {{userName}} ({{businessName}})</li></ul>",
      variables: ["customerName", "customerEmail", "businessName", "userName"],
    },
    {
      name: "staff_welcome",
      subject: "You've been added to the DocDime admin panel",
      body: "<p>Hi {{name}},</p><p>An admin account has been created for you on DocDime. Here are your login credentials:</p><ul><li><strong>Email:</strong> {{email}}</li><li><strong>Password:</strong> {{password}}</li></ul><p>Log in at: <a href=\"{{loginUrl}}\">{{loginUrl}}</a></p><p>Please change your password after your first login.</p><p>The DocDime Team</p>",
      variables: ["name", "email", "password", "loginUrl"],
    },
  ];

  for (const template of newTemplates) {
    await prisma.emailTemplate.upsert({
      where: { name: template.name },
      update: {},
      create: template,
    });
  }

  console.log("✅ Email templates seeded");

  // Seed default app settings
  const settings = [
    { key: "doc_price_usd", value: "0.10" },
    { key: "pro_price_usd", value: "2" },
    { key: "pro_annual_price_usd", value: "20" },
    { key: "pro_monthly_docs", value: "20" },
    { key: "maintenance_mode", value: "false" },
    { key: "admin_notification_email", value: "waweru@kappanetics.com" },
    { key: "resend_api_key", value: "" },
    { key: "resend_from_email", value: "DocDime <noreply@docdime.com>" },
    { key: "paystack_secret_key", value: "" },
    { key: "paystack_public_key", value: "" },
  ];

  for (const setting of settings) {
    await prisma.appSettings.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log("✅ App settings seeded");
  console.log("\n🎉 Seed complete!");
  console.log("⚠️  Change the admin password after first login at /admin/login");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

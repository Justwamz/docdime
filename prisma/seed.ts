import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("Admin@123456", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@docdime.com" },
    update: {},
    create: {
      email: "admin@docdime.com",
      password: hashedPassword,
      name: "DocDime Admin",
      isAdmin: true,
      onboardingDone: true,
      consentGiven: true,
      plan: "PAY_PER_USE",
    },
  });

  console.log("✅ Admin user created/updated:", admin.email);

  // Seed default email templates
  const templates = [
    {
      name: "invoice_sent",
      subject: "Invoice {{docNumber}} from {{businessName}}",
      body: "Dear {{customerName}},\n\nPlease find attached Invoice {{docNumber}} for {{amount}}.\n\nDue Date: {{dueDate}}\n\nThank you for your business.\n\nBest regards,\n{{businessName}}",
      variables: ["docNumber", "businessName", "customerName", "amount", "dueDate"],
    },
    {
      name: "invoice_overdue",
      subject: "Overdue Invoice {{docNumber}} - Action Required",
      body: "Dear {{customerName}},\n\nThis is a reminder that Invoice {{docNumber}} for {{amount}} is now overdue.\n\nPlease make payment at your earliest convenience.\n\nBest regards,\n{{businessName}}",
      variables: ["docNumber", "businessName", "customerName", "amount"],
    },
    {
      name: "quote_sent",
      subject: "Quote {{docNumber}} from {{businessName}}",
      body: "Dear {{customerName}},\n\nPlease find attached Quote {{docNumber}} for {{amount}}.\n\nThis quote is valid until {{expiryDate}}.\n\nBest regards,\n{{businessName}}",
      variables: ["docNumber", "businessName", "customerName", "amount", "expiryDate"],
    },
    {
      name: "quote_expiring",
      subject: "Quote {{docNumber}} Expiring Soon",
      body: "Dear {{customerName}},\n\nYour quote {{docNumber}} for {{amount}} expires on {{expiryDate}}.\n\nPlease respond before the expiry date.\n\nBest regards,\n{{businessName}}",
      variables: ["docNumber", "businessName", "customerName", "amount", "expiryDate"],
    },
  ];

  for (const template of templates) {
    await prisma.emailTemplate.upsert({
      where: { name: template.name },
      update: {},
      create: template,
    });
  }

  console.log("✅ Email templates seeded");

  // Seed default app settings
  const settings = [
    { key: "doc_price_usd", value: "0.11" },
    { key: "pro_price_usd", value: "1" },
    { key: "pro_annual_price_usd", value: "12" },
    { key: "pro_monthly_docs", value: "20" },
    { key: "maintenance_mode", value: "false" },
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
  console.log("Admin login: admin@docdime.com / Admin@123456");
  console.log("⚠️  Please change the admin password after first login!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { Resend } from "resend";
import { prisma } from "./prisma";

async function getResendConfig(): Promise<{ apiKey: string; from: string } | null> {
  const rows = await prisma.appSettings.findMany({
    where: { key: { in: ["resend_api_key", "resend_from_email"] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const apiKey = map.resend_api_key || process.env.RESEND_API_KEY || "";
  const from = map.resend_from_email || "DocDime <noreply@docdime.com>";
  return apiKey ? { apiKey, from } : null;
}

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  const config = await getResendConfig();
  if (!config) {
    console.log("[Email stub] Would send:", { to, subject });
    return;
  }
  const resend = new Resend(config.apiKey);
  await resend.emails.send({ from: config.from, to, subject, html });
}

function renderTemplate(
  template: { subject: string; body: string },
  vars: Record<string, string>
) {
  let subject = template.subject;
  let body = template.body;
  for (const [key, value] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    subject = subject.replace(re, value);
    body = body.replace(re, value);
  }
  return { subject, body };
}

export async function sendTemplateEmail(
  templateName: string,
  to: string | string[],
  vars: Record<string, string>
): Promise<void> {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { name: templateName },
    });
    if (!template || !template.isActive) return;
    const { subject, body } = renderTemplate(template, vars);
    await sendEmail({ to, subject, html: body });
  } catch (err) {
    console.warn(`[Email] Failed to send template "${templateName}":`, err);
  }
}

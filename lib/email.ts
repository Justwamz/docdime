import { Resend } from "resend";
import { prisma } from "./prisma";
import { formatCurrency } from "./utils";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.log("[Email stub] Would send:", { to, subject });
    return;
  }
  await resend.emails.send({
    from: "DocDime <noreply@docdime.com>",
    to,
    subject,
    html,
  });
}

function renderTemplate(template: { subject: string; body: string }, vars: Record<string, string>) {
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

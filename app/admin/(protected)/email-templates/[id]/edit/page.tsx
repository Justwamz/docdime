import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import EditTemplateClient from "./edit-client";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const template = await prisma.emailTemplate.findUnique({ where: { id: params.id } });
  if (!template) notFound();
  return <EditTemplateClient template={template} />;
}

import { prisma } from "@/lib/prisma";
import SettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await prisma.appSettings.findMany({
    orderBy: { key: "asc" },
    select: { key: true, value: true },
  });

  return <SettingsClient initial={settings} />;
}

import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await prisma.appSettings.findMany({
    orderBy: { key: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">App Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {settings.map((s) => (
              <div key={s.key} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-mono text-sm text-gray-700">{s.key}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
                    {s.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Settings are managed via the API. Contact the developer to update values.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

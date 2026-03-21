import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import { DashboardSidebarWrapper } from "@/components/layout/dashboard-sidebar";
import { InstallPrompt } from "@/components/pwa/install-prompt";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (!session.user.onboardingDone) {
    redirect("/onboarding");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <DashboardSidebarWrapper />
      <main className="flex-1 overflow-y-auto min-w-0 pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
      <InstallPrompt />
    </div>
  );
}

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth-options";
import Link from "next/link";

const adminNav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/transactions", label: "Transactions" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/email-templates", label: "Email Templates" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.isAdmin) {
    redirect("/admin/login");
  }

  return (
    <div className="flex h-screen bg-gray-900">
      <aside className="w-56 bg-gray-800 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">D</span>
            </div>
            <span className="font-bold text-white text-sm">Admin Panel</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-700">
          <p className="text-xs text-gray-500 px-3 mb-2">{session.user.email}</p>
          <Link
            href="/"
            className="block px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Back to Site
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

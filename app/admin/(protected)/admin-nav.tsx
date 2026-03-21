"use client";

import { useState } from "react";
import Link from "next/link";

const adminNav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/transactions", label: "Transactions" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/email-templates", label: "Email Templates" },
  { href: "/admin/team", label: "Team" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminNav({ email }: { email: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 bg-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">D</span>
          </div>
          <span className="font-bold text-white text-sm">Admin Panel</span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="text-gray-300 hover:text-white p-1"
          aria-label="Toggle menu"
        >
          {open ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-20 bg-black/50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar — fixed on desktop, slide-in drawer on mobile */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 w-56 bg-gray-800 flex flex-col transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">D</span>
            </div>
            <span className="font-bold text-white text-sm">Admin Panel</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-700">
          <p className="text-xs text-gray-500 px-3 mb-2 truncate">{email}</p>
          <Link
            href="/"
            className="block px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Back to Site
          </Link>
        </div>
      </aside>
    </>
  );
}

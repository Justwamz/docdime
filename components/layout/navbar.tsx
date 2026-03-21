"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/">
            <img src="/logo.png" alt="DocDime" className="h-8 w-auto" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Features</Link>
            <Link href="/#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Pricing</Link>
            <Link href="/#faq" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">FAQ</Link>
          </nav>

          {/* Auth buttons */}
          <div className="hidden md:flex items-center gap-3">
            {session ? (
              <Link href="/dashboard">
                <Button size="sm">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Log in</Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 text-gray-500 hover:text-gray-900"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden py-4 border-t border-gray-100 space-y-3">
            <Link href="/#features" className="block text-sm text-gray-600 py-2" onClick={() => setMobileOpen(false)}>Features</Link>
            <Link href="/#pricing" className="block text-sm text-gray-600 py-2" onClick={() => setMobileOpen(false)}>Pricing</Link>
            <Link href="/#faq" className="block text-sm text-gray-600 py-2" onClick={() => setMobileOpen(false)}>FAQ</Link>
            <div className="flex flex-col gap-2 pt-2">
              {session ? (
                <Link href="/dashboard">
                  <Button className="w-full" size="sm">Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="outline" className="w-full" size="sm">Log in</Button>
                  </Link>
                  <Link href="/signup">
                    <Button className="w-full" size="sm">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

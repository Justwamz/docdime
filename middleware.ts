import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Rate limit login attempts: 10 per 15 minutes per IP
    if (path === "/api/auth/callback/credentials" && req.method === "POST") {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
        req.headers.get("x-real-ip") ??
        "unknown";
      const { allowed } = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
      if (!allowed) {
        return NextResponse.json({ error: "Too many login attempts. Please try again later." }, { status: 429 });
      }
    }

    // Admin routes require isAdmin flag
    if (path.startsWith("/admin") && !path.startsWith("/admin/login")) {
      if (!token?.isAdmin) {
        return NextResponse.redirect(new URL("/admin/login", req.url));
      }
    }

    // Dashboard routes require onboarding to be complete
    if (path.startsWith("/dashboard")) {
      if (!token?.onboardingDone) {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        // Allow admin login page without token
        if (path === "/admin/login") return true;

        // Protect dashboard and admin routes
        if (path.startsWith("/dashboard") || path.startsWith("/admin")) {
          return !!token;
        }

        // Onboarding requires auth
        if (path === "/onboarding") {
          return !!token;
        }

        return true;
      },
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/onboarding", "/api/auth/callback/credentials"],
};

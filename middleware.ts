import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

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
  matcher: ["/dashboard/:path*", "/admin/:path*", "/onboarding"],
};

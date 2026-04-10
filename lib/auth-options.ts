import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
          plan: user.plan,
          onboardingDone: user.onboardingDone,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.isAdmin = user.isAdmin;
        token.plan = user.plan;
        token.onboardingDone = user.onboardingDone;
      }
      // Re-read fresh data from DB on update trigger (e.g. after onboarding)
      if (trigger === "update") {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: { onboardingDone: true, plan: true, isAdmin: true },
        });
        if (fresh) {
          token.onboardingDone = fresh.onboardingDone;
          token.plan = fresh.plan;
          token.isAdmin = fresh.isAdmin;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.isAdmin = token.isAdmin;
        session.user.plan = token.plan;
        session.user.onboardingDone = token.onboardingDone;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};

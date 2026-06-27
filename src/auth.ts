import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validation";

// NextAuth runs `new URL()` on AUTH_URL/NEXTAUTH_URL on every request. A bare
// host (e.g. "urbanlane.uk", as some hosts store the domain) throws "Invalid
// URL" and 500s the whole app. Ensure a scheme before NextAuth reads them.
for (const key of ["AUTH_URL", "NEXTAUTH_URL"] as const) {
  const v = process.env[key];
  if (v && v.trim() && !/^https?:\/\//i.test(v)) {
    process.env[key] = `https://${v.trim().replace(/\/+$/, "")}`;
  }
}

const maxAgeDays = Number(process.env.AUTH_SESSION_MAX_AGE_DAYS || 30);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: maxAgeDays * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash || !user.isActive) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        // Block login until the email is verified (issues-doc requirement).
        // The login action surfaces a specific "verify your email" message.
        if (!user.emailVerified) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: UserRole }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
});

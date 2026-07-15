import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { authenticateWithPassword, loginSchema } from '@/modules/identity';
import { consumeRateLimit } from '@/modules/identity/infrastructure/rate-limiter';
import { normalizeEmail } from '@/modules/identity/presentation/schemas';
import { getServerEnvironment } from '@/shared/validation/env';

const isProduction = process.env.NODE_ENV === 'production';
const environment = getServerEnvironment();

export const authOptions: NextAuthOptions = {
  secret: environment.NEXTAUTH_SECRET,
  pages: { signIn: '/login' },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60,
    updateAge: 15 * 60,
  },
  cookies: {
    sessionToken: {
      name: isProduction
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isProduction,
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mật khẩu', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse({
          email: credentials?.email,
          password: credentials?.password,
        });

        if (!parsed.success) {
          return null;
        }

        const rateLimit = consumeRateLimit(
          'login',
          normalizeEmail(parsed.data.email),
        );
        if (!rateLimit.allowed) {
          return null;
        }

        const actor = await authenticateWithPassword(parsed.data);
        return actor
          ? {
              id: actor.userId,
              email: parsed.data.email,
              authVersion: actor.authVersion,
            }
          : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.authVersion = user.authVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub && typeof token.authVersion === 'number') {
        session.user.id = token.sub;
        session.user.authVersion = token.authVersion;
      }
      return session;
    },
  },
};

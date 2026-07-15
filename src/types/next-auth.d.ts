import type { DefaultSession, DefaultUser } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      authVersion: number;
      id: string;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    authVersion: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    authVersion?: number;
  }
}

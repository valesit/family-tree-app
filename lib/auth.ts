import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import prisma from './db';
import { SessionUser } from '@/types';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        phone: { label: 'Phone', type: 'tel' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.password) {
          throw new Error('Password is required');
        }

        const identifier = credentials.email || credentials.phone;
        if (!identifier) {
          throw new Error('Email or phone is required');
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.email || undefined },
              { phone: credentials.phone || undefined },
            ],
          },
          include: {
            linkedPerson: true,
          },
        });

        if (!user || !user.password) {
          throw new Error('Invalid credentials');
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error('Invalid credentials');
        }

        return {
          id: user.id,
          email: user.email,
          phone: user.phone,
          name: user.name,
          image: user.image,
          role: user.role,
          linkedPersonId: user.linkedPerson?.id || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as SessionUser).role;
        token.phone = (user as SessionUser).phone;
        token.linkedPersonId = (user as SessionUser).linkedPersonId;
      }

      // Keep session state current immediately after profile claiming, photo
      // changes and account edits instead of requiring a sign-out/sign-in.
      if (trigger === 'update' && session) {
        if (typeof session.name !== 'undefined') token.name = session.name;
        if (typeof session.image !== 'undefined') token.picture = session.image;
        if (typeof session.phone !== 'undefined') token.phone = session.phone;
        if (typeof session.linkedPersonId !== 'undefined') {
          token.linkedPersonId = session.linkedPersonId;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as SessionUser).id = token.id as string;
        (session.user as SessionUser).role = token.role as 'ADMIN' | 'MEMBER' | 'VIEWER';
        (session.user as SessionUser).phone = token.phone as string | null;
        (session.user as SessionUser).linkedPersonId = token.linkedPersonId as string | null;
        if (typeof token.picture !== 'undefined') {
          session.user.image = token.picture as string | null;
        }
      }
      return session;
    },
  },
  events: {
    async signIn({ user, isNewUser }) {
      if (isNewUser && user.id) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: 'WELCOME',
            title: 'Welcome to the Family Tree!',
            message: 'Start by exploring the tree or adding yourself and your family members.',
          },
        });
      }
    },
  },
};

export async function getSessionUser(session: { user?: SessionUser } | null): Promise<SessionUser | null> {
  if (!session?.user) return null;
  return session.user as SessionUser;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

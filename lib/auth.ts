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
      
      // Handle session updates
      if (trigger === 'update' && session) {
        token.name = session.name;
        token.image = session.image;
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as SessionUser).id = token.id as string;
        (session.user as SessionUser).role = token.role as 'ADMIN' | 'MEMBER' | 'VIEWER';
        (session.user as SessionUser).phone = token.phone as string | null;
        (session.user as SessionUser).linkedPersonId = token.linkedPersonId as string | null;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, isNewUser }) {
      if (isNewUser && user.id) {
        // Create welcome notification for new users
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

// Helper to get session user
export async function getSessionUser(session: { user?: SessionUser } | null): Promise<SessionUser | null> {
  if (!session?.user) return null;
  return session.user as SessionUser;
}

// Hash password helper
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify password helper
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}


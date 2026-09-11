import { createHmac, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { ZodError } from 'zod';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';

const GUEST_COOKIE = 'family-forum-guest';
export const communityHeaders = { 'Cache-Control': 'private, no-store, max-age=0' };

export class CommunityError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function communityFailure(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ success: false, error: error.issues[0].message }, { status: 400, headers: communityHeaders });
  if (error instanceof CommunityError) return NextResponse.json({ success: false, error: error.message }, { status: error.status, headers: communityHeaders });
  console.error('Family community request failed:', error);
  return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500, headers: communityHeaders });
}

export function checkCommunityRequest(request: NextRequest, maxBytes = 40_000) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== request.nextUrl.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new CommunityError('Please submit from this family site.', 403);
  }
  if (Number(request.headers.get('content-length') || 0) > maxBytes) throw new CommunityError('Your submission is too large.', 413);
}

export async function communityUser() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as SessionUser | undefined)?.id;
  // Names and permissions always come from the account, never from submitted fields.
  return id ? prisma.user.findUnique({ where: { id }, select: { id: true, name: true, image: true, role: true } }) : null;
}

export async function communityFamily(ref: string | null) {
  if (!ref || ref.length > 100) throw new CommunityError('Choose a family first.');
  const family = await prisma.family.findFirst({ where: { OR: [{ id: ref }, { rootPersonId: ref }] }, select: { id: true, name: true, rootPersonId: true } });
  if (!family) throw new CommunityError('Family not found.', 404);
  return family;
}

function digest(value: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new CommunityError('Community posting is temporarily unavailable.', 503);
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function guestIdentity(request: NextRequest) {
  const existing = request.cookies.get(GUEST_COOKIE)?.value;
  const token = existing && /^[a-f0-9]{64}$/.test(existing) ? existing : randomBytes(32).toString('hex');
  return { key: digest(`guest:${token}`), token };
}

export function withGuestCookie(response: NextResponse, request: NextRequest, token?: string) {
  if (token) response.cookies.set(GUEST_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/', maxAge: 60 * 60 * 24 * 365 });
  return response;
}

export async function communityAuthor(request: NextRequest, guestName: string) {
  const user = await communityUser();
  if (user) return { authorId: user.id, authorName: user.name?.trim() || 'Family member', isGuest: false, guestKey: null, token: undefined };
  if (guestName.trim().length < 2) throw new CommunityError('Enter your name to post as a guest.');
  const guest = guestIdentity(request);
  return { authorId: null, authorName: guestName.trim(), isGuest: true, guestKey: guest.key, token: guest.token };
}

export async function limitCommunityWrites(request: NextRequest, userId: string | null) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const ip = (request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
  const id = `${digest(userId ? `user:${userId}` : `ip:${ip}`)}:${Math.floor(now / windowMs)}`;
  const bucket = await prisma.communityRateLimit.upsert({ where: { id }, create: { id, count: 1, expiresAt: new Date(now + windowMs) }, update: { count: { increment: 1 } } });
  if (bucket.count > 20) throw new CommunityError('You have posted several times recently. Please try again in a few minutes.', 429);
  // Bounded cleanup of expired counters; never store raw IP addresses.
  await prisma.communityRateLimit.deleteMany({ where: { expiresAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } } });
}

export async function communityPermissions(request: NextRequest, familyId: string) {
  const user = await communityUser();
  const member = user ? await prisma.familyMembership.findUnique({ where: { userId_familyId: { userId: user.id, familyId } }, select: { role: true } }) : null;
  const guestKey = request.cookies.has(GUEST_COOKIE) ? guestIdentity(request).key : null;
  return { userId: user?.id || null, guestKey, isAdmin: user?.role === 'ADMIN' || member?.role === 'ADMIN' };
}

export function mayManage(author: { authorId: string | null; guestKey: string | null }, permissions: Awaited<ReturnType<typeof communityPermissions>>) {
  return permissions.isAdmin || Boolean(permissions.userId && permissions.userId === author.authorId) || Boolean(permissions.guestKey && permissions.guestKey === author.guestKey);
}

export function communityPage(request: NextRequest) {
  const raw = Number(request.nextUrl.searchParams.get('page') || '1');
  return Number.isInteger(raw) && raw >= 1 && raw <= 10000 ? raw : 1;
}

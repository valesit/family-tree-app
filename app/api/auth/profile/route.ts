import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { profileSchema } from '@/lib/validators';
import { SessionUser } from '@/types';

// GET /api/auth/profile — current user's profile (including whatsappOptIn)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user as SessionUser;

    const data = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        whatsappOptIn: true,
        role: true,
      },
    });

    if (!data) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error('GET /api/auth/profile', e);
    return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 });
  }
}

// PUT /api/auth/profile — update name, email, phone, whatsappOptIn
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user as SessionUser;

    const body = await request.json();
    const result = profileSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.issues[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    const { name, email, phone, whatsappOptIn } = result.data;

    // If they don't have a phone number, WhatsApp opt-in cannot be enabled.
    // (Strip the flag rather than failing — keeps the form forgiving.)
    const cleanPhone = phone ? phone : null;
    const safeOptIn = Boolean(whatsappOptIn) && !!cleanPhone;

    // Make sure email/phone aren't already taken by another account.
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: user.id } },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Email is already in use by another account' },
          { status: 400 }
        );
      }
    }
    if (cleanPhone) {
      const existing = await prisma.user.findFirst({
        where: { phone: cleanPhone, NOT: { id: user.id } },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Phone number is already in use by another account' },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        email: email ? email : null,
        phone: cleanPhone,
        whatsappOptIn: safeOptIn,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        whatsappOptIn: true,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    console.error('PUT /api/auth/profile', e);
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}

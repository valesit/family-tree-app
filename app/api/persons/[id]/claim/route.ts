import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';

// POST /api/persons/[id]/claim - Link user account to a person (auto-approved)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id: personId } = await params;

    // Check if person exists
    const person = await prisma.person.findUnique({
      where: { id: personId },
      include: { user: true },
    });

    if (!person) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    // Check if person is already linked to a user
    if (person.userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'This profile is already linked to an account' 
      }, { status: 400 });
    }

    // Check if user already has a linked person
    const existingLink = await prisma.person.findFirst({
      where: { userId: user.id },
    });

    if (existingLink) {
      return NextResponse.json({ 
        success: false, 
        error: `You are already linked to ${existingLink.firstName} ${existingLink.lastName} in the family tree` 
      }, { status: 400 });
    }

    // Auto-approve: Link directly for all users (seamless & scalable)
    const updatedPerson = await prisma.person.update({
      where: { id: personId },
      data: { userId: user.id },
    });

    // Create activity log
    await prisma.activity.create({
      data: {
        type: 'PERSON_UPDATED',
        description: `${user.name} linked their account to ${person.firstName} ${person.lastName}`,
        userId: user.id,
        data: { personId },
      },
    });

    // Notify admins (for awareness, not approval)
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin: { id: string }) => ({
          userId: admin.id,
          type: 'NEW_FAMILY_MEMBER',
          title: 'Profile Claimed',
          message: `${user.name} (${user.email}) has linked their account to ${person.firstName} ${person.lastName}`,
          data: { personId, userId: user.id },
        })),
      });
    }

    return NextResponse.json({ 
      success: true, 
      data: updatedPerson,
      message: `Welcome! Your account is now linked to ${person.firstName} ${person.lastName}.` 
    });
  } catch (error) {
    console.error('Error claiming profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to claim profile' },
      { status: 500 }
    );
  }
}

// DELETE /api/persons/[id]/claim - Unlink user from person (admin or self only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id: personId } = await params;

    const person = await prisma.person.findUnique({
      where: { id: personId },
    });

    if (!person) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    // Only allow admin or the linked user to unlink
    if (user.role !== 'ADMIN' && person.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    await prisma.person.update({
      where: { id: personId },
      data: { userId: null },
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Profile unlinked successfully' 
    });
  } catch (error) {
    console.error('Error unlinking profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unlink profile' },
      { status: 500 }
    );
  }
}


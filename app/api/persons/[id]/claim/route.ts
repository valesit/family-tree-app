import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import {
  findPersonFamilyRoot,
  addUserToFamily,
  notifyFamilyAdmins,
} from '@/lib/family-membership';

// POST /api/persons/[id]/claim - Link user account to a person ("This is me" - auto-verified)
export async function POST(
  _request: NextRequest,
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
      include: { user: true, profileImage: true },
    });

    if (!person) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }
    if (person.userId) {
      return NextResponse.json(
        { success: false, error: 'This profile is already linked to an account' },
        { status: 400 }
      );
    }

    const existingLink = await prisma.person.findFirst({ where: { userId: user.id } });
    if (existingLink) {
      return NextResponse.json(
        {
          success: false,
          error: `You are already linked to ${existingLink.firstName} ${existingLink.lastName} in the family tree`,
        },
        { status: 400 }
      );
    }

    const familyRootId = await findPersonFamilyRoot(personId);

    const updatedPerson = await prisma.$transaction(async (tx) => {
      const linked = await tx.person.update({
        where: { id: personId },
        data: {
          userId: user.id,
          isVerified: true,
          verifiedAt: new Date(),
          verifiedById: user.id,
        },
      });

      if (person.profileImage?.url) {
        await tx.user.update({
          where: { id: user.id },
          data: { image: person.profileImage.url },
        });
      }

      return linked;
    });

    if (familyRootId) {
      await addUserToFamily(user.id, familyRootId, 'MEMBER');

      // Keep the claimed person's stable family graph association aligned with
      // the account membership. Older records may predate the FamilyPerson
      // backfill, which previously caused claimed users to disappear from
      // family-scoped features such as messaging.
      const familyRecord = await prisma.family.findUnique({
        where: { rootPersonId: familyRootId },
        select: { id: true },
      });
      if (familyRecord) {
        await prisma.familyPerson.upsert({
          where: {
            familyId_personId: {
              familyId: familyRecord.id,
              personId,
            },
          },
          create: {
            familyId: familyRecord.id,
            personId,
          },
          update: {},
        });
      }
    }

    await prisma.activity.create({
      data: {
        type: 'PERSON_UPDATED',
        description: `${user.name || user.email || 'A family member'} claimed the profile of ${person.firstName} ${person.lastName} ("This is me")`,
        userId: user.id,
        data: { personId, familyId: familyRootId },
      },
    });

    if (familyRootId) {
      await notifyFamilyAdmins(familyRootId, {
        type: 'PROFILE_CLAIMED',
        title: 'Profile Claimed',
        message: `${user.name || user.email} has claimed the profile of ${person.firstName} ${person.lastName}`,
        data: { personId, userId: user.id, familyId: familyRootId },
      });
    }

    const systemAdmins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    if (systemAdmins.length > 0) {
      await prisma.notification.createMany({
        data: systemAdmins.map((admin: { id: string }) => ({
          userId: admin.id,
          type: 'PROFILE_CLAIMED' as const,
          title: 'Profile Claimed',
          message: `${user.name || user.email || 'A family member'} has claimed the profile of ${person.firstName} ${person.lastName}`,
          data: { personId, userId: user.id, familyId: familyRootId },
        })),
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedPerson,
      profileImageUrl: person.profileImage?.url || null,
      message: `Welcome! Your account is now linked to ${person.firstName} ${person.lastName}.`,
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id: personId } = await params;
    const person = await prisma.person.findUnique({ where: { id: personId } });

    if (!person) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }
    if (user.role !== 'ADMIN' && person.userId !== user.id) {
      return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    await prisma.person.update({
      where: { id: personId },
      data: { userId: null },
    });

    return NextResponse.json({ success: true, message: 'Profile unlinked successfully' });
  } catch (error) {
    console.error('Error unlinking profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unlink profile' },
      { status: 500 }
    );
  }
}
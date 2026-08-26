import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import { isSystemAdmin, isFamilyAdmin, canManageTree } from '@/lib/family-membership';
import {
  deleteTransitionalMembership,
  getTransitionalMembership,
  listTransitionalMembershipsForFamily,
  resolveFamilyRecord,
  setTransitionalMembershipRole,
  upsertTransitionalMembership,
} from '@/lib/stable-family';

async function hydrateMembers(familyRef: string) {
  const family = await resolveFamilyRecord(familyRef);
  if (!family) return null;
  const memberships = await listTransitionalMembershipsForFamily(family.id);
  const users = await prisma.user.findMany({
    where: { id: { in: memberships.map((membership) => membership.userId) } },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      linkedPerson: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImage: { select: { url: true } },
        },
      },
    },
  });
  const userById = new Map(users.map((user) => [user.id, user]));
  return memberships.map((membership) => ({
    id: membership.id,
    userId: membership.userId,
    familyId: family.rootPersonId,
    familyRecordId: family.id,
    role: membership.role,
    joinedAt: membership.joinedAt,
    updatedAt: membership.updatedAt,
    user: userById.get(membership.userId) ?? null,
  }));
}

// GET /api/family/members - Get members of a family tree
export async function GET(request: NextRequest) {
  try {
    const familyId = new URL(request.url).searchParams.get('familyId');
    if (!familyId) {
      return NextResponse.json({ success: false, error: 'familyId is required' }, { status: 400 });
    }
    const members = await hydrateMembers(familyId);
    if (!members) {
      return NextResponse.json({ success: false, error: 'Family not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: members });
  } catch (error) {
    console.error('Error fetching family members:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch family members' }, { status: 500 });
  }
}

// POST /api/family/members - Add a user to a family tree
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const actor = session.user as SessionUser;
    const body = await request.json();
    const { familyId, targetUserId, role = 'MEMBER' } = body;
    if (!familyId || !targetUserId) {
      return NextResponse.json(
        { success: false, error: 'familyId and targetUserId are required' },
        { status: 400 }
      );
    }

    const family = await resolveFamilyRecord(familyId);
    if (!family) {
      return NextResponse.json({ success: false, error: 'Family not found' }, { status: 404 });
    }

    if (!(await canManageTree(actor.id, family.id))) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to manage this family tree' },
        { status: 403 }
      );
    }

    if (role === 'ADMIN') {
      const [sysAdmin, famAdmin] = await Promise.all([
        isSystemAdmin(actor.id),
        isFamilyAdmin(actor.id, family.id),
      ]);
      if (!sysAdmin && !famAdmin) {
        return NextResponse.json(
          { success: false, error: 'Only System Admin or Family Admin can add admins' },
          { status: 403 }
        );
      }
    }

    if (await getTransitionalMembership(targetUserId, family.id)) {
      return NextResponse.json(
        { success: false, error: 'User is already a member of this family tree' },
        { status: 400 }
      );
    }

    const membership = await upsertTransitionalMembership(
      targetUserId,
      family.id,
      role === 'ADMIN' ? 'ADMIN' : 'MEMBER'
    );
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true },
    });

    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: 'NEW_FAMILY_MEMBER',
        title: 'Added to family tree',
        message: 'You have been added to a family tree.',
        data: { familyId: family.id, rootPersonId: family.rootPersonId },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...membership,
        familyId: family.rootPersonId,
        familyRecordId: family.id,
        user,
      },
    });
  } catch (error) {
    console.error('Error adding family member:', error);
    return NextResponse.json({ success: false, error: 'Failed to add family member' }, { status: 500 });
  }
}

// PATCH /api/family/members - Update a member's role
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const actor = session.user as SessionUser;
    const body = await request.json();
    const { familyId, targetUserId, role } = body;
    if (!familyId || !targetUserId || !role) {
      return NextResponse.json(
        { success: false, error: 'familyId, targetUserId, and role are required' },
        { status: 400 }
      );
    }

    const family = await resolveFamilyRecord(familyId);
    if (!family) {
      return NextResponse.json({ success: false, error: 'Family not found' }, { status: 404 });
    }
    if (!(await canManageTree(actor.id, family.id))) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to manage this family tree' },
        { status: 403 }
      );
    }

    const membership = await getTransitionalMembership(targetUserId, family.id);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'User is not a member of this family tree' },
        { status: 404 }
      );
    }

    const sysAdmin = await isSystemAdmin(actor.id);
    if (targetUserId === actor.id && !sysAdmin) {
      return NextResponse.json({ success: false, error: 'Cannot change your own role' }, { status: 400 });
    }

    if (role === 'ADMIN' && membership.role !== 'ADMIN') {
      const famAdmin = await isFamilyAdmin(actor.id, family.id);
      if (!sysAdmin && !famAdmin) {
        return NextResponse.json(
          { success: false, error: 'Only System Admin or Family Admin can promote to admin' },
          { status: 403 }
        );
      }
    }

    if (membership.role === 'ADMIN' && role !== 'ADMIN' && !sysAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only System Admin can demote Family Admins. Use the removal request process.' },
        { status: 403 }
      );
    }

    const nextRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
    await setTransitionalMembershipRole(membership.id, nextRole);
    return NextResponse.json({
      success: true,
      data: { ...membership, role: nextRole, familyRecordId: family.id, familyId: family.rootPersonId },
    });
  } catch (error) {
    console.error('Error updating family member:', error);
    return NextResponse.json({ success: false, error: 'Failed to update family member' }, { status: 500 });
  }
}

// DELETE /api/family/members - Remove a user from a family tree (System Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const actor = session.user as SessionUser;
    const searchParams = new URL(request.url).searchParams;
    const familyId = searchParams.get('familyId');
    const targetUserId = searchParams.get('targetUserId');
    if (!familyId || !targetUserId) {
      return NextResponse.json(
        { success: false, error: 'familyId and targetUserId are required' },
        { status: 400 }
      );
    }

    if (!(await isSystemAdmin(actor.id))) {
      return NextResponse.json(
        { success: false, error: 'Only System Admin can remove members from a family tree' },
        { status: 403 }
      );
    }

    const family = await resolveFamilyRecord(familyId);
    if (!family) {
      return NextResponse.json({ success: false, error: 'Family not found' }, { status: 404 });
    }
    const membership = await getTransitionalMembership(targetUserId, family.id);
    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'User is not a member of this family tree' },
        { status: 404 }
      );
    }

    await deleteTransitionalMembership(membership.id);
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: 'NEW_FAMILY_MEMBER',
        title: 'Removed from family tree',
        message: 'You have been removed from a family tree.',
        data: { familyId: family.id, rootPersonId: family.rootPersonId },
      },
    });

    return NextResponse.json({ success: true, message: 'Member removed from family tree' });
  } catch (error) {
    console.error('Error removing family member:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove family member' }, { status: 500 });
  }
}

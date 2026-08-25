import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import {
  isSystemAdmin,
  isFamilyAdmin,
  notifyFamilyAdmins,
} from '@/lib/family-membership';
import {
  getTransitionalMembership,
  listTransitionalMembershipsForFamily,
  resolveFamilyRecord,
  upsertTransitionalMembership,
} from '@/lib/stable-family';

// GET /api/family/admins - Get Family Admins for a tree
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const familyId = searchParams.get('familyId');
    if (!familyId) {
      return NextResponse.json(
        { success: false, error: 'familyId is required' },
        { status: 400 }
      );
    }

    const family = await resolveFamilyRecord(familyId);
    if (!family) {
      return NextResponse.json({ success: false, error: 'Family not found' }, { status: 404 });
    }

    const memberships = await listTransitionalMembershipsForFamily(family.id, 'ADMIN');
    const users = await prisma.user.findMany({
      where: { id: { in: memberships.map((membership) => membership.userId) } },
      select: { id: true, name: true, email: true, image: true },
    });
    const userById = new Map(users.map((user) => [user.id, user]));

    const admins = memberships.map((membership) => ({
      id: membership.id,
      userId: membership.userId,
      familyId: family.rootPersonId,
      familyRecordId: family.id,
      role: membership.role,
      joinedAt: membership.joinedAt,
      updatedAt: membership.updatedAt,
      user: userById.get(membership.userId) ?? null,
    }));

    return NextResponse.json({ success: true, data: admins });
  } catch (error) {
    console.error('Error fetching family admins:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch family admins' },
      { status: 500 }
    );
  }
}

// POST /api/family/admins - Add/promote a Family Admin
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const actor = session.user as SessionUser;
    const body = await request.json();
    const { familyId, targetUserId } = body;
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

    const [actorIsSystemAdmin, actorIsFamilyAdmin] = await Promise.all([
      isSystemAdmin(actor.id),
      isFamilyAdmin(actor.id, family.id),
    ]);
    if (!actorIsSystemAdmin && !actorIsFamilyAdmin) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to add Family Admins' },
        { status: 403 }
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'Target user not found' }, { status: 404 });
    }

    const targetMembership = await getTransitionalMembership(targetUserId, family.id);
    if (targetMembership?.role === 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'User is already a Family Admin' },
        { status: 400 }
      );
    }

    await upsertTransitionalMembership(targetUserId, family.id, 'ADMIN');

    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: 'FAMILY_ADMIN_ADDED',
        title: 'You are now a Family Admin',
        message: 'You have been promoted to Family Admin for this family tree.',
        data: { familyId: family.id, rootPersonId: family.rootPersonId },
      },
    });

    await notifyFamilyAdmins(family.id, {
      type: 'FAMILY_ADMIN_ADDED',
      title: 'New Family Admin added',
      message: `${targetUser.name || targetUser.email} has been added as a Family Admin.`,
      data: { familyId: family.id, rootPersonId: family.rootPersonId, newAdminId: targetUserId },
    });

    return NextResponse.json({ success: true, message: 'User promoted to Family Admin' });
  } catch (error) {
    console.error('Error adding family admin:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add family admin' },
      { status: 500 }
    );
  }
}

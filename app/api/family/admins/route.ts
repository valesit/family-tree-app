import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import { 
  isSystemAdmin, 
  isFamilyAdmin, 
  getFamilyMembership,
  notifyFamilyAdmins 
} from '@/lib/family-membership';

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

    const admins = await prisma.familyMembership.findMany({
      where: {
        familyId,
        role: 'ADMIN',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: admins,
    });
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
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
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

    // Check actor permissions (System Admin or existing Family Admin)
    const [actorIsSystemAdmin, actorIsFamilyAdmin] = await Promise.all([
      isSystemAdmin(actor.id),
      isFamilyAdmin(actor.id, familyId),
    ]);

    if (!actorIsSystemAdmin && !actorIsFamilyAdmin) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to add Family Admins' },
        { status: 403 }
      );
    }

    // Check target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Target user not found' },
        { status: 404 }
      );
    }

    // Check target is a member of this family
    const targetMembership = await getFamilyMembership(targetUserId, familyId);

    if (!targetMembership) {
      // If not a member, add them as Family Admin
      await prisma.familyMembership.create({
        data: {
          userId: targetUserId,
          familyId,
          role: 'ADMIN',
        },
      });
    } else if (targetMembership.role === 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'User must be verified before becoming Family Admin' },
        { status: 400 }
      );
    } else if (targetMembership.role === 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'User is already a Family Admin' },
        { status: 400 }
      );
    } else {
      // Promote to Family Admin
      await prisma.familyMembership.update({
        where: { id: targetMembership.id },
        data: { role: 'ADMIN' },
      });
    }

    // Notify the user
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: 'FAMILY_ADMIN_ADDED',
        title: 'You are now a Family Admin',
        message: `You have been promoted to Family Admin for this family tree.`,
        data: { familyId },
      },
    });

    // Notify other Family Admins
    await notifyFamilyAdmins(familyId, {
      type: 'FAMILY_ADMIN_ADDED',
      title: 'New Family Admin added',
      message: `${targetUser.name || targetUser.email} has been added as a Family Admin.`,
      data: { familyId, newAdminId: targetUserId },
    });

    return NextResponse.json({
      success: true,
      message: 'User promoted to Family Admin',
    });
  } catch (error) {
    console.error('Error adding family admin:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add family admin' },
      { status: 500 }
    );
  }
}

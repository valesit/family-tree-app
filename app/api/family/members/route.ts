import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import { isSystemAdmin, isFamilyAdmin, canManageTree } from '@/lib/family-membership';

// GET /api/family/members - Get members of a family tree
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

    const members = await prisma.familyMembership.findMany({
      where: { familyId },
      include: {
        user: {
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
        },
      },
      orderBy: [
        { role: 'asc' }, // ADMINs first
        { joinedAt: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: members,
    });
  } catch (error) {
    console.error('Error fetching family members:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch family members' },
      { status: 500 }
    );
  }
}

// POST /api/family/members - Add a user to a family tree
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
    const { familyId, targetUserId, role = 'MEMBER' } = body;

    if (!familyId || !targetUserId) {
      return NextResponse.json(
        { success: false, error: 'familyId and targetUserId are required' },
        { status: 400 }
      );
    }

    // Check actor can manage this tree
    const canManage = await canManageTree(actor.id, familyId);
    if (!canManage) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to manage this family tree' },
        { status: 403 }
      );
    }

    // Only System Admin can add ADMIN role directly
    if (role === 'ADMIN') {
      const isSysAdmin = await isSystemAdmin(actor.id);
      const isFamAdmin = await isFamilyAdmin(actor.id, familyId);
      if (!isSysAdmin && !isFamAdmin) {
        return NextResponse.json(
          { success: false, error: 'Only System Admin or Family Admin can add admins' },
          { status: 403 }
        );
      }
    }

    // Check if user is already a member
    const existingMembership = await prisma.familyMembership.findUnique({
      where: {
        userId_familyId: { userId: targetUserId, familyId },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { success: false, error: 'User is already a member of this family tree' },
        { status: 400 }
      );
    }

    // Add the membership
    const membership = await prisma.familyMembership.create({
      data: {
        userId: targetUserId,
        familyId,
        role: role as any,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Notify the user
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: 'NEW_FAMILY_MEMBER',
        title: 'Added to family tree',
        message: 'You have been added to a family tree.',
        data: { familyId },
      },
    });

    return NextResponse.json({
      success: true,
      data: membership,
    });
  } catch (error) {
    console.error('Error adding family member:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add family member' },
      { status: 500 }
    );
  }
}

// PATCH /api/family/members - Update a member's role
export async function PATCH(request: NextRequest) {
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
    const { familyId, targetUserId, role } = body;

    if (!familyId || !targetUserId || !role) {
      return NextResponse.json(
        { success: false, error: 'familyId, targetUserId, and role are required' },
        { status: 400 }
      );
    }

    // Check actor can manage this tree
    const canManage = await canManageTree(actor.id, familyId);
    if (!canManage) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to manage this family tree' },
        { status: 403 }
      );
    }

    // Get the membership
    const membership = await prisma.familyMembership.findUnique({
      where: {
        userId_familyId: { userId: targetUserId, familyId },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'User is not a member of this family tree' },
        { status: 404 }
      );
    }

    // Cannot change own role (unless System Admin)
    const isSysAdmin = await isSystemAdmin(actor.id);
    if (targetUserId === actor.id && !isSysAdmin) {
      return NextResponse.json(
        { success: false, error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    // Promoting to ADMIN requires System Admin or Family Admin
    if (role === 'ADMIN' && membership.role !== 'ADMIN') {
      const isFamAdmin = await isFamilyAdmin(actor.id, familyId);
      if (!isSysAdmin && !isFamAdmin) {
        return NextResponse.json(
          { success: false, error: 'Only System Admin or Family Admin can promote to admin' },
          { status: 403 }
        );
      }
    }

    // Demoting an ADMIN requires System Admin (Family Admin removal goes through removal request)
    if (membership.role === 'ADMIN' && role !== 'ADMIN' && !isSysAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only System Admin can demote Family Admins. Use the removal request process.' },
        { status: 403 }
      );
    }

    // Update the role
    const updatedMembership = await prisma.familyMembership.update({
      where: { id: membership.id },
      data: { role: role as any },
    });

    return NextResponse.json({
      success: true,
      data: updatedMembership,
    });
  } catch (error) {
    console.error('Error updating family member:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update family member' },
      { status: 500 }
    );
  }
}

// DELETE /api/family/members - Remove a user from a family tree (System Admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const actor = session.user as SessionUser;
    const { searchParams } = new URL(request.url);
    const familyId = searchParams.get('familyId');
    const targetUserId = searchParams.get('targetUserId');

    if (!familyId || !targetUserId) {
      return NextResponse.json(
        { success: false, error: 'familyId and targetUserId are required' },
        { status: 400 }
      );
    }

    // Only System Admin can remove members
    const isSysAdmin = await isSystemAdmin(actor.id);
    if (!isSysAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only System Admin can remove members from a family tree' },
        { status: 403 }
      );
    }

    // Check if membership exists
    const membership = await prisma.familyMembership.findUnique({
      where: {
        userId_familyId: { userId: targetUserId, familyId },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'User is not a member of this family tree' },
        { status: 404 }
      );
    }

    // Delete the membership
    await prisma.familyMembership.delete({
      where: { id: membership.id },
    });

    // Notify the user
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        type: 'FAMILY_ADMIN_REMOVED',
        title: 'Removed from family tree',
        message: 'You have been removed from a family tree.',
        data: { familyId },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Member removed from family tree',
    });
  } catch (error) {
    console.error('Error removing family member:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove family member' },
      { status: 500 }
    );
  }
}

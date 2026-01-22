import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import { isSystemAdmin, isFamilyAdmin } from '@/lib/family-membership';

// GET /api/family/admins/removal-request - Get pending removal requests
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = session.user as SessionUser;
    const { searchParams } = new URL(request.url);
    const familyId = searchParams.get('familyId');

    // Only System Admin can see all requests, Family Admin can see requests for their tree
    const isSysAdmin = await isSystemAdmin(user.id);

    let where: any = { status: 'PENDING' };
    
    if (!isSysAdmin) {
      if (!familyId) {
        return NextResponse.json(
          { success: false, error: 'familyId is required for non-System Admins' },
          { status: 400 }
        );
      }
      
      const isFamAdmin = await isFamilyAdmin(user.id, familyId);
      if (!isFamAdmin) {
        return NextResponse.json(
          { success: false, error: 'Not authorized' },
          { status: 403 }
        );
      }
      
      where.familyId = familyId;
    } else if (familyId) {
      where.familyId = familyId;
    }

    const requests = await prisma.adminRemovalRequest.findMany({
      where,
      include: {
        family: true,
        targetUser: {
          select: { id: true, name: true, email: true, image: true },
        },
        requestedBy: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error('Error fetching removal requests:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch removal requests' },
      { status: 500 }
    );
  }
}

// POST /api/family/admins/removal-request - Request removal of a Family Admin
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = session.user as SessionUser;
    const body = await request.json();
    const { familyId, targetUserId, reason } = body;

    if (!familyId || !targetUserId) {
      return NextResponse.json(
        { success: false, error: 'familyId and targetUserId are required' },
        { status: 400 }
      );
    }

    // Requester must be a Family Admin of this tree
    const requesterIsFamilyAdmin = await isFamilyAdmin(user.id, familyId);
    if (!requesterIsFamilyAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only Family Admins can request removal of other admins' },
        { status: 403 }
      );
    }

    // Cannot request removal of yourself
    if (targetUserId === user.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot request removal of yourself' },
        { status: 400 }
      );
    }

    // Target must be a Family Admin
    const targetIsFamilyAdmin = await isFamilyAdmin(targetUserId, familyId);
    if (!targetIsFamilyAdmin) {
      return NextResponse.json(
        { success: false, error: 'Target user is not a Family Admin of this tree' },
        { status: 400 }
      );
    }

    // Check for existing pending request
    const existingRequest = await prisma.adminRemovalRequest.findFirst({
      where: {
        familyId,
        targetUserId,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { success: false, error: 'A removal request for this user is already pending' },
        { status: 400 }
      );
    }

    // Create the removal request
    const removalRequest = await prisma.adminRemovalRequest.create({
      data: {
        familyId,
        targetUserId,
        requestedById: user.id,
        reason,
      },
    });

    // Notify System Admins
    const systemAdmins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
    });

    if (systemAdmins.length > 0) {
      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { name: true, email: true },
      });

      await prisma.notification.createMany({
        data: systemAdmins.map((admin) => ({
          userId: admin.id,
          type: 'FAMILY_ADMIN_REMOVAL_REQUEST' as any,
          title: 'Family Admin Removal Request',
          message: `Request to remove ${targetUser?.name || targetUser?.email} as Family Admin`,
          data: { requestId: removalRequest.id, familyId },
        })),
      });
    }

    return NextResponse.json({
      success: true,
      data: removalRequest,
      message: 'Removal request submitted. A System Admin will review it.',
    });
  } catch (error) {
    console.error('Error creating removal request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create removal request' },
      { status: 500 }
    );
  }
}

// PATCH /api/family/admins/removal-request - Approve/reject a removal request (System Admin only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = session.user as SessionUser;
    
    // Only System Admin can approve/reject
    const isSysAdmin = await isSystemAdmin(user.id);
    if (!isSysAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only System Admins can approve or reject removal requests' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { requestId, action } = body; // action: 'approve' or 'reject'

    if (!requestId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'requestId and action (approve/reject) are required' },
        { status: 400 }
      );
    }

    const removalRequest = await prisma.adminRemovalRequest.findUnique({
      where: { id: requestId },
      include: {
        targetUser: { select: { id: true, name: true, email: true } },
        family: true,
      },
    });

    if (!removalRequest) {
      return NextResponse.json(
        { success: false, error: 'Removal request not found' },
        { status: 404 }
      );
    }

    if (removalRequest.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'This request has already been processed' },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    // Update the request
    await prisma.adminRemovalRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        resolvedAt: new Date(),
        resolvedById: user.id,
      },
    });

    // If approved, demote the Family Admin to regular member
    if (action === 'approve') {
      await prisma.familyMembership.updateMany({
        where: {
          userId: removalRequest.targetUserId,
          familyId: removalRequest.familyId,
          role: 'ADMIN',
        },
        data: { role: 'MEMBER' },
      });

      // Notify the removed admin
      await prisma.notification.create({
        data: {
          userId: removalRequest.targetUserId,
          type: 'FAMILY_ADMIN_REMOVED' as any,
          title: 'Family Admin status removed',
          message: 'You have been removed as a Family Admin for this family tree.',
          data: { familyId: removalRequest.familyId },
        },
      });
    }

    // Notify the requester
    await prisma.notification.create({
      data: {
        userId: removalRequest.requestedById,
        type: action === 'approve' ? 'FAMILY_ADMIN_REMOVED' as any : 'APPROVAL_REJECTED' as any,
        title: action === 'approve' ? 'Removal request approved' : 'Removal request rejected',
        message: action === 'approve'
          ? `${removalRequest.targetUser.name || removalRequest.targetUser.email} has been removed as Family Admin.`
          : `Your request to remove ${removalRequest.targetUser.name || removalRequest.targetUser.email} was rejected.`,
        data: { familyId: removalRequest.familyId },
      },
    });

    return NextResponse.json({
      success: true,
      message: action === 'approve' 
        ? 'Family Admin removed successfully' 
        : 'Removal request rejected',
    });
  } catch (error) {
    console.error('Error processing removal request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process removal request' },
      { status: 500 }
    );
  }
}

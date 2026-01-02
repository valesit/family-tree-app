import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/notable/[id] - Get a single nomination
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const nomination = await prisma.notableNomination.findUnique({
      where: { id },
      include: {
        nominatedBy: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        person: {
          include: {
            profileImage: true,
            images: true,
          },
        },
        images: {
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!nomination) {
      return NextResponse.json(
        { success: false, error: 'Nomination not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: nomination,
    });
  } catch (error) {
    console.error('Error fetching nomination:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch nomination' },
      { status: 500 }
    );
  }
}

// POST /api/notable/[id] - Approve or reject a nomination (admin only)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = session.user as SessionUser;
    
    // Only admins can approve/reject
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Only admins can approve or reject nominations' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { action, comment } = body; // action: 'approve' or 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Get nomination
    const nomination = await prisma.notableNomination.findUnique({
      where: { id },
      include: {
        person: true,
        nominatedBy: true,
      },
    });

    if (!nomination) {
      return NextResponse.json(
        { success: false, error: 'Nomination not found' },
        { status: 404 }
      );
    }

    if (nomination.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'This nomination has already been processed' },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    // Update nomination status
    await prisma.notableNomination.update({
      where: { id },
      data: {
        status: newStatus,
        adminComment: comment || null,
      },
    });

    // If approved, update the person's notable fields
    if (action === 'approve') {
      await prisma.person.update({
        where: { id: nomination.personId },
        data: {
          isNotable: true,
          notableTitle: nomination.title,
          notableDescription: nomination.description,
          notableAchievements: nomination.achievements,
        },
      });
    }

    // Notify the nominator
    const notificationType = action === 'approve' 
      ? 'NOTABLE_NOMINATION_APPROVED' 
      : 'NOTABLE_NOMINATION_REJECTED';
    
    const notificationMessage = action === 'approve'
      ? `Your nomination for ${nomination.person.firstName} ${nomination.person.lastName} as "${nomination.title}" has been approved!`
      : `Your nomination for ${nomination.person.firstName} ${nomination.person.lastName} was not approved.${comment ? ` Reason: ${comment}` : ''}`;

    await prisma.notification.create({
      data: {
        type: notificationType as 'NOTABLE_NOMINATION_APPROVED' | 'NOTABLE_NOMINATION_REJECTED',
        title: action === 'approve' ? 'Nomination Approved!' : 'Nomination Update',
        message: notificationMessage,
        userId: nomination.nominatedById,
        data: { nominationId: id, personId: nomination.personId },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Nomination ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    });
  } catch (error) {
    console.error('Error processing nomination:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process nomination' },
      { status: 500 }
    );
  }
}

// DELETE /api/notable/[id] - Delete a nomination (nominator or admin only)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const user = session.user as SessionUser;

    const nomination = await prisma.notableNomination.findUnique({
      where: { id },
    });

    if (!nomination) {
      return NextResponse.json(
        { success: false, error: 'Nomination not found' },
        { status: 404 }
      );
    }

    // Only nominator or admin can delete
    if (nomination.nominatedById !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'You can only delete your own nominations' },
        { status: 403 }
      );
    }

    await prisma.notableNomination.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Nomination deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting nomination:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete nomination' },
      { status: 500 }
    );
  }
}


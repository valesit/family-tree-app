import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';

// POST /api/corrections/[id] - Process a correction request (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { status, adminComment } = body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Get the correction request
    const correction = await prisma.correctionRequest.findUnique({
      where: { id },
      include: {
        person: true,
        requestedBy: true,
      },
    });

    if (!correction) {
      return NextResponse.json(
        { success: false, error: 'Correction request not found' },
        { status: 404 }
      );
    }

    if (correction.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'This correction has already been processed' },
        { status: 400 }
      );
    }

    // Update the correction status
    await prisma.correctionRequest.update({
      where: { id },
      data: {
        status,
        adminComment,
      },
    });

    // If approved, apply the corrections
    if (status === 'APPROVED') {
      const proposedData = correction.proposedData as Record<string, unknown>;

      await prisma.person.update({
        where: { id: correction.personId },
        data: {
          firstName: proposedData.firstName as string || undefined,
          lastName: proposedData.lastName as string || undefined,
          birthDate: proposedData.birthDate ? new Date(proposedData.birthDate as string) : undefined,
          deathDate: proposedData.deathDate ? new Date(proposedData.deathDate as string) : undefined,
          biography: proposedData.biography as string || undefined,
          occupation: proposedData.occupation as string || undefined,
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          type: 'PERSON_UPDATED',
          description: `${correction.person.firstName} ${correction.person.lastName}'s information was corrected`,
          userId: user.id,
          data: { personId: correction.personId },
        },
      });
    }

    // Notify the requester
    await prisma.notification.create({
      data: {
        userId: correction.requestedById,
        type: 'CORRECTION_RESOLVED',
        title: status === 'APPROVED' ? 'Correction Approved' : 'Correction Rejected',
        message: status === 'APPROVED'
          ? `Your correction request for ${correction.person.firstName} ${correction.person.lastName} has been approved.`
          : `Your correction request for ${correction.person.firstName} ${correction.person.lastName} was rejected. ${adminComment || ''}`,
        data: { correctionId: id, personId: correction.personId },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Correction ${status.toLowerCase()} successfully`,
    });
  } catch (error) {
    console.error('Error processing correction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process correction' },
      { status: 500 }
    );
  }
}


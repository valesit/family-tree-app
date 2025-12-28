import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { correctionSchema } from '@/lib/validators';
import { SessionUser } from '@/types';

// GET /api/corrections - Get correction requests
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const type = searchParams.get('type'); // 'mine' or 'all'

    const whereClause = type === 'mine'
      ? { requestedById: user.id }
      : user.role === 'ADMIN'
        ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' }
        : { requestedById: user.id };

    const corrections = await prisma.correctionRequest.findMany({
      where: whereClause,
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true, image: true },
        },
        person: {
          include: { profileImage: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: corrections });
  } catch (error) {
    console.error('Error fetching corrections:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch corrections' },
      { status: 500 }
    );
  }
}

// POST /api/corrections - Create a correction request
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const body = await request.json();

    // Validate correction data
    const validationResult = correctionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.issues[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    const { personId, proposedChanges, reason } = validationResult.data;

    // Get current person data
    const person = await prisma.person.findUnique({
      where: { id: personId },
    });

    if (!person) {
      return NextResponse.json(
        { success: false, error: 'Person not found' },
        { status: 404 }
      );
    }

    // Create correction request
    const correction = await prisma.correctionRequest.create({
      data: {
        personId,
        requestedById: user.id,
        currentData: {
          firstName: person.firstName,
          lastName: person.lastName,
          birthDate: person.birthDate?.toISOString(),
          deathDate: person.deathDate?.toISOString(),
          biography: person.biography,
          occupation: person.occupation,
          // Add other relevant fields
        },
        proposedData: proposedChanges,
        reason,
        status: 'PENDING',
      },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
        person: true,
      },
    });

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          type: 'CORRECTION_REQUEST',
          title: 'New Correction Request',
          message: `${user.name} submitted a correction request for ${person.firstName} ${person.lastName}.`,
          data: { correctionId: correction.id, personId },
        })),
      });
    }

    return NextResponse.json({
      success: true,
      data: correction,
      message: 'Correction request submitted successfully.',
    });
  } catch (error) {
    console.error('Error creating correction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit correction request' },
      { status: 500 }
    );
  }
}


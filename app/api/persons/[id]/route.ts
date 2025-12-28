import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { personSchema } from '@/lib/validators';
import { SessionUser } from '@/types';

// GET /api/persons/[id] - Get a single person (public - no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Viewing a person is public - no authentication required

    const { id } = await params;

    const person = await prisma.person.findUnique({
      where: { id },
      include: {
        profileImage: true,
        images: true,
        parentRelations: {
          include: {
            parent: { include: { profileImage: true } },
          },
        },
        childRelations: {
          include: {
            child: { include: { profileImage: true } },
          },
        },
        spouseRelations1: {
          include: {
            spouse2: { include: { profileImage: true } },
          },
        },
        spouseRelations2: {
          include: {
            spouse1: { include: { profileImage: true } },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!person) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: person });
  } catch (error) {
    console.error('Error fetching person:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch person' },
      { status: 500 }
    );
  }
}

// PUT /api/persons/[id] - Update a person
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id } = await params;
    const body = await request.json();
    const { approverIds, ...personData } = body;

    // Check if person exists
    const existingPerson = await prisma.person.findUnique({
      where: { id },
    });

    if (!existingPerson) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    // Validate person data
    const validationResult = personSchema.safeParse(personData);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.issues[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    // If admin, update directly
    if (user.role === 'ADMIN') {
      const person = await prisma.person.update({
        where: { id },
        data: {
          ...validationResult.data,
          birthDate: validationResult.data.birthDate ? new Date(validationResult.data.birthDate) : null,
          deathDate: validationResult.data.deathDate ? new Date(validationResult.data.deathDate) : null,
          facts: validationResult.data.facts ? JSON.stringify(validationResult.data.facts) : null,
        },
        include: {
          profileImage: true,
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          type: 'PERSON_UPDATED',
          description: `${person.firstName} ${person.lastName}'s information was updated`,
          userId: user.id,
          data: { personId: person.id },
        },
      });

      return NextResponse.json({ success: true, data: person });
    }

    // Create pending change for non-admins
    const pendingChange = await prisma.pendingChange.create({
      data: {
        changeType: 'UPDATE_PERSON',
        changeData: validationResult.data,
        personId: id,
        createdById: user.id,
        approvals: {
          create: approverIds && approverIds.length > 0
            ? approverIds.map((approverId: string) => ({
                approverId,
                status: 'PENDING',
              }))
            : [],
        },
      },
    });

    // Notify approvers
    if (approverIds && approverIds.length > 0) {
      await prisma.notification.createMany({
        data: approverIds.map((approverId: string) => ({
          userId: approverId,
          type: 'APPROVAL_REQUEST',
          title: 'Update Approval Request',
          message: `${user.name} wants to update ${existingPerson.firstName} ${existingPerson.lastName}'s information.`,
          data: { changeId: pendingChange.id },
        })),
      });
    }

    return NextResponse.json({
      success: true,
      data: pendingChange,
      message: 'Your changes have been submitted for approval.',
    });
  } catch (error) {
    console.error('Error updating person:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update person' },
      { status: 500 }
    );
  }
}

// DELETE /api/persons/[id] - Delete a person (admin only)
export async function DELETE(
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
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    const person = await prisma.person.findUnique({
      where: { id },
    });

    if (!person) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    await prisma.person.delete({
      where: { id },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: 'PERSON_UPDATED',
        description: `${person.firstName} ${person.lastName} was removed from the family tree`,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, message: 'Person deleted successfully' });
  } catch (error) {
    console.error('Error deleting person:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete person' },
      { status: 500 }
    );
  }
}


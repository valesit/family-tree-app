import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { relationshipSchema } from '@/lib/validators';
import { SessionUser } from '@/types';

// GET /api/relationships - Get all relationships (public - no auth required)
export async function GET(request: NextRequest) {
  try {
    // Viewing relationships is public - no authentication required

    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('personId');

    const where = personId
      ? {
          OR: [
            { parentId: personId },
            { childId: personId },
            { spouse1Id: personId },
            { spouse2Id: personId },
          ],
        }
      : {};

    const relationships = await prisma.relationship.findMany({
      where,
      include: {
        parent: { include: { profileImage: true } },
        child: { include: { profileImage: true } },
        spouse1: { include: { profileImage: true } },
        spouse2: { include: { profileImage: true } },
      },
    });

    return NextResponse.json({ success: true, data: relationships });
  } catch (error) {
    console.error('Error fetching relationships:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch relationships' },
      { status: 500 }
    );
  }
}

// POST /api/relationships - Create a new relationship
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const body = await request.json();
    const { approverIds, ...relationshipData } = body;

    // Validate relationship data
    const validationResult = relationshipSchema.safeParse(relationshipData);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.issues[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    const { type, person1Id, person2Id, startDate, endDate, notes } = validationResult.data;

    // Verify both persons exist
    const [person1, person2] = await Promise.all([
      prisma.person.findUnique({ where: { id: person1Id } }),
      prisma.person.findUnique({ where: { id: person2Id } }),
    ]);

    if (!person1 || !person2) {
      return NextResponse.json(
        { success: false, error: 'One or both persons not found' },
        { status: 404 }
      );
    }

    // Build relationship data based on type
    const relationshipCreateData: {
      type: typeof type;
      startDate?: Date;
      endDate?: Date;
      notes?: string;
      parentId?: string;
      childId?: string;
      spouse1Id?: string;
      spouse2Id?: string;
    } = {
      type,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      notes: notes || undefined,
    };

    if (type === 'PARENT_CHILD' || type === 'ADOPTED' || type === 'STEP_PARENT' || type === 'STEP_CHILD' || type === 'FOSTER') {
      relationshipCreateData.parentId = person1Id;
      relationshipCreateData.childId = person2Id;
    } else if (type === 'SPOUSE') {
      relationshipCreateData.spouse1Id = person1Id;
      relationshipCreateData.spouse2Id = person2Id;
    }

    // If admin, create directly
    if (user.role === 'ADMIN') {
      const relationship = await prisma.relationship.create({
        data: relationshipCreateData,
        include: {
          parent: true,
          child: true,
          spouse1: true,
          spouse2: true,
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          type: 'RELATIONSHIP_ADDED',
          description: `A ${type.toLowerCase().replace('_', '-')} relationship was added between ${person1.firstName} and ${person2.firstName}`,
          userId: user.id,
          data: { relationshipId: relationship.id },
        },
      });

      return NextResponse.json({ success: true, data: relationship });
    }

    // Create pending change for non-admins
    const pendingChange = await prisma.pendingChange.create({
      data: {
        changeType: 'ADD_RELATIONSHIP',
        changeData: validationResult.data,
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
          title: 'Relationship Approval Request',
          message: `${user.name} wants to add a relationship between ${person1.firstName} and ${person2.firstName}.`,
          data: { changeId: pendingChange.id },
        })),
      });
    }

    return NextResponse.json({
      success: true,
      data: pendingChange,
      message: 'Your relationship request has been submitted for approval.',
    });
  } catch (error) {
    console.error('Error creating relationship:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create relationship' },
      { status: 500 }
    );
  }
}


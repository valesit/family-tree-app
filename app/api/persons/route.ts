import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { personSchema } from '@/lib/validators';
import { SessionUser } from '@/types';

// GET /api/persons - Get all persons or search (public - no auth required)
export async function GET(request: NextRequest) {
  try {
    // Viewing persons is public - no authentication required

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where = query
      ? {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' as const } },
            { lastName: { contains: query, mode: 'insensitive' as const } },
            { nickname: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [persons, total] = await Promise.all([
      prisma.person.findMany({
        where,
        include: {
          profileImage: true,
          parentRelations: true,
          childRelations: true,
          spouseRelations1: true,
          spouseRelations2: true,
        },
        orderBy: { firstName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.person.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: persons,
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching persons:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch persons' },
      { status: 500 }
    );
  }
}

// POST /api/persons - Create a new person (direct or pending)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const body = await request.json();
    const { approverIds, ...personData } = body;

    // Validate person data
    const validationResult = personSchema.safeParse(personData);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.issues[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    // If admin, create directly without approval
    if (user.role === 'ADMIN') {
      const person = await prisma.person.create({
        data: {
          ...validationResult.data,
          birthDate: validationResult.data.birthDate ? new Date(validationResult.data.birthDate) : null,
          deathDate: validationResult.data.deathDate ? new Date(validationResult.data.deathDate) : null,
          facts: validationResult.data.facts ? JSON.stringify(validationResult.data.facts) : null,
          createdById: user.id,
        },
        include: {
          profileImage: true,
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          type: 'PERSON_ADDED',
          description: `${person.firstName} ${person.lastName} was added to the family tree`,
          userId: user.id,
          data: { personId: person.id },
        },
      });

      return NextResponse.json({ success: true, data: person });
    }

    // Create pending change for non-admins
    const pendingChange = await prisma.pendingChange.create({
      data: {
        changeType: 'CREATE_PERSON',
        changeData: validationResult.data,
        createdById: user.id,
        approvals: {
          create: approverIds && approverIds.length > 0
            ? approverIds.map((approverId: string) => ({
                approverId,
                status: 'PENDING',
              }))
            : [], // Admin will need to approve
        },
      },
      include: {
        approvals: {
          include: { approver: true },
        },
      },
    });

    // Notify approvers
    if (approverIds && approverIds.length > 0) {
      await prisma.notification.createMany({
        data: approverIds.map((approverId: string) => ({
          userId: approverId,
          type: 'APPROVAL_REQUEST',
          title: 'Approval Request',
          message: `${user.name} wants to add a new family member and needs your approval.`,
          data: { changeId: pendingChange.id },
        })),
      });
    }

    return NextResponse.json({
      success: true,
      data: pendingChange,
      message: 'Your request has been submitted for approval.',
    });
  } catch (error) {
    console.error('Error creating person:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create person' },
      { status: 500 }
    );
  }
}


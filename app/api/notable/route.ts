import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser, NotablePersonWithDetails } from '@/types';

// GET /api/notable - Get notable persons or nominations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'approved'; // 'approved', 'pending', 'all'
    const familyId = searchParams.get('familyId'); // Optional: filter by family (root person id)
    const limit = parseInt(searchParams.get('limit') || '10');

    if (type === 'approved') {
      // Build where clause
      const whereClause: { isNotable: boolean; lastName?: string } = { isNotable: true };
      
      // If familyId is provided, get the root person's lastName to filter by family
      if (familyId) {
        const rootPerson = await prisma.person.findUnique({
          where: { id: familyId },
          select: { lastName: true },
        });
        if (rootPerson) {
          whereClause.lastName = rootPerson.lastName;
        }
      }

      // Get approved notable persons
      const notablePersons = await prisma.person.findMany({
        where: whereClause,
        include: {
          profileImage: true,
          images: {
            take: 5,
            orderBy: { uploadedAt: 'desc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      });

      return NextResponse.json({
        success: true,
        data: notablePersons as NotablePersonWithDetails[],
      });
    }

    // Get nominations (requires auth)
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = session.user as SessionUser;
    
    const where: Record<string, unknown> = {};
    if (type === 'pending') {
      where.status = 'PENDING';
    }
    
    // Non-admins can only see their own nominations
    if (user.role !== 'ADMIN') {
      where.nominatedById = user.id;
    }

    const nominations = await prisma.notableNomination.findMany({
      where,
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
          },
        },
        images: {
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: nominations,
    });
  } catch (error) {
    console.error('Error fetching notable persons:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notable persons' },
      { status: 500 }
    );
  }
}

// POST /api/notable - Create a nomination for notable person
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = session.user as SessionUser;
    const body = await request.json();
    const { personId, title, description, achievements, imageUrls } = body;

    if (!personId || !title || !description) {
      return NextResponse.json(
        { success: false, error: 'Person ID, title, and description are required' },
        { status: 400 }
      );
    }

    // Check if person exists
    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: { id: true, firstName: true, lastName: true, isNotable: true },
    });

    if (!person) {
      return NextResponse.json(
        { success: false, error: 'Person not found' },
        { status: 404 }
      );
    }

    // Check if person is already notable
    if (person.isNotable) {
      return NextResponse.json(
        { success: false, error: 'This person is already marked as notable' },
        { status: 400 }
      );
    }

    // Check if there's already a pending nomination for this person
    const existingNomination = await prisma.notableNomination.findFirst({
      where: {
        personId,
        status: 'PENDING',
      },
    });

    if (existingNomination) {
      return NextResponse.json(
        { success: false, error: 'There is already a pending nomination for this person' },
        { status: 400 }
      );
    }

    // Create nomination
    const nomination = await prisma.notableNomination.create({
      data: {
        personId,
        nominatedById: user.id,
        title,
        description,
        achievements: achievements ? JSON.stringify(achievements) : null,
        images: imageUrls?.length ? {
          create: imageUrls.map((url: string, index: number) => ({
            url,
            displayOrder: index,
          })),
        } : undefined,
      },
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
          },
        },
        images: true,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: 'NOTABLE_NOMINATION',
        description: `${user.name || 'A user'} nominated ${person.firstName} ${person.lastName} as a notable family member`,
        userId: user.id,
        data: { nominationId: nomination.id, personId },
      },
    });

    // Notify admins about new nomination
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    await prisma.notification.createMany({
      data: admins.map((admin: { id: string }) => ({
        type: 'NOTABLE_NOMINATION_SUBMITTED' as const,
        title: 'New Notable Person Nomination',
        message: `${user.name || 'A user'} nominated ${person.firstName} ${person.lastName} as "${title}"`,
        userId: admin.id,
        data: { nominationId: nomination.id, personId },
      })),
    });

    return NextResponse.json({
      success: true,
      data: nomination,
      message: 'Nomination submitted successfully. It will be reviewed by an admin.',
    });
  } catch (error) {
    console.error('Error creating nomination:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create nomination' },
      { status: 500 }
    );
  }
}


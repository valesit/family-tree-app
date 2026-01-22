import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { personSchema } from '@/lib/validators';
import { SessionUser } from '@/types';
import { 
  isSystemAdmin, 
  isFamilyAdmin, 
  findPersonFamilyRoot,
  notifyVerifiedMembers,
  addUserToFamily
} from '@/lib/family-membership';

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

// POST /api/persons - Create a new person (direct creation with verification status)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const body = await request.json();
    const { approverIds, familyId, relatedPersonId, ...personData } = body;

    // Validate person data
    const validationResult = personSchema.safeParse(personData);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.issues[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    // Determine which family tree this person belongs to
    let targetFamilyId = familyId;
    if (!targetFamilyId && relatedPersonId) {
      // Find the family root from the related person
      targetFamilyId = await findPersonFamilyRoot(relatedPersonId);
    }

    // Check if user is System Admin or Family Admin
    const isSysAdmin = await isSystemAdmin(user.id);
    const isFamAdmin = targetFamilyId ? await isFamilyAdmin(user.id, targetFamilyId) : false;
    
    // Person is auto-verified if added by System Admin or Family Admin
    const shouldAutoVerify = isSysAdmin || isFamAdmin;

    // Create the person directly (no more pending approval for new persons)
    // New persons appear immediately with "Unverified" badge unless added by admin
    const person = await prisma.person.create({
      data: {
        ...validationResult.data,
        birthDate: validationResult.data.birthDate ? new Date(validationResult.data.birthDate) : null,
        deathDate: validationResult.data.deathDate ? new Date(validationResult.data.deathDate) : null,
        facts: validationResult.data.facts ? JSON.stringify(validationResult.data.facts) : null,
        createdById: user.id,
        addedById: user.id,
        isVerified: shouldAutoVerify,
        verifiedAt: shouldAutoVerify ? new Date() : null,
        verifiedById: shouldAutoVerify ? user.id : null,
      },
      include: {
        profileImage: true,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: 'PERSON_ADDED',
        description: `${person.firstName} ${person.lastName} was added to the family tree${!shouldAutoVerify ? ' (pending verification)' : ''}`,
        userId: user.id,
        data: { personId: person.id, familyId: targetFamilyId },
      },
    });

    // If not auto-verified and we have a family ID, notify verified members for approval
    if (!shouldAutoVerify && targetFamilyId) {
      await notifyVerifiedMembers(
        targetFamilyId,
        {
          type: 'NEW_PERSON_PENDING',
          title: 'New family member needs verification',
          message: `${person.firstName} ${person.lastName} was added to the family tree and needs verification.`,
          data: { personId: person.id, familyId: targetFamilyId },
        },
        user.id // Exclude the person who added them
      );
    }

    // If the user adding the person is not yet a member of this family, add them
    if (targetFamilyId) {
      const existingMembership = await prisma.familyMembership.findUnique({
        where: { userId_familyId: { userId: user.id, familyId: targetFamilyId } },
      });
      
      if (!existingMembership) {
        await addUserToFamily(user.id, targetFamilyId, 'MEMBER');
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: person,
      message: shouldAutoVerify 
        ? 'Person added successfully.' 
        : 'Person added with unverified status. Family members can verify this addition.',
    });
  } catch (error) {
    console.error('Error creating person:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create person' },
      { status: 500 }
    );
  }
}


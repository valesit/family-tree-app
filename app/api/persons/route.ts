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
  addUserToFamily,
} from '@/lib/family-membership';
import {
  ensureFamilyPersonAssociation,
  ensureMembershipStableReference,
} from '@/lib/stable-family';

// GET /api/persons - Get all persons or search (public - no auth required)
export async function GET(request: NextRequest) {
  try {
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
          parentRelations: {
            include: { parent: { include: { profileImage: true } } },
          },
          childRelations: {
            include: { child: { include: { profileImage: true } } },
          },
          // The add-person flow needs the actual spouse objects, not just the
          // relationship ids, so it can reliably offer/link the second parent.
          spouseRelations1: {
            include: {
              spouse1: { include: { profileImage: true } },
              spouse2: { include: { profileImage: true } },
            },
          },
          spouseRelations2: {
            include: {
              spouse1: { include: { profileImage: true } },
              spouse2: { include: { profileImage: true } },
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              phone: true,
              whatsappOptIn: true,
              role: true,
            },
          },
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
    const { approverIds: _unusedApprovers, familyId, relatedPersonId, ...personData } = body;
    void _unusedApprovers;

    const validationResult = personSchema.safeParse(personData);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.issues[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    let targetFamilyId: string | null = null;
    if (familyId) {
      targetFamilyId = (await findPersonFamilyRoot(familyId)) || familyId;
    } else if (relatedPersonId) {
      targetFamilyId = await findPersonFamilyRoot(relatedPersonId);
    }

    const isSysAdmin = await isSystemAdmin(user.id);
    const isFamAdmin = targetFamilyId ? await isFamilyAdmin(user.id, targetFamilyId) : false;
    const shouldAutoVerify = isSysAdmin || isFamAdmin;

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
      include: { profileImage: true },
    });

    // Phase-1 migration bridge: explicitly associate the new person with the
    // stable Family.id as soon as it is created. Before Phase 1 this is a no-op.
    if (targetFamilyId) {
      await ensureFamilyPersonAssociation(targetFamilyId, person.id);
    }

    await prisma.activity.create({
      data: {
        type: 'PERSON_ADDED',
        description: `${person.firstName} ${person.lastName} was added to the family tree${!shouldAutoVerify ? ' (pending verification)' : ''}`,
        userId: user.id,
        data: { personId: person.id, familyId: targetFamilyId },
      },
    });

    if (!shouldAutoVerify && targetFamilyId) {
      await notifyVerifiedMembers(
        targetFamilyId,
        {
          type: 'NEW_PERSON_PENDING',
          title: 'New family member needs verification',
          message: `${person.firstName} ${person.lastName} was added to the family tree and needs verification.`,
          data: { personId: person.id, familyId: targetFamilyId },
        },
        user.id
      );
    }

    if (targetFamilyId) {
      await addUserToFamily(user.id, targetFamilyId, 'MEMBER');
      // Keep the existing root-based membership column populated during the
      // zero-downtime migration while also writing the stable Family.id.
      await ensureMembershipStableReference(user.id, targetFamilyId);
    }

    return NextResponse.json({
      success: true,
      data: person,
      familyRootId: targetFamilyId,
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

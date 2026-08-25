import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { relationshipSchema } from '@/lib/validators';
import { SessionUser } from '@/types';
import {
  addUserToFamily,
  findPersonFamilyRoot,
  isFamilyAdmin,
  isSystemAdmin,
  reconcileConnectedFamilies,
} from '@/lib/family-membership';

const PARENT_TYPES = ['PARENT_CHILD', 'ADOPTED', 'STEP_PARENT', 'STEP_CHILD', 'FOSTER'] as const;

// GET /api/relationships - Get all relationships (public - no auth required)
export async function GET(request: NextRequest) {
  try {
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
    const { approverIds: _unusedApprovers, ...relationshipData } = body;
    void _unusedApprovers;

    const validationResult = relationshipSchema.safeParse(relationshipData);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.issues[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    const { type, person1Id, person2Id, startDate, endDate, notes } = validationResult.data;

    if (person1Id === person2Id) {
      return NextResponse.json(
        { success: false, error: 'A person cannot be related to themselves' },
        { status: 400 }
      );
    }

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

    const familyBefore =
      (await findPersonFamilyRoot(person1Id)) ||
      (await findPersonFamilyRoot(person2Id));

    const isSysAdmin = await isSystemAdmin(user.id);
    const isFamAdmin = familyBefore ? await isFamilyAdmin(user.id, familyBefore) : false;

    // Contributions are idempotent. Double taps, retries, and the UI's
    // co-parent mirroring must never create duplicate relationship rows.
    const existing = type === 'SPOUSE'
      ? await prisma.relationship.findFirst({
          where: {
            type: 'SPOUSE',
            OR: [
              { spouse1Id: person1Id, spouse2Id: person2Id },
              { spouse1Id: person2Id, spouse2Id: person1Id },
            ],
          },
          include: { parent: true, child: true, spouse1: true, spouse2: true },
        })
      : PARENT_TYPES.includes(type as (typeof PARENT_TYPES)[number])
      ? await prisma.relationship.findFirst({
          where: {
            type,
            parentId: person1Id,
            childId: person2Id,
          },
          include: { parent: true, child: true, spouse1: true, spouse2: true },
        })
      : null;

    if (existing) {
      const canonicalRoot =
        (await reconcileConnectedFamilies(person1Id)) ||
        (await findPersonFamilyRoot(person1Id)) ||
        familyBefore;

      return NextResponse.json({
        success: true,
        data: existing,
        familyRootId: canonicalRoot,
        deduplicated: true,
        message: 'Relationship already exists.',
      });
    }

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

    if (PARENT_TYPES.includes(type as (typeof PARENT_TYPES)[number])) {
      relationshipCreateData.parentId = person1Id;
      relationshipCreateData.childId = person2Id;
    } else if (type === 'SPOUSE') {
      relationshipCreateData.spouse1Id = person1Id;
      relationshipCreateData.spouse2Id = person2Id;
    }

    const relationship = await prisma.relationship.create({
      data: relationshipCreateData,
      include: {
        parent: true,
        child: true,
        spouse1: true,
        spouse2: true,
      },
    });

    // Relationship creation can connect two branches that previously had stale
    // Family records. Collapse them immediately so every contributor sees the
    // same canonical tree on their next fetch.
    const canonicalRoot =
      (await reconcileConnectedFamilies(person1Id)) ||
      (await reconcileConnectedFamilies(person2Id)) ||
      (await findPersonFamilyRoot(person1Id)) ||
      (await findPersonFamilyRoot(person2Id)) ||
      familyBefore;

    // Root changes are deliberately manual. Adding an older parent expands the
    // existing family but does not silently replace the root selected in the UI.

    // If either person has a linked account, make sure that account belongs to
    // the newly canonical family after a branch/spouse merge.
    if (canonicalRoot) {
      if (person1.userId) {
        await addUserToFamily(person1.userId, canonicalRoot, 'MEMBER');
      }
      if (person2.userId) {
        await addUserToFamily(person2.userId, canonicalRoot, 'MEMBER');
      }
    }

    await prisma.activity.create({
      data: {
        type: 'RELATIONSHIP_ADDED',
        description: `A ${type.toLowerCase().replace('_', '-')} relationship was added between ${person1.firstName} and ${person2.firstName}${!isSysAdmin && !isFamAdmin ? ' (persons may need verification)' : ''}`,
        userId: user.id,
        data: {
          relationshipId: relationship.id,
          familyId: canonicalRoot || familyBefore,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: relationship,
      familyRootId: canonicalRoot,
      message: 'Relationship added successfully.',
    });
  } catch (error) {
    console.error('Error creating relationship:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create relationship' },
      { status: 500 }
    );
  }
}

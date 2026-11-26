import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { activeRelationshipWhere } from '@/lib/person-archive';
import { authOptions } from '@/lib/auth';
import { relationshipSchema } from '@/lib/validators';
import { SessionUser } from '@/types';
import {
  addUserToFamily,
  findPersonFamilyRoot,
  reconcileConnectedFamilies,
} from '@/lib/family-membership';
import {
  ensureFamilyPersonAssociation,
  ensureFamilyRelationshipAssociation,
  ensureMembershipStableReference,
} from '@/lib/stable-family';

import { wouldCreateAncestryCycle } from '@/lib/relationship-safety';
class RelationshipConflict extends Error {}

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
      where: { AND: [where, activeRelationshipWhere] },
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
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    if (user.role === 'VIEWER') return NextResponse.json({ success: false, error: 'Read-only account' }, { status: 403 });
    const account = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
    if (!account || account.role === 'VIEWER') return NextResponse.json({ success: false, error: 'Contributor access required' }, { status: 403 });
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
      prisma.person.findUnique({ where: { id: person1Id, deletedAt: null } }),
      prisma.person.findUnique({ where: { id: person2Id, deletedAt: null } }),
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

      if (canonicalRoot) {
        await Promise.all([
          ensureFamilyPersonAssociation(canonicalRoot, person1Id),
          ensureFamilyPersonAssociation(canonicalRoot, person2Id),
          ensureFamilyRelationshipAssociation(canonicalRoot, existing.id),
        ]);
      }

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

    const relationship = await prisma.$transaction(async tx => {
      // Serialize validation and insertion so concurrent requests cannot bypass
      // duplicate/cycle checks. Archived edges also matter because restoration
      // must not introduce a cycle later.
      const endpoints = await tx.person.count({ where: { id: { in: [person1Id, person2Id] }, deletedAt: null } });
      if (endpoints !== 2) throw new RelationshipConflict('One or both profiles are no longer active');
      const edges = await tx.relationship.findMany({ select: { id: true, type: true, parentId: true, childId: true, spouse1Id: true, spouse2Id: true } });
      const duplicate = edges.find(r => type === 'SPOUSE' ? r.type === 'SPOUSE' && ((r.spouse1Id === person1Id && r.spouse2Id === person2Id) || (r.spouse2Id === person1Id && r.spouse1Id === person2Id)) : r.type === type && r.parentId === person1Id && r.childId === person2Id);
      if (duplicate) throw new RelationshipConflict('Relationship already exists. Refresh the tree.');
      if (PARENT_TYPES.includes(type as (typeof PARENT_TYPES)[number]) && wouldCreateAncestryCycle(person1Id, person2Id, edges)) throw new RelationshipConflict('This relationship would create circular ancestry.');
      return tx.relationship.create({ data: relationshipCreateData, include: { parent: true, child: true, spouse1: true, spouse2: true } });
    }, { isolationLevel: 'Serializable' });

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

    if (canonicalRoot) {
      // Phase-1 migration bridge: every new relationship is explicitly attached
      // to the stable Family.id, and both endpoints are registered as FamilyPerson
      // members. Before Phase 1 these helpers intentionally no-op.
      await Promise.all([
        ensureFamilyPersonAssociation(canonicalRoot, person1Id),
        ensureFamilyPersonAssociation(canonicalRoot, person2Id),
        ensureFamilyRelationshipAssociation(canonicalRoot, relationship.id),
      ]);

      // If either person has a linked account, make sure that account belongs to
      // the newly canonical family after a branch/spouse merge and dual-write the
      // stable Family.id alongside the legacy root id.
      if (person1.userId) {
        await addUserToFamily(person1.userId, canonicalRoot, 'MEMBER');
        await ensureMembershipStableReference(person1.userId, canonicalRoot);
      }
      if (person2.userId) {
        await addUserToFamily(person2.userId, canonicalRoot, 'MEMBER');
        await ensureMembershipStableReference(person2.userId, canonicalRoot);
      }
    }

    await prisma.activity.create({
      data: {
        type: 'RELATIONSHIP_ADDED',
        description: `A ${type.toLowerCase().replace('_', '-')} relationship was added between ${person1.firstName} and ${person2.firstName}`,
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
    if (error instanceof RelationshipConflict) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    console.error('Error creating relationship:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create relationship' },
      { status: 500 }
    );
  }
}

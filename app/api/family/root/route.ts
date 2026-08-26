import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import {
  findPersonFamilyRoot,
  isFamilyAdmin,
  isSystemAdmin,
  reassignFamilyRoot,
} from '@/lib/family-membership';
import {
  ensureFamilyPersonAssociation,
  upsertTransitionalMembership,
} from '@/lib/stable-family';

// PATCH /api/family/root
// Body: { personId: string }
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user as SessionUser;

    const body = await request.json().catch(() => ({}));
    const personId = typeof body.personId === 'string' ? body.personId : '';
    if (!personId) {
      return NextResponse.json({ success: false, error: 'personId is required' }, { status: 400 });
    }

    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!person) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    const currentRoot = await findPersonFamilyRoot(personId);

    if (!currentRoot) {
      const sysAdmin = await isSystemAdmin(user.id);
      if (!sysAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: 'Only System Admins can create a new family tree root when no Family record exists.',
          },
          { status: 403 }
        );
      }

      const spouseRel = await prisma.relationship.findFirst({
        where: {
          type: 'SPOUSE',
          OR: [{ spouse1Id: personId }, { spouse2Id: personId }],
        },
        select: { spouse1Id: true, spouse2Id: true },
      });
      let derivedName = person.lastName;
      if (spouseRel) {
        const spouseId =
          spouseRel.spouse1Id === personId ? spouseRel.spouse2Id : spouseRel.spouse1Id;
        if (spouseId) {
          const spouse = await prisma.person.findUnique({
            where: { id: spouseId },
            select: { lastName: true },
          });
          if (spouse?.lastName && spouse.lastName !== person.lastName) {
            derivedName = `${person.lastName}/${spouse.lastName}`;
          }
        }
      }

      const family = await prisma.family.upsert({
        where: { rootPersonId: personId },
        create: {
          rootPersonId: personId,
          name: derivedName,
          description: null,
          motto: null,
          crestImage: null,
          createdById: user.id,
        },
        update: {},
      });

      // The permanent Family.id is authoritative for membership/person scope.
      // These helpers are no-ops before the additive Phase-1 migration.
      await ensureFamilyPersonAssociation(family.id, personId);
      await upsertTransitionalMembership(user.id, family.id, 'ADMIN');

      await prisma.activity.create({
        data: {
          type: 'PERSON_UPDATED',
          description: `${derivedName} was set as the root ancestor of the family tree`,
          userId: user.id,
          data: { familyId: family.id, newRootPersonId: personId },
        },
      });

      return NextResponse.json({
        success: true,
        data: { familyId: family.id, rootPersonId: personId, previousRootPersonId: null },
        message: `${person.firstName} ${person.lastName} is now the family root.`,
      });
    }

    const sysAdmin = await isSystemAdmin(user.id);
    const famAdmin = sysAdmin ? true : await isFamilyAdmin(user.id, currentRoot);
    if (!sysAdmin && !famAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only System Admins or Family Admins can reassign the family root' },
        { status: 403 }
      );
    }

    if (currentRoot === personId) {
      const family = await prisma.family.findUnique({ where: { rootPersonId: currentRoot } });
      if (family) await ensureFamilyPersonAssociation(family.id, personId);
      return NextResponse.json({
        success: true,
        data: { familyId: family?.id ?? null, rootPersonId: currentRoot },
        message: `${person.firstName} ${person.lastName} is already the family root.`,
      });
    }

    const familyBefore = await prisma.family.findUnique({ where: { rootPersonId: currentRoot } });
    await reassignFamilyRoot(currentRoot, personId);
    if (familyBefore) await ensureFamilyPersonAssociation(familyBefore.id, personId);

    await prisma.activity.create({
      data: {
        type: 'PERSON_UPDATED',
        description: `Family root reassigned to ${person.firstName} ${person.lastName} by admin.`,
        userId: user.id,
        data: {
          familyId: familyBefore?.id ?? null,
          newRootPersonId: personId,
          previousRootPersonId: currentRoot,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        familyId: familyBefore?.id ?? null,
        rootPersonId: personId,
        previousRootPersonId: currentRoot,
      },
      message: `${person.firstName} ${person.lastName} is now the family root.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reassign family root';
    console.error('PATCH /api/family/root', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

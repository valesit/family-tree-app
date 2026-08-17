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

// PATCH /api/family/root
//
// Body: { personId: string }
//
// Reassigns the root of the family tree containing `personId` to that person.
// Only System Admins or Family Admins of the affected tree may call this.
//
// Use cases:
//   - The auto-promotion didn't kick in (e.g. data was imported), and an
//     admin wants to fix the canonical ancestor.
//   - An admin wants to deliberately re-anchor the tree to a different
//     known ancestor.
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
      return NextResponse.json(
        { success: false, error: 'personId is required' },
        { status: 400 }
      );
    }

    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!person) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    const currentRoot = await findPersonFamilyRoot(personId);

    // Case 1: No Family record exists yet for this person's tree.
    // Create one anchored at `personId`. Only System Admins can do this,
    // since there's no existing FamilyMembership to derive family-admin
    // scope from.
    if (!currentRoot) {
      const sysAdmin = await isSystemAdmin(user.id);
      if (!sysAdmin) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Only System Admins can create a new family tree root when no Family record exists.',
          },
          { status: 403 }
        );
      }

      // Derive family name: lastName, or lastName/spouseLastName if the
      // person has a current spouse with a different last name. Mirrors
      // the fallback naming convention used by GET /api/tree.
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
          if (spouse && spouse.lastName && spouse.lastName !== person.lastName) {
            derivedName = `${person.lastName}/${spouse.lastName}`;
          }
        }
      }

      // Idempotent create: if two callers race, the second falls through
      // to the "already the root" fast-path below on the next request.
      await prisma.family.upsert({
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

      await prisma.activity.create({
        data: {
          type: 'PERSON_UPDATED',
          description: `${derivedName} was set as the root ancestor of the family tree`,
          userId: user.id,
          data: {
            newRootPersonId: personId,
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: { rootPersonId: personId, previousRootPersonId: null },
        message: `${person.firstName} ${person.lastName} is now the family root.`,
      });
    }

    // Case 2: A Family record already exists. Reassignment path — require
    // System Admin or Family Admin of THIS tree.
    const sysAdmin = await isSystemAdmin(user.id);
    const famAdmin = sysAdmin ? true : await isFamilyAdmin(user.id, currentRoot);
    if (!sysAdmin && !famAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only System Admins or Family Admins can reassign the family root' },
        { status: 403 }
      );
    }

    if (currentRoot === personId) {
      return NextResponse.json({
        success: true,
        data: { rootPersonId: currentRoot },
        message: `${person.firstName} ${person.lastName} is already the family root.`,
      });
    }

    await reassignFamilyRoot(currentRoot, personId);

    await prisma.activity.create({
      data: {
        type: 'PERSON_UPDATED',
        description: `Family root reassigned to ${person.firstName} ${person.lastName} by admin.`,
        userId: user.id,
        data: {
          newRootPersonId: personId,
          previousRootPersonId: currentRoot,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { rootPersonId: personId, previousRootPersonId: currentRoot },
      message: `${person.firstName} ${person.lastName} is now the family root.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to reassign family root';
    console.error('PATCH /api/family/root', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

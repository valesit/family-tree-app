import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import {
  findPersonFamilyRoot,
  getUserDefaultFamily,
  reconcileConnectedFamilies,
} from '@/lib/family-membership';

// GET /api/user/families - Get the current user's families
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = session.user as SessionUser;

    // Repair legacy duplicate family roots before deciding which tree this user
    // should see. This moves memberships from stale spouse-rooted Family rows
    // onto the single canonical Family record.
    const membershipRoots = await prisma.familyMembership.findMany({
      where: { userId: user.id },
      select: { familyId: true },
    });
    for (const membership of membershipRoots) {
      try {
        await reconcileConnectedFamilies(membership.familyId);
      } catch (error) {
        console.error('Failed to reconcile family membership', membership.familyId, error);
      }
    }

    if (user.linkedPersonId) {
      try {
        await reconcileConnectedFamilies(user.linkedPersonId);
      } catch (error) {
        console.error('Failed to reconcile linked-person family', error);
      }
    }

    // Refetch after reconciliation because family ids may have changed.
    const memberships = await prisma.familyMembership.findMany({
      where: { userId: user.id },
      include: { family: true },
      orderBy: { joinedAt: 'asc' },
    });

    let linkedPersonFamily: string | null = null;
    if (user.linkedPersonId) {
      linkedPersonFamily = await findPersonFamilyRoot(user.linkedPersonId);
    }

    let defaultFamilyId = await getUserDefaultFamily(user.id);
    if (!defaultFamilyId) {
      const allRels = await prisma.relationship.findMany({
        where: { type: 'PARENT_CHILD' },
        select: { parentId: true, childId: true },
      });
      const childIdSet = new Set(allRels.map((rel) => rel.childId).filter(Boolean) as string[]);
      const childCountMap = new Map<string, number>();
      for (const rel of allRels) {
        if (rel.parentId) {
          childCountMap.set(rel.parentId, (childCountMap.get(rel.parentId) ?? 0) + 1);
        }
      }
      const allPersons = await prisma.person.findMany({ select: { id: true, birthDate: true } });
      const roots = allPersons
        .filter((person) => !childIdSet.has(person.id))
        .sort((a, b) => {
          const aChildren = childCountMap.get(a.id) ?? 0;
          const bChildren = childCountMap.get(b.id) ?? 0;
          if (bChildren !== aChildren) return bChildren - aChildren;
          if (!a.birthDate) return 1;
          if (!b.birthDate) return -1;
          return a.birthDate.getTime() - b.birthDate.getTime();
        });
      defaultFamilyId = roots[0]?.id ?? null;
    }

    const families = await Promise.all(
      memberships.map(async (membership) => {
        const rootId = membership.family.rootPersonId;
        const rootPerson = await prisma.person.findUnique({
          where: { id: rootId },
          include: { profileImage: true },
        });

        return {
          id: rootId,
          name: membership.family.name,
          role: membership.role,
          joinedAt: membership.joinedAt,
          rootPerson: rootPerson
            ? {
                id: rootPerson.id,
                firstName: rootPerson.firstName,
                lastName: rootPerson.lastName,
                profileImage: rootPerson.profileImage?.url || null,
              }
            : null,
        };
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          families,
          defaultFamilyId,
          linkedPersonFamily,
        },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('Error fetching user families:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch families' },
      { status: 500 }
    );
  }
}

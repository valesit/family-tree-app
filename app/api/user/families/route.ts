import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import { getUserDefaultFamily, findPersonFamilyRoot } from '@/lib/family-membership';

// GET /api/user/families - Get the current user's families
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = session.user as SessionUser;

    // Get user's family memberships
    const memberships = await prisma.familyMembership.findMany({
      where: { userId: user.id },
      include: {
        family: true,
      },
      orderBy: { joinedAt: 'asc' },
    });

    // Get linked person's family if not already in memberships
    let linkedPersonFamily: string | null = null;
    if (user.linkedPersonId) {
      linkedPersonFamily = await findPersonFamilyRoot(user.linkedPersonId);
    }

    // Determine default family. If no explicit family membership exists (stale Family
    // records or fresh install), fall back to the topmost connected root in the tree.
    let defaultFamilyId = await getUserDefaultFamily(user.id);
    if (!defaultFamilyId) {
      // Find the root of the largest real connected family via the same logic as /api/tree
      const allRels = await prisma.relationship.findMany({
        where: { type: 'PARENT_CHILD' },
        select: { parentId: true, childId: true },
      });
      const childIdSet = new Set(allRels.map(r => r.childId).filter(Boolean) as string[]);
      const childCountMap = new Map<string, number>();
      for (const r of allRels) {
        if (r.parentId) childCountMap.set(r.parentId, (childCountMap.get(r.parentId) ?? 0) + 1);
      }
      const allPersons = await prisma.person.findMany({ select: { id: true, birthDate: true } });
      const roots = allPersons
        .filter(p => !childIdSet.has(p.id))
        .sort((a, b) => {
          const ac = childCountMap.get(a.id) ?? 0;
          const bc = childCountMap.get(b.id) ?? 0;
          if (bc !== ac) return bc - ac;
          if (!a.birthDate) return 1;
          if (!b.birthDate) return -1;
          return a.birthDate.getTime() - b.birthDate.getTime();
        });
      defaultFamilyId = roots[0]?.id ?? null;
    }

    // Get family names for each membership
    const families = await Promise.all(
      memberships.map(async (m) => {
        const rootPerson = await prisma.person.findFirst({
          where: {
            // Find the person with this id (rootPersonId)
            id: m.familyId,
          },
          include: { profileImage: true },
        });

        return {
          id: m.familyId,
          name: m.family.name,
          role: m.role,
          joinedAt: m.joinedAt,
          rootPerson: rootPerson ? {
            id: rootPerson.id,
            firstName: rootPerson.firstName,
            lastName: rootPerson.lastName,
            profileImage: rootPerson.profileImage?.url || null,
          } : null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        families,
        defaultFamilyId,
        linkedPersonFamily,
      },
    });
  } catch (error) {
    console.error('Error fetching user families:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch families' },
      { status: 500 }
    );
  }
}

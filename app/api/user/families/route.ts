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

    // Determine default family
    const defaultFamilyId = await getUserDefaultFamily(user.id);

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

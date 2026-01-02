import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser, RelativeSuggestion } from '@/types';

// Helper function to calculate relationship label based on distance
function getRelationshipLabel(distance: number, path: string[]): string {
  if (distance === 1) {
    if (path.includes('parent')) return 'Parent';
    if (path.includes('child')) return 'Child';
    if (path.includes('spouse')) return 'Spouse';
    return 'Immediate Family';
  }
  if (distance === 2) {
    if (path.filter((p: string) => p === 'parent').length === 2) return 'Grandparent';
    if (path.filter((p: string) => p === 'child').length === 2) return 'Grandchild';
    if (path.includes('parent') && path.includes('child')) return 'Sibling';
    return 'Close Family';
  }
  if (distance === 3) {
    if (path.filter((p: string) => p === 'parent').length === 3) return 'Great-Grandparent';
    if (path.filter((p: string) => p === 'child').length === 3) return 'Great-Grandchild';
    // Aunt/Uncle: parent's sibling
    if (path.includes('parent') && path.filter((p: string) => p === 'parent').length === 2 && path.includes('child')) {
      return 'Aunt/Uncle';
    }
    // Niece/Nephew: sibling's child
    if (path.includes('child') && path.filter((p: string) => p === 'child').length === 2 && path.includes('parent')) {
      return 'Niece/Nephew';
    }
    return 'Extended Family';
  }
  if (distance === 4) {
    // First cousin: parent's sibling's child
    const parentCount = path.filter((p: string) => p === 'parent').length;
    const childCount = path.filter((p: string) => p === 'child').length;
    if (parentCount === 2 && childCount === 2) return '1st Cousin';
    if (parentCount === 3 && childCount === 1) return 'Great-Aunt/Uncle';
    if (parentCount === 1 && childCount === 3) return 'Grand-Niece/Nephew';
    return 'Extended Family';
  }
  if (distance === 5) {
    return '1st Cousin Once Removed';
  }
  if (distance === 6) {
    return '2nd Cousin';
  }
  return `${Math.floor(distance / 2)}${getOrdinalSuffix(Math.floor(distance / 2))} Cousin`;
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// BFS to find all relatives within a certain distance
async function findRelatives(
  startPersonId: string,
  maxDistance: number = 6
): Promise<Map<string, { distance: number; path: string[] }>> {
  const visited = new Map<string, { distance: number; path: string[] }>();
  const queue: { personId: string; distance: number; path: string[] }[] = [
    { personId: startPersonId, distance: 0, path: [] }
  ];

  while (queue.length > 0) {
    const { personId, distance, path } = queue.shift()!;
    
    if (visited.has(personId) || distance > maxDistance) continue;
    visited.set(personId, { distance, path });

    // Get all relationships for this person
    const relationships = await prisma.relationship.findMany({
      where: {
        OR: [
          { parentId: personId },
          { childId: personId },
          { spouse1Id: personId },
          { spouse2Id: personId },
        ],
      },
    });

    for (const rel of relationships) {
      // Parent relationship (person is the child)
      if (rel.childId === personId && rel.parentId) {
        queue.push({
          personId: rel.parentId,
          distance: distance + 1,
          path: [...path, 'parent'],
        });
      }
      // Child relationship (person is the parent)
      if (rel.parentId === personId && rel.childId) {
        queue.push({
          personId: rel.childId,
          distance: distance + 1,
          path: [...path, 'child'],
        });
      }
      // Spouse relationships
      if (rel.spouse1Id === personId && rel.spouse2Id) {
        queue.push({
          personId: rel.spouse2Id,
          distance: distance + 1,
          path: [...path, 'spouse'],
        });
      }
      if (rel.spouse2Id === personId && rel.spouse1Id) {
        queue.push({
          personId: rel.spouse1Id,
          distance: distance + 1,
          path: [...path, 'spouse'],
        });
      }
    }
  }

  return visited;
}

// GET /api/relatives - Get suggested relatives to connect with
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = session.user as SessionUser;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const minDistance = parseInt(searchParams.get('minDistance') || '3');
    const maxDistance = parseInt(searchParams.get('maxDistance') || '6');

    // Get user's linked person
    const userPerson = await prisma.user.findUnique({
      where: { id: user.id },
      select: { linkedPerson: { select: { id: true } } },
    });

    if (!userPerson?.linkedPerson) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'Link your profile to a family member to see relative suggestions',
      });
    }

    // Get all users the current user has messaged
    const existingConversations = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: user.id },
          { receiverId: user.id },
        ],
      },
      select: {
        senderId: true,
        receiverId: true,
      },
    });

    const contactedUserIds = new Set<string>();
    existingConversations.forEach((msg: { senderId: string; receiverId: string | null }) => {
      if (msg.senderId !== user.id) contactedUserIds.add(msg.senderId);
      if (msg.receiverId && msg.receiverId !== user.id) contactedUserIds.add(msg.receiverId);
    });

    // Find all relatives
    const relativesMap = await findRelatives(userPerson.linkedPerson.id, maxDistance);

    // Get person details for relatives
    const relativeIds = Array.from(relativesMap.keys()).filter((id: string) => {
      const rel = relativesMap.get(id)!;
      return rel.distance >= minDistance && rel.distance <= maxDistance;
    });

    if (relativeIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No distant relatives found',
      });
    }

    const persons = await prisma.person.findMany({
      where: {
        id: { in: relativeIds },
      },
      include: {
        profileImage: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Filter and format suggestions
    type PersonType = typeof persons[number];
    const suggestions: RelativeSuggestion[] = persons
      .filter((person: PersonType) => {
        // Exclude if user has already contacted this person
        if (person.user && contactedUserIds.has(person.user.id)) return false;
        return true;
      })
      .map((person: PersonType) => {
        const relInfo = relativesMap.get(person.id)!;
        return {
          person: {
            ...person,
            profileImage: person.profileImage,
          },
          user: person.user || null,
          relationshipPath: getRelationshipLabel(relInfo.distance, relInfo.path),
          distance: relInfo.distance,
          hasAccount: !!person.user,
        };
      })
      .sort((a: RelativeSuggestion, b: RelativeSuggestion) => {
        // Prioritize those with accounts, then by distance
        if (a.hasAccount !== b.hasAccount) return a.hasAccount ? -1 : 1;
        return a.distance - b.distance;
      })
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error('Error fetching relative suggestions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch relative suggestions' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { buildFamilyTree, calculateTreeStats } from '@/lib/tree-utils';

// GET /api/tree - Get the family tree data (public - no auth required)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // Support both rootPersonId and rootId parameters
    const rootPersonId = searchParams.get('rootPersonId') || searchParams.get('rootId');
    const direction = (searchParams.get('direction') || 'both') as 'ancestors' | 'descendants' | 'both';
    const maxDepth = parseInt(searchParams.get('maxDepth') || '10');

    // Get all persons and relationships
    const [persons, relationships] = await Promise.all([
      prisma.person.findMany({
        include: {
          profileImage: true,
        },
      }),
      prisma.relationship.findMany(),
    ]);

    if (persons.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          tree: null,
          stats: null,
          familyName: null,
          foundingAncestor: null,
        },
      });
    }

    // Determine root person
    let rootId = rootPersonId;
    if (!rootId) {
      // Find the oldest person with no parents as root
      const childIds = new Set(
        relationships
          .filter((r: { type: string }) => r.type === 'PARENT_CHILD')
          .map((r: { childId: string | null }) => r.childId)
          .filter(Boolean)
      );

      // Find people who are not children of anyone (root ancestors)
      const potentialRoots = persons.filter((p: { id: string }) => !childIds.has(p.id));
      
      if (potentialRoots.length > 0) {
        // Sort by birth date (oldest first) or just take first one
        const sorted = potentialRoots.sort((a: (typeof potentialRoots)[number], b: (typeof potentialRoots)[number]) => {
          if (!a.birthDate) return 1;
          if (!b.birthDate) return -1;
          return a.birthDate.getTime() - b.birthDate.getTime();
        });
        rootId = sorted[0].id;
      } else {
        // Fall back to first person
        rootId = persons[0].id;
      }
    }

    // Get the root person details
    const rootPerson = persons.find((p: { id: string }) => p.id === rootId);
    if (!rootPerson) {
      return NextResponse.json(
        { success: false, error: 'Root person not found' },
        { status: 404 }
      );
    }

    // Check for custom family name first
    const familySettings = await prisma.family.findUnique({
      where: { rootPersonId: rootId },
    });

    let familyName = familySettings?.name || null;

    // If no custom name, generate from surnames
    if (!familyName) {
      const spouseRelation = relationships.find(
        (r: { type: string; spouse1Id: string | null; spouse2Id: string | null }) =>
          r.type === 'SPOUSE' && (r.spouse1Id === rootId || r.spouse2Id === rootId)
      );
      familyName = rootPerson.lastName;
      if (spouseRelation) {
        const spouseId = spouseRelation.spouse1Id === rootId ? spouseRelation.spouse2Id : spouseRelation.spouse1Id;
        const spouse = persons.find((p: { id: string }) => p.id === spouseId);
        if (spouse && spouse.lastName !== rootPerson.lastName) {
          familyName = `${rootPerson.lastName}/${spouse.lastName}`;
        }
      }
    }

    // Build the tree
    const tree = buildFamilyTree(rootId, persons, relationships, direction, maxDepth);
    const stats = calculateTreeStats(persons, relationships);

    return NextResponse.json({
      success: true,
      data: {
        tree,
        stats,
        rootPersonId: rootId,
        familyName,
        foundingAncestor: {
          id: rootPerson.id,
          firstName: rootPerson.firstName,
          lastName: rootPerson.lastName,
          profileImage: rootPerson.profileImage?.url || null,
          birthYear: rootPerson.birthDate ? new Date(rootPerson.birthDate).getFullYear() : null,
          birthPlace: rootPerson.birthPlace,
          biography: rootPerson.biography,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching tree:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch family tree' },
      { status: 500 }
    );
  }
}

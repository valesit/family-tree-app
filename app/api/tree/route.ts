import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { buildFamilyTree, calculateTreeStats } from '@/lib/tree-utils';

// GET /api/tree - Get the family tree data (public - no auth required)
export async function GET(request: NextRequest) {
  try {
    // Tree viewing is public - no authentication required

    const { searchParams } = new URL(request.url);
    const rootPersonId = searchParams.get('rootPersonId');
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
        },
      });
    }

    // Determine root person
    let rootId = rootPersonId;
    if (!rootId) {
      // Find the oldest person with no parents as root
      const personIds = new Set(persons.map(p => p.id));
      const childIds = new Set(
        relationships
          .filter(r => r.type === 'PARENT_CHILD')
          .map(r => r.childId)
          .filter(Boolean)
      );

      // Find people who are not children of anyone (root ancestors)
      const potentialRoots = persons.filter(p => !childIds.has(p.id));
      
      if (potentialRoots.length > 0) {
        // Sort by birth date (oldest first) or just take first one
        const sorted = potentialRoots.sort((a, b) => {
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

    // Build the tree
    const tree = buildFamilyTree(rootId, persons, relationships, direction, maxDepth);
    const stats = calculateTreeStats(persons, relationships);

    return NextResponse.json({
      success: true,
      data: {
        tree,
        stats,
        rootPersonId: rootId,
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


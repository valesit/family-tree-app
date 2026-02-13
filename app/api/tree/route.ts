import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { buildFamilyTree, calculateTreeStats, collectTreeNodeIds } from '@/lib/tree-utils';
import type { Relationship, Person } from '@prisma/client';

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

    // Build a quick parentId→childId lookup for walking up the tree
    const childToParents = new Map<string, string[]>();
    for (const r of relationships) {
      if (r.type === 'PARENT_CHILD' && r.childId && r.parentId) {
        const list = childToParents.get(r.childId) || [];
        list.push(r.parentId);
        childToParents.set(r.childId, list);
      }
    }

    // Walk up from a given person to find the topmost ancestor in this tree
    function findTopmostAncestor(startId: string): string {
      const visited = new Set<string>();
      let current = startId;
      while (true) {
        visited.add(current);
        const parents = childToParents.get(current);
        if (!parents || parents.length === 0) break;
        // Pick the first parent that hasn't been visited (avoid cycles)
        const next = parents.find((p) => !visited.has(p));
        if (!next) break;
        current = next;
      }
      return current;
    }

    // Determine root person
    let rootId: string | null = rootPersonId;
    if (rootId) {
      // Even if a rootId was given, walk up to the topmost ancestor so the tree
      // always renders from the very top (e.g. after adding a parent above current root)
      rootId = findTopmostAncestor(rootId);
    } else {
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

    // At this point we should always have a rootId, but guard to satisfy strict TS
    if (!rootId) {
      return NextResponse.json(
        { success: false, error: 'Unable to determine root person' },
        { status: 400 }
      );
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
    // Scope stats to ONLY the people in this specific tree, not the entire database.
    const treeIds = collectTreeNodeIds(tree);
    const scopedPersons = persons.filter((p: Person) => treeIds.has(p.id));
    const scopedRelationships = relationships.filter((r: Relationship) => {
      if (r.type === 'PARENT_CHILD') {
        return !!r.parentId && !!r.childId && treeIds.has(r.parentId) && treeIds.has(r.childId);
      }
      if (r.type === 'SPOUSE') {
        return (
          !!r.spouse1Id &&
          !!r.spouse2Id &&
          treeIds.has(r.spouse1Id) &&
          treeIds.has(r.spouse2Id)
        );
      }
      return false;
    });
    const stats = tree ? calculateTreeStats(scopedPersons, scopedRelationships) : null;

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

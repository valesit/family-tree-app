import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { buildFamilyTree, calculateTreeStats, collectTreeNodeIds } from '@/lib/tree-utils';
import { findPersonFamilyRoot } from '@/lib/family-membership';
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

    // Build a quick parentId→childId lookup for walking up the tree when no
    // explicit Family root has been persisted yet.
    const childToParents = new Map<string, string[]>();
    for (const r of relationships) {
      if (r.type === 'PARENT_CHILD' && r.childId && r.parentId) {
        const list = childToParents.get(r.childId) || [];
        list.push(r.parentId);
        childToParents.set(r.childId, list);
      }
    }

    function findTopmostAncestor(startId: string): string {
      const visited = new Set<string>();
      let current = startId;
      while (true) {
        visited.add(current);
        const parents = childToParents.get(current);
        if (!parents || parents.length === 0) break;
        const next = parents.find((p) => !visited.has(p));
        if (!next) break;
        current = next;
      }
      return current;
    }

    // Determine root person.
    //
    // Important: a persisted Family.rootPersonId is authoritative. Previously,
    // even when the UI supplied a stored/manual root, this endpoint always
    // walked farther up to the topmost biological ancestor. That made the
    // "Set as Family Root" action appear to work in the database while the
    // rendered tree immediately ignored it. We now resolve the supplied person
    // back to its stored family root first and only auto-walk when no Family
    // record exists yet.
    let rootId: string | null = rootPersonId;
    let didAutoDetectRoot = false;

    if (rootId) {
      const storedRoot = await findPersonFamilyRoot(rootId);
      rootId = storedRoot || findTopmostAncestor(rootId);
    } else {
      // Auto-detect the root: among persons who have no parents, prefer the one
      // with the most descendants so isolated seed/test records do not win just
      // because they have an older birth date.
      const parentChildRels = relationships.filter(
        (r: { type: string }) => r.type === 'PARENT_CHILD'
      );
      const childIds = new Set(
        parentChildRels
          .map((r: { childId: string | null }) => r.childId)
          .filter(Boolean)
      );
      const childCountMap = new Map<string, number>();
      for (const r of parentChildRels as { parentId: string | null }[]) {
        if (r.parentId) childCountMap.set(r.parentId, (childCountMap.get(r.parentId) ?? 0) + 1);
      }

      const potentialRoots = persons.filter((p: { id: string }) => !childIds.has(p.id));

      if (potentialRoots.length > 0) {
        const sorted = potentialRoots.sort(
          (a: (typeof potentialRoots)[number], b: (typeof potentialRoots)[number]) => {
            const aChildren = childCountMap.get(a.id) ?? 0;
            const bChildren = childCountMap.get(b.id) ?? 0;
            if (bChildren !== aChildren) return bChildren - aChildren;
            if (!a.birthDate) return 1;
            if (!b.birthDate) return -1;
            return a.birthDate.getTime() - b.birthDate.getTime();
          }
        );
        rootId = sorted[0].id;
      } else {
        rootId = persons[0].id;
      }
      didAutoDetectRoot = true;
    }

    if (!rootId) {
      return NextResponse.json(
        { success: false, error: 'Unable to determine root person' },
        { status: 400 }
      );
    }

    const rootPerson = persons.find((p: { id: string }) => p.id === rootId);
    if (!rootPerson) {
      return NextResponse.json(
        { success: false, error: 'Root person not found' },
        { status: 404 }
      );
    }

    const familySettings = await prisma.family.findUnique({
      where: { rootPersonId: rootId },
    });

    let familyName = familySettings?.name || null;

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

    // Persist only roots that were genuinely auto-detected. A manually chosen
    // root is already stored by PATCH /api/family/root and should never be
    // silently replaced here.
    if (didAutoDetectRoot && !familySettings) {
      try {
        await prisma.family.upsert({
          where: { rootPersonId: rootId },
          create: {
            rootPersonId: rootId,
            name: familyName || rootPerson.lastName,
            description: null,
            motto: null,
            crestImage: null,
          },
          update: {},
        });
      } catch (upsertError) {
        console.error('Failed to persist auto-detected tree root:', upsertError);
      }
    }

    const tree = buildFamilyTree(rootId, persons, relationships, direction, maxDepth);
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

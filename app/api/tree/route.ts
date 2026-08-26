import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { calculateTreeStats, collectTreeNodeIds } from '@/lib/tree-utils';
import { buildCollaborativeFamilyTree } from '@/lib/collaborative-tree';
import { findPersonFamilyRoot } from '@/lib/family-membership';
import type { Relationship, Person } from '@prisma/client';

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
};

// GET /api/tree - Get the family tree data (public - no auth required)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rootPersonId = searchParams.get('rootPersonId') || searchParams.get('rootId');
    const direction = (searchParams.get('direction') || 'both') as 'ancestors' | 'descendants' | 'both';
    const maxDepth = parseInt(searchParams.get('maxDepth') || '10');

    const [persons, relationships] = await Promise.all([
      prisma.person.findMany({ include: { profileImage: true } }),
      prisma.relationship.findMany(),
    ]);

    if (persons.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: {
            tree: null,
            stats: null,
            familyName: null,
            foundingAncestor: null,
          },
        },
        { headers: noStoreHeaders }
      );
    }

    const childToParents = new Map<string, string[]>();
    for (const relationship of relationships) {
      if (
        relationship.type === 'PARENT_CHILD' &&
        relationship.childId &&
        relationship.parentId
      ) {
        const list = childToParents.get(relationship.childId) || [];
        list.push(relationship.parentId);
        childToParents.set(relationship.childId, list);
      }
    }

    function findTopmostAncestor(startId: string): string {
      const visited = new Set<string>();
      let current = startId;
      while (true) {
        visited.add(current);
        const parents = childToParents.get(current);
        if (!parents || parents.length === 0) break;
        const next = parents.find((parentId) => !visited.has(parentId));
        if (!next) break;
        current = next;
      }
      return current;
    }

    let rootId: string | null = rootPersonId;
    let didAutoDetectRoot = false;

    if (rootId) {
      // Any person in the connected component resolves to the same stored Family
      // root. This prevents different accounts from seeing different trees just
      // because their membership was originally anchored through another spouse.
      const storedRoot = await findPersonFamilyRoot(rootId);
      rootId = storedRoot || findTopmostAncestor(rootId);
    } else {
      const parentChildRels = relationships.filter(
        (relationship) => relationship.type === 'PARENT_CHILD'
      );
      const childIds = new Set(
        parentChildRels
          .map((relationship) => relationship.childId)
          .filter((id): id is string => Boolean(id))
      );
      const childCountMap = new Map<string, number>();
      for (const relationship of parentChildRels) {
        if (relationship.parentId) {
          childCountMap.set(
            relationship.parentId,
            (childCountMap.get(relationship.parentId) ?? 0) + 1
          );
        }
      }

      const potentialRoots = persons.filter((person) => !childIds.has(person.id));
      if (potentialRoots.length > 0) {
        potentialRoots.sort((a, b) => {
          const aChildren = childCountMap.get(a.id) ?? 0;
          const bChildren = childCountMap.get(b.id) ?? 0;
          if (bChildren !== aChildren) return bChildren - aChildren;
          if (!a.birthDate) return 1;
          if (!b.birthDate) return -1;
          return a.birthDate.getTime() - b.birthDate.getTime();
        });
        rootId = potentialRoots[0].id;
      } else {
        rootId = persons[0].id;
      }
      didAutoDetectRoot = true;
    }

    if (!rootId) {
      return NextResponse.json(
        { success: false, error: 'Unable to determine root person' },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const rootPerson = persons.find((person) => person.id === rootId);
    if (!rootPerson) {
      return NextResponse.json(
        { success: false, error: 'Root person not found' },
        { status: 404, headers: noStoreHeaders }
      );
    }

    const familySettings = await prisma.family.findUnique({
      where: { rootPersonId: rootId },
    });

    let familyName = familySettings?.name || null;
    if (!familyName) {
      const spouseRelation = relationships.find(
        (relationship) =>
          relationship.type === 'SPOUSE' &&
          (relationship.spouse1Id === rootId || relationship.spouse2Id === rootId)
      );
      familyName = rootPerson.lastName;
      if (spouseRelation) {
        const spouseId =
          spouseRelation.spouse1Id === rootId
            ? spouseRelation.spouse2Id
            : spouseRelation.spouse1Id;
        const spouse = persons.find((person) => person.id === spouseId);
        if (spouse && spouse.lastName !== rootPerson.lastName) {
          familyName = `${rootPerson.lastName}/${spouse.lastName}`;
        }
      }
    }

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

    const tree = buildCollaborativeFamilyTree(
      rootId,
      persons,
      relationships,
      direction,
      maxDepth
    );
    const treeIds = collectTreeNodeIds(tree);
    const scopedPersons = persons.filter((person: Person) => treeIds.has(person.id));
    const scopedRelationships = relationships.filter((relationship: Relationship) => {
      if (relationship.type === 'PARENT_CHILD') {
        return (
          !!relationship.parentId &&
          !!relationship.childId &&
          treeIds.has(relationship.parentId) &&
          treeIds.has(relationship.childId)
        );
      }
      if (relationship.type === 'SPOUSE') {
        return (
          !!relationship.spouse1Id &&
          !!relationship.spouse2Id &&
          treeIds.has(relationship.spouse1Id) &&
          treeIds.has(relationship.spouse2Id)
        );
      }
      return false;
    });
    const stats = tree ? calculateTreeStats(scopedPersons, scopedRelationships) : null;

    return NextResponse.json(
      {
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
            birthYear: rootPerson.birthDate
              ? new Date(rootPerson.birthDate).getFullYear()
              : null,
            birthPlace: rootPerson.birthPlace,
            biography: rootPerson.biography,
          },
        },
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error('Error fetching tree:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch family tree' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

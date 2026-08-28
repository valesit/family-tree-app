import type { Relationship } from '@prisma/client';
import type { PersonWithRelations, SpouseNode, TreeNode } from '@/types';

const NEW_PERSON_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type CollaborativeTreeNode = TreeNode & {
  isNew?: boolean;
  parentIds?: string[];
};

type CollaborativeSpouseNode = SpouseNode & {
  isNew?: boolean;
  parentIds?: string[];
};

function wasAddedWithinLast30Days(createdAt: Date): boolean {
  const age = Date.now() - createdAt.getTime();
  return age >= 0 && age <= NEW_PERSON_WINDOW_MS;
}

/**
 * Build the visible genealogy tree from relationship records.
 *
 * A married couple is treated as one visual household for collecting children,
 * but every child also carries its explicit parent ids. The renderer can use
 * those ids and the child's own visual anchor to draw genealogy connectors to
 * the actual child rather than to the midpoint of that child's marriage.
 */
export function buildCollaborativeFamilyTree(
  rootPersonId: string,
  persons: PersonWithRelations[],
  relationships: Relationship[],
  direction: 'ancestors' | 'descendants' | 'both' = 'both',
  maxDepth = 10
): TreeNode | null {
  const personMap = new Map(persons.map((person) => [person.id, person]));
  const visited = new Set<string>();

  const parentIdsFor = (personId: string) =>
    Array.from(
      new Set(
        relationships
          .filter(
            (relationship) =>
              relationship.type === 'PARENT_CHILD' &&
              relationship.childId === personId &&
              relationship.parentId
          )
          .map((relationship) => relationship.parentId!)
      )
    );

  const spouseRelationsFor = (personId: string) =>
    relationships
      .filter(
        (relationship) =>
          relationship.type === 'SPOUSE' &&
          (relationship.spouse1Id === personId || relationship.spouse2Id === personId)
      )
      .sort((a, b) => {
        const aStart = a.startDate?.getTime() ?? 0;
        const bStart = b.startDate?.getTime() ?? 0;
        return aStart - bStart;
      });

  function toSpouseNode(
    person: PersonWithRelations,
    relationship: Relationship,
    marriageOrder: number
  ): SpouseNode {
    const spouseNode: CollaborativeSpouseNode = {
      id: person.id,
      name: `${person.firstName} ${person.lastName}`,
      firstName: person.firstName,
      lastName: person.lastName,
      gender: person.gender || undefined,
      birthDate: person.birthDate?.toISOString(),
      deathDate: person.deathDate?.toISOString(),
      profileImage: person.profileImage?.url,
      isLiving: person.isLiving,
      isVerified: person.isVerified ?? true,
      isNew: wasAddedWithinLast30Days(person.createdAt),
      parentIds: parentIdsFor(person.id),
      marriageDate: relationship.startDate?.toISOString(),
      divorceDate: relationship.endDate?.toISOString(),
      marriageOrder,
      marriageNotes: relationship.notes || undefined,
      attributes: {
        birthYear: person.birthDate
          ? new Date(person.birthDate).getFullYear().toString()
          : undefined,
        deathYear: person.deathDate
          ? new Date(person.deathDate).getFullYear().toString()
          : undefined,
        occupation: person.occupation || undefined,
        maidenName: person.maidenName || undefined,
      },
    };
    return spouseNode;
  }

  function buildNode(personId: string, depth = 0): TreeNode | null {
    if (depth > maxDepth || visited.has(personId)) return null;

    const person = personMap.get(personId);
    if (!person) return null;

    visited.add(personId);

    const node: CollaborativeTreeNode = {
      id: person.id,
      name: `${person.firstName} ${person.lastName}`,
      firstName: person.firstName,
      lastName: person.lastName,
      gender: person.gender || undefined,
      birthDate: person.birthDate?.toISOString(),
      deathDate: person.deathDate?.toISOString(),
      profileImage: person.profileImage?.url,
      isLiving: person.isLiving,
      isVerified: person.isVerified ?? true,
      isNew: wasAddedWithinLast30Days(person.createdAt),
      parentIds: parentIdsFor(person.id),
      attributes: {
        birthYear: person.birthDate
          ? new Date(person.birthDate).getFullYear().toString()
          : undefined,
        deathYear: person.deathDate
          ? new Date(person.deathDate).getFullYear().toString()
          : undefined,
        occupation: person.occupation || undefined,
        maidenName: person.maidenName || undefined,
      },
    };

    const spouseRelations = spouseRelationsFor(personId);
    const spouses: SpouseNode[] = [];
    const spouseIds = new Set<string>();

    spouseRelations.forEach((relationship, index) => {
      const spouseId =
        relationship.spouse1Id === personId
          ? relationship.spouse2Id
          : relationship.spouse1Id;
      if (!spouseId) return;

      const spouse = personMap.get(spouseId);
      if (!spouse) return;

      spouseIds.add(spouseId);
      spouses.push(toSpouseNode(spouse, relationship, index + 1));
    });

    if (spouses.length > 0) {
      node.spouse = spouses[0];
      node.spouses = spouses;
    }

    if (direction === 'descendants' || direction === 'both') {
      // Collect children contributed through either member of this household.
      // Parentage itself remains explicit in each child's parentIds metadata.
      const householdParentIds = new Set([personId, ...spouseIds]);
      const childIds = new Set<string>();

      for (const relationship of relationships) {
        if (
          relationship.type === 'PARENT_CHILD' &&
          relationship.parentId &&
          householdParentIds.has(relationship.parentId) &&
          relationship.childId &&
          !spouseIds.has(relationship.childId)
        ) {
          childIds.add(relationship.childId);
        }
      }

      const sortedChildIds = Array.from(childIds).sort((a, b) => {
        const aDate = personMap.get(a)?.birthDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDate = personMap.get(b)?.birthDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      });

      const children = sortedChildIds
        .map((childId) => buildNode(childId, depth + 1))
        .filter((child): child is TreeNode => child !== null);

      if (children.length > 0) node.children = children;
    }

    return node;
  }

  return buildNode(rootPersonId);
}

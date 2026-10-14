import type { Relationship } from '@prisma/client';
import type { PersonWithRelations, SpouseNode, TreeNode } from '@/types';

/**
 * Build the visible genealogy tree from relationship records.
 *
 * The important distinction from a simple parent->children traversal is that a
 * married couple is treated as one visual household. Children linked to either
 * spouse are collected, de-duplicated, and rendered beneath the couple. This
 * prevents a contribution from appearing to replace existing children merely
 * because it was attached through the other parent.
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
    return {
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
  }

  function buildNode(personId: string, depth = 0): TreeNode | null {
    if (depth > maxDepth || visited.has(personId)) return null;

    const person = personMap.get(personId);
    if (!person) return null;

    visited.add(personId);

    const node: TreeNode = {
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
      // Treat the couple as one household for descendant rendering. A child may
      // have been contributed through either parent, or correctly linked to
      // both. Either way it appears exactly once beneath the couple.
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

  const tree = buildNode(rootPersonId);
  if (!tree || direction === 'descendants') return tree;

  // The canonical family root remains stable when new grandparents are added.
  // Descendant-only traversal cannot show parents above that root or above a
  // spouse who married into the family. Preserve the descendant hierarchy and
  // attach all as-yet-unrepresented ancestral branches to their actual children.
  const displayedIds = new Set<string>();
  function collectDisplayed(node: TreeNode): void {
    displayedIds.add(node.id);
    for (const spouse of node.spouses ?? (node.spouse ? [node.spouse] : [])) {
      displayedIds.add(spouse.id);
    }
    node.children?.forEach(collectDisplayed);
  }
  collectDisplayed(tree);

  const parentsByChild = new Map<string, Set<string>>();
  for (const relationship of relationships) {
    if (
      relationship.type !== 'PARENT_CHILD' ||
      !relationship.parentId ||
      !relationship.childId
    ) continue;
    const parents = parentsByChild.get(relationship.childId) ?? new Set<string>();
    parents.add(relationship.parentId);
    parentsByChild.set(relationship.childId, parents);
  }

  function ancestorNode(person: PersonWithRelations): TreeNode {
    return {
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
      attributes: {
        birthYear: person.birthDate
          ? String(person.birthDate.getFullYear()) : undefined,
        deathYear: person.deathDate
          ? String(person.deathDate.getFullYear()) : undefined,
        occupation: person.occupation || undefined,
        maidenName: person.maidenName || undefined,
      },
    };
  }

  function missingAncestors(
    childId: string,
    ancestorDepth: number,
    path: Set<string>
  ): TreeNode[] {
    if (ancestorDepth >= maxDepth) return [];

    return Array.from(parentsByChild.get(childId) ?? [])
      .filter((parentId) => !displayedIds.has(parentId) && !path.has(parentId))
      .map((parentId) => {
        const person = personMap.get(parentId);
        if (!person) return null;

        const parent = ancestorNode(person);
        const nextPath = new Set(path);
        nextPath.add(parentId);
        const grandparents = missingAncestors(parentId, ancestorDepth + 1, nextPath);
        if (grandparents.length > 0) parent.parents = grandparents;
        return parent;
      })
      .filter((parent): parent is TreeNode => parent !== null);
  }

  function attachAncestors(node: TreeNode): void {
    const parents = missingAncestors(node.id, 0, new Set([node.id]));
    if (parents.length > 0) node.parents = parents;

    // Spouse ancestry is independent: Richard's new grandparents must not
    // hide Mercy's parents (and vice versa).
    for (const spouse of node.spouses ?? (node.spouse ? [node.spouse] : [])) {
      const spouseParents = missingAncestors(spouse.id, 0, new Set([spouse.id]));
      if (spouseParents.length > 0) spouse.parents = spouseParents;
    }
    node.children?.forEach(attachAncestors);
  }
  attachAncestors(tree);

  return tree;
}

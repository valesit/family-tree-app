import { Person, Relationship } from '@prisma/client';
import { TreeNode, PersonWithRelations } from '@/types';

/**
 * Build a tree structure from a list of persons and relationships
 */
export function buildFamilyTree(
  rootPersonId: string,
  persons: PersonWithRelations[],
  relationships: Relationship[],
  direction: 'ancestors' | 'descendants' | 'both' = 'both',
  maxDepth: number = 10
): TreeNode | null {
  const personMap = new Map(persons.map(p => [p.id, p]));
  const visited = new Set<string>();

  function buildNode(personId: string, depth: number = 0): TreeNode | null {
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
      attributes: {
        birthYear: person.birthDate ? new Date(person.birthDate).getFullYear().toString() : undefined,
        deathYear: person.deathDate ? new Date(person.deathDate).getFullYear().toString() : undefined,
        occupation: person.occupation || undefined,
        maidenName: person.maidenName || undefined,
      },
    };

    // Get children if showing descendants
    if (direction === 'descendants' || direction === 'both') {
      const childRelations = relationships.filter(
        r => r.type === 'PARENT_CHILD' && r.parentId === personId
      );
      
      const children = childRelations
        .map(r => buildNode(r.childId!, depth + 1))
        .filter((c): c is TreeNode => c !== null);

      if (children.length > 0) {
        node.children = children;
      }
    }

    // Get spouse
    const spouseRelation = relationships.find(
      r => r.type === 'SPOUSE' && (r.spouse1Id === personId || r.spouse2Id === personId)
    );

    if (spouseRelation) {
      const spouseId = spouseRelation.spouse1Id === personId 
        ? spouseRelation.spouse2Id 
        : spouseRelation.spouse1Id;
      
      if (spouseId && !visited.has(spouseId)) {
        const spousePerson = personMap.get(spouseId);
        if (spousePerson) {
          node.spouse = {
            id: spousePerson.id,
            name: `${spousePerson.firstName} ${spousePerson.lastName}`,
            firstName: spousePerson.firstName,
            lastName: spousePerson.lastName,
            gender: spousePerson.gender || undefined,
            birthDate: spousePerson.birthDate?.toISOString(),
            deathDate: spousePerson.deathDate?.toISOString(),
            profileImage: spousePerson.profileImage?.url,
            isLiving: spousePerson.isLiving,
            attributes: {
              birthYear: spousePerson.birthDate ? new Date(spousePerson.birthDate).getFullYear().toString() : undefined,
              deathYear: spousePerson.deathDate ? new Date(spousePerson.deathDate).getFullYear().toString() : undefined,
              occupation: spousePerson.occupation || undefined,
              maidenName: spousePerson.maidenName || undefined,
            },
          };
        }
      }
    }

    return node;
  }

  return buildNode(rootPersonId);
}

/**
 * Get all ancestors of a person
 */
export function getAncestors(
  personId: string,
  relationships: Relationship[],
  maxGenerations: number = 5
): string[] {
  const ancestors: string[] = [];
  const queue: { id: string; generation: number }[] = [{ id: personId, generation: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id) || current.generation > maxGenerations) continue;
    visited.add(current.id);

    const parentRelations = relationships.filter(
      r => r.type === 'PARENT_CHILD' && r.childId === current.id
    );

    for (const rel of parentRelations) {
      if (rel.parentId && !visited.has(rel.parentId)) {
        ancestors.push(rel.parentId);
        queue.push({ id: rel.parentId, generation: current.generation + 1 });
      }
    }
  }

  return ancestors;
}

/**
 * Get all descendants of a person
 */
export function getDescendants(
  personId: string,
  relationships: Relationship[],
  maxGenerations: number = 5
): string[] {
  const descendants: string[] = [];
  const queue: { id: string; generation: number }[] = [{ id: personId, generation: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.id) || current.generation > maxGenerations) continue;
    visited.add(current.id);

    const childRelations = relationships.filter(
      r => r.type === 'PARENT_CHILD' && r.parentId === current.id
    );

    for (const rel of childRelations) {
      if (rel.childId && !visited.has(rel.childId)) {
        descendants.push(rel.childId);
        queue.push({ id: rel.childId, generation: current.generation + 1 });
      }
    }
  }

  return descendants;
}

/**
 * Get siblings of a person
 */
export function getSiblings(
  personId: string,
  relationships: Relationship[]
): string[] {
  // Find parents
  const parentRelations = relationships.filter(
    r => r.type === 'PARENT_CHILD' && r.childId === personId
  );

  const parentIds = parentRelations.map(r => r.parentId).filter(Boolean) as string[];

  // Find children of those parents (siblings)
  const siblingIds = new Set<string>();
  
  for (const parentId of parentIds) {
    const childRelations = relationships.filter(
      r => r.type === 'PARENT_CHILD' && r.parentId === parentId
    );
    
    for (const rel of childRelations) {
      if (rel.childId && rel.childId !== personId) {
        siblingIds.add(rel.childId);
      }
    }
  }

  return Array.from(siblingIds);
}

/**
 * Get the relationship path between two people
 */
export function findRelationshipPath(
  person1Id: string,
  person2Id: string,
  relationships: Relationship[],
  maxDepth: number = 10
): string[] | null {
  if (person1Id === person2Id) return [person1Id];

  const queue: { id: string; path: string[] }[] = [{ id: person1Id, path: [person1Id] }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.path.length > maxDepth) continue;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    // Get all connected people
    const connections = getDirectConnections(current.id, relationships);

    for (const connectedId of connections) {
      if (connectedId === person2Id) {
        return [...current.path, connectedId];
      }
      if (!visited.has(connectedId)) {
        queue.push({ id: connectedId, path: [...current.path, connectedId] });
      }
    }
  }

  return null;
}

/**
 * Get directly connected people (parents, children, spouses)
 */
function getDirectConnections(personId: string, relationships: Relationship[]): string[] {
  const connections = new Set<string>();

  for (const rel of relationships) {
    if (rel.type === 'PARENT_CHILD') {
      if (rel.parentId === personId && rel.childId) {
        connections.add(rel.childId);
      }
      if (rel.childId === personId && rel.parentId) {
        connections.add(rel.parentId);
      }
    }
    if (rel.type === 'SPOUSE') {
      if (rel.spouse1Id === personId && rel.spouse2Id) {
        connections.add(rel.spouse2Id);
      }
      if (rel.spouse2Id === personId && rel.spouse1Id) {
        connections.add(rel.spouse1Id);
      }
    }
  }

  return Array.from(connections);
}

/**
 * Calculate statistics for the family tree
 */
export function calculateTreeStats(persons: Person[], relationships: Relationship[]) {
  const livingCount = persons.filter(p => p.isLiving).length;
  const deceasedCount = persons.filter(p => !p.isLiving).length;
  
  const maleCount = persons.filter(p => p.gender === 'MALE').length;
  const femaleCount = persons.filter(p => p.gender === 'FEMALE').length;
  
  const marriageCount = relationships.filter(r => r.type === 'SPOUSE').length;
  
  // Find oldest and youngest
  const withBirthDate = persons.filter(p => p.birthDate);
  const oldest = withBirthDate.reduce((oldest, current) => {
    if (!oldest.birthDate) return current;
    if (!current.birthDate) return oldest;
    return current.birthDate < oldest.birthDate ? current : oldest;
  }, withBirthDate[0]);
  
  const youngestLiving = withBirthDate
    .filter(p => p.isLiving)
    .reduce((youngest, current) => {
      if (!youngest?.birthDate) return current;
      if (!current.birthDate) return youngest;
      return current.birthDate > youngest.birthDate ? current : youngest;
    }, null as Person | null);

  return {
    totalMembers: persons.length,
    livingCount,
    deceasedCount,
    maleCount,
    femaleCount,
    marriageCount,
    oldestMember: oldest ? {
      name: `${oldest.firstName} ${oldest.lastName}`,
      birthYear: oldest.birthDate?.getFullYear(),
    } : null,
    youngestLiving: youngestLiving ? {
      name: `${youngestLiving.firstName} ${youngestLiving.lastName}`,
      birthYear: youngestLiving.birthDate?.getFullYear(),
    } : null,
  };
}

/**
 * Format a person's full name
 */
export function formatPersonName(person: Pick<Person, 'firstName' | 'lastName' | 'middleName' | 'maidenName' | 'nickname'>): string {
  let name = person.firstName;
  
  if (person.middleName) {
    name += ` ${person.middleName}`;
  }
  
  name += ` ${person.lastName}`;
  
  if (person.maidenName) {
    name += ` (née ${person.maidenName})`;
  }
  
  if (person.nickname) {
    name += ` "${person.nickname}"`;
  }
  
  return name;
}

/**
 * Calculate age from birth date
 */
export function calculateAge(birthDate: Date, deathDate?: Date | null): number {
  const endDate = deathDate || new Date();
  let age = endDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = endDate.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}


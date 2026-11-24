/**
 * Read-only adapter for Family Explorer 2.0.
 *
 * Family relationships are a graph, not a nested tree. We intentionally keep
 * every parent-child edge (including those involving different partners) and
 * resolve the connected family component from the selected root.
 *
 * This file does not write data or change the existing tree builder.
 */
export interface ExplorerPersonRecord {
  id: string;
  firstName: string;
  lastName: string;
  gender?: string | null;
  birthDate?: string | Date | null;
  deathDate?: string | Date | null;
  isLiving?: boolean;
  profileImage?: string | { url: string } | null;
}

export interface ExplorerRelationship {
  id?: string;
  type: string;
  parentId?: string | null;
  childId?: string | null;
  spouse1Id?: string | null;
  spouse2Id?: string | null;
  parent?: ExplorerPersonRecord | null;
  child?: ExplorerPersonRecord | null;
  spouse1?: ExplorerPersonRecord | null;
  spouse2?: ExplorerPersonRecord | null;
}

export interface ExplorerPerson {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  gender: string | null;
  photo: string | null;
  birthYear: number | null;
  deathYear: number | null;
  isLiving: boolean;
}

export interface ExplorerLink {
  person: ExplorerPerson;
  type: string;
}

export interface ExplorerChildGroup {
  key: string;
  coParents: ExplorerPerson[];
  children: ExplorerLink[];
}

export interface ExplorerGraph {
  rootId: string;
  people: Map<string, ExplorerPerson>;
  relationships: ExplorerRelationship[];
}

export interface ExplorerContext {
  person: ExplorerPerson;
  parents: ExplorerLink[];
  parentBranches: Array<{ parent: ExplorerLink; grandparents: ExplorerLink[] }>;
  partners: ExplorerPerson[];
  childGroups: ExplorerChildGroup[];
  siblings: ExplorerPerson[];
}

const PARENT_TYPES = new Set(['PARENT_CHILD', 'ADOPTED', 'STEP_PARENT', 'STEP_CHILD', 'FOSTER']);

function year(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getFullYear();
}

function normalize(person: ExplorerPersonRecord): ExplorerPerson {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    name: [person.firstName, person.lastName].filter(Boolean).join(' '),
    gender: person.gender ?? null,
    photo: typeof person.profileImage === 'string'
      ? person.profileImage
      : person.profileImage?.url ?? null,
    birthYear: year(person.birthDate),
    deathYear: year(person.deathDate),
    isLiving: person.isLiving ?? true,
  };
}

function comparePeople(a: ExplorerPerson, b: ExplorerPerson): number {
  return a.name.localeCompare(b.name);
}

export function buildExplorerGraph(
  root: ExplorerPersonRecord,
  relationships: ExplorerRelationship[]
): ExplorerGraph {
  const everyone = new Map<string, ExplorerPerson>();
  const adjacency = new Map<string, Set<string>>();

  const addPerson = (person: ExplorerPersonRecord | null | undefined) => {
    if (!person?.id) return;
    everyone.set(person.id, normalize(person));
  };

  addPerson(root);
  for (const rel of relationships) {
    addPerson(rel.parent);
    addPerson(rel.child);
    addPerson(rel.spouse1);
    addPerson(rel.spouse2);
    const ids = rel.type === 'SPOUSE'
      ? [rel.spouse1Id, rel.spouse2Id]
      : [rel.parentId, rel.childId, rel.spouse1Id, rel.spouse2Id];
    const endpoints = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
    for (const id of endpoints) {
      if (!adjacency.has(id)) adjacency.set(id, new Set());
      for (const other of endpoints) {
        if (id !== other) adjacency.get(id)!.add(other);
      }
    }
  }

  const connected = new Set<string>([root.id]);
  const queue = [root.id];
  for (let i = 0; i < queue.length; i++) {
    for (const other of adjacency.get(queue[i]) ?? []) {
      if (!connected.has(other)) {
        connected.add(other);
        queue.push(other);
      }
    }
  }

  const people = new Map(
    Array.from(everyone.entries()).filter(([id]) => connected.has(id))
  );
  const scoped = relationships.filter((rel) => {
    if (rel.type === 'SPOUSE') {
      return Boolean(rel.spouse1Id && rel.spouse2Id &&
        connected.has(rel.spouse1Id) && connected.has(rel.spouse2Id));
    }
    return Boolean(rel.parentId && rel.childId &&
      connected.has(rel.parentId) && connected.has(rel.childId));
  });

  return { rootId: root.id, people, relationships: scoped };
}

export function getExplorerContext(graph: ExplorerGraph, personId: string): ExplorerContext | null {
  const person = graph.people.get(personId);
  if (!person) return null;

  const parentsOf = (childId: string): ExplorerLink[] => {
    const found = new Map<string, ExplorerLink>();
    for (const rel of graph.relationships) {
      if (!PARENT_TYPES.has(rel.type) || rel.childId !== childId || !rel.parentId) continue;
      const parent = graph.people.get(rel.parentId);
      if (parent && !found.has(parent.id)) found.set(parent.id, { person: parent, type: rel.type });
    }
    return [...found.values()].sort((a, b) => comparePeople(a.person, b.person));
  };

  const parents = parentsOf(personId);
  const parentBranches = parents.map((parent) => ({
    parent,
    grandparents: parentsOf(parent.person.id).filter((p) => p.person.id !== personId),
  }));

  const partners = new Map<string, ExplorerPerson>();
  for (const rel of graph.relationships) {
    if (rel.type !== 'SPOUSE') continue;
    const id = rel.spouse1Id === personId ? rel.spouse2Id
      : rel.spouse2Id === personId ? rel.spouse1Id : null;
    const partner = id ? graph.people.get(id) : null;
    if (partner) partners.set(partner.id, partner);
  }

  const children = new Map<string, ExplorerLink>();
  for (const rel of graph.relationships) {
    if (!PARENT_TYPES.has(rel.type) || rel.parentId !== personId || !rel.childId) continue;
    const child = graph.people.get(rel.childId);
    if (child && !children.has(child.id)) children.set(child.id, { person: child, type: rel.type });
  }

  const groups = new Map<string, ExplorerChildGroup>();
  for (const child of children.values()) {
    const coParents = parentsOf(child.person.id)
      .map((p) => p.person)
      .filter((p) => p.id !== personId)
      .sort(comparePeople);
    const key = coParents.map((p) => p.id).join('|') || 'without-coparent';
    if (!groups.has(key)) groups.set(key, { key, coParents, children: [] });
    groups.get(key)!.children.push(child);
  }
  const childGroups = Array.from(groups.values()).map((group) => ({
    ...group,
    children: group.children.sort((a, b) =>
      (a.person.birthYear ?? 9999) - (b.person.birthYear ?? 9999) ||
      comparePeople(a.person, b.person)),
  })).sort((a, b) => a.key.localeCompare(b.key));

  const siblingIds = new Set<string>();
  const parentIds = new Set(parents.map((p) => p.person.id));
  for (const rel of graph.relationships) {
    if (PARENT_TYPES.has(rel.type) && rel.parentId &&
      parentIds.has(rel.parentId) && rel.childId && rel.childId !== personId) {
      siblingIds.add(rel.childId);
    }
  }
  const siblings = Array.from(siblingIds)
    .map((id) => graph.people.get(id))
    .filter((p): p is ExplorerPerson => Boolean(p))
    .sort(comparePeople);

  return {
    person,
    parents,
    parentBranches,
    partners: Array.from(partners.values()).sort(comparePeople),
    childGroups,
    siblings,
  };
}

export function relationshipLabel(type: string, gender?: string | null): string {
  switch (type) {
    case 'ADOPTED': return 'Adoptive';
    case 'STEP_PARENT':
    case 'STEP_CHILD': return 'Step';
    case 'FOSTER': return 'Foster';
    default: return gender === 'MALE' ? 'Father' : gender === 'FEMALE' ? 'Mother' : 'Parent';
  }
}

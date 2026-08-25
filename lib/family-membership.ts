import prisma from '@/lib/db';
import { FamilyRole, FamilyMembership, Prisma, Relationship } from '@prisma/client';

/**
 * Return every person in the connected genealogy component containing personId.
 * Parent/child and spouse links are all traversed so a spouse can never silently
 * resolve to a different family simply because they have no direct parent edge
 * into the other spouse's ancestry.
 */
export async function getConnectedPersonIds(personId: string): Promise<Set<string>> {
  const relationships = await prisma.relationship.findMany({
    select: {
      type: true,
      parentId: true,
      childId: true,
      spouse1Id: true,
      spouse2Id: true,
    },
  });

  const adjacency = new Map<string, Set<string>>();
  const connect = (a: string | null, b: string | null) => {
    if (!a || !b) return;
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    if (!adjacency.has(b)) adjacency.set(b, new Set());
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };

  for (const relationship of relationships) {
    if (relationship.type === 'PARENT_CHILD') {
      connect(relationship.parentId, relationship.childId);
    } else if (relationship.type === 'SPOUSE') {
      connect(relationship.spouse1Id, relationship.spouse2Id);
    }
  }

  const connected = new Set<string>();
  const queue = [personId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (connected.has(current)) continue;
    connected.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!connected.has(next)) queue.push(next);
    }
  }

  return connected;
}

/**
 * Count ancestors reachable by walking upward through parent links while spouse
 * links are treated as same-generation connections. This is only used to rank
 * stale duplicate Family records: the candidate with fewer upstream ancestors
 * is the higher/root-most record.
 */
function upstreamAncestorCount(rootPersonId: string, relationships: Relationship[]): number {
  const visited = new Set<string>();
  const ancestors = new Set<string>();
  const queue = [rootPersonId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const relationship of relationships) {
      if (relationship.type === 'SPOUSE') {
        if (relationship.spouse1Id === current && relationship.spouse2Id && !visited.has(relationship.spouse2Id)) {
          queue.push(relationship.spouse2Id);
        }
        if (relationship.spouse2Id === current && relationship.spouse1Id && !visited.has(relationship.spouse1Id)) {
          queue.push(relationship.spouse1Id);
        }
      }

      if (
        relationship.type === 'PARENT_CHILD' &&
        relationship.childId === current &&
        relationship.parentId
      ) {
        ancestors.add(relationship.parentId);
        if (!visited.has(relationship.parentId)) queue.push(relationship.parentId);
      }
    }
  }

  return ancestors.size;
}

async function getCanonicalFamilyForPerson(personId: string) {
  const connectedIds = await getConnectedPersonIds(personId);
  const [families, relationships] = await Promise.all([
    prisma.family.findMany({
      where: { rootPersonId: { in: Array.from(connectedIds) } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.relationship.findMany(),
  ]);

  if (families.length === 0) return { canonical: null, families, connectedIds };
  if (families.length === 1) return { canonical: families[0], families, connectedIds };

  const ranked = [...families].sort((a, b) => {
    const aUpstream = upstreamAncestorCount(a.rootPersonId, relationships);
    const bUpstream = upstreamAncestorCount(b.rootPersonId, relationships);
    if (aUpstream !== bUpstream) return aUpstream - bUpstream;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return { canonical: ranked[0], families, connectedIds };
}

/**
 * Merge stale duplicate Family records that point into the same connected tree.
 *
 * Older app behavior could create one Family for one spouse and another Family
 * for the other branch. Because FamilyMembership currently references
 * Family.rootPersonId, this routine moves all memberships to the canonical root
 * before deleting the duplicate Family rows. It is safe to call repeatedly.
 */
export async function reconcileConnectedFamilies(personId: string): Promise<string | null> {
  const { canonical, families } = await getCanonicalFamilyForPerson(personId);
  if (!canonical) return null;
  if (families.length === 1) return canonical.rootPersonId;

  await prisma.$transaction(async (tx) => {
    for (const duplicate of families) {
      if (duplicate.id === canonical.id) continue;

      const memberships = await tx.familyMembership.findMany({
        where: { familyId: duplicate.rootPersonId },
      });

      for (const membership of memberships) {
        const existing = await tx.familyMembership.findUnique({
          where: {
            userId_familyId: {
              userId: membership.userId,
              familyId: canonical.rootPersonId,
            },
          },
        });

        if (!existing) {
          await tx.familyMembership.create({
            data: {
              userId: membership.userId,
              familyId: canonical.rootPersonId,
              role: membership.role,
              joinedAt: membership.joinedAt,
            },
          });
        } else if (membership.role === 'ADMIN' && existing.role !== 'ADMIN') {
          await tx.familyMembership.update({
            where: { id: existing.id },
            data: { role: 'ADMIN' },
          });
        }
      }

      await tx.familyMembership.deleteMany({
        where: { familyId: duplicate.rootPersonId },
      });
      await tx.family.delete({ where: { id: duplicate.id } });
    }
  });

  return canonical.rootPersonId;
}

/** Check if a user is a Family Admin for a specific family tree. */
export async function isFamilyAdmin(userId: string, familyId: string): Promise<boolean> {
  const canonicalFamilyId = (await findPersonFamilyRoot(familyId)) || familyId;
  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId, familyId: canonicalFamilyId } },
  });
  return membership?.role === 'ADMIN';
}

/** Check if a user is a System Admin. */
export async function isSystemAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === 'ADMIN';
}

/** Check if a user can manage a specific family tree. */
export async function canManageTree(userId: string, familyId: string): Promise<boolean> {
  const [sysAdmin, famAdmin] = await Promise.all([
    isSystemAdmin(userId),
    isFamilyAdmin(userId, familyId),
  ]);
  return sysAdmin || famAdmin;
}

/** Any membership row counts as a verified family member. */
export async function isVerifiedMember(userId: string, familyId: string): Promise<boolean> {
  const canonicalFamilyId = (await findPersonFamilyRoot(familyId)) || familyId;
  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId, familyId: canonicalFamilyId } },
  });
  return membership !== null;
}

export async function getFamilyMembership(
  userId: string,
  familyId: string
): Promise<FamilyMembership | null> {
  const canonicalFamilyId = (await findPersonFamilyRoot(familyId)) || familyId;
  return prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId, familyId: canonicalFamilyId } },
  });
}

export async function getUserFamilies(userId: string) {
  return prisma.familyMembership.findMany({
    where: { userId },
    include: { family: true },
    orderBy: { joinedAt: 'asc' },
  });
}

/**
 * Get a user's default family. A linked profile wins; otherwise the oldest
 * membership is resolved back to the canonical Family root.
 */
export async function getUserDefaultFamily(userId: string): Promise<string | null> {
  const linkedPerson = await prisma.person.findFirst({ where: { userId } });
  if (linkedPerson) {
    const familyRoot = await findPersonFamilyRoot(linkedPerson.id);
    if (familyRoot) return familyRoot;
  }

  const membership = await prisma.familyMembership.findFirst({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
  });
  if (!membership) return null;

  return (await findPersonFamilyRoot(membership.familyId)) || membership.familyId;
}

/** Legacy helper retained for callers that need a purely biological topmost ancestor. */
export async function findTopmostAncestor(personId: string): Promise<string> {
  const visited = new Set<string>();
  let current = personId;
  while (!visited.has(current)) {
    visited.add(current);
    const parentRel = await prisma.relationship.findFirst({
      where: { type: 'PARENT_CHILD', childId: current, parentId: { not: null } },
      select: { parentId: true },
    });
    if (!parentRel?.parentId) break;
    current = parentRel.parentId;
  }
  return current;
}

/**
 * Re-point the single canonical Family record to a user-selected root.
 * Memberships are preserved while the rootPersonId foreign key changes.
 */
export async function reassignFamilyRoot(
  oldRootPersonId: string,
  newRootPersonId: string
): Promise<boolean> {
  const canonicalOldRoot = (await reconcileConnectedFamilies(oldRootPersonId)) || oldRootPersonId;
  if (canonicalOldRoot === newRootPersonId) return false;

  const [newRootPerson, family] = await Promise.all([
    prisma.person.findUnique({ where: { id: newRootPersonId }, select: { id: true } }),
    prisma.family.findUnique({ where: { rootPersonId: canonicalOldRoot } }),
  ]);
  if (!newRootPerson) throw new Error('New root person not found');
  if (!family) throw new Error('Family not found for current root');

  const clash = await prisma.family.findUnique({ where: { rootPersonId: newRootPersonId } });
  if (clash && clash.id !== family.id) {
    throw new Error('That person is already the root of another family');
  }

  await prisma.$transaction(async (tx) => {
    const memberships = await tx.familyMembership.findMany({
      where: { familyId: canonicalOldRoot },
      select: { userId: true, role: true, joinedAt: true },
    });

    if (memberships.length > 0) {
      await tx.familyMembership.deleteMany({ where: { familyId: canonicalOldRoot } });
    }

    await tx.family.update({
      where: { id: family.id },
      data: { rootPersonId: newRootPersonId },
    });

    if (memberships.length > 0) {
      await tx.familyMembership.createMany({
        data: memberships.map((membership) => ({
          userId: membership.userId,
          familyId: newRootPersonId,
          role: membership.role,
          joinedAt: membership.joinedAt,
        })),
      });
    }
  });

  return true;
}

/**
 * Root selection is intentionally manual. Adding an older parent expands the
 * same family but does not silently change the selected root.
 */
export async function promoteFamilyRootIfHigher(personId: string): Promise<string | null> {
  return findPersonFamilyRoot(personId);
}

/**
 * Resolve any person in a connected component to the single canonical Family
 * root. Unlike the old implementation, spouse connections participate in the
 * lookup and we never return the first stale Family row we happen to encounter.
 */
export async function findPersonFamilyRoot(personId: string): Promise<string | null> {
  const { canonical } = await getCanonicalFamilyForPerson(personId);
  return canonical?.rootPersonId ?? null;
}

export async function addUserToFamily(
  userId: string,
  familyId: string,
  role: FamilyRole = 'MEMBER'
): Promise<FamilyMembership> {
  const canonicalFamilyId = (await findPersonFamilyRoot(familyId)) || familyId;
  const existing = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId, familyId: canonicalFamilyId } },
  });

  if (existing) {
    // Joining/contributing as a MEMBER must never demote an existing Family Admin.
    if (existing.role === 'ADMIN' || existing.role === role) return existing;
    return prisma.familyMembership.update({
      where: { id: existing.id },
      data: { role },
    });
  }

  return prisma.familyMembership.create({
    data: { userId, familyId: canonicalFamilyId, role },
  });
}

export async function promoteToFamilyAdmin(
  actorId: string,
  targetUserId: string,
  familyId: string
): Promise<{ success: boolean; error?: string }> {
  const canonicalFamilyId = (await findPersonFamilyRoot(familyId)) || familyId;
  const [actorIsSystemAdmin, actorIsFamilyAdmin] = await Promise.all([
    isSystemAdmin(actorId),
    isFamilyAdmin(actorId, canonicalFamilyId),
  ]);

  if (!actorIsSystemAdmin && !actorIsFamilyAdmin) {
    return { success: false, error: 'Not authorized to promote Family Admins' };
  }

  const targetMembership = await getFamilyMembership(targetUserId, canonicalFamilyId);
  if (!targetMembership) {
    return { success: false, error: 'User must be a member of this family tree' };
  }

  await prisma.familyMembership.update({
    where: { id: targetMembership.id },
    data: { role: 'ADMIN' },
  });
  return { success: true };
}

export async function getFamilyAdmins(familyId: string) {
  const canonicalFamilyId = (await findPersonFamilyRoot(familyId)) || familyId;
  return prisma.familyMembership.findMany({
    where: { familyId: canonicalFamilyId, role: 'ADMIN' },
    include: { user: true },
  });
}

export async function getVerifiedFamilyMembers(familyId: string) {
  const canonicalFamilyId = (await findPersonFamilyRoot(familyId)) || familyId;
  return prisma.familyMembership.findMany({
    where: { familyId: canonicalFamilyId },
    include: { user: true },
  });
}

export async function notifyFamilyAdmins(
  familyId: string,
  notification: {
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }
) {
  const admins = await getFamilyAdmins(familyId);
  if (admins.length === 0) return;

  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.userId,
      type: notification.type as any,
      title: notification.title,
      message: notification.message,
      data: (notification.data || {}) as Prisma.InputJsonValue,
    })),
  });
}

export async function notifyVerifiedMembers(
  familyId: string,
  notification: {
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  },
  excludeUserId?: string
) {
  const members = await getVerifiedFamilyMembers(familyId);
  const recipients = excludeUserId
    ? members.filter((membership) => membership.userId !== excludeUserId)
    : members;
  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((member) => ({
      userId: member.userId,
      type: notification.type as any,
      title: notification.title,
      message: notification.message,
      data: (notification.data || {}) as Prisma.InputJsonValue,
    })),
  });
}

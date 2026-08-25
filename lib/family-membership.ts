import prisma from '@/lib/db';
import { FamilyRole, FamilyMembership, Prisma, Relationship } from '@prisma/client';
import {
  deleteTransitionalMembership,
  ensureMembershipStableReference,
  getTransitionalMembership,
  hasLegacyMembershipRootColumn,
  isStableFamilySchemaReady,
  listTransitionalMembershipsForFamily,
  listTransitionalMembershipsForUser,
  resolveFamilyRecord,
  setTransitionalMembershipRole,
  TransitionalMembership,
  upsertTransitionalMembership,
} from '@/lib/stable-family';

function asLegacyMembership(membership: TransitionalMembership): FamilyMembership {
  return {
    id: membership.id,
    userId: membership.userId,
    familyId:
      membership.legacyRootPersonId || membership.stableFamilyId || '',
    role: membership.role,
    joinedAt: membership.joinedAt,
    updatedAt: membership.updatedAt,
  };
}

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

/** Rank stale duplicate Family records by how high their stored roots sit. */
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
        if (
          relationship.spouse1Id === current &&
          relationship.spouse2Id &&
          !visited.has(relationship.spouse2Id)
        ) {
          queue.push(relationship.spouse2Id);
        }
        if (
          relationship.spouse2Id === current &&
          relationship.spouse1Id &&
          !visited.has(relationship.spouse1Id)
        ) {
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
 * Merge stale duplicate Family rows within one connected genealogy component.
 * Stable Family.id membership references are moved first, then the duplicate
 * Family is removed. The old root-person column is kept in sync only as a
 * compatibility field while it still exists.
 */
export async function reconcileConnectedFamilies(personId: string): Promise<string | null> {
  const { canonical, families } = await getCanonicalFamilyForPerson(personId);
  if (!canonical) return null;

  if (families.length > 1) {
    for (const duplicate of families) {
      if (duplicate.id === canonical.id) continue;

      const memberships = await listTransitionalMembershipsForFamily(duplicate.id);
      for (const membership of memberships) {
        await upsertTransitionalMembership(
          membership.userId,
          canonical.id,
          membership.role
        );
        await deleteTransitionalMembership(membership.id);
      }

      await prisma.family.delete({ where: { id: duplicate.id } });
    }
  }

  const canonicalMemberships = await listTransitionalMembershipsForFamily(canonical.id);
  for (const membership of canonicalMemberships) {
    await ensureMembershipStableReference(membership.userId, canonical.id);
  }

  return canonical.rootPersonId;
}

/** Check if a user is a Family Admin. `familyId` may be Family.id or root person id. */
export async function isFamilyAdmin(userId: string, familyId: string): Promise<boolean> {
  const family = await resolveFamilyRecord(familyId);
  if (!family) {
    const root = await findPersonFamilyRoot(familyId);
    if (!root) return false;
    return isFamilyAdmin(userId, root);
  }
  const membership = await getTransitionalMembership(userId, family.id);
  return membership?.role === 'ADMIN';
}

export async function isSystemAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === 'ADMIN';
}

export async function canManageTree(userId: string, familyId: string): Promise<boolean> {
  const [sysAdmin, famAdmin] = await Promise.all([
    isSystemAdmin(userId),
    isFamilyAdmin(userId, familyId),
  ]);
  return sysAdmin || famAdmin;
}

export async function isVerifiedMember(userId: string, familyId: string): Promise<boolean> {
  return (await getFamilyMembership(userId, familyId)) !== null;
}

export async function getFamilyMembership(
  userId: string,
  familyId: string
): Promise<FamilyMembership | null> {
  const family =
    (await resolveFamilyRecord(familyId)) ||
    (await findPersonFamilyRoot(familyId).then((root) =>
      root ? resolveFamilyRecord(root) : null
    ));
  if (!family) return null;
  const membership = await getTransitionalMembership(userId, family.id);
  return membership ? asLegacyMembership(membership) : null;
}

export async function getUserFamilies(userId: string) {
  const memberships = await listTransitionalMembershipsForUser(userId);
  const familyIds = memberships.map((membership) => membership.family.id);
  const families = await prisma.family.findMany({ where: { id: { in: familyIds } } });
  const byId = new Map(families.map((family) => [family.id, family]));

  return memberships
    .map((membership) => {
      const family = byId.get(membership.family.id);
      if (!family) return null;
      return {
        ...asLegacyMembership(membership),
        family,
      };
    })
    .filter((membership): membership is NonNullable<typeof membership> => membership !== null);
}

/** A linked profile wins; otherwise use the oldest stable family membership. */
export async function getUserDefaultFamily(userId: string): Promise<string | null> {
  const linkedPerson = await prisma.person.findFirst({ where: { userId } });
  if (linkedPerson) {
    const familyRoot = await findPersonFamilyRoot(linkedPerson.id);
    if (familyRoot) return familyRoot;
  }

  const memberships = await listTransitionalMembershipsForUser(userId);
  return memberships[0]?.family.rootPersonId ?? null;
}

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
 * Re-point the same permanent Family record to a user-selected root.
 *
 * During the transition the physical legacy FamilyMembership.familyId FK may
 * still reference Family.rootPersonId. We atomically recreate those rows with
 * the new root while preserving familyRecordId = Family.id. Once the old FK is
 * removed in Phase 2, this remains safe (and becomes merely conservative).
 */
export async function reassignFamilyRoot(
  oldRootPersonId: string,
  newRootPersonId: string
): Promise<boolean> {
  const canonicalOldRoot =
    (await reconcileConnectedFamilies(oldRootPersonId)) || oldRootPersonId;
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

  const memberships = await listTransitionalMembershipsForFamily(family.id);
  const stableReady = await isStableFamilySchemaReady();
  const hasLegacyColumn = await hasLegacyMembershipRootColumn();

  await prisma.$transaction(async (tx) => {
    if (memberships.length > 0) {
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM "FamilyMembership"
        WHERE "id" IN (${Prisma.join(memberships.map((membership) => membership.id))})
      `);
    }

    await tx.family.update({
      where: { id: family.id },
      data: { rootPersonId: newRootPersonId },
    });

    for (const membership of memberships) {
      if (stableReady && hasLegacyColumn) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "FamilyMembership"
            ("id", "userId", "familyId", "familyRecordId", "role", "joinedAt", "updatedAt")
          VALUES
            (${membership.id}, ${membership.userId}, ${newRootPersonId}, ${family.id},
             CAST(${membership.role} AS "FamilyRole"), ${membership.joinedAt}, CURRENT_TIMESTAMP)
        `);
      } else if (stableReady) {
        await tx.$executeRaw(Prisma.sql`
          INSERT INTO "FamilyMembership"
            ("id", "userId", "familyRecordId", "role", "joinedAt", "updatedAt")
          VALUES
            (${membership.id}, ${membership.userId}, ${family.id},
             CAST(${membership.role} AS "FamilyRole"), ${membership.joinedAt}, CURRENT_TIMESTAMP)
        `);
      } else {
        await tx.familyMembership.create({
          data: {
            id: membership.id,
            userId: membership.userId,
            familyId: newRootPersonId,
            role: membership.role,
            joinedAt: membership.joinedAt,
          },
        });
      }
    }
  });

  return true;
}

/** Root selection is manual; adding an older parent does not silently change it. */
export async function promoteFamilyRootIfHigher(personId: string): Promise<string | null> {
  return findPersonFamilyRoot(personId);
}

/** Resolve any person in a connected component to the canonical root person id. */
export async function findPersonFamilyRoot(personId: string): Promise<string | null> {
  const { canonical } = await getCanonicalFamilyForPerson(personId);
  return canonical?.rootPersonId ?? null;
}

export async function addUserToFamily(
  userId: string,
  familyId: string,
  role: FamilyRole = 'MEMBER'
): Promise<FamilyMembership> {
  const family =
    (await resolveFamilyRecord(familyId)) ||
    (await findPersonFamilyRoot(familyId).then((root) =>
      root ? resolveFamilyRecord(root) : null
    ));
  if (!family) throw new Error('Family not found');
  const membership = await upsertTransitionalMembership(userId, family.id, role);
  return asLegacyMembership(membership);
}

export async function promoteToFamilyAdmin(
  actorId: string,
  targetUserId: string,
  familyId: string
): Promise<{ success: boolean; error?: string }> {
  const family = await resolveFamilyRecord(familyId);
  const familyRef = family?.id || (await findPersonFamilyRoot(familyId));
  if (!familyRef) return { success: false, error: 'Family not found' };

  const [actorIsSystemAdmin, actorIsFamilyAdmin] = await Promise.all([
    isSystemAdmin(actorId),
    isFamilyAdmin(actorId, familyRef),
  ]);
  if (!actorIsSystemAdmin && !actorIsFamilyAdmin) {
    return { success: false, error: 'Not authorized to promote Family Admins' };
  }

  const targetMembership = await getTransitionalMembership(targetUserId, familyRef);
  if (!targetMembership) {
    return { success: false, error: 'User must be a member of this family tree' };
  }

  await setTransitionalMembershipRole(targetMembership.id, 'ADMIN');
  return { success: true };
}

export async function getFamilyAdmins(familyId: string) {
  const family = await resolveFamilyRecord(familyId);
  const familyRef = family?.id || (await findPersonFamilyRoot(familyId));
  if (!familyRef) return [];
  const memberships = await listTransitionalMembershipsForFamily(familyRef, 'ADMIN');
  const users = await prisma.user.findMany({
    where: { id: { in: memberships.map((membership) => membership.userId) } },
  });
  const userById = new Map(users.map((user) => [user.id, user]));
  return memberships.map((membership) => ({
    ...asLegacyMembership(membership),
    user: userById.get(membership.userId)!,
  }));
}

export async function getVerifiedFamilyMembers(familyId: string) {
  const family = await resolveFamilyRecord(familyId);
  const familyRef = family?.id || (await findPersonFamilyRoot(familyId));
  if (!familyRef) return [];
  const memberships = await listTransitionalMembershipsForFamily(familyRef);
  const users = await prisma.user.findMany({
    where: { id: { in: memberships.map((membership) => membership.userId) } },
  });
  const userById = new Map(users.map((user) => [user.id, user]));
  return memberships.map((membership) => ({
    ...asLegacyMembership(membership),
    user: userById.get(membership.userId)!,
  }));
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

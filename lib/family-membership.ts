import prisma from '@/lib/db';
import { FamilyRole, FamilyMembership, User, Prisma } from '@prisma/client';

/**
 * Check if a user is a Family Admin for a specific family tree
 */
export async function isFamilyAdmin(userId: string, familyId: string): Promise<boolean> {
  const membership = await prisma.familyMembership.findUnique({
    where: {
      userId_familyId: { userId, familyId },
    },
  });
  return membership?.role === 'ADMIN';
}

/**
 * Check if a user is a System Admin
 */
export async function isSystemAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === 'ADMIN';
}

/**
 * Check if a user can manage a specific family tree (System Admin or Family Admin)
 */
export async function canManageTree(userId: string, familyId: string): Promise<boolean> {
  const [sysAdmin, famAdmin] = await Promise.all([
    isSystemAdmin(userId),
    isFamilyAdmin(userId, familyId),
  ]);
  return sysAdmin || famAdmin;
}

/**
 * Check if a user is a member of a family tree.
 * (We no longer model a PENDING state — any membership row counts.)
 */
export async function isVerifiedMember(userId: string, familyId: string): Promise<boolean> {
  const membership = await prisma.familyMembership.findUnique({
    where: {
      userId_familyId: { userId, familyId },
    },
  });
  return membership !== null;
}

/**
 * Get user's family membership for a specific tree
 */
export async function getFamilyMembership(
  userId: string,
  familyId: string
): Promise<FamilyMembership | null> {
  return prisma.familyMembership.findUnique({
    where: {
      userId_familyId: { userId, familyId },
    },
  });
}

/**
 * Get all families a user belongs to
 */
export async function getUserFamilies(userId: string) {
  return prisma.familyMembership.findMany({
    where: { userId },
    include: {
      family: true,
    },
    orderBy: { joinedAt: 'asc' },
  });
}

/**
 * Get user's primary/default family tree
 * Priority: 1) Linked person's family, 2) First family membership
 */
export async function getUserDefaultFamily(userId: string): Promise<string | null> {
  // First, check if user is linked to a Person
  const linkedPerson = await prisma.person.findFirst({
    where: { userId },
  });

  if (linkedPerson) {
    // Find which family tree this person belongs to
    // Look for relationships to find the root
    const familyRoot = await findPersonFamilyRoot(linkedPerson.id);
    if (familyRoot) {
      return familyRoot;
    }
  }

  // Fall back to first family membership
  const membership = await prisma.familyMembership.findFirst({
    where: { userId },
    orderBy: { joinedAt: 'asc' },
  });

  return membership?.familyId || null;
}

/**
 * Walk up parent-child relationships from `personId` and return the topmost
 * ancestor. Treats every PARENT_CHILD-style edge (including ADOPTED) as a
 * step upward. If the input has no parents, returns `personId` unchanged.
 *
 * Used to auto-promote the family root when a new parent is added higher
 * in the tree.
 */
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
 * Re-point a Family's rootPersonId to a new ancestor. Because
 * FamilyMembership.familyId is a foreign key to Family.rootPersonId,
 * Postgres won't let us update the unique key while memberships still
 * reference it. We work around that inside a single transaction:
 *   1. snapshot existing memberships
 *   2. delete them (FK becomes free)
 *   3. update Family.rootPersonId
 *   4. recreate memberships under the new id
 *
 * Idempotent: if the family already points at `newRootPersonId`, this is
 * a no-op.
 *
 * Returns true if the root was changed, false if it was already current.
 */
export async function reassignFamilyRoot(
  oldRootPersonId: string,
  newRootPersonId: string
): Promise<boolean> {
  if (oldRootPersonId === newRootPersonId) return false;

  // Verify both persons exist before doing any destructive work.
  const [newRootPerson, family] = await Promise.all([
    prisma.person.findUnique({ where: { id: newRootPersonId }, select: { id: true } }),
    prisma.family.findUnique({ where: { rootPersonId: oldRootPersonId } }),
  ]);
  if (!newRootPerson) throw new Error('New root person not found');
  if (!family) throw new Error('Family not found for current root');

  // Make sure the new id isn't already a Family root for some other tree —
  // rootPersonId is @unique so a clash would error inside the transaction.
  const clash = await prisma.family.findUnique({
    where: { rootPersonId: newRootPersonId },
    select: { id: true },
  });
  if (clash) {
    throw new Error('That person is already the root of another family');
  }

  await prisma.$transaction(async (tx) => {
    const memberships = await tx.familyMembership.findMany({
      where: { familyId: oldRootPersonId },
      select: { userId: true, role: true, joinedAt: true },
    });

    if (memberships.length > 0) {
      await tx.familyMembership.deleteMany({ where: { familyId: oldRootPersonId } });
    }

    await tx.family.update({
      where: { rootPersonId: oldRootPersonId },
      data: { rootPersonId: newRootPersonId },
    });

    if (memberships.length > 0) {
      await tx.familyMembership.createMany({
        data: memberships.map((m) => ({
          userId: m.userId,
          familyId: newRootPersonId,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      });
    }
  });

  return true;
}

/**
 * Auto-promote the family root if `personId` (or anyone above them) is
 * higher in the tree than the currently stored root. Safe to call after
 * any PARENT_CHILD relationship is created. Returns the new (or
 * unchanged) root id, or null if no Family record exists for this tree.
 */
export async function promoteFamilyRootIfHigher(
  personId: string
): Promise<string | null> {
  const currentRoot = await findPersonFamilyRoot(personId);
  if (!currentRoot) return null;

  const topmost = await findTopmostAncestor(currentRoot);
  if (topmost === currentRoot) return currentRoot;

  // Topmost is strictly above the current root — promote.
  await reassignFamilyRoot(currentRoot, topmost);
  return topmost;
}

/**
 * Find the root person ID of the family tree a person belongs to
 */
export async function findPersonFamilyRoot(personId: string): Promise<string | null> {
  const relationships = await prisma.relationship.findMany({
    where: {
      OR: [
        { childId: personId },
        { parentId: personId },
        { spouse1Id: personId },
        { spouse2Id: personId },
      ],
    },
  });

  // If no relationships, this person might be a root
  if (relationships.length === 0) {
    // Check if this person is a root of a family
    const family = await prisma.family.findUnique({
      where: { rootPersonId: personId },
    });
    return family ? personId : null;
  }

  // Traverse up to find the root (person with no parents)
  const visited = new Set<string>();
  const queue = [personId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    // Check if this person is a family root
    const family = await prisma.family.findUnique({
      where: { rootPersonId: currentId },
    });
    if (family) {
      return currentId;
    }

    // Find parents of current person
    const parentRelations = await prisma.relationship.findMany({
      where: {
        type: 'PARENT_CHILD',
        childId: currentId,
      },
    });

    for (const rel of parentRelations) {
      if (rel.parentId && !visited.has(rel.parentId)) {
        queue.push(rel.parentId);
      }
    }
  }

  // If no root found, return the oldest ancestor found
  return null;
}

/**
 * Add user to a family tree
 */
export async function addUserToFamily(
  userId: string,
  familyId: string,
  role: FamilyRole = 'MEMBER'
): Promise<FamilyMembership> {
  return prisma.familyMembership.upsert({
    where: {
      userId_familyId: { userId, familyId },
    },
    create: {
      userId,
      familyId,
      role,
    },
    update: {
      role,
    },
  });
}

/**
 * Promote user to Family Admin
 */
export async function promoteToFamilyAdmin(
  actorId: string,
  targetUserId: string,
  familyId: string
): Promise<{ success: boolean; error?: string }> {
  // Check actor permissions
  const [actorIsSystemAdmin, actorIsFamilyAdmin] = await Promise.all([
    isSystemAdmin(actorId),
    isFamilyAdmin(actorId, familyId),
  ]);

  if (!actorIsSystemAdmin && !actorIsFamilyAdmin) {
    return { success: false, error: 'Not authorized to promote Family Admins' };
  }

  // Check target is a member
  const targetMembership = await getFamilyMembership(targetUserId, familyId);
  if (!targetMembership) {
    return { success: false, error: 'User must be a member of this family tree' };
  }

  // Promote
  await prisma.familyMembership.update({
    where: { id: targetMembership.id },
    data: { role: 'ADMIN' },
  });

  return { success: true };
}

/**
 * Get all Family Admins for a tree
 */
export async function getFamilyAdmins(familyId: string) {
  return prisma.familyMembership.findMany({
    where: {
      familyId,
      role: 'ADMIN',
    },
    include: {
      user: true,
    },
  });
}

/**
 * Get all verified members of a family tree (for approval notifications)
 */
export async function getVerifiedFamilyMembers(familyId: string) {
  return prisma.familyMembership.findMany({
    where: { familyId },
    include: { user: true },
  });
}

/**
 * Notify all Family Admins of a specific tree
 */
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

/**
 * Notify all verified family members (for new person verification)
 */
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
    ? members.filter((m) => m.userId !== excludeUserId)
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

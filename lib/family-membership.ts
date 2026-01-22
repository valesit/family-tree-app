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
 * Check if a user is a verified member of a family tree
 */
export async function isVerifiedMember(userId: string, familyId: string): Promise<boolean> {
  const membership = await prisma.familyMembership.findUnique({
    where: {
      userId_familyId: { userId, familyId },
    },
  });
  return membership !== null && membership.role !== 'PENDING';
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

  // Check target is a verified member
  const targetMembership = await getFamilyMembership(targetUserId, familyId);
  if (!targetMembership) {
    return { success: false, error: 'User must be a member of this family tree' };
  }
  if (targetMembership.role === 'PENDING') {
    return { success: false, error: 'User must be verified before becoming Family Admin' };
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
    where: {
      familyId,
      role: { in: ['ADMIN', 'MEMBER'] },
    },
    include: {
      user: true,
    },
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

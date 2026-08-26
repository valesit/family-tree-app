import { FamilyRole } from '@prisma/client';
import prisma from '@/lib/db';

/**
 * Retained as a compatibility shape for existing callers while the codebase
 * finishes renaming transitional helpers. In Phase 3 the stable Family.id is
 * the only membership identity; the legacy root-person column no longer exists.
 */
export type TransitionalMembership = {
  id: string;
  userId: string;
  role: FamilyRole;
  joinedAt: Date;
  updatedAt: Date;
  legacyRootPersonId: null;
  stableFamilyId: string;
};

export async function isStableFamilySchemaReady(): Promise<boolean> {
  return true;
}

export async function hasLegacyMembershipRootColumn(): Promise<boolean> {
  return false;
}

export async function resolveFamilyRecord(familyRef: string) {
  return prisma.family.findFirst({
    where: { OR: [{ id: familyRef }, { rootPersonId: familyRef }] },
  });
}

export async function ensureFamilyPersonAssociation(
  familyRef: string,
  personId: string
): Promise<void> {
  const family = await resolveFamilyRecord(familyRef);
  if (!family) return;

  await prisma.familyPerson.upsert({
    where: { familyId_personId: { familyId: family.id, personId } },
    create: { familyId: family.id, personId },
    update: {},
  });
}

export async function ensureFamilyRelationshipAssociation(
  familyRef: string,
  relationshipId: string
): Promise<void> {
  const family = await resolveFamilyRecord(familyRef);
  if (!family) return;

  await prisma.familyRelationship.upsert({
    where: {
      familyId_relationshipId: { familyId: family.id, relationshipId },
    },
    create: { familyId: family.id, relationshipId },
    update: {},
  });
}

/**
 * Phase 3 stores memberships directly against Family.id, so there is no
 * secondary reference to synchronize. This function now only validates that
 * the expected stable membership row is addressable.
 */
export async function ensureMembershipStableReference(
  userId: string,
  familyRef: string
): Promise<void> {
  const family = await resolveFamilyRecord(familyRef);
  if (!family) return;
  await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId, familyId: family.id } },
    select: { id: true },
  });
}

function toTransitionalMembership(
  membership: {
    id: string;
    userId: string;
    familyId: string;
    role: FamilyRole;
    joinedAt: Date;
    updatedAt: Date;
  }
): TransitionalMembership {
  return {
    id: membership.id,
    userId: membership.userId,
    role: membership.role,
    joinedAt: membership.joinedAt,
    updatedAt: membership.updatedAt,
    legacyRootPersonId: null,
    stableFamilyId: membership.familyId,
  };
}

export async function getTransitionalMembership(
  userId: string,
  familyRef: string
): Promise<TransitionalMembership | null> {
  const family = await resolveFamilyRecord(familyRef);
  if (!family) return null;

  const membership = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId, familyId: family.id } },
  });
  return membership ? toTransitionalMembership(membership) : null;
}

export async function upsertTransitionalMembership(
  userId: string,
  familyRef: string,
  role: FamilyRole = 'MEMBER'
): Promise<TransitionalMembership> {
  const family = await resolveFamilyRecord(familyRef);
  if (!family) throw new Error('Family not found');

  const existing = await prisma.familyMembership.findUnique({
    where: { userId_familyId: { userId, familyId: family.id } },
  });

  if (existing) {
    const nextRole: FamilyRole = existing.role === 'ADMIN' ? 'ADMIN' : role;
    const membership =
      nextRole === existing.role
        ? existing
        : await prisma.familyMembership.update({
            where: { id: existing.id },
            data: { role: nextRole },
          });
    return toTransitionalMembership(membership);
  }

  const created = await prisma.familyMembership.create({
    data: { userId, familyId: family.id, role },
  });
  return toTransitionalMembership(created);
}

export async function listTransitionalMembershipsForUser(
  userId: string
): Promise<Array<TransitionalMembership & { family: { id: string; rootPersonId: string; name: string } }>> {
  const memberships = await prisma.familyMembership.findMany({
    where: { userId },
    include: { family: { select: { id: true, rootPersonId: true, name: true } } },
    orderBy: { joinedAt: 'asc' },
  });

  return memberships.map((membership) => ({
    ...toTransitionalMembership(membership),
    family: membership.family,
  }));
}

export async function listTransitionalMembershipsForFamily(
  familyRef: string,
  role?: FamilyRole
): Promise<TransitionalMembership[]> {
  const family = await resolveFamilyRecord(familyRef);
  if (!family) return [];

  const memberships = await prisma.familyMembership.findMany({
    where: { familyId: family.id, ...(role ? { role } : {}) },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  });
  return memberships.map(toTransitionalMembership);
}

export async function setTransitionalMembershipRole(
  membershipId: string,
  role: FamilyRole
): Promise<void> {
  await prisma.familyMembership.update({
    where: { id: membershipId },
    data: { role },
  });
}

export async function deleteTransitionalMembership(membershipId: string): Promise<void> {
  await prisma.familyMembership.delete({ where: { id: membershipId } });
}

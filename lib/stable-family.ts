import { randomUUID } from 'node:crypto';
import { FamilyRole, Prisma } from '@prisma/client';
import prisma from '@/lib/db';

export type TransitionalMembership = {
  id: string;
  userId: string;
  role: FamilyRole;
  joinedAt: Date;
  updatedAt: Date;
  legacyRootPersonId: string | null;
  stableFamilyId: string | null;
};

let phaseOneReadyPromise: Promise<boolean> | null = null;
let legacyColumnPromise: Promise<boolean> | null = null;

/**
 * Phase 1 is additive. Until it has been applied, callers can continue using
 * the legacy membership path. Once the stable column/join tables exist this
 * module automatically treats Family.id as the source of truth.
 */
export function isStableFamilySchemaReady(): Promise<boolean> {
  if (!phaseOneReadyPromise) {
    phaseOneReadyPromise = prisma
      .$queryRaw<Array<{ ready: boolean }>>(Prisma.sql`
        SELECT (
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'FamilyMembership'
              AND column_name = 'familyRecordId'
          )
          AND to_regclass('public."FamilyPerson"') IS NOT NULL
          AND to_regclass('public."FamilyRelationship"') IS NOT NULL
        ) AS ready
      `)
      .then((rows) => Boolean(rows[0]?.ready))
      .catch(() => false);
  }
  return phaseOneReadyPromise;
}

/** The old root-person column may remain during Phase 2 as a compatibility shim. */
export function hasLegacyMembershipRootColumn(): Promise<boolean> {
  if (!legacyColumnPromise) {
    legacyColumnPromise = prisma
      .$queryRaw<Array<{ present: boolean }>>(Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'FamilyMembership'
            AND column_name = 'familyId'
        ) AS present
      `)
      .then((rows) => Boolean(rows[0]?.present))
      .catch(() => false);
  }
  return legacyColumnPromise;
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
  if (!(await isStableFamilySchemaReady())) return;
  const family = await resolveFamilyRecord(familyRef);
  if (!family) return;

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "FamilyPerson" ("familyId", "personId", "createdAt")
    VALUES (${family.id}, ${personId}, CURRENT_TIMESTAMP)
    ON CONFLICT ("familyId", "personId") DO NOTHING
  `);
}

export async function ensureFamilyRelationshipAssociation(
  familyRef: string,
  relationshipId: string
): Promise<void> {
  if (!(await isStableFamilySchemaReady())) return;
  const family = await resolveFamilyRecord(familyRef);
  if (!family) return;

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "FamilyRelationship" ("familyId", "relationshipId", "createdAt")
    VALUES (${family.id}, ${relationshipId}, CURRENT_TIMESTAMP)
    ON CONFLICT ("familyId", "relationshipId") DO NOTHING
  `);
}

export async function ensureMembershipStableReference(
  userId: string,
  familyRef: string
): Promise<void> {
  if (!(await isStableFamilySchemaReady())) return;
  const family = await resolveFamilyRecord(familyRef);
  if (!family) return;

  if (await hasLegacyMembershipRootColumn()) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "FamilyMembership"
      SET "familyRecordId" = ${family.id},
          "familyId" = ${family.rootPersonId},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${userId}
        AND (
          "familyRecordId" = ${family.id}
          OR "familyId" = ${family.rootPersonId}
        )
    `);
  } else {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "FamilyMembership"
      SET "familyRecordId" = ${family.id},
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${userId}
        AND "familyRecordId" = ${family.id}
    `);
  }
}

export async function getTransitionalMembership(
  userId: string,
  familyRef: string
): Promise<TransitionalMembership | null> {
  const family = await resolveFamilyRecord(familyRef);
  if (!family) return null;

  if (!(await isStableFamilySchemaReady())) {
    const legacy = await prisma.familyMembership.findUnique({
      where: { userId_familyId: { userId, familyId: family.rootPersonId } },
    });
    return legacy
      ? {
          id: legacy.id,
          userId: legacy.userId,
          role: legacy.role,
          joinedAt: legacy.joinedAt,
          updatedAt: legacy.updatedAt,
          legacyRootPersonId: legacy.familyId,
          stableFamilyId: null,
        }
      : null;
  }

  if (await hasLegacyMembershipRootColumn()) {
    const rows = await prisma.$queryRaw<TransitionalMembership[]>(Prisma.sql`
      SELECT
        fm."id", fm."userId", fm."role", fm."joinedAt", fm."updatedAt",
        fm."familyId" AS "legacyRootPersonId",
        fm."familyRecordId" AS "stableFamilyId"
      FROM "FamilyMembership" fm
      WHERE fm."userId" = ${userId}
        AND (fm."familyRecordId" = ${family.id} OR fm."familyId" = ${family.rootPersonId})
      ORDER BY CASE WHEN fm."familyRecordId" = ${family.id} THEN 0 ELSE 1 END,
               fm."joinedAt" ASC
      LIMIT 1
    `);
    const membership = rows[0] ?? null;
    if (membership && membership.stableFamilyId !== family.id) {
      await ensureMembershipStableReference(userId, family.id);
      membership.stableFamilyId = family.id;
    }
    return membership;
  }

  const rows = await prisma.$queryRaw<TransitionalMembership[]>(Prisma.sql`
    SELECT
      fm."id", fm."userId", fm."role", fm."joinedAt", fm."updatedAt",
      NULL::text AS "legacyRootPersonId",
      fm."familyRecordId" AS "stableFamilyId"
    FROM "FamilyMembership" fm
    WHERE fm."userId" = ${userId}
      AND fm."familyRecordId" = ${family.id}
    ORDER BY fm."joinedAt" ASC
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function upsertTransitionalMembership(
  userId: string,
  familyRef: string,
  role: FamilyRole = 'MEMBER'
): Promise<TransitionalMembership> {
  const family = await resolveFamilyRecord(familyRef);
  if (!family) throw new Error('Family not found');

  let existing = await getTransitionalMembership(userId, family.id);
  if (existing) {
    const nextRole: FamilyRole = existing.role === 'ADMIN' ? 'ADMIN' : role;
    if (nextRole !== existing.role) {
      await setTransitionalMembershipRole(existing.id, nextRole);
      existing = { ...existing, role: nextRole };
    }
    await ensureMembershipStableReference(userId, family.id);
    return {
      ...existing,
      stableFamilyId: (await isStableFamilySchemaReady()) ? family.id : null,
    };
  }

  if (!(await isStableFamilySchemaReady())) {
    const created = await prisma.familyMembership.create({
      data: { id: randomUUID(), userId, familyId: family.rootPersonId, role },
    });
    return {
      id: created.id,
      userId: created.userId,
      role: created.role,
      joinedAt: created.joinedAt,
      updatedAt: created.updatedAt,
      legacyRootPersonId: created.familyId,
      stableFamilyId: null,
    };
  }

  const id = randomUUID();
  if (await hasLegacyMembershipRootColumn()) {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "FamilyMembership"
        ("id", "userId", "familyId", "familyRecordId", "role", "joinedAt", "updatedAt")
      VALUES
        (${id}, ${userId}, ${family.rootPersonId}, ${family.id},
         CAST(${role} AS "FamilyRole"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
  } else {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "FamilyMembership"
        ("id", "userId", "familyRecordId", "role", "joinedAt", "updatedAt")
      VALUES
        (${id}, ${userId}, ${family.id}, CAST(${role} AS "FamilyRole"),
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
  }

  const created = await getTransitionalMembership(userId, family.id);
  if (!created) throw new Error('Failed to create family membership');
  return created;
}

export async function listTransitionalMembershipsForUser(
  userId: string
): Promise<Array<TransitionalMembership & { family: { id: string; rootPersonId: string; name: string } }>> {
  if (!(await isStableFamilySchemaReady())) {
    const legacy = await prisma.familyMembership.findMany({
      where: { userId },
      include: { family: true },
      orderBy: { joinedAt: 'asc' },
    });
    return legacy.map((membership) => ({
      id: membership.id,
      userId: membership.userId,
      role: membership.role,
      joinedAt: membership.joinedAt,
      updatedAt: membership.updatedAt,
      legacyRootPersonId: membership.familyId,
      stableFamilyId: membership.family.id,
      family: {
        id: membership.family.id,
        rootPersonId: membership.family.rootPersonId,
        name: membership.family.name,
      },
    }));
  }

  const legacySelect = (await hasLegacyMembershipRootColumn())
    ? Prisma.sql`fm."familyId" AS "legacyRootPersonId"`
    : Prisma.sql`NULL::text AS "legacyRootPersonId"`;

  return prisma.$queryRaw(Prisma.sql`
    SELECT
      fm."id", fm."userId", fm."role", fm."joinedAt", fm."updatedAt",
      ${legacySelect},
      fm."familyRecordId" AS "stableFamilyId",
      json_build_object('id', f."id", 'rootPersonId', f."rootPersonId", 'name', f."name") AS "family"
    FROM "FamilyMembership" fm
    JOIN "Family" f ON f."id" = fm."familyRecordId"
    WHERE fm."userId" = ${userId}
    ORDER BY fm."joinedAt" ASC
  `);
}

export async function listTransitionalMembershipsForFamily(
  familyRef: string,
  role?: FamilyRole
): Promise<TransitionalMembership[]> {
  const family = await resolveFamilyRecord(familyRef);
  if (!family) return [];

  if (!(await isStableFamilySchemaReady())) {
    const legacy = await prisma.familyMembership.findMany({
      where: { familyId: family.rootPersonId, ...(role ? { role } : {}) },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
    return legacy.map((membership) => ({
      id: membership.id,
      userId: membership.userId,
      role: membership.role,
      joinedAt: membership.joinedAt,
      updatedAt: membership.updatedAt,
      legacyRootPersonId: membership.familyId,
      stableFamilyId: null,
    }));
  }

  const legacySelect = (await hasLegacyMembershipRootColumn())
    ? Prisma.sql`fm."familyId" AS "legacyRootPersonId"`
    : Prisma.sql`NULL::text AS "legacyRootPersonId"`;

  if (role) {
    return prisma.$queryRaw(Prisma.sql`
      SELECT
        fm."id", fm."userId", fm."role", fm."joinedAt", fm."updatedAt",
        ${legacySelect}, fm."familyRecordId" AS "stableFamilyId"
      FROM "FamilyMembership" fm
      WHERE fm."familyRecordId" = ${family.id}
        AND fm."role" = CAST(${role} AS "FamilyRole")
      ORDER BY fm."joinedAt" ASC
    `);
  }

  return prisma.$queryRaw(Prisma.sql`
    SELECT
      fm."id", fm."userId", fm."role", fm."joinedAt", fm."updatedAt",
      ${legacySelect}, fm."familyRecordId" AS "stableFamilyId"
    FROM "FamilyMembership" fm
    WHERE fm."familyRecordId" = ${family.id}
    ORDER BY fm."role" ASC, fm."joinedAt" ASC
  `);
}

export async function setTransitionalMembershipRole(
  membershipId: string,
  role: FamilyRole
): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "FamilyMembership"
    SET "role" = CAST(${role} AS "FamilyRole"), "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${membershipId}
  `);
}

export async function deleteTransitionalMembership(membershipId: string): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    DELETE FROM "FamilyMembership" WHERE "id" = ${membershipId}
  `);
}

# Stable Family ID migration

The permanent identity of a family is `Family.id`. `Family.rootPersonId` is presentation state and may change whenever a better root ancestor is selected.

## Rollout order

1. Deploy the application changes in PR #11.
2. Run the Phase 1 additive SQL previously supplied:
   - add/backfill `FamilyMembership.familyRecordId -> Family.id`
   - create/backfill `FamilyPerson`
   - create/backfill `FamilyRelationship`
3. Verify there are no missing stable membership references:

```sql
SELECT COUNT(*) AS memberships_missing_family_record
FROM "FamilyMembership"
WHERE "familyRecordId" IS NULL;
```

Expected: `0`.

4. Exercise the application before Phase 2:
   - load the tree as a normal member and as an admin
   - add a child to a married couple
   - add/change a spouse
   - change the family root
   - add/promote a Family Admin
   - confirm new `FamilyPerson` and `FamilyRelationship` rows are created
5. Run the revised Phase 2 SQL below.

## Important

Do **not** use the earlier Phase 2 script that renamed `familyRecordId` to `familyId` and immediately removed the legacy column. The application now uses `familyRecordId` as the stable database field during the zero-downtime transition.

## Revised Phase 2: decouple memberships from rootPersonId

This removes the structural dependency on the mutable root while keeping the old physical `FamilyMembership.familyId` column temporarily as a compatibility/rollback field. `familyRecordId` becomes required and authoritative.

```sql
BEGIN;

-- Safety: every membership must already point at a permanent Family.id.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "FamilyMembership"
    WHERE "familyRecordId" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot run Phase 2: some FamilyMembership.familyRecordId values are NULL';
  END IF;
END $$;

-- Stable Family.id is now mandatory.
ALTER TABLE "FamilyMembership"
ALTER COLUMN "familyRecordId" SET NOT NULL;

-- The legacy root-person FK is the coupling we are removing.
ALTER TABLE "FamilyMembership"
DROP CONSTRAINT IF EXISTS "FamilyMembership_familyId_fkey";

-- The legacy root field is no longer authoritative. Keep it nullable for
-- rollback/compatibility; the app reads membership scope from familyRecordId.
ALTER TABLE "FamilyMembership"
ALTER COLUMN "familyId" DROP NOT NULL;

-- Remove legacy membership uniqueness. Stable uniqueness from Phase 1 remains.
ALTER TABLE "FamilyMembership"
DROP CONSTRAINT IF EXISTS "FamilyMembership_userId_familyId_key";

DROP INDEX IF EXISTS "FamilyMembership_familyId_idx";

-- Re-assert the stable FK in case Phase 1 was applied manually with a
-- differently ordered rollout.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FamilyMembership_familyRecordId_fkey'
  ) THEN
    ALTER TABLE "FamilyMembership"
    ADD CONSTRAINT "FamilyMembership_familyRecordId_fkey"
    FOREIGN KEY ("familyRecordId")
    REFERENCES "Family"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS
"FamilyMembership_familyRecordId_idx"
ON "FamilyMembership" ("familyRecordId");

CREATE UNIQUE INDEX IF NOT EXISTS
"FamilyMembership_userId_familyRecordId_key"
ON "FamilyMembership" ("userId", "familyRecordId");

COMMIT;
```

## Phase 2 verification

```sql
-- Must be zero.
SELECT COUNT(*)
FROM "FamilyMembership" fm
LEFT JOIN "Family" f
  ON f."id" = fm."familyRecordId"
WHERE f."id" IS NULL;

-- There should be no duplicate user/family memberships.
SELECT "userId", "familyRecordId", COUNT(*)
FROM "FamilyMembership"
GROUP BY "userId", "familyRecordId"
HAVING COUNT(*) > 1;
```

Both queries should return zero problem rows.

## What the application does during the transition

- Family membership authorization resolves both root-person IDs and permanent `Family.id` values, but stable membership storage uses `familyRecordId` whenever Phase 1 is present.
- New people are dual-written into `FamilyPerson`.
- New relationships are dual-written into `FamilyRelationship`.
- New/updated memberships populate `familyRecordId` and preserve the legacy root field while it exists.
- Root reassignment preserves the same permanent `Family.id`; membership identity no longer changes conceptually with the root.
- API responses expose `familyRecordId` while retaining root IDs for existing `/tree?rootId=` navigation.

## Later cleanup (Phase 3)

After Phase 2 has been stable in production, update the Prisma model so the logical membership `familyId` maps directly to the stable family reference, then remove the deprecated physical `FamilyMembership.familyId` root-person column. Do not perform that cleanup in the same production change as Phase 2; keeping the deprecated field temporarily gives a clean rollback path.

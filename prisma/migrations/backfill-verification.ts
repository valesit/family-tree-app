/**
 * Migration script to backfill existing data with new verification and family membership fields
 * 
 * This script:
 * 1. Marks all existing persons as verified (isVerified = true)
 * 2. Creates FamilyMembership records for users linked to persons
 * 3. Sets tree creators as Family Admins where detectable
 * 4. Ensures all families have at least one admin
 * 
 * Run with: npx tsx prisma/migrations/backfill-verification.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// Set up Prisma with the adapter (required for Prisma 7+)
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔄 Starting backfill migration...\n');

  // 1. Mark all existing persons as verified
  console.log('1️⃣  Marking all existing persons as verified...');
  const personsUpdateResult = await prisma.person.updateMany({
    where: {
      isVerified: false,
    },
    data: {
      isVerified: true,
      verifiedAt: new Date(),
    },
  });
  console.log(`   ✅ Updated ${personsUpdateResult.count} persons to verified status\n`);

  // 2. Get all families
  console.log('2️⃣  Processing family trees...');
  const families = await prisma.family.findMany({
    include: {
      memberships: true,
    },
  });
  console.log(`   Found ${families.length} family trees\n`);

  // 3. For each family, create memberships for linked users
  console.log('3️⃣  Creating family memberships for linked users...');
  let membershipsCreated = 0;
  let adminsCreated = 0;

  for (const family of families) {
    // Find all persons in this family tree
    const personsInFamily = await findPersonsInFamily(family.rootPersonId);
    
    // Get users linked to these persons
    const linkedUsers = await prisma.person.findMany({
      where: {
        id: { in: personsInFamily },
        userId: { not: null },
      },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
      },
    });

    for (const person of linkedUsers) {
      if (!person.userId) continue;

      // Check if membership already exists
      const existingMembership = await prisma.familyMembership.findUnique({
        where: {
          userId_familyId: {
            userId: person.userId,
            familyId: family.rootPersonId,
          },
        },
      });

      if (!existingMembership) {
        // Determine role - if this is the root person or family creator, make them admin
        const isRootPerson = person.id === family.rootPersonId;
        const isCreator = family.createdById === person.userId;
        const role = (isRootPerson || isCreator) ? 'ADMIN' : 'MEMBER';

        await prisma.familyMembership.create({
          data: {
            userId: person.userId,
            familyId: family.rootPersonId,
            role,
          },
        });

        membershipsCreated++;
        if (role === 'ADMIN') {
          adminsCreated++;
          console.log(`   👑 Created ADMIN membership for ${person.firstName} ${person.lastName} in ${family.name}`);
        }
      }
    }

    // Ensure family has at least one admin
    const familyAdmins = await prisma.familyMembership.findMany({
      where: {
        familyId: family.rootPersonId,
        role: 'ADMIN',
      },
    });

    if (familyAdmins.length === 0) {
      // Find any linked user and make them admin
      const anyLinkedUser = await prisma.person.findFirst({
        where: {
          id: { in: personsInFamily },
          userId: { not: null },
        },
        select: { userId: true, firstName: true, lastName: true },
      });

      if (anyLinkedUser?.userId) {
        await prisma.familyMembership.upsert({
          where: {
            userId_familyId: {
              userId: anyLinkedUser.userId,
              familyId: family.rootPersonId,
            },
          },
          create: {
            userId: anyLinkedUser.userId,
            familyId: family.rootPersonId,
            role: 'ADMIN',
          },
          update: {
            role: 'ADMIN',
          },
        });
        adminsCreated++;
        console.log(`   👑 Promoted ${anyLinkedUser.firstName} ${anyLinkedUser.lastName} to ADMIN for ${family.name} (no admins found)`);
      } else {
        console.log(`   ⚠️  Family "${family.name}" has no linked users - no admin assigned`);
      }
    }
  }

  console.log(`\n   ✅ Created ${membershipsCreated} family memberships`);
  console.log(`   ✅ Created/promoted ${adminsCreated} family admins\n`);

  // 4. Set System Admin user's linked person as verified by admin
  console.log('4️⃣  Updating System Admin linked persons...');
  const systemAdmins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    include: { linkedPerson: true },
  });

  for (const admin of systemAdmins) {
    if (admin.linkedPerson) {
      await prisma.person.update({
        where: { id: admin.linkedPerson.id },
        data: {
          isVerified: true,
          verifiedById: admin.id,
          verifiedAt: new Date(),
        },
      });
      console.log(`   ✅ Set ${admin.linkedPerson.firstName} ${admin.linkedPerson.lastName} as verified by admin ${admin.name}`);
    }
  }

  console.log('\n🎉 Backfill migration completed successfully!\n');
  
  // Summary
  const totalPersons = await prisma.person.count();
  const verifiedPersons = await prisma.person.count({ where: { isVerified: true } });
  const totalMemberships = await prisma.familyMembership.count();
  const totalAdmins = await prisma.familyMembership.count({ where: { role: 'ADMIN' } });

  console.log('📊 Summary:');
  console.log(`   - Total persons: ${totalPersons}`);
  console.log(`   - Verified persons: ${verifiedPersons}`);
  console.log(`   - Total family memberships: ${totalMemberships}`);
  console.log(`   - Family admins: ${totalAdmins}`);
}

/**
 * Find all person IDs that belong to a family tree (by traversing relationships)
 */
async function findPersonsInFamily(rootPersonId: string): Promise<string[]> {
  const personIds = new Set<string>();
  const queue = [rootPersonId];
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (personIds.has(currentId)) continue;
    personIds.add(currentId);

    // Find all related persons
    const relationships = await prisma.relationship.findMany({
      where: {
        OR: [
          { parentId: currentId },
          { childId: currentId },
          { spouse1Id: currentId },
          { spouse2Id: currentId },
        ],
      },
    });

    for (const rel of relationships) {
      if (rel.parentId && !personIds.has(rel.parentId)) queue.push(rel.parentId);
      if (rel.childId && !personIds.has(rel.childId)) queue.push(rel.childId);
      if (rel.spouse1Id && !personIds.has(rel.spouse1Id)) queue.push(rel.spouse1Id);
      if (rel.spouse2Id && !personIds.has(rel.spouse2Id)) queue.push(rel.spouse2Id);
    }
  }

  return Array.from(personIds);
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

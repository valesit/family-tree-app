import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

const PARENT_CHILD_TYPES = ['PARENT_CHILD', 'ADOPTED', 'STEP_PARENT', 'STEP_CHILD', 'FOSTER'] as const;

async function getStats() {
  const [totalMembers, livingCount, deceasedCount, maleCount, femaleCount, marriageCount, oldestMember, youngestLiving] =
    await Promise.all([
      prisma.person.count(),
      prisma.person.count({ where: { isLiving: true } }),
      prisma.person.count({ where: { isLiving: false } }),
      prisma.person.count({ where: { gender: 'MALE' } }),
      prisma.person.count({ where: { gender: 'FEMALE' } }),
      prisma.relationship.count({ where: { type: 'SPOUSE' } }),
      prisma.person.findFirst({
        where: { birthDate: { not: null } },
        orderBy: { birthDate: 'asc' },
        select: { firstName: true, lastName: true, birthDate: true },
      }),
      prisma.person.findFirst({
        where: { birthDate: { not: null }, isLiving: true },
        orderBy: { birthDate: 'desc' },
        select: { firstName: true, lastName: true, birthDate: true },
      }),
    ]);
  return {
    totalMembers,
    livingCount,
    deceasedCount,
    maleCount,
    femaleCount,
    marriageCount,
    oldestMember: oldestMember
      ? { name: `${oldestMember.firstName} ${oldestMember.lastName}`, birthYear: new Date(oldestMember.birthDate!).getFullYear() }
      : null,
    youngestLiving: youngestLiving
      ? { name: `${youngestLiving.firstName} ${youngestLiving.lastName}`, birthYear: new Date(youngestLiving.birthDate!).getFullYear() }
      : null,
  };
}

export async function GET() {
  try {
    // 1. Try Family table first (explicit family trees)
    const familyRecords = await prisma.family.findMany({
      include: { createdBy: true },
    });

    if (familyRecords.length > 0) {
      const families = await Promise.all(
        familyRecords.map(async (f) => {
          const person = await prisma.person.findUnique({
            where: { id: f.rootPersonId },
            include: { profileImage: true },
          });
          if (!person) return null;
          const memberCount = await countFamilyMembers(person.id);
          const generationCount = await countGenerations(person.id);
          const notableCount = await prisma.person.count({
            where: { lastName: person.lastName, isNotable: true },
          });
          return {
            id: person.id,
            familyName: f.name,
            foundingAncestor: {
              id: person.id,
              firstName: person.firstName,
              lastName: person.lastName,
              profileImage: person.profileImage?.url || null,
              birthYear: person.birthDate ? new Date(person.birthDate).getFullYear() : null,
              birthPlace: person.birthPlace,
            },
            memberCount,
            generationCount,
            notableCount,
            lastUpdated: f.updatedAt?.toISOString() || new Date().toISOString(),
          };
        })
      );
      const validFamilies = families.filter((f): f is NonNullable<typeof f> => f !== null);
      return NextResponse.json({
        success: true,
        data: {
          families: validFamilies.sort((a, b) => b.memberCount - a.memberCount),
          stats: await getStats(),
        },
      });
    }

    // 2. Fallback: infer from Person/Relationship (roots = never the child in parent-child relations)
    const [persons, relationships] = await Promise.all([
      prisma.person.findMany({ include: { profileImage: true } }),
      prisma.relationship.findMany({
        where: { type: { in: [...PARENT_CHILD_TYPES] } },
        select: { childId: true },
      }),
    ]);
    const childIds = new Set(
      relationships.map((r) => r.childId).filter((id): id is string => !!id)
    );
    let rootPersons = persons
      .filter((p) => !childIds.has(p.id))
      .sort((a, b) => {
        if (!a.birthDate) return 1;
        if (!b.birthDate) return -1;
        return a.birthDate.getTime() - b.birthDate.getTime();
      });

    // 3. Fallback: if we have persons but no roots (bad data), use oldest person as single family
    if (rootPersons.length === 0 && persons.length > 0) {
      const sorted = [...persons].sort((a, b) => {
        if (!a.birthDate) return 1;
        if (!b.birthDate) return -1;
        return a.birthDate.getTime() - b.birthDate.getTime();
      });
      rootPersons = [sorted[0]];
    }

    // Group root persons by last name to form family units
    const familyGroups: { [key: string]: typeof rootPersons } = {};
    
    for (const person of rootPersons) {
      const familyKey = person.lastName.toUpperCase();
      if (!familyGroups[familyKey]) {
        familyGroups[familyKey] = [];
      }
      familyGroups[familyKey].push(person);
    }

    // Build family previews
    type FounderType = typeof rootPersons[number];
    const families = await Promise.all(
      Object.entries(familyGroups).map(async ([lastName, founders]) => {
        // Get the oldest founder as the main ancestor
        const mainAncestor = founders.reduce((oldest: FounderType, current: FounderType) => {
          if (!oldest.birthDate) return current;
          if (!current.birthDate) return oldest;
          return current.birthDate < oldest.birthDate ? current : oldest;
        }, founders[0]);

        // Count all descendants for this family
        const memberCount = await countFamilyMembers(mainAncestor.id);
        
        // Count generations
        const generationCount = await countGenerations(mainAncestor.id);
        
        // Count notable persons in this family
        const notableCount = await prisma.person.count({
          where: {
            lastName: lastName,
            isNotable: true
          }
        });

        // Get spouse surnames for the family name
        const spouseSurnames = await getSpouseSurnames(founders.map((f: { id: string }) => f.id), lastName);

        // Create family name (e.g., "Sithole" or "Sithole/Moyo")
        const familyName = spouseSurnames.length > 0 
          ? `${lastName}/${spouseSurnames[0]}`
          : lastName;

        return {
          id: mainAncestor.id,
          familyName,
          foundingAncestor: {
            id: mainAncestor.id,
            firstName: mainAncestor.firstName,
            lastName: mainAncestor.lastName,
            profileImage: mainAncestor.profileImage?.url || null,
            birthYear: mainAncestor.birthDate ? new Date(mainAncestor.birthDate).getFullYear() : null,
            birthPlace: mainAncestor.birthPlace,
          },
          memberCount,
          generationCount,
          notableCount,
          lastUpdated: mainAncestor.updatedAt?.toISOString() || new Date().toISOString(),
        };
      })
    );

    const stats = await getStats();

    return NextResponse.json({
      success: true,
      data: {
        families: families.sort((a: (typeof families)[number], b: (typeof families)[number]) => b.memberCount - a.memberCount),
        stats,
      }
    });
  } catch (error) {
    console.error('Error fetching families:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch families' },
      { status: 500 }
    );
  }
}

// Helper function to get spouse surnames
async function getSpouseSurnames(founderIds: string[], excludeLastName: string): Promise<string[]> {
  const spouseSurnames: string[] = [];
  
  for (const founderId of founderIds) {
    // Get spouse relationships where this person is spouse1
    const spouseRels1 = await prisma.relationship.findMany({
      where: {
        type: 'SPOUSE',
        spouse1Id: founderId,
      },
      include: {
        spouse2: { select: { lastName: true } }
      }
    });
    
    for (const rel of spouseRels1) {
      if (rel.spouse2 && rel.spouse2.lastName !== excludeLastName && !spouseSurnames.includes(rel.spouse2.lastName)) {
        spouseSurnames.push(rel.spouse2.lastName);
      }
    }
    
    // Get spouse relationships where this person is spouse2
    const spouseRels2 = await prisma.relationship.findMany({
      where: {
        type: 'SPOUSE',
        spouse2Id: founderId,
      },
      include: {
        spouse1: { select: { lastName: true } }
      }
    });
    
    for (const rel of spouseRels2) {
      if (rel.spouse1 && rel.spouse1.lastName !== excludeLastName && !spouseSurnames.includes(rel.spouse1.lastName)) {
        spouseSurnames.push(rel.spouse1.lastName);
      }
    }
  }
  
  return spouseSurnames;
}

// Helper function to count all family members recursively
async function countFamilyMembers(rootPersonId: string, visited = new Set<string>()): Promise<number> {
  if (visited.has(rootPersonId)) return 0;
  visited.add(rootPersonId);
  
  let count = 1;
  
  // Get children
  const childRelations = await prisma.relationship.findMany({
    where: {
      type: 'PARENT_CHILD',
      parentId: rootPersonId
    },
    select: { childId: true }
  });

  for (const rel of childRelations) {
    if (rel.childId) {
      count += await countFamilyMembers(rel.childId, visited);
    }
  }

  // Get spouse
  const spouseRelations = await prisma.relationship.findMany({
    where: {
      type: 'SPOUSE',
      OR: [
        { spouse1Id: rootPersonId },
        { spouse2Id: rootPersonId }
      ]
    },
    select: { spouse1Id: true, spouse2Id: true }
  });

  for (const rel of spouseRelations) {
    const spouseId = rel.spouse1Id === rootPersonId ? rel.spouse2Id : rel.spouse1Id;
    if (spouseId && !visited.has(spouseId)) {
      visited.add(spouseId);
      count += 1;
    }
  }

  return count;
}

// Helper function to count generations
async function countGenerations(rootPersonId: string, currentGen = 1, maxGen = { value: 1 }): Promise<number> {
  maxGen.value = Math.max(maxGen.value, currentGen);
  
  // Get children
  const childRelations = await prisma.relationship.findMany({
    where: {
      type: 'PARENT_CHILD',
      parentId: rootPersonId
    },
    select: { childId: true }
  });

  for (const rel of childRelations) {
    if (rel.childId) {
      await countGenerations(rel.childId, currentGen + 1, maxGen);
    }
  }

  return maxGen.value;
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { buildCollaborativeFamilyTree } from '@/lib/collaborative-tree';
import { collectTreeNodeIds } from '@/lib/tree-utils';
import { findPersonFamilyRoot } from '@/lib/family-membership';
import type { PersonWithRelations, TreeNode } from '@/types';

const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' };

async function getStats() {
  const [
    totalMembers,
    livingCount,
    deceasedCount,
    maleCount,
    femaleCount,
    marriageCount,
    oldestMember,
    youngestLiving,
  ] = await Promise.all([
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
      ? {
          name: `${oldestMember.firstName} ${oldestMember.lastName}`,
          birthYear: new Date(oldestMember.birthDate!).getFullYear(),
        }
      : null,
    youngestLiving: youngestLiving
      ? {
          name: `${youngestLiving.firstName} ${youngestLiving.lastName}`,
          birthYear: new Date(youngestLiving.birthDate!).getFullYear(),
        }
      : null,
  };
}

function generationCount(tree: TreeNode | null): number {
  if (!tree) return 0;
  if (!tree.children?.length) return 1;
  return 1 + Math.max(...tree.children.map((child) => generationCount(child)));
}

export async function GET() {
  try {
    const [persons, relationships, familyRecords] = await Promise.all([
      prisma.person.findMany({ include: { profileImage: true } }),
      prisma.relationship.findMany(),
      prisma.family.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);

    const personMap = new Map(persons.map((person) => [person.id, person]));
    const asTreePersons = persons as unknown as PersonWithRelations[];

    const buildPreview = async (rootId: string, familyName?: string, updatedAt?: Date) => {
      const person = personMap.get(rootId);
      if (!person) return null;

      const tree = buildCollaborativeFamilyTree(rootId, asTreePersons, relationships);
      const ids = collectTreeNodeIds(tree);
      const spouse = tree?.spouse || tree?.spouses?.[0];
      const inferredName =
        spouse && spouse.lastName !== person.lastName
          ? `${person.lastName}/${spouse.lastName}`
          : person.lastName;

      return {
        id: rootId,
        familyName: familyName || inferredName,
        foundingAncestor: {
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          profileImage: person.profileImage?.url || null,
          birthYear: person.birthDate ? new Date(person.birthDate).getFullYear() : null,
          birthPlace: person.birthPlace,
        },
        memberCount: ids.size,
        generationCount: generationCount(tree),
        notableCount: persons.filter((candidate) => ids.has(candidate.id) && candidate.isNotable).length,
        lastUpdated: (updatedAt || person.updatedAt || new Date()).toISOString(),
      };
    };

    // Existing Family rows are authoritative, but legacy versions could leave
    // multiple rows inside the same connected tree. Resolve every row through
    // the canonical family lookup and de-duplicate the previews by root id.
    const previewsByRoot = new Map<string, Awaited<ReturnType<typeof buildPreview>>>();
    for (const family of familyRecords) {
      const canonicalRoot =
        (await findPersonFamilyRoot(family.rootPersonId)) || family.rootPersonId;
      if (previewsByRoot.has(canonicalRoot)) continue;

      const canonicalFamily =
        familyRecords.find((candidate) => candidate.rootPersonId === canonicalRoot) || family;
      previewsByRoot.set(
        canonicalRoot,
        await buildPreview(canonicalRoot, canonicalFamily.name, canonicalFamily.updatedAt)
      );
    }

    let families = Array.from(previewsByRoot.values()).filter(
      (family): family is NonNullable<typeof family> => family !== null
    );

    // Fresh database fallback: infer candidate roots and choose the largest
    // collaborative tree. A spouse-only branch may also look parentless, but it
    // will naturally rank below the real ancestor because the couple-aware tree
    // rooted higher contains more people/generations.
    if (families.length === 0 && persons.length > 0) {
      const childIds = new Set(
        relationships
          .filter((relationship) => relationship.type === 'PARENT_CHILD')
          .map((relationship) => relationship.childId)
          .filter((id): id is string => Boolean(id))
      );

      const candidateRoots = persons.filter((person) => !childIds.has(person.id));
      const roots = candidateRoots.length > 0 ? candidateRoots : persons.slice(0, 1);
      families = (
        await Promise.all(roots.map((root) => buildPreview(root.id)))
      ).filter((family): family is NonNullable<typeof family> => family !== null);
    }

    const sorted = families.sort((a, b) => {
      if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
      return b.generationCount - a.generationCount;
    });
    const primary =
      sorted.find((family) => family.familyName.toLowerCase().includes('sithole')) ||
      sorted[0] ||
      null;

    if (primary && familyRecords.length === 0) {
      try {
        await prisma.family.upsert({
          where: { rootPersonId: primary.id },
          create: {
            rootPersonId: primary.id,
            name: primary.familyName,
            description: null,
            motto: null,
            crestImage: null,
          },
          update: {},
        });
      } catch (error) {
        console.error('Failed to persist auto-detected family root:', error);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          families: sorted,
          primaryFamilyId: primary?.id || null,
          stats: await getStats(),
        },
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error('Error fetching families:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch families' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

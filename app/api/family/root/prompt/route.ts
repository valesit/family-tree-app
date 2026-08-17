import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import { isFamilyAdmin, isSystemAdmin } from '@/lib/family-membership';

/**
 * GET /api/family/root/prompt
 *
 * Returns whether the current admin should be prompted to pick a canonical
 * root ancestor for the family tree, and (if so) up to 4 candidate
 * ancestors from the topmost no-parent group.
 *
 * Gating rules (all must hold for shouldPrompt=true):
 *   - Caller is authenticated.
 *   - Caller is System Admin OR a Family Admin.
 *   - There are ≥2 no-parent persons who share the largest same-last-name
 *     group.
 *   - At least one of those persons has ≥1 direct PARENT_CHILD child.
 *   - No existing Family.rootPersonId already equals one of the candidates
 *     (either no Family record exists, or the stored root is *not* in the
 *     candidate set — meaning we haven't picked yet).
 *
 * Guests (401/403) get shouldPrompt=false with an empty candidate list so
 * the client can render nothing without special-casing.
 */
export async function GET() {
  const emptyResponse = NextResponse.json({
    success: true,
    data: { shouldPrompt: false, candidates: [] as CandidatePerson[] },
  });

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return emptyResponse;
    }
    const user = session.user as SessionUser;

    // Load minimal data: persons, parent-child edges, and existing families.
    // We deliberately keep the payload small — this endpoint is polled by
    // every logged-in admin on both the home and tree pages.
    const [persons, parentChildRels, families] = await Promise.all([
      prisma.person.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          gender: true,
          profileImage: { select: { url: true } },
        },
      }),
      prisma.relationship.findMany({
        where: { type: 'PARENT_CHILD' },
        select: { parentId: true, childId: true },
      }),
      prisma.family.findMany({ select: { rootPersonId: true } }),
    ]);

    // Persons who appear as children in any PARENT_CHILD edge — everyone else
    // is a "no-parent" root candidate.
    const childIds = new Set<string>();
    // Parent -> direct-child count.
    const directChildCount = new Map<string, number>();
    for (const rel of parentChildRels) {
      if (rel.childId) childIds.add(rel.childId);
      if (rel.parentId) {
        directChildCount.set(
          rel.parentId,
          (directChildCount.get(rel.parentId) ?? 0) + 1
        );
      }
    }

    const noParentPersons = persons.filter((p) => !childIds.has(p.id));
    if (noParentPersons.length < 2) return emptyResponse;

    // Group topmost no-parent persons by uppercased last name. We prompt only
    // when a single family group contains ≥2 same-surname elders — that's
    // the classic "which spouse is the canonical root?" pattern. (Cross-
    // surname couples still need one member of the group to hold that
    // surname; the auto-mirror change from commit 2 makes both spouses
    // top-visible for same-surname couples, which is the common case.)
    const groups = new Map<string, typeof noParentPersons>();
    for (const p of noParentPersons) {
      const key = p.lastName.toUpperCase();
      const list = groups.get(key) ?? [];
      list.push(p);
      groups.set(key, list);
    }

    // Pick the largest same-surname group; ties broken by lexicographic
    // order so the choice is stable across requests.
    const sortedGroups = [...groups.entries()].sort((a, b) => {
      if (b[1].length !== a[1].length) return b[1].length - a[1].length;
      return a[0].localeCompare(b[0]);
    });
    const [, topGroup] = sortedGroups[0] ?? [null, []];
    if (topGroup.length < 2) return emptyResponse;

    // Require at least one candidate to have direct children — otherwise the
    // prompt is asking about a couple with no descendants and there's no
    // canonical root to pick yet.
    const hasAnyChildren = topGroup.some(
      (p) => (directChildCount.get(p.id) ?? 0) > 0
    );
    if (!hasAnyChildren) return emptyResponse;

    // Only prompt when no Family record already resolves to one of the
    // candidates. If admins picked one already, we respect that choice.
    const candidateIds = new Set(topGroup.map((p) => p.id));
    const storedRoots = new Set(families.map((f) => f.rootPersonId));
    const anyStoredRootIsCandidate = [...storedRoots].some((id) =>
      candidateIds.has(id)
    );
    if (anyStoredRootIsCandidate) return emptyResponse;

    // Auth: strict — only System Admins or Family Admins of any tree in
    // question get the prompt. Guests and plain members never see it.
    const sysAdmin = await isSystemAdmin(user.id);
    let mayPrompt = sysAdmin;
    if (!mayPrompt) {
      // A Family Admin for ANY of the candidate IDs qualifies. In practice
      // there's typically no Family record for these candidates yet (that's
      // the whole point of the prompt), so this check will usually fall
      // through — but if an admin exists for one of them, honor it.
      for (const p of topGroup) {
        // eslint-disable-next-line no-await-in-loop
        const ok = await isFamilyAdmin(user.id, p.id);
        if (ok) {
          mayPrompt = true;
          break;
        }
      }
    }
    if (!mayPrompt) return emptyResponse;

    // Sort candidates alphabetically by first name (then last name) so the
    // UI ordering is deterministic.
    const sortedCandidates = [...topGroup]
      .sort((a, b) => {
        const first = a.firstName.localeCompare(b.firstName);
        if (first !== 0) return first;
        return a.lastName.localeCompare(b.lastName);
      })
      .slice(0, 4)
      .map<CandidatePerson>((p) => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        image: p.profileImage?.url ?? null,
        gender: p.gender ?? null,
      }));

    return NextResponse.json({
      success: true,
      data: {
        shouldPrompt: true,
        candidates: sortedCandidates,
      },
    });
  } catch (error) {
    console.error('GET /api/family/root/prompt', error);
    return emptyResponse;
  }
}

type CandidatePerson = {
  id: string;
  name: string;
  image: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
};

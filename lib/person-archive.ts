import prisma from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { findPersonFamilyRoot, isFamilyAdmin } from '@/lib/family-membership';

export const activeRelationshipWhere: Prisma.RelationshipWhereInput = {
  NOT: { OR: [
    { parent: { is: { deletedAt: { not: null } } } },
    { child: { is: { deletedAt: { not: null } } } },
    { spouse1: { is: { deletedAt: { not: null } } } },
    { spouse2: { is: { deletedAt: { not: null } } } },
  ] },
};

type Actor = { id: string; role: string };
type Target = { id: string; addedById: string | null; createdById: string | null; userId: string | null; deletedAt: Date | null };
export async function personArchiveAccess(actor: Actor | undefined, person: Target) {
  if (!actor) return { canDelete: false, canRestore: false };
  const account = await prisma.user.findUnique({ where: { id: actor.id }, select: { role: true } });
  if (!account || account.role === 'VIEWER') return { canDelete: false, canRestore: false };
  const [familyRoot, directAdmin, root] = await Promise.all([
    findPersonFamilyRoot(person.id),
    prisma.familyPerson.findFirst({ where: { personId: person.id, family: { memberships: { some: { userId: actor.id, role: 'ADMIN' } } } } }),
    prisma.family.findUnique({ where: { rootPersonId: person.id }, select: { id: true } }),
  ]);
  const admin = account.role === 'ADMIN' || !!directAdmin || (!!familyRoot && await isFamilyAdmin(actor.id, familyRoot));
  const owner = (person.addedById ?? person.createdById) === actor.id;
  return { canDelete: !person.deletedAt && !person.userId && !root && (admin || owner), canRestore: !!person.deletedAt && admin };
}

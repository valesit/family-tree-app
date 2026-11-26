import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import { activeRelationshipWhere } from '@/lib/person-archive';

const parentTypes = ['PARENT_CHILD','ADOPTED','STEP_PARENT','STEP_CHILD','FOSTER'];
class InvalidChange extends Error {}

async function actor() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return null;
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  return account && account.role !== 'VIEWER' ? user : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await actor();
  if (!user) return NextResponse.json({ success: false, error: 'Contributor access required' }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const relationshipId = typeof body.relationshipId === 'string' ? body.relationshipId : '';
  const replacementId = typeof body.replacementId === 'string' ? body.replacementId : '';
  const action = body.action;
  if (!relationshipId || (action !== 'remove' && action !== 'replace') || (action === 'replace' && (!replacementId || replacementId === id))) return NextResponse.json({ success: false, error: 'Invalid relationship change' }, { status: 400 });
  try {
    await prisma.$transaction(async tx => {
      const person = await tx.person.findUnique({ where: { id, deletedAt: null }, select: { id: true, firstName: true, lastName: true } });
      if (!person) throw new InvalidChange('Person not found');
      const rel = await tx.relationship.findFirst({ where: { id: relationshipId, AND: [activeRelationshipWhere, { OR: [{ parentId: id }, { childId: id }, { spouse1Id: id }, { spouse2Id: id }] }] } });
      if (!rel) throw new InvalidChange('Relationship no longer exists');
      // Keep explicit family associations before changing a connection. This
      // allows detached active profiles to remain discoverable.
      const links = await tx.familyRelationship.findMany({ where: { relationshipId }, select: { familyId: true } });
      const personLinks = await tx.familyPerson.findMany({ where: { personId: id }, select: { familyId: true } });
      const families = new Set([...links, ...personLinks].map(link => link.familyId));
      const endpoints = [rel.parentId, rel.childId, rel.spouse1Id, rel.spouse2Id].filter((p): p is string => !!p);
      for (const familyId of families) for (const personId of endpoints) await tx.familyPerson.upsert({ where: { familyId_personId: { familyId, personId } }, create: { familyId, personId }, update: {} });
      if (action === 'remove') {
        await tx.relationship.delete({ where: { id: relationshipId } });
      } else {
        const replacement = await tx.person.findUnique({ where: { id: replacementId, deletedAt: null }, select: { id: true } });
        if (!replacement) throw new InvalidChange('Replacement person not found');
        if (endpoints.includes(replacementId)) throw new InvalidChange('Select a different person');
        const next = { parentId: rel.parentId, childId: rel.childId, spouse1Id: rel.spouse1Id, spouse2Id: rel.spouse2Id };
        if (parentTypes.includes(rel.type)) {
          if (rel.childId === id) next.parentId = replacementId;
          else if (rel.parentId === id) next.childId = replacementId;
          else throw new InvalidChange('Invalid parent-child connection');
          if (!next.parentId || !next.childId) throw new InvalidChange('Invalid parent-child connection');
          const edges = await tx.relationship.findMany({ where: { id: { not: relationshipId }, parentId: { not: null }, childId: { not: null } }, select: { parentId: true, childId: true } });
          const descendants = new Set<string>(); const queue = [next.childId];
          while (queue.length) { const current = queue.pop()!; if (descendants.has(current)) continue; descendants.add(current); for (const e of edges) if (e.parentId === current && e.childId) queue.push(e.childId); }
          if (descendants.has(next.parentId)) throw new InvalidChange('That change would create a circular ancestry');
          if (await tx.relationship.findFirst({ where: { id: { not: relationshipId }, type: rel.type, parentId: next.parentId, childId: next.childId } })) throw new InvalidChange('That relationship already exists');
        } else if (rel.type === 'SPOUSE') {
          if (rel.spouse1Id === id) next.spouse2Id = replacementId;
          else next.spouse1Id = replacementId;
          if (await tx.relationship.findFirst({ where: { id: { not: relationshipId }, type: 'SPOUSE', OR: [{ spouse1Id: next.spouse1Id, spouse2Id: next.spouse2Id }, { spouse1Id: next.spouse2Id, spouse2Id: next.spouse1Id }] } })) throw new InvalidChange('That relationship already exists');
        } else throw new InvalidChange('This relationship type cannot be replaced');
        // Replacements are restricted to an existing family association or an
        // existing graph connection. Use the standard add-person workflow for new families.
        const replacementLinks = await tx.familyPerson.findMany({ where: { personId: replacementId }, select: { familyId: true } });
        if (families.size && !replacementLinks.some(l => families.has(l.familyId))) throw new InvalidChange('Choose a person already associated with this family');
        await tx.relationship.update({ where: { id: relationshipId }, data: next });
      }
      await tx.activity.create({ data: { type: 'PERSON_UPDATED', description: 'A relationship for ' + person.firstName + ' ' + person.lastName + ' was ' + (action === 'remove' ? 'removed' : 'corrected'), userId: user.id, data: { action: action === 'remove' ? 'RELATIONSHIP_REMOVED' : 'RELATIONSHIP_CORRECTED', personId: id, relationshipId, replacementId: replacementId || null, previous: { type: rel.type, parentId: rel.parentId, childId: rel.childId, spouse1Id: rel.spouse1Id, spouse2Id: rel.spouse2Id } } } });
    }, { isolationLevel: 'Serializable' });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof InvalidChange) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    console.error('Relationship correction failed', error);
    return NextResponse.json({ success: false, error: 'Could not save the relationship change. Reload and try again.' }, { status: 409 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import { resolveFamilyRecord } from '@/lib/stable-family';
import { getConnectedPersonIds } from '@/lib/family-membership';
import { personArchiveAccess } from '@/lib/person-archive';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: 'Sign in required' }, { status: 401 });
  const user = session.user as SessionUser;
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  const adminFamilies = await prisma.familyMembership.findMany({ where: { userId: user.id, role: 'ADMIN' }, select: { familyId: true } });
  if (!account || account.role === 'VIEWER' || (account.role !== 'ADMIN' && !adminFamilies.length)) return NextResponse.json({ success: false, error: 'Administrator access required' }, { status: 403 });
  const rootId = request.nextUrl.searchParams.get('rootId');
  const family = rootId ? await resolveFamilyRecord(rootId) : null;
  if (rootId && !family) return NextResponse.json({ success: false, error: 'Family not found' }, { status: 404 });
  if (family && account.role !== 'ADMIN' && !adminFamilies.some(f => f.familyId === family.id)) return NextResponse.json({ success: false, error: 'Administrator access required' }, { status: 403 });
  const connectedIds = family ? [...await getConnectedPersonIds(family.rootPersonId)] : [];
  const persons = await prisma.person.findMany({
    where: { deletedAt: { not: null }, ...(family ? { OR: [{ familyLinks: { some: { familyId: family.id } } }, { id: { in: connectedIds } }] } : account.role === 'ADMIN' ? {} : { familyLinks: { some: { familyId: { in: adminFamilies.map(f => f.familyId) } } } }) },
    select: { id: true, firstName: true, lastName: true, deletedAt: true, deletedById: true, deletionReason: true },
    orderBy: { deletedAt: 'desc' },
  });
  const allowed = family ? (await Promise.all(persons.map(async person => ({ person, allowed: (await personArchiveAccess(user, { ...person, addedById: null, createdById: null, userId: null })).canRestore })))).filter(entry => entry.allowed).map(entry => entry.person) : persons;
  const actorIds = [...new Set(allowed.map(p => p.deletedById).filter((id): id is string => !!id))];
  const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  const names = new Map(actors.map(a => [a.id, a.name]));
  return NextResponse.json({ success: true, data: allowed.map(p => ({ ...p, deletedByName: p.deletedById ? names.get(p.deletedById) ?? null : null })) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: 'Sign in required' }, { status: 401 });
  const user = session.user as SessionUser;
  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== 'string') return NextResponse.json({ success: false, error: 'Person ID required' }, { status: 400 });
  const person = await prisma.person.findUnique({ where: { id: body.id } });
  if (!person?.deletedAt) return NextResponse.json({ success: false, error: 'Archived person not found' }, { status: 404 });
  if (!(await personArchiveAccess(user, person)).canRestore) return NextResponse.json({ success: false, error: 'Administrator access required' }, { status: 403 });
  try {
    await prisma.$transaction(async tx => {
      const result = await tx.person.updateMany({ where: { id: person.id, deletedAt: person.deletedAt }, data: { deletedAt: null, deletedById: null, deletionReason: null } });
      if (result.count !== 1) throw new Error('Archive status changed');
      await tx.activity.create({ data: { type: 'PERSON_UPDATED', description: person.firstName + ' ' + person.lastName + ' was restored to the family tree', userId: user.id, data: { personId: person.id, action: 'PERSON_RESTORED', previousReason: person.deletionReason } } });
    }, { isolationLevel: 'Serializable' });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Restore failed:', error);
    return NextResponse.json({ success: false, error: 'Restore failed. Reload and try again.' }, { status: 409 });
  }
}

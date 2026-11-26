import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import { personArchiveAccess } from '@/lib/person-archive';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: 'Sign in required' }, { status: 401 });
  const user = session.user as SessionUser;
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  const adminFamilies = await prisma.familyMembership.findMany({ where: { userId: user.id, role: 'ADMIN' }, select: { familyId: true } });
  if (!account || account.role === 'VIEWER' || (account.role !== 'ADMIN' && !adminFamilies.length)) return NextResponse.json({ success: false, error: 'Administrator access required' }, { status: 403 });
  const persons = await prisma.person.findMany({
    where: { deletedAt: { not: null }, ...(account.role === 'ADMIN' ? {} : { familyLinks: { some: { familyId: { in: adminFamilies.map(f => f.familyId) } } } }) },
    select: { id: true, firstName: true, lastName: true, deletedAt: true, deletedById: true, deletionReason: true },
    orderBy: { deletedAt: 'desc' },
  });
  return NextResponse.json({ success: true, data: persons }, { headers: { 'Cache-Control': 'no-store' } });
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

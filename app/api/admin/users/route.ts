import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';

// GET /api/admin/users — list every account on the platform, with the family
// tree person they're linked to (if any). System Admins only.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const me = session.user as SessionUser;
    if (me.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        role: true,
        createdAt: true,
        whatsappOptIn: true,
        linkedPerson: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error('GET /api/admin/users', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load users' },
      { status: 500 }
    );
  }
}

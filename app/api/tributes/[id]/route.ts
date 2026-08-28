import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import {
  findPersonFamilyRoot,
  isFamilyAdmin,
  isSystemAdmin,
} from '@/lib/family-membership';

type TributeOwner = {
  id: string;
  personId: string;
  authorId: string;
};

async function findTribute(id: string): Promise<TributeOwner | null> {
  const rows = await prisma.$queryRaw<TributeOwner[]>`
    SELECT "id", "personId", "authorId"
    FROM "Tribute"
    WHERE "id" = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Sign in required' }, { status: 401 });
    }
    const user = session.user as SessionUser;
    const { id } = await params;
    const tribute = await findTribute(id);
    if (!tribute) {
      return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
    }
    if (tribute.authorId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Only the author can edit this message' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    if (!content || content.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Message must be between 1 and 1,000 characters' },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      UPDATE "Tribute"
      SET "content" = ${content}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH tribute failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to update message' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Sign in required' }, { status: 401 });
    }
    const user = session.user as SessionUser;
    const { id } = await params;
    const tribute = await findTribute(id);
    if (!tribute) {
      return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
    }

    let allowed = tribute.authorId === user.id || (await isSystemAdmin(user.id));
    if (!allowed) {
      const rootId = await findPersonFamilyRoot(tribute.personId);
      allowed = !!rootId && (await isFamilyAdmin(user.id, rootId));
    }

    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'You cannot remove this family message' },
        { status: 403 }
      );
    }

    await prisma.$executeRaw`DELETE FROM "Tribute" WHERE "id" = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE tribute failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove message' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';

// DELETE /api/admin/users/[id] — delete a user account.
//
// Authorization: System Admins only (User.role === 'ADMIN').
//
// Guardrails:
//   - You cannot delete your own account here. Sign out and have another
//     System Admin do it if you really want it gone.
//   - You cannot delete the last remaining System Admin — that would lock
//     everyone out of admin tools.
//
// Cascades (defined in schema.prisma):
//   - Account, Session, Notification, FamilyMembership are all
//     onDelete: Cascade. The login is removed cleanly.
//   - Person.userId becomes NULL — the family-tree profile stays put,
//     just no longer linked to a login. Admins can re-link it later.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    if (id === me.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'You cannot delete your own account. Ask another admin to remove it.',
        },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!target) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (target.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Cannot delete the last remaining System Admin — promote someone else first.',
          },
          { status: 400 }
        );
      }
    }

    // First null out Person.userId on any linked person; otherwise the
    // unique relation `User.linkedPerson` would block the delete (Prisma
    // doesn't auto-cascade through the optional inverse relation).
    await prisma.person.updateMany({
      where: { userId: id },
      data: { userId: null },
    });

    await prisma.user.delete({ where: { id } });

    await prisma.activity.create({
      data: {
        type: 'PERSON_UPDATED',
        description: `Admin removed user account ${target.name || target.email || target.id}`,
        userId: me.id,
        data: { deletedUserId: id, deletedUserEmail: target.email },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Removed ${target.name || target.email || 'user account'}.`,
    });
  } catch (error) {
    console.error('DELETE /api/admin/users/[id]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}

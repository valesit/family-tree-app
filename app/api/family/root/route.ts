import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import {
  findPersonFamilyRoot,
  isFamilyAdmin,
  isSystemAdmin,
  reassignFamilyRoot,
} from '@/lib/family-membership';

// PATCH /api/family/root
//
// Body: { personId: string }
//
// Reassigns the root of the family tree containing `personId` to that person.
// Only System Admins or Family Admins of the affected tree may call this.
//
// Use cases:
//   - The auto-promotion didn't kick in (e.g. data was imported), and an
//     admin wants to fix the canonical ancestor.
//   - An admin wants to deliberately re-anchor the tree to a different
//     known ancestor.
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user as SessionUser;

    const body = await request.json().catch(() => ({}));
    const personId = typeof body.personId === 'string' ? body.personId : '';
    if (!personId) {
      return NextResponse.json(
        { success: false, error: 'personId is required' },
        { status: 400 }
      );
    }

    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!person) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    const currentRoot = await findPersonFamilyRoot(personId);
    if (!currentRoot) {
      return NextResponse.json(
        {
          success: false,
          error:
            'This person is not connected to any registered family tree yet. Connect them via a relationship first.',
        },
        { status: 400 }
      );
    }

    // Authorization: System Admin or Family Admin of THIS tree.
    const sysAdmin = await isSystemAdmin(user.id);
    const famAdmin = sysAdmin ? true : await isFamilyAdmin(user.id, currentRoot);
    if (!sysAdmin && !famAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only System Admins or Family Admins can reassign the family root' },
        { status: 403 }
      );
    }

    if (currentRoot === personId) {
      return NextResponse.json({
        success: true,
        data: { rootPersonId: currentRoot },
        message: `${person.firstName} ${person.lastName} is already the family root.`,
      });
    }

    await reassignFamilyRoot(currentRoot, personId);

    await prisma.activity.create({
      data: {
        type: 'PERSON_UPDATED',
        description: `Family root reassigned to ${person.firstName} ${person.lastName} by admin.`,
        userId: user.id,
        data: {
          newRootPersonId: personId,
          previousRootPersonId: currentRoot,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: { rootPersonId: personId, previousRootPersonId: currentRoot },
      message: `${person.firstName} ${person.lastName} is now the family root.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to reassign family root';
    console.error('PATCH /api/family/root', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

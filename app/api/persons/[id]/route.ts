import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { personSchema } from '@/lib/validators';
import { SessionUser } from '@/types';
import {
  findPersonFamilyRoot,
  getFamilyMembership,
  isFamilyAdmin,
  isSystemAdmin,
  promoteFamilyRootIfHigher,
} from '@/lib/family-membership';

// GET /api/persons/[id] - Get a single person (public - no auth required)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as SessionUser | undefined;

    const person = await prisma.person.findUnique({
      where: { id },
      include: {
        profileImage: true,
        images: true,
        parentRelations: {
          include: { parent: { include: { profileImage: true } } },
        },
        childRelations: {
          include: { child: { include: { profileImage: true } } },
        },
        spouseRelations1: {
          include: { spouse2: { include: { profileImage: true } } },
        },
        spouseRelations2: {
          include: { spouse1: { include: { profileImage: true } } },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            whatsappOptIn: true,
          },
        },
      },
    });

    if (!person) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    // Only members of the same family can receive the optional WhatsApp deep
    // link. Anonymous viewers and unrelated accounts never receive the phone.
    let isSameFamily = false;
    if (sessionUser) {
      const rootId = await findPersonFamilyRoot(id);
      isSameFamily = !!rootId && !!(await getFamilyMembership(sessionUser.id, rootId));
      if (sessionUser.role === 'ADMIN') isSameFamily = true;
    }

    type PersonShape = typeof person;
    let safePerson: PersonShape = person;
    if (person.user) {
      const optedIn = person.user.whatsappOptIn && !!person.user.phone;
      safePerson = {
        ...person,
        user: {
          ...person.user,
          phone: isSameFamily && optedIn ? person.user.phone : null,
        },
      };
    }

    return NextResponse.json({ success: true, data: safePerson });
  } catch (error) {
    console.error('Error fetching person:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch person' },
      { status: 500 }
    );
  }
}

// PUT /api/persons/[id] - Update a person.
// Direct edits are limited to the claimed profile owner, Family Admins and System Admins.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id } = await params;
    const body = await request.json();
    const { approverIds: _unusedApprovers, ...personData } = body;
    void _unusedApprovers;

    const existingPerson = await prisma.person.findUnique({ where: { id } });
    if (!existingPerson) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    const ownsProfile = existingPerson.userId === user.id;
    const sysAdmin = await isSystemAdmin(user.id);
    let famAdmin = false;
    if (!sysAdmin && !ownsProfile) {
      const familyRoot = await findPersonFamilyRoot(id);
      famAdmin = !!familyRoot && (await isFamilyAdmin(user.id, familyRoot));
    }

    if (!ownsProfile && !sysAdmin && !famAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only the profile owner or a Family Admin can edit this family member directly',
        },
        { status: 403 }
      );
    }

    const validationResult = personSchema.safeParse(personData);
    if (!validationResult.success) {
      return NextResponse.json(
        { success: false, error: validationResult.error.issues[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    const updated = await prisma.person.update({
      where: { id },
      data: {
        ...validationResult.data,
        birthDate: validationResult.data.birthDate ? new Date(validationResult.data.birthDate) : null,
        deathDate: validationResult.data.deathDate ? new Date(validationResult.data.deathDate) : null,
        facts: validationResult.data.facts ? JSON.stringify(validationResult.data.facts) : null,
      },
      include: { profileImage: true },
    });

    await prisma.activity.create({
      data: {
        type: 'PERSON_UPDATED',
        description: `${updated.firstName} ${updated.lastName}'s information was updated`,
        userId: user.id,
        data: { personId: updated.id },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating person:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update person' },
      { status: 500 }
    );
  }
}

// DELETE /api/persons/[id] - Remove a person from the family tree.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id } = await params;

    const person = await prisma.person.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, userId: true },
    });

    if (!person) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    try {
      await promoteFamilyRootIfHigher(id);
    } catch (err) {
      console.error('Heal family root before delete failed:', err);
    }

    const familyAsRoot = await prisma.family.findUnique({
      where: { rootPersonId: id },
      select: { id: true, name: true },
    });
    if (familyAsRoot) {
      return NextResponse.json(
        {
          success: false,
          error: 'This person is the root of a family tree and cannot be deleted. Reassign the root first.',
        },
        { status: 400 }
      );
    }

    if (person.userId && person.userId === user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'You cannot delete your own linked profile. Unlink your account first if needed.',
        },
        { status: 400 }
      );
    }

    const sysAdmin = await isSystemAdmin(user.id);
    let famAdmin = false;
    let familyId: string | null = null;
    if (!sysAdmin) {
      familyId = await findPersonFamilyRoot(id);
      if (familyId) famAdmin = await isFamilyAdmin(user.id, familyId);
    }

    if (!sysAdmin && !famAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only System Admins or Family Admins can delete a family member' },
        { status: 403 }
      );
    }

    await prisma.person.delete({ where: { id } });

    await prisma.activity.create({
      data: {
        type: 'PERSON_UPDATED',
        description: `${person.firstName} ${person.lastName} was removed from the family tree`,
        userId: user.id,
        data: { personId: id, familyId },
      },
    });

    return NextResponse.json({
      success: true,
      message: `${person.firstName} ${person.lastName} was removed from the family tree.`,
    });
  } catch (error) {
    console.error('Error deleting person:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete person' },
      { status: 500 }
    );
  }
}

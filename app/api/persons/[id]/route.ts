import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { personSchema } from '@/lib/validators';
import { SessionUser } from '@/types';
import { personArchiveAccess, activeRelationshipWhere } from '@/lib/person-archive';
import { canManagePersonPhotos, getPersonalPhotoIds } from '@/lib/person-photos';
import {
  findPersonFamilyRoot,
  getFamilyMembership,
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
      where: { id, deletedAt: null },
      include: {
        profileImage: true,
        images: { orderBy: { uploadedAt: 'desc' } },
        parentRelations: {
          where: activeRelationshipWhere,
          include: { parent: { include: { profileImage: true } } },
        },
        childRelations: {
          where: activeRelationshipWhere,
          include: { child: { include: { profileImage: true } } },
        },
        spouseRelations1: {
          where: activeRelationshipWhere,
          include: { spouse2: { include: { profileImage: true } } },
        },
        spouseRelations2: {
          where: activeRelationshipWhere,
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

    const [personalPhotoIds, canManagePhotos] = await Promise.all([
      getPersonalPhotoIds(id),
      sessionUser ? canManagePersonPhotos(sessionUser.id, person) : Promise.resolve(false),
    ]);

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

    return NextResponse.json(
      {
        success: true,
        data: {
          ...safePerson,
          canManagePhotos,
          canDelete: (await personArchiveAccess(sessionUser, person)).canDelete,
          images: person.images.filter((image) =>
            personalPhotoIds.has(image.id) && !image.isPrimary && image.id !== person.profileImageId
          ),
        },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    );
  } catch (error) {
    console.error('Error fetching person:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch person' },
      { status: 500 }
    );
  }
}

// PUT /api/persons/[id] - Update a person.
// Registered contributors can publish factual edits immediately; deletion uses separate ownership checks.
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

    const existingPerson = await prisma.person.findUnique({ where: { id, deletedAt: null } });
    if (!existingPerson) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    // Any signed-in contributor can correct family information without routing
    // the change through an admin. VIEWER accounts remain read-only.
    if (user.role === 'VIEWER') {
      return NextResponse.json(
        { success: false, error: 'Your account does not have permission to edit family information' },
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
      where: { id, deletedAt: null },
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

// DELETE /api/persons/[id] - Archive one person without deleting associated data.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const user = session.user as SessionUser;
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason || reason.length > 500) return NextResponse.json({ success: false, error: 'Provide a deletion reason (maximum 500 characters)' }, { status: 400 });
    const person = await prisma.person.findUnique({ where: { id } });
    if (!person || person.deletedAt) return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    if (!(await personArchiveAccess(user, person)).canDelete) return NextResponse.json({ success: false, error: 'You cannot delete this person. Only the original contributor or an authorized administrator can delete an unlinked, non-root profile.' }, { status: 403 });
    const familyRoot = await findPersonFamilyRoot(id);
    await prisma.$transaction(async tx => {
      if (await tx.family.findUnique({ where: { rootPersonId: id } })) throw new Error('Family root cannot be archived');
      const updated = await tx.person.updateMany({ where: { id, deletedAt: null, userId: null }, data: { deletedAt: new Date(), deletedById: user.id, deletionReason: reason } });
      if (updated.count !== 1) throw new Error('Profile changed; reload and try again');
      // Preserve the family association even when this was a legacy record.
      if (familyRoot) {
        const family = await tx.family.findUnique({ where: { rootPersonId: familyRoot } });
        if (family) await tx.familyPerson.upsert({ where: { familyId_personId: { familyId: family.id, personId: id } }, create: { familyId: family.id, personId: id }, update: {} });
      }
      await tx.activity.create({ data: { type: 'PERSON_UPDATED', description: person.firstName + ' ' + person.lastName + ' was removed from the active family tree', userId: user.id, data: { personId: id, familyId: familyRoot, action: 'PERSON_ARCHIVED', reason } } });
    }, { isolationLevel: 'Serializable' });
    return NextResponse.json({ success: true, message: 'Person removed. Other family members and associated content are preserved.' });
  } catch (error) {
    console.error('Error archiving person:', error);
    return NextResponse.json({ success: false, error: 'Unable to remove person. Reload and try again.' }, { status: 409 });
  }
}

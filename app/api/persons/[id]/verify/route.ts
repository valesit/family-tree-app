import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import { 
  isVerifiedMember, 
  findPersonFamilyRoot,
  notifyFamilyAdmins 
} from '@/lib/family-membership';

// POST /api/persons/[id]/verify - Verify an unverified person
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = session.user as SessionUser;
    const { id } = await params;

    // Get the person
    const person = await prisma.person.findUnique({
      where: { id },
    });

    if (!person) {
      return NextResponse.json(
        { success: false, error: 'Person not found' },
        { status: 404 }
      );
    }

    // Check if already verified
    if (person.isVerified) {
      return NextResponse.json(
        { success: false, error: 'This person is already verified' },
        { status: 400 }
      );
    }

    // Find which family tree this person belongs to
    const familyId = await findPersonFamilyRoot(person.id);

    if (!familyId) {
      // If we can't determine the family, only System Admin can verify
      if (user.role !== 'ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Cannot determine family tree. Only System Admin can verify.' },
          { status: 403 }
        );
      }
    } else {
      // Check if the verifier is a verified member of this family tree
      const isVerifier = user.role === 'ADMIN' || await isVerifiedMember(user.id, familyId);
      
      if (!isVerifier) {
        return NextResponse.json(
          { success: false, error: 'Only verified family members can verify new additions' },
          { status: 403 }
        );
      }
    }

    // Verify the person
    const updatedPerson = await prisma.person.update({
      where: { id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedById: user.id,
      },
      include: {
        profileImage: true,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: 'APPROVAL_COMPLETED',
        description: `${person.firstName} ${person.lastName} was verified by ${user.name || user.email}`,
        userId: user.id,
        data: { personId: person.id, familyId },
      },
    });

    // Notify the person who added them (if different from verifier)
    if (person.addedById && person.addedById !== user.id) {
      await prisma.notification.create({
        data: {
          userId: person.addedById,
          type: 'PERSON_VERIFIED',
          title: 'Family member verified',
          message: `${person.firstName} ${person.lastName} has been verified by ${user.name || 'a family member'}.`,
          data: { personId: person.id, familyId },
        },
      });
    }

    // Notify Family Admins
    if (familyId) {
      await notifyFamilyAdmins(familyId, {
        type: 'PERSON_VERIFIED',
        title: 'New family member verified',
        message: `${person.firstName} ${person.lastName} has been verified by ${user.name || user.email}.`,
        data: { personId: person.id },
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedPerson,
      message: `${person.firstName} ${person.lastName} has been verified.`,
    });
  } catch (error) {
    console.error('Error verifying person:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify person' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';

// POST /api/approvals/[id] - Approve or reject a pending change
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id } = await params;
    const body = await request.json();
    const { status, comment } = body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Get the pending change
    const pendingChange = await prisma.pendingChange.findUnique({
      where: { id },
      include: {
        approvals: true,
        createdBy: true,
      },
    });

    if (!pendingChange) {
      return NextResponse.json(
        { success: false, error: 'Pending change not found' },
        { status: 404 }
      );
    }

    if (pendingChange.status !== 'PENDING') {
      return NextResponse.json(
        { success: false, error: 'This change has already been processed' },
        { status: 400 }
      );
    }

    // Check if user is an approver or admin
    const isApprover = pendingChange.approvals.some((a: { approverId: string }) => a.approverId === user.id);
    const isAdmin = user.role === 'ADMIN';

    if (!isApprover && !isAdmin) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to approve this change' },
        { status: 403 }
      );
    }

    // Update the approval
    if (isApprover) {
      await prisma.approval.updateMany({
        where: {
          pendingChangeId: id,
          approverId: user.id,
        },
        data: {
          status,
          comment,
        },
      });
    }

    // Check if all approvals are complete or if admin approved
    const updatedApprovals = await prisma.approval.findMany({
      where: { pendingChangeId: id },
    });

    const allApproved = updatedApprovals.every((a: { status: string }) => a.status === 'APPROVED');
    const anyRejected = updatedApprovals.some((a: { status: string }) => a.status === 'REJECTED');
    const shouldProcess = isAdmin || allApproved || anyRejected;

    if (shouldProcess) {
      const finalStatus = (isAdmin && status === 'APPROVED') || allApproved ? 'APPROVED' : 'REJECTED';

      // Update the pending change status
      await prisma.pendingChange.update({
        where: { id },
        data: { status: finalStatus },
      });

      // If approved, apply the change
      if (finalStatus === 'APPROVED') {
        await applyPendingChange(pendingChange);
      }

      // Notify the creator
      await prisma.notification.create({
        data: {
          userId: pendingChange.createdById,
          type: finalStatus === 'APPROVED' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
          title: finalStatus === 'APPROVED' ? 'Change Approved!' : 'Change Rejected',
          message: finalStatus === 'APPROVED'
            ? 'Your family tree update has been approved and applied.'
            : `Your family tree update was rejected. ${comment || ''}`,
          data: { changeId: id },
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          type: 'APPROVAL_COMPLETED',
          description: `A pending change was ${finalStatus.toLowerCase()}`,
          userId: user.id,
          data: { changeId: id },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Change ${status.toLowerCase()} successfully`,
    });
  } catch (error) {
    console.error('Error processing approval:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process approval' },
      { status: 500 }
    );
  }
}

// Apply the pending change to the database
async function applyPendingChange(pendingChange: {
  id: string;
  changeType: string;
  changeData: unknown;
  personId: string | null;
  createdById: string;
}) {
  const changeData = pendingChange.changeData as Record<string, unknown>;

  switch (pendingChange.changeType) {
    case 'CREATE_PERSON':
      const newPerson = await prisma.person.create({
        data: {
          firstName: changeData.firstName as string,
          lastName: changeData.lastName as string,
          middleName: changeData.middleName as string || null,
          maidenName: changeData.maidenName as string || null,
          nickname: changeData.nickname as string || null,
          gender: changeData.gender as 'MALE' | 'FEMALE' | 'OTHER' || null,
          birthDate: changeData.birthDate ? new Date(changeData.birthDate as string) : null,
          birthPlace: changeData.birthPlace as string || null,
          deathDate: changeData.deathDate ? new Date(changeData.deathDate as string) : null,
          deathPlace: changeData.deathPlace as string || null,
          biography: changeData.biography as string || null,
          facts: changeData.facts ? JSON.stringify(changeData.facts) : null,
          email: changeData.email as string || null,
          phone: changeData.phone as string || null,
          address: changeData.address as string || null,
          occupation: changeData.occupation as string || null,
          isLiving: changeData.isLiving as boolean ?? true,
          isPrivate: changeData.isPrivate as boolean ?? false,
          createdById: pendingChange.createdById,
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          type: 'PERSON_ADDED',
          description: `${newPerson.firstName} ${newPerson.lastName} was added to the family tree`,
          userId: pendingChange.createdById,
          data: { personId: newPerson.id },
        },
      });
      break;

    case 'UPDATE_PERSON':
      if (pendingChange.personId) {
        // Check if this is a profile claim request
        if (changeData.action === 'CLAIM_PROFILE') {
          const claimUserId = changeData.userId as string;
          
          // Link the user to the person
          await prisma.person.update({
            where: { id: pendingChange.personId },
            data: { userId: claimUserId },
          });

          // Get person name for notification
          const claimedPerson = await prisma.person.findUnique({
            where: { id: pendingChange.personId },
            select: { firstName: true, lastName: true },
          });

          await prisma.activity.create({
            data: {
              type: 'PERSON_UPDATED',
              description: `${changeData.userName} linked their account to ${claimedPerson?.firstName} ${claimedPerson?.lastName}`,
              userId: claimUserId,
              data: { personId: pendingChange.personId },
            },
          });

          // Notify the user their claim was approved
          await prisma.notification.create({
            data: {
              userId: claimUserId,
              type: 'WELCOME',
              title: 'Profile Linked!',
              message: `Your account has been successfully linked to ${claimedPerson?.firstName} ${claimedPerson?.lastName} in the family tree.`,
              data: { personId: pendingChange.personId },
            },
          });
        } else {
          // Regular person update
          await prisma.person.update({
            where: { id: pendingChange.personId },
            data: {
              firstName: changeData.firstName as string,
              lastName: changeData.lastName as string,
              middleName: changeData.middleName as string || null,
              maidenName: changeData.maidenName as string || null,
              nickname: changeData.nickname as string || null,
              gender: changeData.gender as 'MALE' | 'FEMALE' | 'OTHER' || null,
              birthDate: changeData.birthDate ? new Date(changeData.birthDate as string) : null,
              birthPlace: changeData.birthPlace as string || null,
              deathDate: changeData.deathDate ? new Date(changeData.deathDate as string) : null,
              deathPlace: changeData.deathPlace as string || null,
              biography: changeData.biography as string || null,
              facts: changeData.facts ? JSON.stringify(changeData.facts) : null,
              email: changeData.email as string || null,
              phone: changeData.phone as string || null,
              address: changeData.address as string || null,
              occupation: changeData.occupation as string || null,
              isLiving: changeData.isLiving as boolean ?? true,
              isPrivate: changeData.isPrivate as boolean ?? false,
            },
          });

          await prisma.activity.create({
            data: {
              type: 'PERSON_UPDATED',
              description: `A family member's information was updated`,
              userId: pendingChange.createdById,
              data: { personId: pendingChange.personId },
            },
          });
        }
      }
      break;

    case 'UPDATE_FAMILY_NAME':
      // Update family name
      if (pendingChange.personId) {
        const newFamilyName = (changeData as { familyName: string }).familyName;
        
        // Upsert family record
        await prisma.family.upsert({
          where: { rootPersonId: pendingChange.personId },
          update: { name: newFamilyName },
          create: {
            rootPersonId: pendingChange.personId,
            name: newFamilyName,
          },
        });

        await prisma.activity.create({
          data: {
            type: 'PERSON_UPDATED',
            description: `Family name was changed to "${newFamilyName}"`,
            userId: pendingChange.createdById,
            data: { rootPersonId: pendingChange.personId, newFamilyName },
          },
        });
      }
      break;

    case 'ADD_RELATIONSHIP':
      const { type, person1Id, person2Id, startDate, endDate, notes } = changeData as {
        type: string;
        person1Id: string;
        person2Id: string;
        startDate?: string;
        endDate?: string;
        notes?: string;
      };

      const relationshipData: {
        type: 'PARENT_CHILD' | 'SPOUSE' | 'SIBLING' | 'ADOPTED' | 'STEP_PARENT' | 'STEP_CHILD' | 'FOSTER';
        startDate?: Date;
        endDate?: Date;
        notes?: string;
        parentId?: string;
        childId?: string;
        spouse1Id?: string;
        spouse2Id?: string;
      } = {
        type: type as 'PARENT_CHILD' | 'SPOUSE' | 'SIBLING' | 'ADOPTED' | 'STEP_PARENT' | 'STEP_CHILD' | 'FOSTER',
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        notes: notes || undefined,
      };

      if (type === 'SPOUSE') {
        relationshipData.spouse1Id = person1Id;
        relationshipData.spouse2Id = person2Id;
      } else {
        relationshipData.parentId = person1Id;
        relationshipData.childId = person2Id;
      }

      await prisma.relationship.create({ data: relationshipData });

      await prisma.activity.create({
        data: {
          type: 'RELATIONSHIP_ADDED',
          description: `A new ${type.toLowerCase().replace('_', '-')} relationship was added`,
          userId: pendingChange.createdById,
        },
      });
      break;
  }
}


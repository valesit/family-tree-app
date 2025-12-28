import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';

// GET /api/approvals - Get pending approvals for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';
    const type = searchParams.get('type'); // 'mine' or 'pending' (approvals I need to make)

    if (type === 'mine') {
      // Get changes I've submitted
      const pendingChanges = await prisma.pendingChange.findMany({
        where: {
          createdById: user.id,
          status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED',
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, image: true },
          },
          person: {
            include: { profileImage: true },
          },
          approvals: {
            include: {
              approver: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ success: true, data: pendingChanges });
    }

    // Get approvals I need to make (or admin sees all pending)
    const whereClause = user.role === 'ADMIN'
      ? {
          status: 'PENDING' as const,
        }
      : {
          approvals: {
            some: {
              approverId: user.id,
              status: 'PENDING' as const,
            },
          },
        };

    const pendingChanges = await prisma.pendingChange.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, image: true },
        },
        person: {
          include: { profileImage: true },
        },
        approvals: {
          include: {
            approver: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: pendingChanges });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}


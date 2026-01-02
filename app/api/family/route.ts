import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';

// GET - Fetch family settings by root person ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rootPersonId = searchParams.get('rootPersonId');

    if (!rootPersonId) {
      return NextResponse.json({ success: false, error: 'Root person ID required' }, { status: 400 });
    }

    const family = await prisma.family.findUnique({
      where: { rootPersonId },
    });

    return NextResponse.json({ success: true, data: family });
  } catch (error) {
    console.error('Error fetching family:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch family' }, { status: 500 });
  }
}

// POST - Create or update family settings
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const sessionUser = session.user as SessionUser;

    // Check if user is admin
    if (sessionUser.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { rootPersonId, name, description, motto, crestImage } = body;

    if (!rootPersonId || !name) {
      return NextResponse.json({ success: false, error: 'Root person ID and name are required' }, { status: 400 });
    }

    // Upsert - create if doesn't exist, update if it does
    const family = await prisma.family.upsert({
      where: { rootPersonId },
      update: {
        name,
        description,
        motto,
        crestImage,
      },
      create: {
        rootPersonId,
        name,
        description,
        motto,
        crestImage,
      },
    });

    return NextResponse.json({ success: true, data: family });
  } catch (error) {
    console.error('Error saving family:', error);
    return NextResponse.json({ success: false, error: 'Failed to save family' }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { STOCK_GALLERY } from '@/lib/gallery-stock';
import { SessionUser } from '@/types';

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** GET — stock images + uploaded photos for a family (root person id). */
export async function GET(request: NextRequest) {
  try {
    const rootPersonId = request.nextUrl.searchParams.get('rootPersonId');
    if (!rootPersonId) {
      return NextResponse.json({
        success: true,
        data: {
          stock: STOCK_GALLERY,
          uploads: [] as unknown[],
        },
      });
    }

    const uploads = await prisma.galleryPhoto.findMany({
      where: { rootPersonId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        url: true,
        label: true,
        uploadedById: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        stock: STOCK_GALLERY,
        uploads,
      },
    });
  } catch (e) {
    console.error('GET /api/gallery', e);
    return NextResponse.json({ success: false, error: 'Failed to load gallery' }, { status: 500 });
  }
}

/** POST — authenticated upload with optional label */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const label = (formData.get('label') as string) || '';
    const rootPersonId = formData.get('rootPersonId') as string | null;

    if (!file || !rootPersonId) {
      return NextResponse.json(
        { success: false, error: 'Image and family root id are required' },
        { status: 400 }
      );
    }

    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Invalid image type' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'Image must be under 4MB' }, { status: 400 });
    }

    const root = await prisma.person.findUnique({ where: { id: rootPersonId } });
    if (!root) {
      return NextResponse.json({ success: false, error: 'Family not found' }, { status: 404 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${buf.toString('base64')}`;
    if (dataUrl.length > 6_000_000) {
      return NextResponse.json({ success: false, error: 'Image too large after encoding' }, { status: 400 });
    }

    const count = await prisma.galleryPhoto.count({ where: { rootPersonId } });
    const photo = await prisma.galleryPhoto.create({
      data: {
        rootPersonId,
        url: dataUrl,
        label: label.slice(0, 500),
        sortOrder: count,
        uploadedById: user.id,
      },
      select: {
        id: true,
        url: true,
        label: true,
        uploadedById: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: photo });
  } catch (e) {
    console.error('POST /api/gallery', e);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}

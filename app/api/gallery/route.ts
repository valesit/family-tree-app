import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { put } from '@vercel/blob';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' };

function getBlobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.FAMILY_BLOB_READ_WRITE_TOKEN || null;
}

function uploadErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const text = error.message.toLowerCase();
    if (text.includes('token') || text.includes('unauthorized') || text.includes('forbidden')) {
      return 'Gallery storage is not configured correctly. Reconnect the Vercel Blob store and redeploy.';
    }
    if (text.includes('public access') || text.includes('private store')) {
      return 'This Blob store does not allow public image URLs. Connect a public Vercel Blob store for family photos.';
    }
  }
  return 'Upload failed';
}

/** GET — uploaded family photos for a family (root person id). */
export async function GET(request: NextRequest) {
  try {
    const rootPersonId = request.nextUrl.searchParams.get('rootPersonId');
    if (!rootPersonId) {
      return NextResponse.json(
        {
          success: true,
          data: { uploads: [] as unknown[] },
        },
        { headers: noStoreHeaders }
      );
    }

    const uploads = await prisma.galleryPhoto.findMany({
      where: { rootPersonId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        url: true,
        label: true,
        category: true,
        uploadedById: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: { uploads },
      },
      { headers: noStoreHeaders }
    );
  } catch (e) {
    console.error('GET /api/gallery', e);
    return NextResponse.json(
      { success: false, error: 'Failed to load gallery' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}

/** POST — authenticated upload with optional label */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const blobToken = getBlobToken();
    if (!blobToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Gallery storage is not configured. Connect the Vercel Blob store and redeploy.',
        },
        { status: 503 }
      );
    }

    const user = session.user as SessionUser;
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const label = (formData.get('label') as string) || '';
    const rootPersonId = formData.get('rootPersonId') as string | null;
    const categoryRaw = ((formData.get('category') as string) || '').trim().slice(0, 60);
    const category = categoryRaw.length > 0 ? categoryRaw : null;

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

    let url: string;
    try {
      const blob = await put(
        `gallery/${rootPersonId}/${Date.now()}-${file.name}`,
        file,
        {
          access: 'public',
          addRandomSuffix: true,
          token: blobToken,
        }
      );
      url = blob.url;
    } catch (error) {
      console.error('Vercel Blob gallery upload failed:', error);
      return NextResponse.json(
        { success: false, error: uploadErrorMessage(error) },
        { status: 502 }
      );
    }

    const count = await prisma.galleryPhoto.count({ where: { rootPersonId } });
    const photo = await prisma.galleryPhoto.create({
      data: {
        rootPersonId,
        url,
        label: label.slice(0, 500),
        category,
        sortOrder: count,
        uploadedById: user.id,
      },
      select: {
        id: true,
        url: true,
        label: true,
        category: true,
        uploadedById: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { success: true, data: photo },
      { headers: noStoreHeaders }
    );
  } catch (e) {
    console.error('POST /api/gallery', e);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
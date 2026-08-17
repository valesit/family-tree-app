import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { put } from '@vercel/blob';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user as SessionUser;

    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }

    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image type. Allowed: JPEG, PNG, GIF, WebP' },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'Image must be under 5MB' }, { status: 400 });
    }

    const { url } = await put(
      `wiki/${user.id}/${Date.now()}-${file.name}`,
      file,
      {
        access: 'public',
        addRandomSuffix: true,
        token: process.env.FAMILY_BLOB_READ_WRITE_TOKEN,
      }
    );

    return NextResponse.json({ success: true, data: { url } });
  } catch (e) {
    console.error('POST /api/wiki/upload', e);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}

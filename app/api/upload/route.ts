import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { put } from '@vercel/blob';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import {
  findPersonFamilyRoot,
  isFamilyAdmin,
  isSystemAdmin,
} from '@/lib/family-membership';

function getBlobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.FAMILY_BLOB_READ_WRITE_TOKEN || null;
}

function uploadErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const text = error.message.toLowerCase();
    if (text.includes('token') || text.includes('unauthorized') || text.includes('forbidden')) {
      return 'Photo storage is not configured correctly. Reconnect the Vercel Blob store and redeploy.';
    }
    if (text.includes('public access') || text.includes('private store')) {
      return 'This Blob store does not allow public image URLs. Connect a public Vercel Blob store for family photos.';
    }
  }
  return 'Failed to upload image';
}

// POST /api/upload - Upload an image for a family member.
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const formData = await request.formData();
    const image = formData.get('image') as File | null;
    const personId = formData.get('personId') as string | null;
    const isProfile = formData.get('isProfile') === 'true';

    if (!image) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }
    if (!personId) {
      return NextResponse.json({ success: false, error: 'Person ID is required' }, { status: 400 });
    }

    const blobToken = getBlobToken();
    if (!blobToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Photo storage is not configured. Connect the Vercel Blob store and redeploy.',
        },
        { status: 503 }
      );
    }

    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: {
        id: true,
        userId: true,
        addedById: true,
      },
    });
    if (!person) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    const rootId = await findPersonFamilyRoot(personId);
    const [sysAdmin, familyAdmin] = await Promise.all([
      isSystemAdmin(user.id),
      rootId ? isFamilyAdmin(user.id, rootId) : Promise.resolve(false),
    ]);
    const ownsProfile = person.userId === user.id;
    const justAddedPerson = person.addedById === user.id;

    if (!sysAdmin && !familyAdmin && !ownsProfile && !justAddedPerson) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to change this person’s photos' },
        { status: 403 }
      );
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(image.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image type. Allowed: JPEG, PNG, GIF, WebP' },
        { status: 400 }
      );
    }

    const maxSize = 5 * 1024 * 1024;
    if (image.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'Image size must be less than 5MB' },
        { status: 400 }
      );
    }

    let url: string;
    try {
      const blob = await put(
        `persons/${personId}/${Date.now()}-${image.name}`,
        image,
        {
          access: 'public',
          addRandomSuffix: true,
          token: blobToken,
        }
      );
      url = blob.url;
    } catch (error) {
      console.error('Vercel Blob profile upload failed:', error);
      return NextResponse.json(
        { success: false, error: uploadErrorMessage(error) },
        { status: 502 }
      );
    }

    const personImage = await prisma.personImage.create({
      data: {
        url,
        personId,
        isPrimary: isProfile,
      },
    });

    if (isProfile) {
      await prisma.person.update({
        where: { id: personId },
        data: { profileImageId: personImage.id },
      });

      // A claimed family profile is the source of truth for the member's
      // family-facing avatar. Keep the account avatar in sync for messaging.
      if (person.userId) {
        await prisma.user.update({
          where: { id: person.userId },
          data: { image: url },
        });
      }
    }

    await prisma.activity.create({
      data: {
        type: 'IMAGE_UPLOADED',
        description: isProfile
          ? 'A profile photo was updated'
          : 'A photo was added to the family tree',
        userId: user.id,
        data: { personId, imageId: personImage.id, isProfile },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: { ...personImage, url },
        message: isProfile ? 'Profile photo updated.' : 'Image uploaded successfully.',
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}
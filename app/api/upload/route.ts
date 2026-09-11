import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { put } from '@vercel/blob';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import { canManagePersonPhotos } from '@/lib/person-photos';

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
    const image = formData.get('image');
    const personId = formData.get('personId');
    const isProfile = formData.get('isProfile') === 'true';
    const captionValue = formData.get('caption');
    const caption = typeof captionValue === 'string' ? captionValue.trim() : '';

    if (!(image instanceof File) || image.size === 0) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }
    if (typeof personId !== 'string' || !personId) {
      return NextResponse.json({ success: false, error: 'Person ID is required' }, { status: 400 });
    }
    if (!isProfile && caption.length > 280) {
      return NextResponse.json({ success: false, error: 'Caption must be 280 characters or fewer' }, { status: 400 });
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
        profileImageId: true,
      },
    });
    if (!person) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    if (!(await canManagePersonPhotos(user.id, person))) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to change this person’s photos' },
        { status: 403 }
      );
    }

    const mimeByExtension: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const extension = image.name.split('.').pop()?.toLowerCase() || '';
    const contentType = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(image.type)
      ? image.type
      : mimeByExtension[extension];

    // Desktop file pickers can send an empty or generic MIME type. The file
    // extension provides a fallback for those file pickers.
    if (!contentType) {
      return NextResponse.json(
        { success: false, error: 'Invalid image type. Allowed: JPEG, PNG, GIF, WebP' },
        { status: 400 }
      );
    }

    // Personal photos use the same 4MB limit as the family gallery, leaving
    // room for multipart fields within Vercel's request body limit.
    const maxSizeMB = isProfile ? 5 : 4;
    const maxSize = maxSizeMB * 1024 * 1024;
    if (image.size > maxSize) {
      return NextResponse.json(
        { success: false, error: `Image size must be ${maxSizeMB}MB or less` },
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
          contentType,
        }
      );
      url = blob.url;
    } catch (error) {
      console.error('Vercel Blob image upload failed:', error);
      return NextResponse.json(
        { success: false, error: uploadErrorMessage(error) },
        { status: 502 }
      );
    }

    if (!isProfile) {
      // Save the image and its purpose together so a successful upload is
      // always discoverable in the person's photo section after reloading.
      const personImage = await prisma.$transaction(async (tx) => {
        const photo = await tx.personImage.create({
          data: { url, personId, isPrimary: false, caption: caption || null },
        });
        await tx.activity.create({
          data: {
            type: 'IMAGE_UPLOADED',
            description: 'A personal photo was added',
            userId: user.id,
            data: { personId, imageId: photo.id, isProfile: false },
          },
        });
        return photo;
      });
      return NextResponse.json(
        { success: true, data: personImage, message: 'Photo added.' },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }

    // Reuse the current profile-photo record when replacing an avatar. This
    // keeps a replacement from creating a second active profile photo.
    let personImage = isProfile && person.profileImageId
      ? await prisma.personImage.findUnique({ where: { id: person.profileImageId } })
      : null;

    if (personImage) {
      personImage = await prisma.personImage.update({
        where: { id: personImage.id },
        data: { url, isPrimary: isProfile },
      });
    } else {
      personImage = await prisma.personImage.create({
        data: {
          url,
          personId,
          isPrimary: isProfile,
        },
      });
    }

    if (isProfile) {
      await prisma.personImage.updateMany({
        where: { personId, id: { not: personImage.id } },
        data: { isPrimary: false },
      });

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

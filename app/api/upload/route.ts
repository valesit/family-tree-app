import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';

// POST /api/upload - Upload an image for a person
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const formData = await request.formData();
    const image = formData.get('image') as File | null;
    const personId = formData.get('personId') as string | null;
    const isProfile = formData.get('isProfile') === 'true';

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'No image provided' },
        { status: 400 }
      );
    }

    if (!personId) {
      return NextResponse.json(
        { success: false, error: 'Person ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(image.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image type. Allowed: JPEG, PNG, GIF, WebP' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (image.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'Image size must be less than 5MB' },
        { status: 400 }
      );
    }

    // In a real application, you would upload to cloud storage here
    // For now, we'll store a placeholder URL (you would replace this with actual upload logic)
    // Example with Vercel Blob:
    // const { url } = await put(image.name, image, { access: 'public' });

    // Generate a placeholder URL (in production, this would be the actual uploaded URL)
    const timestamp = Date.now();
    const fileName = `${personId}-${timestamp}-${image.name}`;
    const placeholderUrl = `/uploads/${fileName}`; // Placeholder - implement actual upload

    // Create the image record
    const personImage = await prisma.personImage.create({
      data: {
        url: placeholderUrl,
        personId,
        isPrimary: isProfile,
      },
    });

    // If this is a profile image, update the person's profile image
    if (isProfile) {
      await prisma.person.update({
        where: { id: personId },
        data: { profileImageId: personImage.id },
      });
    }

    // Log activity
    await prisma.activity.create({
      data: {
        type: 'IMAGE_UPLOADED',
        description: 'A photo was added to the family tree',
        userId: user.id,
        data: { personId, imageId: personImage.id },
      },
    });

    return NextResponse.json({
      success: true,
      data: personImage,
      message: 'Image uploaded successfully. Note: In production, configure cloud storage.',
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}


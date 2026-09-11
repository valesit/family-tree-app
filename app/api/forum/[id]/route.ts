import { NextRequest, NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import prisma from '@/lib/db';
import { checkCommunityRequest, CommunityError, communityFailure, communityHeaders, communityPermissions, mayManage } from '@/lib/community';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkCommunityRequest(request);
    const { id } = await params;
    const post = await prisma.forumPost.findUnique({ where: { id }, include: { images: true } });
    if (!post) throw new CommunityError('Post not found.', 404);
    const permissions = await communityPermissions(request, post.familyId);
    if (!mayManage(post, permissions)) throw new CommunityError('You can only remove your own posts.', 403);
    await prisma.$transaction(async tx => {
      await tx.galleryPhoto.deleteMany({ where: { id: { in: post.images.map(image => image.galleryPhotoId) } } });
      await tx.forumPost.delete({ where: { id } });
    });
    const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.FAMILY_BLOB_READ_WRITE_TOKEN;
    if (token && post.images.length) {
      try { await del(post.images.map(image => image.url), { token }); } catch (error) { console.error('Forum photo cleanup failed:', error); }
    }
    return NextResponse.json({ success: true }, { headers: communityHeaders });
  } catch (error) { return communityFailure(error); }
}

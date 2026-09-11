import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { checkCommunityRequest, CommunityError, communityFailure, communityHeaders, communityPermissions, mayManage } from '@/lib/community';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkCommunityRequest(request);
    const { id } = await params;
    const comment = await prisma.forumComment.findUnique({ where: { id }, include: { post: { select: { familyId: true } } } });
    if (!comment) throw new CommunityError('Reply not found.', 404);
    const permissions = await communityPermissions(request, comment.post.familyId);
    if (!mayManage(comment, permissions)) throw new CommunityError('You can only remove your own replies.', 403);
    await prisma.forumComment.delete({ where: { id } });
    return NextResponse.json({ success: true }, { headers: communityHeaders });
  } catch (error) { return communityFailure(error); }
}

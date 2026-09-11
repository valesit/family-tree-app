import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { checkCommunityRequest, CommunityError, communityAuthor, communityFailure, communityHeaders, communityPage, communityPermissions, limitCommunityWrites, mayManage, withGuestCookie } from '@/lib/community';
import { commentSchema } from '@/lib/community-validation';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: postId } = await params;
    const post = await prisma.forumPost.findUnique({ where: { id: postId }, select: { familyId: true } });
    if (!post) throw new CommunityError('Post not found.', 404);
    const permissions = await communityPermissions(request, post.familyId);
    const page = communityPage(request);
    const [comments, total] = await Promise.all([
      prisma.forumComment.findMany({ where: { postId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 20, skip: (page - 1) * 20 }),
      prisma.forumComment.count({ where: { postId } }),
    ]);
    const items = comments.map(({ guestKey, authorId, ...comment }) => ({ ...comment, canDelete: mayManage({ guestKey, authorId }, permissions) }));
    return NextResponse.json({ success: true, data: { items, total, page, totalPages: Math.ceil(total / 20) } }, { headers: communityHeaders });
  } catch (error) { return communityFailure(error); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkCommunityRequest(request);
    const { id: postId } = await params;
    const input = commentSchema.parse(await request.json());
    const post = await prisma.forumPost.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) throw new CommunityError('Post not found.', 404);
    const { token, ...author } = await communityAuthor(request, input.guestName);
    await limitCommunityWrites(request, author.authorId);
    const comment = await prisma.forumComment.create({ data: { postId, content: input.content, ...author } });
    return withGuestCookie(NextResponse.json({ success: true, data: { id: comment.id } }, { status: 201, headers: communityHeaders }), request, token);
  } catch (error) { return communityFailure(error); }
}

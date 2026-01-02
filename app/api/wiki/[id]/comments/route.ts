import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wiki/[id]/comments - Get comments for an article
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: articleId } = await params;

    const comments = await prisma.wikiComment.findMany({
      where: { 
        articleId,
        parentId: null, // Only top-level comments
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        replies: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

// POST /api/wiki/[id]/comments - Add a comment
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: articleId } = await params;
    const user = session.user as SessionUser;
    const body = await request.json();
    const { content, parentId } = body;

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Comment content is required' },
        { status: 400 }
      );
    }

    // Verify article exists
    const article = await prisma.wikiArticle.findUnique({
      where: { id: articleId },
      select: { id: true, title: true, authorId: true },
    });

    if (!article) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // If replying to a comment, verify parent exists
    if (parentId) {
      const parentComment = await prisma.wikiComment.findUnique({
        where: { id: parentId },
        select: { authorId: true },
      });

      if (!parentComment) {
        return NextResponse.json(
          { success: false, error: 'Parent comment not found' },
          { status: 404 }
        );
      }

      // Notify the parent comment author about the reply
      if (parentComment.authorId !== user.id) {
        await prisma.notification.create({
          data: {
            type: 'WIKI_COMMENT_REPLY',
            title: 'New reply to your comment',
            message: `${user.name || 'Someone'} replied to your comment on "${article.title}"`,
            userId: parentComment.authorId,
            data: { articleId, commentId: parentId },
          },
        });
      }
    }

    const comment = await prisma.wikiComment.create({
      data: {
        content: content.trim(),
        authorId: user.id,
        articleId,
        parentId: parentId || null,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // Notify article author about new comment (if not replying and not own article)
    if (!parentId && article.authorId !== user.id) {
      await prisma.notification.create({
        data: {
          type: 'WIKI_COMMENT_REPLY',
          title: 'New comment on your article',
          message: `${user.name || 'Someone'} commented on "${article.title}"`,
          userId: article.authorId,
          data: { articleId, commentId: comment.id },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: comment,
      message: 'Comment added successfully',
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add comment' },
      { status: 500 }
    );
  }
}

// DELETE /api/wiki/[id]/comments - Delete a comment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = session.user as SessionUser;
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');

    if (!commentId) {
      return NextResponse.json(
        { success: false, error: 'Comment ID is required' },
        { status: 400 }
      );
    }

    // Check if comment exists and user has permission
    const comment = await prisma.wikiComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json(
        { success: false, error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Only comment author or admin can delete
    if (comment.authorId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'You can only delete your own comments' },
        { status: 403 }
      );
    }

    await prisma.wikiComment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}


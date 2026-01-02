import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wiki/[id] - Get a single article
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // Check if id is a slug or cuid
    const isSlug = !id.startsWith('c') || id.length !== 25;
    
    const article = await prisma.wikiArticle.findFirst({
      where: isSlug ? { slug: id } : { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        aboutPerson: {
          include: {
            profileImage: true,
          },
        },
        tags: true,
        comments: {
          where: { parentId: null }, // Only top-level comments
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
        },
      },
    });

    if (!article) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Increment view count
    await prisma.wikiArticle.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      data: article,
    });
  } catch (error) {
    console.error('Error fetching wiki article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch wiki article' },
      { status: 500 }
    );
  }
}

// PUT /api/wiki/[id] - Update an article
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const user = session.user as SessionUser;
    const body = await request.json();
    const { title, content, excerpt, coverImage, aboutPersonId, tags, isPublished } = body;

    // Check if article exists and user has permission
    const existing = await prisma.wikiArticle.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Only author or admin can edit
    if (existing.authorId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'You can only edit your own articles' },
        { status: 403 }
      );
    }

    // Update slug if title changed
    let slug = existing.slug;
    if (title && title !== existing.title) {
      const baseSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      slug = baseSlug;
      let counter = 1;
      while (await prisma.wikiArticle.findFirst({ 
        where: { slug, id: { not: id } } 
      })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    // Update article
    const article = await prisma.wikiArticle.update({
      where: { id },
      data: {
        title: title || undefined,
        slug,
        content: content || undefined,
        excerpt: excerpt || undefined,
        coverImage: coverImage !== undefined ? coverImage : undefined,
        aboutPersonId: aboutPersonId !== undefined ? aboutPersonId : undefined,
        isPublished: isPublished !== undefined ? isPublished : undefined,
        tags: tags ? {
          set: [], // Clear existing tags
          connectOrCreate: tags.map((tagName: string) => ({
            where: { name: tagName },
            create: { name: tagName },
          })),
        } : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        aboutPerson: {
          include: {
            profileImage: true,
          },
        },
        tags: true,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: 'WIKI_ARTICLE_UPDATED',
        description: `${user.name || 'A user'} updated wiki article: "${article.title}"`,
        userId: user.id,
        data: { articleId: article.id },
      },
    });

    return NextResponse.json({
      success: true,
      data: article,
      message: 'Article updated successfully',
    });
  } catch (error) {
    console.error('Error updating wiki article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update wiki article' },
      { status: 500 }
    );
  }
}

// DELETE /api/wiki/[id] - Delete an article
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const user = session.user as SessionUser;

    // Check if article exists and user has permission
    const existing = await prisma.wikiArticle.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // Only author or admin can delete
    if (existing.authorId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'You can only delete your own articles' },
        { status: 403 }
      );
    }

    await prisma.wikiArticle.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Article deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting wiki article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete wiki article' },
      { status: 500 }
    );
  }
}


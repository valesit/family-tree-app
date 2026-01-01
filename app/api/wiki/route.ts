import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser, WikiArticleWithAuthor } from '@/types';

// GET /api/wiki - List wiki articles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const tag = searchParams.get('tag') || '';
    const published = searchParams.get('published') !== 'false'; // Default to published only
    
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    
    if (published) {
      where.isPublished = true;
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (tag) {
      where.tags = {
        some: { name: tag }
      };
    }

    const [articles, total] = await Promise.all([
      prisma.wikiArticle.findMany({
        where,
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
          _count: {
            select: { comments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.wikiArticle.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: articles as WikiArticleWithAuthor[],
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching wiki articles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch wiki articles' },
      { status: 500 }
    );
  }
}

// POST /api/wiki - Create a new wiki article
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = session.user as SessionUser;
    const body = await request.json();
    const { title, content, excerpt, coverImage, aboutPersonId, tags, isPublished } = body;

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: 'Title and content are required' },
        { status: 400 }
      );
    }

    // Generate slug from title
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    // Check if slug exists and make it unique
    let slug = baseSlug;
    let counter = 1;
    while (await prisma.wikiArticle.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create article with tags
    const article = await prisma.wikiArticle.create({
      data: {
        title,
        slug,
        content,
        excerpt: excerpt || content.substring(0, 200) + '...',
        coverImage,
        isPublished: isPublished || false,
        authorId: user.id,
        aboutPersonId: aboutPersonId || null,
        tags: tags?.length ? {
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
        type: 'WIKI_ARTICLE_CREATED',
        description: `${user.name || 'A user'} created a new wiki article: "${title}"`,
        userId: user.id,
        data: { articleId: article.id, articleSlug: article.slug },
      },
    });

    return NextResponse.json({
      success: true,
      data: article,
      message: 'Article created successfully',
    });
  } catch (error) {
    console.error('Error creating wiki article:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create wiki article' },
      { status: 500 }
    );
  }
}


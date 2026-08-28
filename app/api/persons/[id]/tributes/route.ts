import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';
import {
  findPersonFamilyRoot,
  getFamilyMembership,
  isSystemAdmin,
} from '@/lib/family-membership';

type TributeRow = {
  id: string;
  content: string;
  personId: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  authorName: string | null;
  authorImage: string | null;
};

async function listVisibleTributes(personId: string): Promise<TributeRow[]> {
  return prisma.$queryRaw<TributeRow[]>`
    SELECT
      t."id",
      t."content",
      t."personId",
      t."authorId",
      t."createdAt",
      t."updatedAt",
      COALESCE(
        NULLIF(TRIM(CONCAT(ap."firstName", ' ', ap."lastName")), ''),
        u."name",
        'Family member'
      ) AS "authorName",
      COALESCE(pi."url", u."image") AS "authorImage"
    FROM "Tribute" t
    JOIN "User" u ON u."id" = t."authorId"
    LEFT JOIN "Person" ap ON ap."userId" = u."id"
    LEFT JOIN "PersonImage" pi ON pi."id" = ap."profileImageId"
    WHERE t."personId" = ${personId}
      AND t."isHidden" = FALSE
    ORDER BY t."createdAt" DESC
  `;
}

// GET /api/persons/[id]/tributes - public, visible tributes for a profile.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: personId } = await params;
    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: { id: true },
    });
    if (!person) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    const tributes = await listVisibleTributes(personId);
    return NextResponse.json({ success: true, data: tributes });
  } catch (error) {
    console.error('GET profile tributes failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load family messages' },
      { status: 500 }
    );
  }
}

// POST /api/persons/[id]/tributes - add a eulogy, memory, gratitude or encouragement.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Sign in required' }, { status: 401 });
    }

    const user = session.user as SessionUser;
    const { id: personId } = await params;
    const body = await request.json().catch(() => ({}));
    const content = typeof body?.content === 'string' ? body.content.trim() : '';

    if (!content) {
      return NextResponse.json({ success: false, error: 'Write a message before posting' }, { status: 400 });
    }
    if (content.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Family messages must be 1,000 characters or fewer' },
        { status: 400 }
      );
    }

    const person = await prisma.person.findUnique({
      where: { id: personId },
      select: { id: true, userId: true },
    });
    if (!person) {
      return NextResponse.json({ success: false, error: 'Person not found' }, { status: 404 });
    }

    const rootId = await findPersonFamilyRoot(personId);
    const [sysAdmin, membership] = await Promise.all([
      isSystemAdmin(user.id),
      rootId ? getFamilyMembership(user.id, rootId) : Promise.resolve(null),
    ]);

    if (!sysAdmin && !membership) {
      return NextResponse.json(
        { success: false, error: 'Only members of this family can post on this profile' },
        { status: 403 }
      );
    }

    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "Tribute"
        ("id", "content", "personId", "authorId", "isHidden", "createdAt", "updatedAt")
      VALUES
        (${id}, ${content}, ${personId}, ${user.id}, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;

    const [created] = await prisma.$queryRaw<TributeRow[]>`
      SELECT
        t."id",
        t."content",
        t."personId",
        t."authorId",
        t."createdAt",
        t."updatedAt",
        COALESCE(
          NULLIF(TRIM(CONCAT(ap."firstName", ' ', ap."lastName")), ''),
          u."name",
          'Family member'
        ) AS "authorName",
        COALESCE(pi."url", u."image") AS "authorImage"
      FROM "Tribute" t
      JOIN "User" u ON u."id" = t."authorId"
      LEFT JOIN "Person" ap ON ap."userId" = u."id"
      LEFT JOIN "PersonImage" pi ON pi."id" = ap."profileImageId"
      WHERE t."id" = ${id}
    `;

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error('POST profile tribute failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to post your family message' },
      { status: 500 }
    );
  }
}

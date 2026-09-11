import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { checkCommunityRequest, CommunityError, communityFailure, communityFamily, communityHeaders, communityPage, communityPermissions, communityUser, limitCommunityWrites } from '@/lib/community';
import { listingSchema } from '@/lib/community-validation';

export async function GET(request: NextRequest) {
  try {
    const family = await communityFamily(request.nextUrl.searchParams.get('familyId'));
    const permissions = await communityPermissions(request, family.id);
    const page = communityPage(request);
    const kind = request.nextUrl.searchParams.get('kind');
    const search = (request.nextUrl.searchParams.get('search') || '').trim().slice(0, 100);
    const where = { familyId: family.id, ...(kind === 'BUSINESS' || kind === 'CAUSE' ? { kind } : {}),
      ...(search ? { OR: ['name', 'description', 'location'].map(field => ({ [field]: { contains: search, mode: 'insensitive' as const } })) } : {}) };
    const [listings, total] = await Promise.all([
      prisma.businessListing.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 12, skip: (page - 1) * 12 }),
      prisma.businessListing.count({ where }),
    ]);
    const items = listings.map(({ ownerId, ...listing }) => ({ ...listing, canManage: permissions.isAdmin || permissions.userId === ownerId }));
    return NextResponse.json({ success: true, data: { items, total, page, totalPages: Math.ceil(total / 12) } }, { headers: communityHeaders });
  } catch (error) { return communityFailure(error); }
}

export async function POST(request: NextRequest) {
  try {
    checkCommunityRequest(request);
    const user = await communityUser();
    if (!user) throw new CommunityError('Sign in to add a business or cause.', 401);
    const input = listingSchema.parse(await request.json());
    const family = await communityFamily(input.familyId);
    await limitCommunityWrites(request, user.id);
    const listing = await prisma.businessListing.create({ data: { ...input, familyId: family.id, ownerId: user.id } });
    return NextResponse.json({ success: true, data: { id: listing.id } }, { status: 201, headers: communityHeaders });
  } catch (error) { return communityFailure(error); }
}

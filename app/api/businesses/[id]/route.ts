import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { checkCommunityRequest, CommunityError, communityFailure, communityFamily, communityHeaders, communityPermissions, limitCommunityWrites } from '@/lib/community';
import { listingSchema } from '@/lib/community-validation';

async function editableListing(request: NextRequest, id: string) {
  const listing = await prisma.businessListing.findUnique({ where: { id } });
  if (!listing) throw new CommunityError('Listing not found.', 404);
  const permissions = await communityPermissions(request, listing.familyId);
  if (!permissions.userId) throw new CommunityError('Sign in to manage a listing.', 401);
  if (!permissions.isAdmin && permissions.userId !== listing.ownerId) throw new CommunityError('You can only manage your own listings.', 403);
  return { listing, userId: permissions.userId };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkCommunityRequest(request);
    const { id } = await params;
    const { listing, userId } = await editableListing(request, id);
    const input = listingSchema.parse(await request.json());
    const family = await communityFamily(input.familyId);
    if (family.id !== listing.familyId) throw new CommunityError('A listing cannot be moved to another family.');
    await limitCommunityWrites(request, userId);
    await prisma.businessListing.update({ where: { id }, data: { ...input, familyId: family.id } });
    return NextResponse.json({ success: true, data: { id } }, { headers: communityHeaders });
  } catch (error) { return communityFailure(error); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkCommunityRequest(request);
    const { id } = await params;
    await editableListing(request, id);
    await prisma.businessListing.delete({ where: { id } });
    return NextResponse.json({ success: true }, { headers: communityHeaders });
  } catch (error) { return communityFailure(error); }
}

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import prisma from '@/lib/db';
import { communityAuthor, communityFailure, communityFamily, communityHeaders, communityPage, communityPermissions, checkCommunityRequest, CommunityError, limitCommunityWrites, mayManage, withGuestCookie } from '@/lib/community';
import { postSchema, validateForumImages, MAX_FORUM_IMAGE_BYTES, POSTED_IMAGES_CATEGORY } from '@/lib/community-validation';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const family = await communityFamily(request.nextUrl.searchParams.get('familyId'));
    const page = communityPage(request);
    const permissions = await communityPermissions(request, family.id);
    const where = { familyId: family.id };
    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 12, take: 12,
        include: { images: { orderBy: { displayOrder: 'asc' }, select: { id: true, url: true } }, _count: { select: { comments: true } } } }),
      prisma.forumPost.count({ where }),
    ]);
    const items = posts.map(({ guestKey, authorId, ...post }) => ({ ...post, canDelete: mayManage({ guestKey, authorId }, permissions) }));
    return NextResponse.json({ success: true, data: { items, total, page, totalPages: Math.ceil(total / 12) } }, { headers: communityHeaders });
  } catch (error) { return communityFailure(error); }
}

async function checkImageSignature(file: File) {
  const b = Buffer.from(await file.slice(0, 12).arrayBuffer());
  const valid = file.type === 'image/jpeg' ? b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
    : file.type === 'image/png' ? b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : file.type === 'image/gif' ? ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString())
    : b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
  if (!valid) throw new CommunityError('One of the files is not a valid photo. Choose a JPEG, PNG, GIF or WebP image.');
}

export async function POST(request: NextRequest) {
  const uploaded: string[] = [];
  const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.FAMILY_BLOB_READ_WRITE_TOKEN;
  try {
    checkCommunityRequest(request, MAX_FORUM_IMAGE_BYTES + 64_000);
    const form = await request.formData();
    const input = postSchema.parse({ familyId: form.get('familyId'), content: form.get('content') || '', guestName: form.get('guestName') || '' });
    const attachments = form.getAll('images');
    if (attachments.some(item => !(item instanceof File))) throw new CommunityError('Choose valid photo files.');
    const files = attachments as File[];
    const imageError = validateForumImages(files);
    if (imageError) throw new CommunityError(imageError);
    if (!input.content && !files.length) throw new CommunityError('Write something or add a photo first.');
    await Promise.all(files.map(checkImageSignature));
    const family = await communityFamily(input.familyId);
    const { token: guestToken, ...author } = await communityAuthor(request, input.guestName);
    await limitCommunityWrites(request, author.authorId);
    if (files.length && !token) throw new CommunityError('Photo storage is temporarily unavailable. Please try again later.', 503);
    for (const file of files) {
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' }[file.type];
      const blob = await put(`forum/${family.id}/${randomUUID()}.${extension}`, file, { access: 'public', contentType: file.type, token, addRandomSuffix: true });
      uploaded.push(blob.url);
    }
    // Publishing and the gallery copies succeed together. Existing upload routes are untouched.
    const post = await prisma.$transaction(async tx => {
      const created = await tx.forumPost.create({ data: { familyId: family.id, content: input.content, ...author } });
      for (const [displayOrder, url] of uploaded.entries()) {
        const photo = await tx.galleryPhoto.create({ data: { rootPersonId: family.rootPersonId, url, label: (input.content || `Photo shared by ${author.authorName}`).slice(0, 500), category: POSTED_IMAGES_CATEGORY, uploadedById: author.authorId } });
        await tx.forumImage.create({ data: { postId: created.id, url, galleryPhotoId: photo.id, displayOrder } });
      }
      return created;
    }, { timeout: 15000 });
    return withGuestCookie(NextResponse.json({ success: true, data: { id: post.id } }, { status: 201, headers: communityHeaders }), request, guestToken);
  } catch (error) {
    if (uploaded.length && token) {
      try { await del(uploaded, { token }); } catch (cleanupError) { console.error('Forum upload cleanup failed:', cleanupError); }
    }
    return communityFailure(error);
  }
}

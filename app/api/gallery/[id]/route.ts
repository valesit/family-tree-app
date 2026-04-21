import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { SessionUser } from '@/types';

/** PATCH — update caption/label (owner or admin) */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user as SessionUser;
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const label = typeof body.label === 'string' ? body.label.slice(0, 500) : undefined;
    if (label === undefined) {
      return NextResponse.json({ success: false, error: 'label required' }, { status: 400 });
    }

    const existing = await prisma.galleryPhoto.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const isAdmin = user.role === 'ADMIN';
    const isOwner = existing.uploadedById === user.id;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.galleryPhoto.update({
      where: { id },
      data: { label },
      select: { id: true, label: true, url: true, uploadedById: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    console.error('PATCH /api/gallery/[id]', e);
    return NextResponse.json({ success: false, error: 'Update failed' }, { status: 500 });
  }
}

/** DELETE — remove upload (owner or admin) */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user as SessionUser;
    const { id } = await params;

    const existing = await prisma.galleryPhoto.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const isAdmin = user.role === 'ADMIN';
    const isOwner = existing.uploadedById === user.id;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    await prisma.galleryPhoto.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/gallery/[id]', e);
    return NextResponse.json({ success: false, error: 'Delete failed' }, { status: 500 });
  }
}

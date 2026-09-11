import prisma from '@/lib/db';
import { findPersonFamilyRoot, isFamilyAdmin, isSystemAdmin } from '@/lib/family-membership';

type PhotoOwner = { id: string; userId: string | null; addedById: string | null };

export async function canManagePersonPhotos(userId: string, person: PhotoOwner) {
  if (person.userId === userId || person.addedById === userId) return true;
  if (await isSystemAdmin(userId)) return true;
  const rootId = await findPersonFamilyRoot(person.id);
  return !!rootId && isFamilyAdmin(userId, rootId);
}

export async function getPersonalPhotoIds(personId: string): Promise<Set<string>> {
  // Uploads already record their purpose in durable Activity metadata. Require
  // an explicit personal upload so legacy avatar history does not become an
  // album just because those images are no longer marked as primary.
  const uploads = await prisma.activity.findMany({
    where: {
      type: 'IMAGE_UPLOADED',
      AND: [
        { data: { path: ['personId'], equals: personId } },
        { data: { path: ['isProfile'], equals: false } },
      ],
    },
    select: { data: true },
  });

  return new Set(uploads.flatMap(({ data }) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
    return typeof data.imageId === 'string' ? [data.imageId] : [];
  }));
}

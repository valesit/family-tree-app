import { z } from 'zod';

export const POSTED_IMAGES_CATEGORY = 'Posted Images';
export const MAX_FORUM_IMAGES = 4;
export const MAX_FORUM_IMAGE_BYTES = 4 * 1024 * 1024;
export const FORUM_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const postSchema = z.object({
  familyId: z.string().trim().min(1).max(100),
  content: z.string().trim().max(5000, 'Posts can contain up to 5,000 characters.'),
  guestName: z.string().trim().max(80).default(''),
});
export const commentSchema = z.object({
  content: z.string().trim().min(1, 'Write a reply first.').max(2000),
  guestName: z.string().trim().max(80).default(''),
});

const optionalText = (max: number) => z.string().trim().max(max).default('');
export const listingSchema = z.object({
  familyId: z.string().trim().min(1).max(100),
  kind: z.enum(['BUSINESS', 'CAUSE']),
  name: z.string().trim().min(2, 'Enter a name for your listing.').max(120),
  description: z.string().trim().min(10, 'Add a little more detail (at least 10 characters).').max(5000),
  location: optionalText(160),
  contactName: z.string().trim().min(2, 'Enter a contact name.').max(100),
  email: z.union([z.email(), z.literal('')]).default(''),
  phone: optionalText(40).refine(value => !value || /^\+?[\d\s().-]{6,40}$/.test(value), 'Enter a valid phone number.'),
  website: optionalText(500).refine(value => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
  }, 'Use a full website address starting with https:// or http://.'),
  supportDetails: z.string().trim().min(5, 'Describe how people can support you.').max(2000),
}).refine(value => value.email || value.phone || value.website, {
  message: 'Add at least one way to get in touch: email, phone, or website.', path: ['email'],
});

export type ListingInput = z.infer<typeof listingSchema>;

export function validateForumImages(files: File[]) {
  if (files.length > MAX_FORUM_IMAGES) return 'Add up to 4 photos per post.';
  if (files.some(file => !FORUM_IMAGE_TYPES.includes(file.type) || file.size === 0)) {
    return 'Choose a JPEG, PNG, GIF or WebP photo.';
  }
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_FORUM_IMAGE_BYTES) {
    return 'The selected photos must total 4 MB or less.';
  }
  return null;
}

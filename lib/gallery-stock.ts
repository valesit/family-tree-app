/** Curated stock images for the family gallery (shown to everyone). */
export type GalleryCategoryId =
  | 'generations'
  | 'celebrations'
  | 'heritage'
  | 'moments'
  | 'milestones';

export type StockGalleryItem = {
  id: string;
  url: string;
  label: string;
  category: GalleryCategoryId;
};

export type GalleryCategory = {
  id: GalleryCategoryId;
  label: string;
  /** Short copy shown on hover/active state */
  blurb: string;
};

/** UI order for category pills. Keep in sync with GalleryCategoryId. */
export const GALLERY_CATEGORIES: GalleryCategory[] = [
  { id: 'generations', label: 'Generations', blurb: 'Grandparents, parents, and children together' },
  { id: 'celebrations', label: 'Celebrations', blurb: 'Weddings, birthdays, holidays' },
  { id: 'heritage', label: 'Heritage & roots', blurb: 'Places, traditions, ancestral history' },
  { id: 'moments', label: 'Everyday moments', blurb: 'Casual snapshots and family life' },
  { id: 'milestones', label: 'Milestones', blurb: 'Graduations, new arrivals, achievements' },
];

export const STOCK_GALLERY: StockGalleryItem[] = [
  // Generations
  {
    id: 'stock-gen-1',
    url: 'https://images.unsplash.com/photo-1529333162767-5440f0756e52?w=900&q=80&auto=format&fit=crop',
    label: 'Three generations together',
    category: 'generations',
  },
  {
    id: 'stock-gen-2',
    url: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=900&q=80&auto=format&fit=crop',
    label: 'Together at home',
    category: 'generations',
  },
  // Celebrations
  {
    id: 'stock-cel-1',
    url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=900&q=80&auto=format&fit=crop',
    label: 'A family celebration',
    category: 'celebrations',
  },
  {
    id: 'stock-cel-2',
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=900&q=80&auto=format&fit=crop',
    label: 'Wedding day',
    category: 'celebrations',
  },
  // Heritage
  {
    id: 'stock-her-1',
    url: 'https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=900&q=80&auto=format&fit=crop',
    label: 'Heritage and roots',
    category: 'heritage',
  },
  {
    id: 'stock-her-2',
    url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=900&q=80&auto=format&fit=crop',
    label: 'Ancestral landscapes',
    category: 'heritage',
  },
  // Everyday moments
  {
    id: 'stock-mom-1',
    url: 'https://images.unsplash.com/photo-1542037104857-ffbb0b9155fb?w=900&q=80&auto=format&fit=crop',
    label: 'A quiet afternoon',
    category: 'moments',
  },
  {
    id: 'stock-mom-2',
    url: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=900&q=80&auto=format&fit=crop',
    label: 'Around the table',
    category: 'moments',
  },
  // Milestones
  {
    id: 'stock-mil-1',
    url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=900&q=80&auto=format&fit=crop',
    label: 'Graduation day',
    category: 'milestones',
  },
  {
    id: 'stock-mil-2',
    url: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=900&q=80&auto=format&fit=crop',
    label: 'A new arrival',
    category: 'milestones',
  },
];

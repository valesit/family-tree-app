/** Curated stock images for the family gallery (shown to everyone). */
export type StockGalleryItem = {
  id: string;
  url: string;
  label: string;
};

export const STOCK_GALLERY: StockGalleryItem[] = [
  {
    id: 'stock-1',
    url: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=900&q=80&auto=format&fit=crop',
    label: 'Together at home',
  },
  {
    id: 'stock-2',
    url: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=900&q=80&auto=format&fit=crop',
    label: 'Celebration',
  },
  {
    id: 'stock-3',
    url: 'https://images.unsplash.com/photo-1529333162767-5440f0756e52?w=900&q=80&auto=format&fit=crop',
    label: 'Generations',
  },
  {
    id: 'stock-4',
    url: 'https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=900&q=80&auto=format&fit=crop',
    label: 'Heritage & roots',
  },
];

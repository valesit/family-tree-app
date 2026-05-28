'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { TreePine } from 'lucide-react';
import { FamilyGallerySection } from '@/components/gallery';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function GalleryPage() {
  const { data } = useSWR<{ success: boolean; data: { primaryFamilyId: string | null } }>(
    '/api/families',
    fetcher,
    { revalidateOnFocus: false }
  );
  const rootPersonId = data?.data?.primaryFamilyId ?? null;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight">
            Family gallery
          </h1>
          <p className="text-slate-600 mt-2 max-w-xl">
            Authentic photos shared by family members. Sign in to add your own with a caption.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <TreePine className="w-4 h-4 text-maroon-600" />
          Back to home
        </Link>
      </div>
      <FamilyGallerySection rootPersonId={rootPersonId} />
    </div>
  );
}

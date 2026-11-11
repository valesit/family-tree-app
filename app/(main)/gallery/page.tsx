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
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-8 flex flex-col gap-4 border-b border-[#e6dcd3] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-[#332720] sm:text-4xl">
            Family gallery
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-7 text-[#66574f]">
            Authentic photos shared by family members. Sign in to add your own with a caption.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-lg border border-[#d8c8bc] bg-[#fffdf9] px-4 py-2.5 text-sm font-medium text-maroon-700 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-maroon-500"
        >
          <TreePine className="w-4 h-4 text-maroon-600" />
          Back to family tree
        </Link>
      </div>
      <FamilyGallerySection rootPersonId={rootPersonId} />
    </div>
  );
}

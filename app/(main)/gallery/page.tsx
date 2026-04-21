import Link from 'next/link';
import { Images, TreePine, ArrowRight } from 'lucide-react';

export default function GalleryPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
      <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white via-slate-50/40 to-maroon-50/20 p-8 sm:p-12 text-center shadow-sm ring-1 ring-slate-900/[0.04]">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-maroon-500 text-white shadow-lg shadow-maroon-900/15 mb-6">
          <Images className="w-8 h-8" />
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight mb-3">
          Family gallery
        </h1>
        <p className="text-slate-600 leading-relaxed mb-8 max-w-lg mx-auto">
          We&apos;re curating a space for photos, documents, and memories. Until then, explore
          family stories and articles in the wiki.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/wiki"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-maroon-500 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-maroon-600 transition-colors"
          >
            Open wiki &amp; stories
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
          >
            <TreePine className="w-4 h-4 text-maroon-600" />
            Back to family tree
          </Link>
        </div>
      </div>
    </div>
  );
}

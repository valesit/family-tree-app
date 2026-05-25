'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import {
  Images,
  Upload,
  Loader2,
  Pencil,
  Check,
  X,
  Trash2,
  LogIn,
  ImageOff,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import {
  GALLERY_CATEGORIES,
  type GalleryCategoryId,
  type StockGalleryItem,
} from '@/lib/gallery-stock';
import { SessionUser } from '@/types';
import { clsx } from 'clsx';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type UploadRow = {
  id: string;
  url: string;
  label: string;
  /** Built-in GalleryCategoryId OR a user-coined slug. NULL = "Your family's". */
  category: string | null;
  uploadedById: string | null;
  createdAt?: string;
};

/** Unified representation of any photo in the lightbox / grid. */
type GalleryItem = {
  id: string;
  url: string;
  label: string;
  source: 'stock' | 'upload';
  uploaderId?: string | null;
};

interface FamilyGallerySectionProps {
  rootPersonId: string | null;
  /** Tighter spacing on the homepage */
  compact?: boolean;
}

/** 'all' | builtin id | 'uploads' (uncategorized bucket) | `custom:<slug>`. */
type FilterId = 'all' | GalleryCategoryId | 'uploads' | `custom:${string}`;

/** Sentinel value for the "Create new…" option in the upload category dropdown. */
const NEW_CATEGORY_SENTINEL = '__new__';

const BUILTIN_IDS = new Set<string>(GALLERY_CATEGORIES.map((c) => c.id));

export function FamilyGallerySection({ rootPersonId, compact }: FamilyGallerySectionProps) {
  const { data: session, status } = useSession();
  const user = session?.user as SessionUser | undefined;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadLabel, setUploadLabel] = useState('');
  const [hasFile, setHasFile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');

  /**
   * Upload-form category. `''` = "Your family's" (uncategorized);
   * `NEW_CATEGORY_SENTINEL` = the form is showing the "type a new name" input.
   */
  const [uploadCategory, setUploadCategory] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState('');

  /** Lightbox state. */
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const galleryUrl = rootPersonId ? `/api/gallery?rootPersonId=${encodeURIComponent(rootPersonId)}` : '/api/gallery';
  const { data, isLoading, mutate } = useSWR(galleryUrl, fetcher, { revalidateOnFocus: false });

  const stock: StockGalleryItem[] = data?.data?.stock ?? [];
  const uploads: UploadRow[] = data?.data?.uploads ?? [];
  const isAuthenticated = status === 'authenticated';

  /** User-coined categories appearing on at least one upload (sorted A→Z). */
  const customCategories = useMemo(() => {
    const set = new Set<string>();
    for (const u of uploads) {
      if (u.category && !BUILTIN_IDS.has(u.category)) set.add(u.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [uploads]);

  /** Counts per filter so users see what's there at a glance. */
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: stock.length + uploads.length,
      generations: 0,
      celebrations: 0,
      heritage: 0,
      moments: 0,
      milestones: 0,
      uploads: 0, // uncategorized uploads only
    };
    for (const s of stock) c[s.category]++;
    for (const u of uploads) {
      if (!u.category) {
        c.uploads++;
      } else if (BUILTIN_IDS.has(u.category)) {
        c[u.category] = (c[u.category] ?? 0) + 1;
      } else {
        c[`custom:${u.category}`] = (c[`custom:${u.category}`] ?? 0) + 1;
      }
    }
    return c;
  }, [stock, uploads]);

  /** Resolve which category string to send with the upload. */
  const resolvedCategory = (): string => {
    if (uploadCategory === NEW_CATEGORY_SENTINEL) {
      return newCategoryName.trim().slice(0, 60);
    }
    return uploadCategory;
  };

  const handleUpload = async () => {
    const input = fileRef.current;
    const file = input?.files?.[0];
    if (!file || !rootPersonId) return;
    const category = resolvedCategory();
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('label', uploadLabel.trim());
      fd.append('rootPersonId', rootPersonId);
      if (category) fd.append('category', category);
      const res = await fetch('/api/gallery', { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || 'Upload failed');
        return;
      }
      setUploadLabel('');
      setUploadCategory('');
      setNewCategoryName('');
      setHasFile(false);
      if (input) input.value = '';
      await mutate();
      // Jump to whichever bucket the photo now lives in.
      if (!category) {
        setActiveFilter('uploads');
      } else if (BUILTIN_IDS.has(category)) {
        setActiveFilter(category as GalleryCategoryId);
      } else {
        setActiveFilter(`custom:${category}` as FilterId);
      }
    } catch {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const saveLabel = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/gallery/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: editText }),
        });
        const json = await res.json();
        if (!json.success) {
          alert(json.error || 'Could not save');
          return;
        }
        setEditingId(null);
        await mutate();
      } catch {
        alert('Could not save');
      }
    },
    [editText, mutate]
  );

  const removePhoto = async (id: string) => {
    if (!confirm('Remove this photo from the gallery?')) return;
    try {
      const res = await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || 'Could not remove');
        return;
      }
      await mutate();
    } catch {
      alert('Could not remove');
    }
  };

  const startEdit = (row: UploadRow) => {
    setEditingId(row.id);
    setEditText(row.label);
  };

  const canEdit = (row: UploadRow) =>
    isAuthenticated && user && (user.role === 'ADMIN' || row.uploadedById === user.id);

  /** Stock images surface only on All + the 5 built-in category pills. */
  const filteredStock = useMemo(() => {
    if (activeFilter === 'all') return stock;
    if (activeFilter === 'uploads') return [];
    if (typeof activeFilter === 'string' && activeFilter.startsWith('custom:')) return [];
    return stock.filter((s) => s.category === activeFilter);
  }, [stock, activeFilter]);

  /** Uploads bucket by the same rules. */
  const filteredUploads = useMemo(() => {
    if (activeFilter === 'all') return uploads;
    if (activeFilter === 'uploads') return uploads.filter((u) => !u.category);
    if (typeof activeFilter === 'string' && activeFilter.startsWith('custom:')) {
      const slug = activeFilter.slice('custom:'.length);
      return uploads.filter((u) => u.category === slug);
    }
    return uploads.filter((u) => u.category === activeFilter);
  }, [uploads, activeFilter]);

  const isEmpty =
    !isLoading && filteredStock.length === 0 && filteredUploads.length === 0;

  /** Flat list of every visible photo in current filter order — used by the lightbox. */
  const visibleItems = useMemo<GalleryItem[]>(() => {
    const items: GalleryItem[] = [];
    for (const s of filteredStock) {
      items.push({ id: s.id, url: s.url, label: s.label, source: 'stock' });
    }
    for (const u of filteredUploads) {
      items.push({
        id: u.id,
        url: u.url,
        label: u.label,
        source: 'upload',
        uploaderId: u.uploadedById,
      });
    }
    return items;
  }, [filteredStock, filteredUploads]);

  // Keyboard nav for the lightbox.
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((i) => (i === null ? null : (i + 1) % visibleItems.length));
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((i) =>
          i === null ? null : (i - 1 + visibleItems.length) % visibleItems.length
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, visibleItems.length]);

  // Close the lightbox if the current filter no longer has photos.
  useEffect(() => {
    if (lightboxIndex !== null && visibleItems.length === 0) {
      setLightboxIndex(null);
    }
  }, [lightboxIndex, visibleItems.length]);

  return (
    <section
      className={clsx(
        'relative overflow-hidden rounded-2xl border border-maroon-900/10 bg-gradient-to-b from-white to-maroon-50/20 shadow-sm ring-1 ring-maroon-900/[0.04]',
        compact ? 'py-4 px-3 sm:py-5 sm:px-6' : 'py-6 px-4 sm:py-8 sm:px-8'
      )}
    >
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-maroon-400/[0.06] blur-3xl pointer-events-none" aria-hidden />

      {/* Header */}
      <div className="relative mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-slate-900 sm:text-2xl">
            <Images className="h-5 w-5 shrink-0 text-maroon-600 sm:h-6 sm:w-6" />
            Family gallery
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 sm:mt-1 sm:text-sm">
            Tap a category to filter photos. Sign in to add your own.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAuthenticated ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={() => setHasFile(!!fileRef.current?.files?.length)}
              />
              <button
                type="button"
                disabled={!rootPersonId || uploading}
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-maroon-500 px-3 py-2 text-xs font-semibold text-white shadow-md transition-colors hover:bg-maroon-600 disabled:opacity-50 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Add photo
              </button>
              <Link
                href="/gallery"
                className="text-xs font-medium text-maroon-800 hover:underline sm:text-sm"
              >
                See all
              </Link>
            </>
          ) : (
            <Link
              href={`/login?callbackUrl=${encodeURIComponent('/gallery')}`}
              className="inline-flex items-center gap-2 rounded-xl border border-maroon-300 bg-white px-3 py-2 text-xs font-semibold text-maroon-900 shadow-sm transition-colors hover:bg-maroon-50 sm:px-4 sm:py-2.5 sm:text-sm"
            >
              <LogIn className="h-4 w-4" />
              Sign in to upload
            </Link>
          )}
        </div>
      </div>

      {/* Category pills */}
      <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 sm:mb-5 sm:gap-2 [scrollbar-width:thin]">
        <CategoryPill
          label="All"
          count={counts.all}
          active={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
        />
        {GALLERY_CATEGORIES.map((cat) => (
          <CategoryPill
            key={cat.id}
            label={cat.label}
            count={counts[cat.id]}
            active={activeFilter === cat.id}
            onClick={() => setActiveFilter(cat.id)}
            title={cat.blurb}
          />
        ))}
        {counts.uploads > 0 && (
          <CategoryPill
            label="Your family's"
            count={counts.uploads}
            active={activeFilter === 'uploads'}
            onClick={() => setActiveFilter('uploads')}
            highlight
          />
        )}
        {customCategories.map((slug) => (
          <CategoryPill
            key={`custom:${slug}`}
            label={slug}
            count={counts[`custom:${slug}`] ?? 0}
            active={activeFilter === `custom:${slug}`}
            onClick={() => setActiveFilter(`custom:${slug}` as FilterId)}
            highlight
          />
        ))}
      </div>

      {/* Authenticated upload form (only when adding) */}
      {isAuthenticated && rootPersonId && hasFile && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white/80 p-3 sm:mb-5 sm:p-4">
          {/* Row 1: caption + category. Wraps on small screens. */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_minmax(10rem,15rem)] sm:gap-3">
            <input
              type="text"
              value={uploadLabel}
              onChange={(e) => setUploadLabel(e.target.value)}
              placeholder="Caption (optional)"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-maroon-400 focus:ring-1 focus:ring-maroon-400"
              maxLength={500}
            />
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-maroon-400 focus:ring-1 focus:ring-maroon-400"
              aria-label="Category"
            >
              <option value="">Your family&rsquo;s (default)</option>
              <optgroup label="Built-in categories">
                {GALLERY_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              {customCategories.length > 0 && (
                <optgroup label="Your custom">
                  {customCategories.map((slug) => (
                    <option key={`custom-${slug}`} value={slug}>
                      {slug}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value={NEW_CATEGORY_SENTINEL}>+ Create new category&hellip;</option>
            </select>
          </div>

          {/* Row 2 (conditional): name a new category. */}
          {uploadCategory === NEW_CATEGORY_SENTINEL && (
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-maroon-600" aria-hidden />
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name (e.g. Reunions, Sports)"
                maxLength={60}
                className="flex-1 rounded-lg border border-maroon-200 px-3 py-2 text-sm outline-none focus:border-maroon-400 focus:ring-1 focus:ring-maroon-400"
              />
            </div>
          )}

          {/* Row 3: actions. */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={
                uploading ||
                (uploadCategory === NEW_CATEGORY_SENTINEL && !newCategoryName.trim())
              }
              onClick={handleUpload}
              className="whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-40"
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                if (fileRef.current) fileRef.current.value = '';
                setHasFile(false);
                setUploadLabel('');
                setUploadCategory('');
                setNewCategoryName('');
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <p className="text-[11px] text-slate-500">
              JPEG, PNG, GIF or WebP — max 4&nbsp;MB.
            </p>
          </div>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-7 w-7 animate-spin text-maroon-500" />
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white/60 py-10 text-center">
          <ImageOff className="h-7 w-7 text-slate-400" aria-hidden />
          <p className="text-sm text-slate-600">No photos in this category yet.</p>
          {activeFilter === 'uploads' && isAuthenticated && (
            <p className="text-xs text-slate-500">Tap “Add photo” to be the first.</p>
          )}
        </div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filteredStock.map((item, idx) => (
            <li key={item.id} className="group">
              <button
                type="button"
                onClick={() => setLightboxIndex(idx)}
                className="block aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-maroon-500"
                aria-label={`Open ${item.label || 'photo'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.label}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                />
              </button>
              <p className="mt-1.5 line-clamp-2 text-[11px] font-medium text-slate-600 sm:mt-2 sm:text-xs md:text-sm">
                {item.label}
              </p>
            </li>
          ))}
          {filteredUploads.map((row, j) => {
            const itemIndex = filteredStock.length + j;
            return (
              <li key={row.id} className="group">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(itemIndex)}
                    className="block h-full w-full focus:outline-none focus:ring-2 focus:ring-maroon-500"
                    aria-label={`Open ${row.label || 'family photo'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={row.url}
                      alt={row.label}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  </button>
                  {canEdit(row) && (
                    <div className="absolute right-1.5 top-1.5 flex gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(row);
                        }}
                        className="rounded-lg bg-white/95 p-1.5 text-slate-700 shadow hover:bg-white"
                        title="Edit caption"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePhoto(row.id);
                        }}
                        className="rounded-lg bg-white/95 p-1.5 text-red-600 shadow hover:bg-white"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {editingId === row.id ? (
                  <div className="mt-1.5 flex gap-1">
                    <input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="min-w-0 flex-1 rounded border border-maroon-200 px-2 py-1 text-xs"
                      maxLength={500}
                    />
                    <button
                      type="button"
                      onClick={() => saveLabel(row.id)}
                      className="rounded bg-maroon-500 p-1.5 text-white"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded border border-slate-200 p-1.5"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <p className="mt-1.5 line-clamp-2 text-[11px] font-medium text-slate-600 sm:mt-2 sm:text-xs md:text-sm">
                    {row.label || <span className="italic text-slate-400">No caption</span>}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && visibleItems[lightboxIndex] && (
        <Lightbox
          item={visibleItems[lightboxIndex]}
          index={lightboxIndex}
          total={visibleItems.length}
          onClose={() => setLightboxIndex(null)}
          onPrev={() =>
            setLightboxIndex((i) =>
              i === null ? null : (i - 1 + visibleItems.length) % visibleItems.length
            )
          }
          onNext={() =>
            setLightboxIndex((i) =>
              i === null ? null : (i + 1) % visibleItems.length
            )
          }
        />
      )}
    </section>
  );
}

interface LightboxProps {
  item: GalleryItem;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function Lightbox({ item, index, total, onClose, onPrev, onNext }: LightboxProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={item.label || 'Photo'}
      onClick={onClose}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 rounded-full bg-white/15 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
        aria-label="Close"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>

      {/* Prev */}
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 p-2.5 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
          aria-label="Previous photo"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
      )}

      {/* Image + caption (stop propagation so clicks inside don't close) */}
      <figure
        className="relative max-h-full max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.label}
          className="mx-auto max-h-[85vh] max-w-[95vw] rounded-lg object-contain shadow-2xl"
        />
        {item.label && (
          <figcaption className="mx-auto mt-3 max-w-[60ch] text-center text-sm text-white/90">
            {item.label}
          </figcaption>
        )}
        <p className="mt-2 text-center text-xs text-white/60">
          {index + 1} of {total}
        </p>
      </figure>

      {/* Next */}
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 p-2.5 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
          aria-label="Next photo"
        >
          <ChevronRight className="h-6 w-6" aria-hidden />
        </button>
      )}
    </div>
  );
}

interface CategoryPillProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  title?: string;
  highlight?: boolean;
}

function CategoryPill({ label, count, active, onClick, title, highlight }: CategoryPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={clsx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm',
        active
          ? 'border-maroon-700 bg-maroon-700 text-white shadow-sm'
          : highlight
          ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
          : 'border-slate-200 bg-white text-slate-700 hover:border-maroon-200 hover:text-maroon-800'
      )}
      aria-pressed={active}
    >
      <span>{label}</span>
      <span
        className={clsx(
          'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
          active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
        )}
      >
        {count}
      </span>
    </button>
  );
}

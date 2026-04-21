'use client';

import { useCallback, useRef, useState } from 'react';
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
} from 'lucide-react';
import type { StockGalleryItem } from '@/lib/gallery-stock';
import { SessionUser } from '@/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type UploadRow = {
  id: string;
  url: string;
  label: string;
  uploadedById: string | null;
  createdAt?: string;
};

interface FamilyGallerySectionProps {
  rootPersonId: string | null;
  /** Tighter spacing on the homepage */
  compact?: boolean;
}

export function FamilyGallerySection({ rootPersonId, compact }: FamilyGallerySectionProps) {
  const { data: session, status } = useSession();
  const user = session?.user as SessionUser | undefined;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadLabel, setUploadLabel] = useState('');
  const [hasFile, setHasFile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const galleryUrl = rootPersonId ? `/api/gallery?rootPersonId=${encodeURIComponent(rootPersonId)}` : '/api/gallery';
  const { data, isLoading, mutate } = useSWR(galleryUrl, fetcher, { revalidateOnFocus: false });

  const stock: StockGalleryItem[] = data?.data?.stock ?? [];
  const uploads: UploadRow[] = data?.data?.uploads ?? [];
  const isAuthenticated = status === 'authenticated';

  const handleUpload = async () => {
    const input = fileRef.current;
    const file = input?.files?.[0];
    if (!file || !rootPersonId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('label', uploadLabel.trim());
      fd.append('rootPersonId', rootPersonId);
      const res = await fetch('/api/gallery', { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || 'Upload failed');
        return;
      }
      setUploadLabel('');
      setHasFile(false);
      if (input) input.value = '';
      await mutate();
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

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-maroon-900/10 bg-gradient-to-b from-white to-maroon-50/20 shadow-sm ring-1 ring-maroon-900/[0.04] ${
        compact ? 'py-5 px-4 sm:px-6' : 'py-8 px-4 sm:px-8'
      }`}
    >
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-maroon-400/[0.06] blur-3xl pointer-events-none" aria-hidden />

      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-serif text-xl sm:text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <Images className="w-6 h-6 text-maroon-600 shrink-0" />
            Family gallery
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Moments from reunions, milestones, and everyday life — stock highlights plus your uploads.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                className="inline-flex items-center gap-2 rounded-xl bg-maroon-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-maroon-600 disabled:opacity-50 transition-colors"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Choose photo
              </button>
              <Link
                href="/gallery"
                className="text-sm font-medium text-maroon-800 hover:underline"
              >
                Open full gallery
              </Link>
            </>
          ) : (
            <Link
              href={`/login?callbackUrl=${encodeURIComponent('/gallery')}`}
              className="inline-flex items-center gap-2 rounded-xl border border-maroon-300 bg-white px-4 py-2.5 text-sm font-semibold text-maroon-900 shadow-sm hover:bg-maroon-50 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Sign in to upload photos
            </Link>
          )}
        </div>
      </div>

      {isAuthenticated && rootPersonId && (
        <div className="flex flex-col gap-3 mb-6 p-4 rounded-xl bg-white/80 border border-slate-200/80">
          <p className="text-xs text-slate-500">
            Choose a photo, add an optional caption, then submit. JPEG, PNG, GIF or WebP — max 4MB.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={uploadLabel}
              onChange={(e) => setUploadLabel(e.target.value)}
              placeholder="Caption or label for this photo (optional)"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-maroon-400 focus:ring-1 focus:ring-maroon-400 outline-none"
              maxLength={500}
            />
            <button
              type="button"
              disabled={uploading || !hasFile}
              onClick={handleUpload}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {uploading ? 'Uploading…' : 'Upload photo'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-maroon-500 animate-spin" />
        </div>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 list-none p-0 m-0">
          {stock.map((item) => (
            <li key={item.id} className="group">
              <div className="aspect-[4/3] overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                />
              </div>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 font-medium line-clamp-2">{item.label}</p>
            </li>
          ))}
          {uploads.map((row) => (
            <li key={row.id} className="group">
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={row.url} alt="" className="h-full w-full object-cover" />
                {canEdit(row) && (
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="rounded-lg bg-white/95 p-1.5 text-slate-700 shadow hover:bg-white"
                      title="Edit label"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePhoto(row.id)}
                      className="rounded-lg bg-white/95 p-1.5 text-red-600 shadow hover:bg-white"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {editingId === row.id ? (
                <div className="mt-2 flex gap-1">
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="flex-1 min-w-0 rounded border border-maroon-200 px-2 py-1 text-xs"
                    maxLength={500}
                  />
                  <button
                    type="button"
                    onClick={() => saveLabel(row.id)}
                    className="rounded bg-maroon-500 p-1.5 text-white"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded border border-slate-200 p-1.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs sm:text-sm text-slate-600 font-medium line-clamp-2">
                  {row.label || <span className="text-slate-400 italic">No label</span>}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

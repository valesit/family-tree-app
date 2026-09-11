'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, Images, Loader2, X } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import type { PersonImage } from '@/types';

interface PersonPhotosProps {
  personId: string;
  firstName: string;
  photos: PersonImage[];
  canManage: boolean;
  onUploaded: (photo: PersonImage) => void;
}

export function PersonPhotos({ personId, firstName: rawFirstName, photos, canManage, onUploaded }: PersonPhotosProps) {
  const firstName = rawFirstName.trim();
  const fileInput = useRef<HTMLInputElement>(null);
  const lightbox = useRef<HTMLDialogElement>(null);
  const uploadInProgress = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [viewing, setViewing] = useState<PersonImage | null>(null);

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  useEffect(() => {
    if (viewing) lightbox.current?.showModal();
    else lightbox.current?.close();
  }, [viewing]);

  function clearSelection() {
    setFile(null);
    setPreview(null);
    setCaption('');
    if (fileInput.current) fileInput.current.value = '';
  }

  function selectFile(selected: File | undefined) {
    if (!selected) return;
    setError(null);
    setMessage(null);
    setFile(null);
    setPreview(null);
    setCaption('');
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(selected.type)
      && !/\.(jpe?g|png|gif|webp)$/i.test(selected.name)) {
      setError('Choose a JPEG, PNG, GIF or WebP image.');
    } else if (selected.size === 0 || selected.size > 4 * 1024 * 1024) {
      setError(selected.size === 0 ? 'This file is empty. Choose another photo.' : 'Choose a photo that is 4MB or smaller.');
    } else {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  }

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !canManage || uploadInProgress.current) return;
    uploadInProgress.current = true;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const body = new FormData();
      body.append('image', file);
      body.append('personId', personId);
      body.append('isProfile', 'false');
      body.append('caption', caption.trim());
      const response = await fetch('/api/upload', { method: 'POST', body });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Could not upload this photo. Please try again.');
      }
      clearSelection();
      setMessage('Photo added.');
      onUploaded(result.data);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload this photo.');
    } finally {
      uploadInProgress.current = false;
      setUploading(false);
    }
  }

  return (
    <Card id="photos" className="scroll-mt-24 border-[#e3d7cd] bg-[#fffdf9]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-semibold text-[#382a24]">Photos</h2>
        {canManage && (
          <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
            <Camera className="mr-2 h-4 w-4" />{file ? 'Choose another photo' : 'Add photo'}
          </Button>
        )}
      </div>
      <p className="mt-2 text-sm leading-6 text-[#7a6960]">Moments, places and memories from {firstName}’s life.</p>

      {canManage && (
        <>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
            aria-label={`Choose a photo for ${firstName}`}
            className="hidden"
            disabled={uploading}
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
          <p className="mt-1 text-xs text-[#9a887d]">JPEG, PNG, GIF or WebP · up to 4MB per photo</p>
          {file && (
            <form onSubmit={uploadPhoto} className="mt-4 rounded-xl border border-[#e5d9cf] bg-[#faf6f2] p-4">
              <div className="flex items-start gap-3">
                {preview && <img src={preview} alt="Selected photo preview" className="h-20 w-20 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-[#57473f]">Selected: {file.name}</p>
                  <label htmlFor={`photo-caption-${personId}`} className="mt-3 block text-xs text-[#75645c]">Caption (optional)</label>
                  <input
                    id={`photo-caption-${personId}`}
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    maxLength={280}
                    disabled={uploading}
                    placeholder="A place, a date or a memory…"
                    className="mt-1 w-full rounded-lg border border-[#ddd0c6] bg-white px-3 py-2 text-sm text-[#4c3b33] outline-none focus:border-[#8a4a42]"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" disabled={uploading} onClick={clearSelection}>Cancel</Button>
                <Button type="submit" size="sm" disabled={uploading}>
                  {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {uploading ? 'Uploading…' : 'Upload photo'}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
      <p role="status" className="mt-3 text-sm text-[#56715c]">{uploading ? `Uploading: ${file?.name}` : message}</p>

      {photos.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <figure key={photo.id} className="overflow-hidden rounded-xl border border-[#eadfd6] bg-[#f7f1ec]">
              <button type="button" className="block w-full focus-visible:outline-2 focus-visible:outline-maroon-500" onClick={() => setViewing(photo)} aria-label={`View ${photo.caption || `${firstName}’s photo`}`}>
                <img src={photo.url} alt={photo.caption || `${firstName}’s photo`} loading="lazy" className="aspect-square w-full object-cover" />
              </button>
              {photo.caption && <figcaption className="break-words p-3 text-xs leading-5 text-[#7f6e65]">{photo.caption}</figcaption>}
            </figure>
          ))}
        </div>
      ) : !file ? (
        <div className="mt-4 rounded-xl border border-dashed border-[#e2d5ca] px-5 py-7 text-center">
          <Images className="mx-auto h-7 w-7 text-[#9a735f]" />
          <p className="mt-2 text-sm text-[#8a7970]">No photos have been added yet.</p>
          {canManage && <p className="mt-1 text-xs text-[#9a887d]">Add a photo to start sharing memories.</p>}
        </div>
      ) : null}

      <dialog
        ref={lightbox}
        aria-label="Photo viewer"
        onClose={() => setViewing(null)}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[min(90vw,56rem)] overflow-auto rounded-2xl border border-[#e5d9ce] bg-[#fffdf9] p-4 backdrop:bg-black/60"
      >
        {viewing && (
          <>
            <div className="mb-3 flex justify-end">
              <button type="button" onClick={() => lightbox.current?.close()} aria-label="Close photo" className="rounded-full p-2 text-[#75645c] hover:bg-[#f5efe9]"><X className="h-5 w-5" /></button>
            </div>
            <img src={viewing.url} alt={viewing.caption || `${firstName}’s photo`} className="max-h-[65dvh] w-full object-contain" />
            {viewing.caption && <p className="mt-3 break-words text-center text-sm text-[#706057]">{viewing.caption}</p>}
          </>
        )}
      </dialog>
    </Card>
  );
}

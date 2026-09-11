'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { Globe2, ImagePlus, Send, X } from 'lucide-react';
import { Avatar, Button, Input, Textarea } from '@/components/ui';
import { validateForumImages } from '@/lib/community-validation';
import { communityFetch, CommunityErrorNotice } from './shared';

export function ForumComposer({ familyId, onPosted }: { familyId: string; onPosted: () => Promise<unknown> }) {
  const { data: session, status } = useSession();
  const [content, setContent] = useState('');
  const [guestName, setGuestName] = useState('');
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const photoRef = useRef(photos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => { photoRef.current = photos; }, [photos]);
  useEffect(() => () => photoRef.current.forEach(photo => URL.revokeObjectURL(photo.url)), []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || status === 'loading') return;
    setError(''); setSuccess('');
    if (!content.trim() && !photos.length) { setError('Write something or add a photo first.'); return; }
    if (!session?.user && guestName.trim().length < 2) { setError('Enter your name to post as a guest.'); return; }
    setBusy(true);
    const form = new FormData();
    form.set('familyId', familyId); form.set('content', content); form.set('guestName', guestName);
    photos.forEach(photo => form.append('images', photo.file));
    try {
      await communityFetch('/api/forum', { method: 'POST', body: form });
      setContent(''); photos.forEach(photo => URL.revokeObjectURL(photo.url)); setPhotos([]);
      setSuccess(photos.length ? 'Your post is published. Photos were also added to Posted Images in the gallery.' : 'Your post is published.');
      await Promise.allSettled([onPosted()]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to publish your post.'); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} className="rounded-2xl border border-[#e5d9ce] bg-white p-5 shadow-sm sm:p-6">
    <div className="mb-4 flex items-center gap-3">
      <Avatar name={session?.user?.name || guestName || 'Guest'} src={session?.user?.image} size="md" />
      <div><h2 className="font-serif text-lg text-[#332720]">Share with the family</h2><p className="mt-0.5 flex items-center gap-1 text-xs text-[#8a7b72]"><Globe2 className="h-3 w-3" />Public · Everyone can read and reply</p></div>
    </div>
    <fieldset disabled={busy || status === 'loading'} className="space-y-4 disabled:opacity-70">
      {status === 'authenticated' ? <p className="text-sm text-[#66574f]">Posting as <strong>{session?.user?.name || 'Family member'}</strong></p>
        : <Input id="forum-guest-name" label="Your name" placeholder="Enter your name to join in" value={guestName} onChange={e => setGuestName(e.target.value)} maxLength={80} minLength={2} required autoComplete="name" />}
      <Textarea id="forum-post" aria-label="Write a post" placeholder="Share an update, a memory, or something on your mind…" rows={4} value={content} onChange={e => setContent(e.target.value)} maxLength={5000} />
      {photos.length > 0 && <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">{photos.map((photo, index) => <li key={photo.url} className="relative min-w-0">
        <Image src={photo.url} alt={`Selected photo: ${photo.file.name}`} width={200} height={160} unoptimized className="aspect-[5/4] w-full rounded-xl object-cover" />
        <button type="button" aria-label={`Remove ${photo.file.name}`} onClick={() => { URL.revokeObjectURL(photo.url); setPhotos(old => old.filter((_, i) => i !== index)); }} className="absolute right-1 top-1 rounded-full bg-white p-1.5 shadow"><X className="h-4 w-4" /></button>
        <p className="mt-1 truncate text-xs text-[#7e6e65]" title={photo.file.name}>{photo.file.name}</p>
      </li>)}</ul>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eee5de] pt-4">
        <div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#ded2c8] px-3 py-2 text-sm text-[#66574f] focus-within:ring-2 focus-within:ring-maroon-500">
            <ImagePlus className="h-4 w-4 text-maroon-600" />Add photos
            <input type="file" aria-label="Add photos to post" className="sr-only" multiple accept="image/jpeg,image/png,image/gif,image/webp" onChange={e => {
              const selected = Array.from(e.target.files || []);
              if (!selected.length) return;
              const problem = validateForumImages([...photos.map(p => p.file), ...selected]);
              setError(problem || ''); setSuccess('');
              if (!problem) setPhotos(old => [...old, ...selected.map(file => ({ file, url: URL.createObjectURL(file) }))]);
              e.target.value = '';
            }} />
          </label>
          <p className="mt-1.5 text-[11px] text-[#8a7b72]">Up to 4 photos · 4 MB total · Also saved to Posted Images</p>
        </div>
        <div className="flex items-center gap-3"><span className="text-xs text-[#8a7b72]">{content.length}/5,000</span><Button type="submit" disabled={busy || status === 'loading'}><Send className="mr-2 h-4 w-4" />{busy ? 'Publishing…' : 'Post'}</Button></div>
      </div>
    </fieldset>
    {error && <div className="mt-4"><CommunityErrorNotice message={error} /></div>}
    {success && <p role="status" className="mt-4 text-sm text-emerald-800">{success}</p>}
    {busy && <p role="status" className="mt-3 text-sm text-[#7e6e65]">{photos.length ? 'Uploading your photos and publishing…' : 'Publishing your post…'}</p>}
  </form>;
}

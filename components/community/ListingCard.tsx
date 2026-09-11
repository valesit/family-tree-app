'use client';

import { useState } from 'react';
import { ArrowUpRight, HeartHandshake, Mail, MapPin, Pencil, Phone, Store, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { BusinessListingView } from '@/types/community';
import { communityFetch, CommunityErrorNotice } from './shared';

export function ListingCard({ listing, onEdit, onDeleted }: { listing: BusinessListingView; onEdit: () => void; onDeleted: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const isCause = listing.kind === 'CAUSE';
  async function remove() {
    if (!window.confirm(`Remove “${listing.name}” from the directory?`)) return;
    setBusy(true); setError('');
    try { await communityFetch(`/api/businesses/${listing.id}`, { method: 'DELETE' }); await onDeleted(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to remove listing.'); }
    finally { setBusy(false); }
  }
  return <article className="flex min-w-0 flex-col rounded-2xl border border-[#e5d9ce] bg-white p-6 shadow-sm">
    <div className="mb-5 flex items-start justify-between gap-3"><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${isCause ? 'bg-emerald-50 text-emerald-800' : 'bg-maroon-50 text-maroon-700'}`}>{isCause ? <HeartHandshake className="h-4 w-4" /> : <Store className="h-4 w-4" />}{isCause ? 'Charitable cause' : 'Family business'}</span>
      {listing.canManage && <div className="flex gap-1"><button type="button" aria-label={`Edit ${listing.name}`} onClick={onEdit} className="rounded-lg p-1.5 text-[#8a7b72] hover:bg-[#f5efe9]"><Pencil className="h-4 w-4" /></button><button type="button" aria-label={`Remove ${listing.name}`} disabled={busy} onClick={remove} className="rounded-lg p-1.5 text-[#8a7b72] hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button></div>}
    </div>
    <h2 className="break-words font-serif text-2xl text-[#332720]">{listing.name}</h2>
    {listing.location && <p className="mt-2 flex items-start gap-1.5 text-xs text-[#8a7b72]"><MapPin className="h-3.5 w-3.5 shrink-0" />{listing.location}</p>}
    <p className={`mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-[#66574f] ${expanded ? '' : 'line-clamp-4'}`}>{listing.description}</p>
    {listing.description.length > 200 && <Button variant="ghost" size="sm" className="mt-1 self-start" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? 'Show less' : 'Read more'}</Button>}
    <div className="my-5 rounded-xl bg-[#fbf9f5] p-4"><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#9a897f]">How to support</h3><p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#66574f]">{listing.supportDetails}</p></div>
    <div className="mt-auto space-y-2 border-t border-[#eee5de] pt-4"><p className="break-words text-xs text-[#8a7b72]">Contact: <span className="font-medium text-[#66574f]">{listing.contactName}</span></p>
      {listing.email && <a href={`mailto:${listing.email}`} className="flex items-center gap-2 break-all text-sm text-maroon-700 hover:underline"><Mail className="h-4 w-4 shrink-0" />{listing.email}</a>}
      {listing.phone && <a href={`tel:${listing.phone.replace(/[^+\d]/g, '')}`} className="flex items-center gap-2 text-sm text-maroon-700 hover:underline"><Phone className="h-4 w-4 shrink-0" />{listing.phone}</a>}
      {listing.website && <a href={listing.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#ded2c8] px-3 py-2 text-sm font-medium text-maroon-700 hover:bg-[#fffaf6]">{isCause ? 'Visit support page' : 'Visit website'}<ArrowUpRight className="h-4 w-4" /></a>}
    </div>
    {error && <div className="mt-4"><CommunityErrorNotice message={error} /></div>}
  </article>;
}

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import Link from 'next/link';
import { HeartHandshake, Plus, Search } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { ListingForm } from '@/components/community/ListingForm';
import { ListingCard } from '@/components/community/ListingCard';
import { communityFetch, CommunityErrorNotice, CommunityLoading, CommunityPagination, useCommunityFamily } from '@/components/community/shared';
import { BusinessListingView, CommunityPage } from '@/types/community';

export default function SupportPage() {
  const family = useCommunityFamily();
  if (family.isLoading) return <CommunityLoading />;
  if (family.error) return <div className="mx-auto max-w-3xl p-8"><CommunityErrorNotice message={family.error.message} /><Button className="mt-4" onClick={family.retry}>Try again</Button></div>;
  if (!family.familyId) return <p className="p-8 text-center text-[#7e6e65]">The directory will be available once a family has been created.</p>;
  return <FamilyDirectory familyId={family.familyId} familyName={family.familyName} />;
}

function FamilyDirectory({ familyId, familyName }: { familyId: string; familyName: string }) {
  const { data: session, status } = useSession();
  const [kind, setKind] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<BusinessListingView | 'new' | null>(null);
  const [success, setSuccess] = useState('');
  const params = new URLSearchParams({ familyId, page: String(page), kind, search: query });
  const { data, error, isLoading, mutate } = useSWR<CommunityPage<BusinessListingView>>([`/api/businesses?${params}`, status, session?.user?.name], ([url]) => communityFetch(url), { revalidateOnFocus: false });
  function edit(listing: BusinessListingView | 'new') { setEditor(listing); setSuccess(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
    <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs uppercase tracking-[0.18em] text-[#9a897f]">{familyName} · Stronger together</p><h1 className="max-w-2xl font-serif text-3xl leading-tight text-[#332720] sm:text-4xl">Support a Family Business/Cause</h1><p className="mt-3 max-w-2xl text-[#7e6e65]">Discover what our family is building, find a service, or support a cause close to home.</p></div>
      {status === 'authenticated' ? <Button onClick={() => edit('new')} className="shrink-0 self-start sm:self-auto"><Plus className="mr-2 h-4 w-4" />Add a listing</Button>
        : status === 'unauthenticated' ? <Link href="/login?callbackUrl=%2Fsupport" className="shrink-0 self-start rounded-lg bg-maroon-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-maroon-600">Sign in to add a listing</Link> : null}
    </header>
    {success && <p role="status" className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</p>}
    {editor && session?.user && <ListingForm key={editor === 'new' ? 'new' : editor.id} familyId={familyId} listing={editor === 'new' ? undefined : editor} onCancel={() => setEditor(null)} onSaved={() => {
      setSuccess(editor === 'new' ? 'Your listing is published and visible to everyone.' : 'Your listing has been updated.'); setEditor(null); setPage(1); setQuery(''); setSearch(''); setKind(''); void mutate();
    }} />}
    <div className="mb-7 flex flex-col gap-4 border-y border-[#e5d9ce] py-5 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap gap-2" aria-label="Listing categories">{[['', 'All listings'], ['BUSINESS', 'Businesses'], ['CAUSE', 'Causes']].map(([value, label]) => <button key={value} type="button" aria-pressed={kind === value} onClick={() => { setKind(value); setPage(1); }} className={`rounded-full border px-4 py-2 text-sm transition ${kind === value ? 'border-maroon-600 bg-maroon-600 text-white' : 'border-[#ded2c8] bg-white text-[#7e6e65] hover:border-maroon-400'}`}>{label}</button>)}</div>
      <form onSubmit={e => { e.preventDefault(); setQuery(search.trim()); setPage(1); }} className="flex items-center gap-2 md:max-w-sm"><Input aria-label="Search businesses and causes" placeholder="Search the directory" value={search} onChange={e => { setSearch(e.target.value); if (!e.target.value) { setQuery(''); setPage(1); } }} maxLength={100} /><Button type="submit" variant="outline" aria-label="Search directory"><Search className="h-4 w-4" /></Button></form>
    </div>
    {error && <div className="mb-5"><CommunityErrorNotice message={error.message} /><Button variant="outline" className="mt-3" onClick={() => mutate()}>Try again</Button></div>}{isLoading && <CommunityLoading />}
    {!isLoading && !error && !data?.items.length && <div className="rounded-2xl border border-dashed border-[#d8c8bc] px-6 py-16 text-center"><HeartHandshake className="mx-auto mb-4 h-9 w-9 text-[#baa596]" /><h2 className="font-serif text-2xl">{query || kind ? 'No matching listings' : 'Good things start with family'}</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#8a7b72]">{query || kind ? 'Try another search or browse all listings.' : 'Share your business or charitable cause so family members can find you and lend their support.'}</p>{query || kind ? <Button className="mt-5" variant="outline" onClick={() => { setSearch(''); setQuery(''); setKind(''); setPage(1); }}>View all listings</Button> : null}</div>}
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{data?.items.map(listing => <ListingCard key={listing.id} listing={listing} onEdit={() => edit(listing)} onDeleted={() => mutate()} />)}</div>
    <CommunityPagination page={page} totalPages={data?.totalPages || 0} onChange={setPage} />
    <p className="mt-8 text-center text-xs text-[#9a897f]">Everyone can browse. Sign in to publish and manage your listings.</p>
  </div>;
}

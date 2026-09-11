'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import Link from 'next/link';
import { ArrowRight, Globe2, Images, MessageCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';
import { ForumComposer } from '@/components/community/ForumComposer';
import { ForumPostCard } from '@/components/community/ForumPostCard';
import { communityFetch, CommunityErrorNotice, CommunityLoading, CommunityPagination, useCommunityFamily } from '@/components/community/shared';
import { CommunityPage, ForumPostView } from '@/types/community';

export default function ForumPage() {
  const family = useCommunityFamily();
  if (family.isLoading) return <CommunityLoading />;
  if (family.error) return <div className="mx-auto max-w-3xl p-8"><CommunityErrorNotice message={family.error.message} /><Button className="mt-4" onClick={family.retry}>Try again</Button></div>;
  if (!family.familyId) return <p className="p-8 text-center text-[#7e6e65]">The forum will be available once a family has been created.</p>;
  return <FamilyForum familyId={family.familyId} familyName={family.familyName} />;
}

function FamilyForum({ familyId, familyName }: { familyId: string; familyName: string }) {
  const { data: session, status } = useSession();
  const [page, setPage] = useState(1);
  const url = `/api/forum?familyId=${encodeURIComponent(familyId)}&page=${page}`;
  const { data, error, isLoading, isValidating, mutate } = useSWR<CommunityPage<ForumPostView>>([url, status, session?.user?.name], ([path]) => communityFetch(path), { revalidateOnFocus: false });
  const onChange = () => mutate();
  const onPosted = async () => { setPage(1); await mutate(); };
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
    <header className="mb-8"><p className="mb-2 text-xs uppercase tracking-[0.18em] text-[#9a897f]">{familyName} · Family life</p><h1 className="font-serif text-4xl text-[#332720]">Forum</h1><p className="mt-3 max-w-2xl text-[#7e6e65]">A place to catch up, share memories, and keep the conversation going.</p></header>
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 space-y-6"><ForumComposer familyId={familyId} onPosted={onPosted} />
        <div className="flex items-center justify-between"><h2 className="font-serif text-xl text-[#49372f]">Latest conversations</h2><Button variant="ghost" size="sm" onClick={() => mutate()} disabled={isValidating}><RefreshCw className={`mr-2 h-3.5 w-3.5 ${isValidating ? 'animate-spin' : ''}`} />Refresh</Button></div>
        {error && <CommunityErrorNotice message={error.message} />}{isLoading && <CommunityLoading />}
        {!isLoading && !error && !data?.items.length && <div className="rounded-2xl border border-dashed border-[#d8c8bc] px-6 py-12 text-center"><MessageCircle className="mx-auto mb-3 h-8 w-8 text-[#baa596]" /><h3 className="font-serif text-xl">Start the conversation</h3><p className="mt-2 text-sm text-[#8a7b72]">Share the first update or family photo above.</p></div>}
        {data?.items.map(post => <ForumPostCard key={post.id} post={post} onChange={onChange} />)}
        <CommunityPagination page={page} totalPages={data?.totalPages || 0} onChange={setPage} />
      </div>
      <aside className="space-y-6 text-sm text-[#7e6e65] lg:sticky lg:top-24">
        <section className="rounded-2xl border border-[#e5d9ce] bg-[#fffdf9] p-5"><Globe2 className="mb-3 h-5 w-5 text-maroon-600" /><h2 className="mb-2 font-serif text-lg text-[#49372f]">Everyone is welcome</h2><p className="leading-6">Read, post, and reply without signing in. Just add your name, or sign in to post with your account.</p></section>
        <section className="px-1"><Images className="mb-3 h-5 w-5 text-maroon-600" /><h2 className="mb-2 font-serif text-lg text-[#49372f]">Memories, kept together</h2><p className="leading-6">Photos shared here also appear in the family gallery under Posted Images.</p><Link href="/gallery" className="mt-3 inline-flex items-center gap-2 font-medium text-maroon-700">Visit the gallery<ArrowRight className="h-4 w-4" /></Link></section>
        <div className="border-t border-[#e5d9ce] pt-5"><Link href="/support" className="font-medium leading-6 text-maroon-700">Support a Family Business/Cause<ArrowRight className="ml-2 inline h-4 w-4" /></Link></div>
      </aside>
    </div>
  </div>;
}

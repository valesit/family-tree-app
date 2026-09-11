'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { MessageCircle, Trash2 } from 'lucide-react';
import { Avatar, Button, Input, Textarea } from '@/components/ui';
import { CommunityPage, ForumCommentView, ForumPostView } from '@/types/community';
import { communityFetch, CommunityDate, CommunityErrorNotice, CommunityLoading, CommunityPagination } from './shared';

export function ForumPostCard({ post, onChange }: { post: ForumPostView; onChange: () => Promise<unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (!window.confirm('Remove this post? Its replies and its photos in Posted Images will also be removed.')) return;
    setBusy(true); setError('');
    try { await communityFetch(`/api/forum/${post.id}`, { method: 'DELETE' }); await onChange(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to remove post.'); }
    finally { setBusy(false); }
  }
  return <article className="overflow-hidden rounded-2xl border border-[#e5d9ce] bg-white shadow-sm">
    <div className="p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3"><Avatar name={post.authorName} size="md" /><div className="min-w-0 flex-1">
        <p className="break-words font-medium text-[#332720]">{post.authorName}{post.isGuest && <span className="ml-2 rounded-full bg-[#f5efe9] px-2 py-0.5 text-[10px] font-normal text-[#8a7b72]">Guest</span>}</p><CommunityDate date={post.createdAt} />
      </div>{post.canDelete && <button type="button" onClick={remove} disabled={busy} aria-label={`Remove post by ${post.authorName}`} className="rounded-lg p-2 text-[#8a7b72] hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>}</div>
      {post.content && <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-[#493a32]">{post.content}</p>}
      {!!post.images.length && <div className={`mt-4 grid gap-2 ${post.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>{post.images.map((photo, i) => <a href={photo.url} target="_blank" rel="noopener noreferrer" key={photo.id} aria-label={`Open photo ${i + 1} by ${post.authorName}`}><Image src={photo.url} alt={`Photo ${i + 1} shared by ${post.authorName}`} width={800} height={600} unoptimized className={`w-full rounded-xl bg-[#fbf9f5] ${post.images.length === 1 ? 'max-h-[540px] object-contain' : 'aspect-square object-cover'}`} /></a>)}</div>}
      {error && <div className="mt-4"><CommunityErrorNotice message={error} /></div>}
    </div>
    <div className="border-t border-[#eee5de] px-5 py-2 sm:px-6"><Button variant="ghost" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><MessageCircle className="mr-2 h-4 w-4" />{post._count.comments ? `${post._count.comments} ${post._count.comments === 1 ? 'reply' : 'replies'}` : 'Reply'}</Button></div>
    {expanded && <ForumReplies postId={post.id} onChange={onChange} />}
  </article>;
}

function ForumReplies({ postId, onChange }: { postId: string; onChange: () => Promise<unknown> }) {
  const { data: session, status } = useSession();
  const [page, setPage] = useState(1);
  const [guestName, setGuestName] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const url = `/api/forum/${postId}/comments?page=${page}`;
  const { data, error: loadError, isLoading, mutate } = useSWR<CommunityPage<ForumCommentView>>([url, status, session?.user?.name], ([path]) => communityFetch(path), { revalidateOnFocus: false });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || status === 'loading') return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await communityFetch(`/api/forum/${postId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, guestName }) });
      setContent(''); setSuccess('Your reply is published.');
      setPage(Math.max(1, Math.ceil(((data?.total || 0) + 1) / 20)));
      await Promise.allSettled([mutate(), onChange()]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to reply.'); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!window.confirm('Remove this reply?')) return;
    setBusy(true); setError('');
    try { await communityFetch(`/api/forum/comments/${id}`, { method: 'DELETE' }); await Promise.all([mutate(), onChange()]); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to remove reply.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="Replies" className="space-y-4 border-t border-[#eee5de] bg-[#fffdf9] p-5 sm:p-6">
    {isLoading && <CommunityLoading />}{loadError && <CommunityErrorNotice message={loadError.message} />}
    {data?.items.map(comment => <div className="flex items-start gap-2" key={comment.id}><div className="min-w-0 flex-1 rounded-xl bg-[#f5efe9] p-3"><p className="break-words text-sm font-medium">{comment.authorName}{comment.isGuest && <span className="ml-2 text-xs font-normal text-[#8a7b72]">Guest</span>}</p><p className="my-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#66574f]">{comment.content}</p><CommunityDate date={comment.createdAt} /></div>{comment.canDelete && <button type="button" onClick={() => remove(comment.id)} disabled={busy} aria-label={`Remove reply by ${comment.authorName}`} className="rounded-lg p-2 text-[#8a7b72] hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>}</div>)}
    <CommunityPagination page={page} totalPages={data?.totalPages || 0} onChange={setPage} />
    <form onSubmit={submit} className="space-y-3"><fieldset disabled={busy || status === 'loading'} className="space-y-3">
      {!session?.user && <Input id={`reply-name-${postId}`} label="Your name" value={guestName} onChange={e => setGuestName(e.target.value)} required minLength={2} maxLength={80} autoComplete="name" />}
      {session?.user && <p className="text-xs text-[#7e6e65]">Replying as {session.user.name || 'Family member'}</p>}
      <Textarea id={`reply-${postId}`} label="Write a reply" value={content} onChange={e => setContent(e.target.value)} required maxLength={2000} rows={2} />
      <Button type="submit" disabled={busy || status === 'loading'}>{busy ? 'Sending…' : 'Reply'}</Button>
    </fieldset>{error && <CommunityErrorNotice message={error} />}{success && <p role="status" className="text-sm text-emerald-800">{success}</p>}</form>
  </section>;
}

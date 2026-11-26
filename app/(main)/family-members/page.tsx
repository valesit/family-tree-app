'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui';

type Person = { id: string; firstName: string; lastName: string; deletedAt?: string; deletionReason?: string };
const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(res => res.json());
export default function FamilyMembersPage() {
  const { status } = useSession();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const { data: persons, mutate: refresh } = useSWR<{ success: boolean; data: { items: Person[]; totalPages: number } }>(status === 'authenticated' ? '/api/persons?limit=50&page=' + page + '&query=' + encodeURIComponent(query) : null, fetcher);
  const { data: archive, mutate: refreshArchive } = useSWR<{ success: boolean; data: Person[] }>(status === 'authenticated' ? '/api/persons/archived' : null, fetcher);
  async function restore(id: string) {
    if (!window.confirm('Restore this profile and its retained connections?')) return;
    setBusy(id); setError('');
    try {
      const res = await fetch('/api/persons/archived', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Restore failed');
      await Promise.all([refresh(), refreshArchive()]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Restore failed'); } finally { setBusy(''); }
  }
  if (status === 'loading') return <p className="p-8">Loading…</p>;
  if (status !== 'authenticated') return <p className="p-8"><Link href="/login?callbackUrl=/family-members">Sign in to manage family members</Link></p>;
  return <main className="mx-auto max-w-4xl px-4 py-8">
    <Link href="/tree" className="text-sm text-maroon-700">Back to family tree</Link>
    <h1 className="mt-3 text-2xl font-semibold">Manage family members</h1>
    <p className="mt-2 text-sm text-slate-600">Find active profiles, including people who are no longer connected to the visible tree. Search covers all family records.</p>
    <div className="my-5 flex gap-2"><Button variant={!showArchive ? 'primary' : 'outline'} onClick={() => setShowArchive(false)}>Active people</Button>{archive?.success && <Button variant={showArchive ? 'primary' : 'outline'} onClick={() => setShowArchive(true)}>Deleted people ({archive.data.length})</Button>}</div>
    {error && <p role="alert" className="mb-4 text-rose-700">{error}</p>}
    {!showArchive ? <>
      <input aria-label="Search people" className="mb-4 w-full rounded-lg border px-3 py-2" placeholder="Search by name" value={query} onChange={e => {setQuery(e.target.value); setPage(1);}} />
      {!persons ? <p>Loading people…</p> : !persons.success ? <p>Could not load people.</p> : <><div className="divide-y rounded-lg border">{persons.data.items.map(p => <Link key={p.id} href={'/person/' + p.id} className="block p-3 hover:bg-slate-50">{p.firstName} {p.lastName}</Link>)}</div>{!persons.data.items.length && <p>No matching people.</p>}<div className="mt-4 flex items-center gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button><span>Page {page} of {Math.max(1, persons.data.totalPages)}</span><Button variant="outline" disabled={page >= persons.data.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button></div></>}
    </> : <div className="divide-y rounded-lg border">{archive?.data.map(p => <div key={p.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-medium">{p.firstName} {p.lastName}</p><p className="text-sm text-slate-600">{p.deletionReason} · {p.deletedAt ? new Date(p.deletedAt).toLocaleDateString() : ''}</p></div><Button variant="outline" disabled={!!busy} isLoading={busy === p.id} onClick={() => restore(p.id)}>Restore</Button></div>)}{archive?.data.length === 0 && <p className="p-4">No deleted profiles.</p>}</div>}
  </main>;
}

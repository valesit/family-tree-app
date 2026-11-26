'use client';
import { use, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui';

type Person = { id: string; firstName: string; lastName: string };
type Relation = { id: string; type: string; parent?: Person; child?: Person; spouse1?: Person; spouse2?: Person };
const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(res => res.json());

export default function RelationshipsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status, data: session } = useSession();
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, mutate } = useSWR<{ success: boolean; data: Relation[] }>('/api/relationships?personId=' + encodeURIComponent(id), fetcher);
  const { data: matches } = useSWR<{ success: boolean; data: { items: Person[] } }>(selected && query.trim().length >= 2 ? '/api/persons?limit=30&query=' + encodeURIComponent(query) : null, fetcher);
  async function change(relationshipId: string, action: 'remove' | 'replace') {
    if (busy || (action === 'replace' && !replacement)) return;
    if (!window.confirm(action === 'remove' ? 'Remove only this connection? Both profiles will remain.' : 'Replace only this connection? All other relationships will remain.')) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/persons/' + encodeURIComponent(id) + '/relationships', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relationshipId, action, replacementId: action === 'replace' ? replacement : undefined }) });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Could not save change');
      setSelected(''); setReplacement(''); setQuery(''); await mutate();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save change'); } finally { setBusy(false); }
  }
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (status === 'loading') return <p className="p-8">Loading…</p>;
  if (status !== 'authenticated' || role === 'VIEWER') return <p className="p-8">Contributor access required. <Link href={'/person/' + id}>Back to profile</Link></p>;
  return <main className="mx-auto max-w-3xl px-4 py-8">
    <Link className="text-sm text-maroon-700" href={'/person/' + id}>Back to profile</Link>
    <h1 className="mt-3 text-2xl font-semibold">Manage relationships</h1>
    <p className="mt-2 text-sm text-slate-600">Correct individual parents, children or spouses without deleting a person or changing their other connections.</p>
    {error && <p role="alert" className="my-4 text-rose-700">{error}</p>}
    <div className="mt-5 space-y-3">
      {!data ? <p>Loading relationships…</p> : !data.success ? <p>Unable to load relationships.</p> : data.data.length === 0 ? <p>No existing connections. Use the family tree to add a relationship.</p> : data.data.map(rel => {
        const other = [rel.parent, rel.child, rel.spouse1, rel.spouse2].find(p => p && p.id !== id);
        if (!other) return null;
        const label = rel.type === 'SPOUSE' ? 'Spouse' : rel.child?.id === id ? 'Parent' : 'Child';
        return <section key={rel.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs text-slate-500">{label} · {rel.type.replaceAll('_',' ')}</p><Link className="font-medium text-maroon-700" href={'/person/' + other.id}>{other.firstName} {other.lastName}</Link></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => {setSelected(rel.id);setReplacement('');setQuery('');}}>Replace</Button><Button size="sm" variant="outline" disabled={busy} className="text-rose-700" onClick={() => change(rel.id, 'remove')}>Remove</Button></div></div>
          {selected === rel.id && <div className="mt-4 border-t pt-4"><label className="text-sm font-medium" htmlFor="replacement-search">Search for the correct {label.toLowerCase()}</label><input id="replacement-search" className="mt-2 w-full rounded border p-2" value={query} onChange={e => {setQuery(e.target.value);setReplacement('');}} /><select aria-label="Replacement person" className="mt-2 w-full rounded border p-2" value={replacement} onChange={e => setReplacement(e.target.value)}><option value="">Select a person</option>{matches?.success && matches.data.items.filter(p => p.id !== id && p.id !== other.id).map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select><div className="mt-3 flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setSelected('')}>Cancel</Button><Button disabled={!replacement || busy} isLoading={busy} onClick={() => change(rel.id, 'replace')}>Save correction</Button></div></div>}
        </section>;
      })}
    </div>
    <Link className="mt-6 inline-block text-sm text-maroon-700 underline" href="/family-members">Find other family members</Link>
  </main>;
}

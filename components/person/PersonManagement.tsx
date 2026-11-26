'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { Trash2 } from 'lucide-react';

export function PersonManagement({ personId, personName, canDelete, parents, children, spouses }: {
  personId: string; personName: string; canDelete: boolean; parents: number; children: number; spouses: number;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (busy || !reason) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/persons/' + encodeURIComponent(personId), {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Unable to remove this person.');
      window.location.assign('/family-members');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to remove this person.');
      setBusy(false);
    }
  }
  return <>
    <Link href={'/person/' + personId + '/relationships'}><Button size="sm" variant="outline">Manage relationships</Button></Link>
    {canDelete && <Button size="sm" variant="outline" className="text-rose-700" onClick={() => { setOpen(true); setError(''); }}><Trash2 className="mr-2 h-4 w-4" />Delete person</Button>}
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="delete-person-title" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h2 id="delete-person-title" className="text-xl font-semibold text-slate-900">Delete {personName}?</h2>
        <p className="mt-2 text-sm text-slate-600">This profile will be removed from the active tree. An administrator can restore it. No other family member or associated content will be deleted.</p>
        <div className="my-4 rounded-lg border p-3 text-sm text-slate-700">Affected connections: {parents} parents, {children} children, {spouses} spouses. Disconnected members remain accessible from Manage family members.</div>
        <label className="block text-sm font-medium" htmlFor="delete-reason">Reason for deletion</label>
        <select id="delete-reason" className="mt-2 w-full rounded-lg border p-2" value={reason} onChange={e => setReason(e.target.value)} disabled={busy}>
          <option value="">Select a reason</option><option>Added by mistake</option><option>Duplicate family member</option><option>Incorrect relationship</option><option>Other</option>
        </select>
        {reason === 'Incorrect relationship' && <p className="mt-3 text-sm text-slate-700">You can correct the connection instead of deleting this profile. <Link className="text-maroon-700 underline" href={'/person/' + personId + '/relationships'}>Manage relationships</Link></p>}
        {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="bg-rose-700 text-white" disabled={!reason || busy} isLoading={busy} onClick={remove}>Delete person</Button>
        </div>
      </section>
    </div>}
  </>;
}

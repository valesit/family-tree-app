'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { ArchiveRestore, X } from 'lucide-react';
import { Button } from '@/components/ui';

type ArchivedPerson = { id: string; firstName: string; lastName: string; deletedAt: string; deletedByName: string | null; deletionReason: string | null };
type ArchiveResponse = { success: boolean; data?: ArchivedPerson[]; error?: string };
const fetcher = (url: string): Promise<ArchiveResponse> => fetch(url, { cache: 'no-store' }).then(res => res.json());

export function TreeArchiveRestore({ rootId, onRestored }: { rootId?: string; onRestored: () => Promise<void> }) {
  const { data, mutate } = useSWR<ArchiveResponse>(rootId ? '/api/persons/archived?rootId=' + encodeURIComponent(rootId) : null, fetcher);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);
  function close() {
    if (busy) return;
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  }
  async function restore(person: ArchivedPerson) {
    if (busy || !window.confirm('Restore ' + person.firstName + ' ' + person.lastName + ' and their retained relationships?')) return;
    setBusy(person.id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/persons/archived', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: person.id }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Restore failed');
      await Promise.all([mutate(), onRestored()]);
      setNotice(person.firstName + ' ' + person.lastName + ' restored.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to restore person'); }
    finally { setBusy(null); }
  }
  if (!rootId || !data?.success || !data.data) return null;
  return <>
    <Button ref={trigger} type="button" size="sm" variant="outline" aria-label={'Deleted people (' + data.data.length + ')'} onClick={() => { setError(''); setNotice(''); setOpen(true); void mutate(); }}>
      <ArchiveRestore className="h-4 w-4 sm:mr-1.5" aria-hidden /><span className="hidden sm:inline">Deleted people </span><span>({data.data.length})</span>
    </Button>
    {open && createPortal(
      <dialog ref={dialog} aria-labelledby="tree-archive-title" onCancel={event => { event.preventDefault(); close(); }} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/40">
        <div className="flex items-center justify-between border-b p-5">
          <h2 id="tree-archive-title" className="font-serif text-xl font-semibold">Deleted people</h2>
          <button type="button" aria-label="Close deleted people" disabled={!!busy} onClick={close} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-sm text-slate-600">Restore deleted family members and their retained relationships.</p>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
          {!data.data.length && <p className="rounded-lg border p-4 text-sm text-slate-600">No deleted people in this family.</p>}
          {data.data.map(person => <div key={person.id} className="flex items-start justify-between gap-3 rounded-lg border p-4">
            <div className="min-w-0"><p className="font-medium">{person.firstName} {person.lastName}</p>
              <p className="mt-1 text-xs text-slate-600">Deleted {new Date(person.deletedAt).toLocaleDateString()} · {person.deletedByName || 'Unknown contributor'}</p>
              <p className="mt-1 text-sm text-slate-600">{person.deletionReason || 'No reason recorded'}</p>
            </div>
            <Button type="button" size="sm" variant="outline" disabled={!!busy} isLoading={busy === person.id} onClick={() => restore(person)}>Restore</Button>
          </div>)}
        </div>
      </dialog>, document.body)}
  </>;
}

'use client';

import useSWR from 'swr';
import { AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';

export async function communityFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) throw new Error(json?.error || 'Unable to complete the request. Please try again.');
  return json.data as T;
}

export function useCommunityFamily() {
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean; data: { primaryFamilyId: string | null; families: { id: string; familyName: string }[] };
  }>('/api/families', async url => {
    const response = await fetch(url);
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error('Unable to load your family. Please try again.');
    return json;
  }, { revalidateOnFocus: false });
  const familyId = data?.data?.primaryFamilyId || null;
  return { familyId, familyName: data?.data?.families.find(f => f.id === familyId)?.familyName || 'Family', error, isLoading, retry: () => mutate() };
}

export function CommunityErrorNotice({ message }: { message: string }) {
  return <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{message}</p>;
}

export function CommunityLoading() {
  return <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-[#7e6e65]"><Loader2 className="h-5 w-5 animate-spin" />Loading…</div>;
}

export function CommunityPagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return <nav aria-label="Results pages" className="flex items-center justify-center gap-4 py-5">
    <Button variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button>
    <span className="text-sm text-[#7e6e65]">{page} of {totalPages}</span>
    <Button variant="outline" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
  </nav>;
}

export function CommunityDate({ date }: { date: string }) {
  return <time dateTime={date} className="text-xs text-[#8a7b72]">{new Date(date).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>;
}

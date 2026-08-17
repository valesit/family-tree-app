'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR, { useSWRConfig } from 'swr';
import { Avatar } from '@/components/ui';
import { Crown, X, Loader2 } from 'lucide-react';

type CandidatePerson = {
  id: string;
  name: string;
  image: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
};

type PromptResponse = {
  success: boolean;
  data: {
    shouldPrompt: boolean;
    candidates: CandidatePerson[];
  };
};

const DISMISS_KEY = 'canonicalRootPromptDismissedAt';
const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const fetcher = async (url: string): Promise<PromptResponse> => {
  const res = await fetch(url);
  if (res.status === 401 || res.status === 403) {
    // Guests and non-admins get treated as "nothing to prompt".
    return { success: true, data: { shouldPrompt: false, candidates: [] } };
  }
  const json = (await res.json().catch(() => ({}))) as Partial<PromptResponse>;
  if (!json?.success) {
    return { success: true, data: { shouldPrompt: false, candidates: [] } };
  }
  return json as PromptResponse;
};

/**
 * Small non-blocking card that appears once when the family tree has a
 * two-spouse "which one is the canonical root?" ambiguity. Renders nothing
 * for guests, non-admins, dismissed sessions (within 7 days), or when the
 * server says no prompt is needed.
 *
 * See app/api/family/root/prompt/route.ts for the eligibility rules.
 */
export function CanonicalRootPrompt() {
  const { status } = useSession();
  const { mutate: globalMutate } = useSWRConfig();

  // Check localStorage dismissal *before* firing the network request, so
  // dismissed users don't hit the endpoint at all.
  const [isDismissed, setIsDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsDismissed(false);
      return;
    }
    try {
      const raw = window.localStorage.getItem(DISMISS_KEY);
      if (!raw) {
        setIsDismissed(false);
        return;
      }
      const dismissedAt = Number(raw);
      if (!Number.isFinite(dismissedAt)) {
        setIsDismissed(false);
        return;
      }
      setIsDismissed(Date.now() - dismissedAt < DISMISS_WINDOW_MS);
    } catch {
      setIsDismissed(false);
    }
  }, []);

  // Only fire the request for signed-in users who haven't recently dismissed.
  const shouldFetch = status === 'authenticated' && isDismissed === false;
  const { data } = useSWR<PromptResponse>(
    shouldFetch ? '/api/family/root/prompt' : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selfDismissed, setSelfDismissed] = useState(false);

  const candidates = useMemo(
    () => data?.data?.candidates ?? [],
    [data]
  );
  const shouldPrompt = data?.data?.shouldPrompt ?? false;

  if (
    status !== 'authenticated' ||
    isDismissed === null ||
    isDismissed ||
    selfDismissed ||
    !shouldPrompt ||
    candidates.length === 0
  ) {
    return null;
  }

  const handleDismiss = () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
      }
    } catch {
      // Non-fatal: dismissal is best-effort persistence.
    }
    setSelfDismissed(true);
  };

  const handlePick = async (personId: string) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/family/root', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        setErrorMsg(
          json?.error || 'Could not set the canonical root. Please try again.'
        );
        return;
      }
      // Refresh anything that depends on the family root. SWR keys we care
      // about start with /api/tree or /api/families.
      await Promise.all([
        globalMutate(
          (key) => typeof key === 'string' && key.startsWith('/api/tree'),
          undefined,
          { revalidate: true }
        ),
        globalMutate(
          (key) => typeof key === 'string' && key.startsWith('/api/families'),
          undefined,
          { revalidate: true }
        ),
        globalMutate('/api/family/root/prompt', undefined, { revalidate: true }),
      ]);
      // Hide ourselves regardless of revalidation timing.
      setSelfDismissed(true);
    } catch (err) {
      console.error('CanonicalRootPrompt pick failed', err);
      setErrorMsg('Could not set the canonical root. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto my-3 w-full max-w-[1600px] px-3 sm:px-6 lg:px-8">
      <div className="relative rounded-2xl border border-maroon-200/70 bg-gradient-to-br from-maroon-50/80 via-white to-white p-4 shadow-sm sm:p-5">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="flex items-start gap-3">
          <span className="mt-0.5 hidden shrink-0 rounded-full bg-maroon-100 p-2 text-maroon-700 sm:inline-flex">
            <Crown className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-maroon-700/80">
              Family root ancestor
            </p>
            <h3 className="mt-0.5 font-serif text-base font-semibold text-slate-900 sm:text-lg">
              Who should be your family&rsquo;s root ancestor?
            </h3>
            <p className="mt-1 max-w-2xl text-xs text-slate-600 sm:text-sm">
              Pick the canonical elder &mdash; this is the person the tree
              renders from. You can change it later.
            </p>

            {errorMsg && (
              <p className="mt-2 rounded-md bg-rose-50 px-3 py-1.5 text-xs text-rose-700 ring-1 ring-rose-100">
                {errorMsg}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handlePick(c.id)}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-maroon-300 hover:bg-maroon-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Avatar
                    src={c.image ?? undefined}
                    name={c.name}
                    size="xs"
                  />
                  <span className="max-w-[12rem] truncate">{c.name}</span>
                  {isSubmitting && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-maroon-500" aria-hidden />
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="mt-3 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
            >
              Not now, thanks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

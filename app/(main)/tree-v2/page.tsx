'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, TreeDeciduous } from 'lucide-react';
import { FamilyExplorer } from '@/components/tree-v2/FamilyExplorer';
import {
  buildExplorerGraph,
  type ExplorerPersonRecord,
  type ExplorerRelationship,
} from '@/lib/family-explorer';

type TreeResponse = {
  success: boolean;
  data: {
    tree: ExplorerPersonRecord | null;
    rootPersonId: string | null;
    familyName: string | null;
  };
};

type RelationshipResponse = {
  success: boolean;
  data: ExplorerRelationship[];
};

type FamiliesResponse = {
  success: boolean;
  data: { defaultFamilyId: string | null };
};

async function fetcher(url: string) {
  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || 'Could not load family information.');
  return result;
}

function LoadingState() {
  return (
    <div className="min-h-[70dvh] bg-[#fbfcfa] px-4 py-10" role="status" aria-live="polite">
      <div className="mx-auto max-w-[1240px] animate-pulse space-y-5">
        <div className="h-8 w-52 rounded-lg bg-[#e7f3ef]" />
        <div className="h-12 max-w-xl rounded-xl bg-[#e7f3ef]" />
        <div className="h-[430px] rounded-2xl bg-[#f1f7f4]" />
      </div>
      <span className="sr-only">Loading the family explorer</span>
    </div>
  );
}

function ExplorerPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const rootIdParam = searchParams.get('rootId');
  const isAuthenticated = status === 'authenticated';

  const { data: familiesData, error: familiesError } = useSWR<FamiliesResponse>(
    isAuthenticated && !rootIdParam ? '/api/user/families' : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const defaultRoot = familiesData?.data?.defaultFamilyId;
  const waitingForFamily = status === 'loading' || (isAuthenticated && !rootIdParam && !familiesData && !familiesError);

  useEffect(() => {
    if (isAuthenticated && !rootIdParam && defaultRoot) {
      router.replace(`/tree-v2?rootId=${encodeURIComponent(defaultRoot)}`);
    }
  }, [isAuthenticated, rootIdParam, defaultRoot, router]);

  const treeUrl = rootIdParam
    ? `/api/tree?rootId=${encodeURIComponent(rootIdParam)}`
    : '/api/tree';

  const { data: treeData, error: treeError, mutate: revalidateTree } = useSWR<TreeResponse>(
    waitingForFamily || (isAuthenticated && !rootIdParam && defaultRoot) ? null : treeUrl,
    fetcher,
    { revalidateOnFocus: true, keepPreviousData: false }
  );

  const { data: relationshipData, error: relationshipError } = useSWR<RelationshipResponse>(
    treeData?.data?.tree ? '/api/relationships' : null,
    fetcher,
    { revalidateOnFocus: true }
  );

  const graph = useMemo(() => {
    const root = treeData?.data?.tree;
    if (!root || !relationshipData?.data) return null;
    return buildExplorerGraph(root, relationshipData.data);
  }, [treeData, relationshipData]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const previousRootRef = useRef<string | null>(null);

  useEffect(() => {
    if (!graph) return;
    if (previousRootRef.current !== graph.rootId) {
      previousRootRef.current = graph.rootId;
      setSelectedId(graph.rootId);
      setHistory([]);
    } else if (selectedId && !graph.people.has(selectedId)) {
      setSelectedId(graph.rootId);
      setHistory([]);
    }
  }, [graph, selectedId]);

  const focusId = graph && selectedId && graph.people.has(selectedId)
    ? selectedId : graph?.rootId ?? '';

  const focusPerson = useCallback((id: string) => {
    if (!graph?.people.has(id) || id === focusId) return;
    setHistory((current) => [...current, focusId].slice(-30));
    setSelectedId(id);
  }, [graph, focusId]);

  const goBack = useCallback(() => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setSelectedId(previous);
    setHistory((current) => current.slice(0, -1));
  }, [history]);

  if (waitingForFamily || (isAuthenticated && !rootIdParam && defaultRoot)) return <LoadingState />;

  const error = treeError || relationshipError || (familiesError && !rootIdParam ? familiesError : null);
  if (error) {
    return (
      <div className="mx-auto flex min-h-[65dvh] max-w-lg flex-col items-center justify-center px-6 text-center">
        <AlertCircle className="mb-4 h-9 w-9 text-[#651a1a]" />
        <h1 className="font-serif text-2xl font-semibold">Unable to load the family explorer</h1>
        <p className="mt-3 text-sm text-[#52615c]">Your existing tree is unaffected. Try again or return to the classic view.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => void revalidateTree()} className="min-h-11 rounded-lg bg-[#651a1a] px-5 text-sm font-semibold text-white">Try again</button>
          <Link href={rootIdParam ? `/tree?rootId=${encodeURIComponent(rootIdParam)}` : '/tree'} className="inline-flex min-h-11 items-center rounded-lg border border-[#cad9d2] px-5 text-sm font-semibold text-[#14635b]">Classic tree</Link>
        </div>
      </div>
    );
  }

  if (!treeData || (treeData.data.tree && !relationshipData)) return <LoadingState />;

  if (!treeData.data.tree || !graph) {
    return (
      <div className="mx-auto flex min-h-[65dvh] max-w-lg flex-col items-center justify-center px-6 text-center">
        <TreeDeciduous className="mb-5 h-12 w-12 text-[#14635b]" />
        <h1 className="font-serif text-2xl font-semibold">Your family story starts here</h1>
        <p className="mt-3 text-[#52615c]">There are no relatives to explore yet. Add the first person using the existing family tree workflow.</p>
        <Link href="/tree" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#651a1a] px-5 text-sm font-semibold text-white">
          <ArrowLeft className="h-4 w-4" /> Open classic tree
        </Link>
      </div>
    );
  }

  const rootId = treeData.data.rootPersonId || graph.rootId;
  const oldTreeHref = `/tree?rootId=${encodeURIComponent(rootId)}`;

  return (
    <FamilyExplorer
      graph={graph}
      selectedId={focusId}
      familyName={treeData.data.familyName || 'Family'}
      onSelect={focusPerson}
      onBack={goBack}
      canGoBack={history.length > 0}
      isAuthenticated={isAuthenticated}
      oldTreeHref={oldTreeHref}
    />
  );
}

export default function FamilyExplorerPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ExplorerPageContent />
    </Suspense>
  );
}

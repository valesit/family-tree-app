'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { FamilyTree, ExpandedTreeView } from '@/components/tree';
import { CanonicalRootPrompt } from '@/components/tree/CanonicalRootPrompt';
import { ExportTreeDialog } from '@/components/tree/ExportTreeDialog';
import { Modal, Button, Avatar } from '@/components/ui';
import { PersonCard } from '@/components/person';
import { TreeNode, PersonWithRelations, PersonWithImage, SessionUser } from '@/types';
import { flattenTree } from '@/lib/tree-utils';
import { PeopleListView, PeopleDirectoryView, type PersonExtras } from '@/components/people';
import { 
  Loader2, AlertCircle, Users, TreePine, Calendar, Heart, Lock, 
  Maximize2, BookOpen, Award, MapPin, Briefcase, ChevronRight,
  ChevronUp, ChevronDown, ChevronLeft, X, UserPlus, Pencil, Save, Cake,
  LayoutGrid, List as ListIcon, Contact, Download,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface TreeStats {
  totalMembers: number;
  livingCount: number;
  deceasedCount: number;
  maleCount: number;
  femaleCount: number;
  marriageCount: number;
  oldestMember: { name: string; birthYear: number } | null;
  youngestLiving: { name: string; birthYear: number } | null;
}

interface FoundingAncestor {
  id: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
  birthYear: number | null;
  birthPlace: string | null;
  biography: string | null;
}

type BirthdayPerson = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  profileImage?: string;
  isLiving: boolean;
};

function collectPeopleFromTree(tree: TreeNode | null): BirthdayPerson[] {
  if (!tree) return [];
  const byId = new Map<string, BirthdayPerson>();

  const addNode = (n: TreeNode | null | undefined) => {
    if (!n) return;
    if (!n.birthDate) return;
    byId.set(n.id, {
      id: n.id,
      firstName: n.firstName,
      lastName: n.lastName,
      birthDate: n.birthDate,
      profileImage: n.profileImage,
      isLiving: n.isLiving,
    });
  };

  const walk = (n: TreeNode) => {
    addNode(n);
    addNode(n.spouse);
    n.spouses?.forEach((s) => addNode(s));
    n.children?.forEach((c) => walk(c));
  };

  walk(tree);
  return Array.from(byId.values());
}

function getBirthdaysInMonth(tree: TreeNode | null, monthIndex: number): BirthdayPerson[] {
  const people = collectPeopleFromTree(tree);
  const birthdays = people.filter((p) => {
    const d = new Date(p.birthDate);
    return !Number.isNaN(d.getTime()) && d.getMonth() === monthIndex;
  });
  birthdays.sort((a, b) => new Date(a.birthDate).getDate() - new Date(b.birthDate).getDate());
  return birthdays;
}

export default function TreePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [selectedPerson, setSelectedPerson] = useState<PersonWithRelations | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExpandedViewOpen, setIsExpandedViewOpen] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);
  
  // Family name edit state
  const [isEditingFamilyName, setIsEditingFamilyName] = useState(false);
  const [editedFamilyName, setEditedFamilyName] = useState('');
  const [isSavingFamilyName, setIsSavingFamilyName] = useState(false);
  /** On small screens, overview is secondary — collapsed by default so the tree is primary. */
  const [mobileOverviewOpen, setMobileOverviewOpen] = useState(false);

  /** Active main view. Tabs are only shown when authenticated. */
  const [activeView, setActiveView] = useState<'tree' | 'list' | 'directory'>('tree');
  /** Export dialog visibility (Tree tab only). */
  const [isExportOpen, setIsExportOpen] = useState(false);
  /** Live capture target for "Match what's on screen" PNG/PDF export. */
  const liveCanvasRef = useRef<HTMLDivElement>(null);

  const user = session?.user as SessionUser | undefined;
  const isAuthenticated = status === 'authenticated';
  const isAdmin = user?.role === 'ADMIN';
  
  // Get rootId from URL params if specified
  const rootIdParam = searchParams.get('rootId');

  // Fetch user's families to determine their default tree
  const { data: userFamiliesData } = useSWR<{
    success: boolean;
    data: {
      families: Array<{
        id: string;
        name: string;
        role: string;
        rootPerson: { id: string; firstName: string; lastName: string } | null;
      }>;
      defaultFamilyId: string | null;
      linkedPersonFamily: string | null;
    };
  }>(isAuthenticated && !rootIdParam ? '/api/user/families' : null, fetcher);

  // Redirect logged-in users to their family tree if they haven't specified one
  useEffect(() => {
    if (
      isAuthenticated && 
      !rootIdParam && 
      !hasRedirected && 
      userFamiliesData?.success && 
      userFamiliesData.data.defaultFamilyId
    ) {
      setHasRedirected(true);
      router.replace(`/tree?rootId=${userFamiliesData.data.defaultFamilyId}`);
    }
  }, [isAuthenticated, rootIdParam, hasRedirected, userFamiliesData, router]);

  // Build the API URL - use rootId if specified, otherwise default
  const treeApiUrl = rootIdParam ? `/api/tree?rootId=${rootIdParam}` : '/api/tree';

  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data: {
      tree: TreeNode | null;
      stats: TreeStats | null;
      rootPersonId: string;
      familyName: string;
      foundingAncestor: FoundingAncestor | null;
    };
  }>(treeApiUrl, fetcher, {
    revalidateOnFocus: false,
  });

  // Fetch notable persons
  const { data: notableData } = useSWR<{
    success: boolean;
    data: Array<{
      id: string;
      firstName: string;
      lastName: string;
      notableTitle: string | null;
      notableDescription: string | null;
      notableAchievements: string | null;
      profileImage?: { url: string } | null;
    }>;
  }>(data?.data?.rootPersonId ? `/api/notable?familyId=${data.data.rootPersonId}` : null, fetcher);

  /**
   * Fetch the full person rows so List/Directory views can show fields that
   * /api/tree omits (birthPlace, occupation, etc.). Only fired for signed-in
   * users browsing the List or Directory tab — keeps anonymous tree loads light.
   */
  const shouldLoadExtras = isAuthenticated && (activeView === 'list' || activeView === 'directory');
  const { data: personsData } = useSWR<{
    success: boolean;
    data: { items: PersonWithImage[] };
  }>(shouldLoadExtras ? '/api/persons?limit=500' : null, fetcher, { revalidateOnFocus: false });

  const openPersonModal = useCallback(async (personId: string) => {
    try {
      const response = await fetch(`/api/persons/${personId}`);
      const result = await response.json();
      if (result.success) {
        setSelectedPerson(result.data);
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching person:', error);
    }
  }, []);

  const handleNodeClick = (node: TreeNode) => openPersonModal(node.id);

  const handleAddChild = (parentId: string) => {
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=/add-person?parentId=${parentId}`);
      return;
    }
    router.push(`/add-person?parentId=${parentId}`);
  };

  const handleAddSpouse = (personId: string) => {
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=/add-person?spouseId=${personId}`);
      return;
    }
    router.push(`/add-person?spouseId=${personId}`);
  };

  const handleAddParent = (childId: string) => {
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=/add-person?childId=${childId}`);
      return;
    }
    router.push(`/add-person?childId=${childId}`);
  };

  const handleViewBirthFamily = (personId: string, maidenName?: string) => {
    if (maidenName) {
      // Search for families with this surname
      router.push(`/?search=${encodeURIComponent(maidenName)}`);
    }
  };

  // Handle saving edited family name
  const handleSaveFamilyName = async () => {
    if (!data?.data?.rootPersonId || !editedFamilyName.trim()) return;
    
    setIsSavingFamilyName(true);
    try {
      if (isAdmin) {
        // Admin can save directly
        const response = await fetch('/api/family', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rootPersonId: data.data.rootPersonId,
            name: editedFamilyName.trim(),
          }),
        });
        
        if (response.ok) {
          mutate();
          setIsEditingFamilyName(false);
        } else {
          const result = await response.json();
          alert(result.error || 'Failed to save family name');
        }
      } else {
        // Regular user - submit for approval
        const response = await fetch('/api/approvals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'UPDATE_FAMILY_NAME',
            personId: data.data.rootPersonId, // Use root person as reference
            currentData: { familyName: familyName },
            proposedData: { familyName: editedFamilyName.trim() },
            reason: `Proposed family name change: "${familyName}" → "${editedFamilyName.trim()}"`,
            requiredApprovals: 2, // Requires 2 family member approvals or 1 admin
          }),
        });
        
        if (response.ok) {
          setIsEditingFamilyName(false);
          alert('Your family name change has been submitted for approval. It needs approval from 2 family members or an admin.');
        } else {
          const result = await response.json();
          alert(result.error || 'Failed to submit family name change');
        }
      }
    } catch (error) {
      console.error('Error saving family name:', error);
      alert('Failed to save family name');
    } finally {
      setIsSavingFamilyName(false);
    }
  };

  // Start editing family name
  const handleStartEditFamilyName = () => {
    setEditedFamilyName(familyName || '');
    setIsEditingFamilyName(true);
  };

  // IMPORTANT: Hooks must run unconditionally on every render (avoid calling hooks after early returns).
  const { tree, stats, familyName, foundingAncestor } = data?.data || { 
    tree: null, 
    stats: null, 
    familyName: null, 
    foundingAncestor: null 
  };

  const monthIndex = new Date().getMonth();
  const monthName = new Date().toLocaleString(undefined, { month: 'long' });
  const birthdaysThisMonth = useMemo(() => getBirthdaysInMonth(tree, monthIndex), [tree, monthIndex]);

  /** Flat list of every person in this tree — for List & Directory views. */
  const flatPeople = useMemo(() => flattenTree(tree), [tree]);
  /** Map of personId -> birthPlace/occupation pulled from /api/persons. */
  const extrasMap = useMemo(() => {
    const m = new Map<string, PersonExtras>();
    const items = personsData?.data?.items ?? [];
    for (const p of items) {
      m.set(p.id, { birthPlace: p.birthPlace, occupation: p.occupation });
    }
    return m;
  }, [personsData]);

  // Show loading while checking for redirect or loading tree
  const isCheckingRedirect = isAuthenticated && !rootIdParam && !hasRedirected && !userFamiliesData;
  
  if (isLoading || isCheckingRedirect) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-maroon-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading your family tree...</p>
        </div>
      </div>
    );
  }

  // Show onboarding if user is logged in but has no family
  const userHasNoFamily = isAuthenticated && userFamiliesData?.success && 
    !userFamiliesData.data.defaultFamilyId && 
    userFamiliesData.data.families.length === 0;

  if (userHasNoFamily && !rootIdParam) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center max-w-md mx-auto px-6">
          <TreePine className="w-16 h-16 text-maroon-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Welcome to Family Tree!</h2>
          <p className="text-slate-600 mb-6">
            You&apos;re not part of any family tree yet. You can create a new family tree or browse existing ones to find your family.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => router.push('/add-person')}
              className="bg-maroon-600 hover:bg-maroon-700 text-white"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Create New Tree
            </Button>
            <Button
              onClick={() => router.push('/')}
              variant="outline"
            >
              Browse Families
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-4" />
          <p className="text-slate-600">Failed to load family tree</p>
          <button
            onClick={() => mutate()}
            className="mt-4 text-maroon-600 hover:text-maroon-700 font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const notablePersons = notableData?.data || [];
  
  // Get user's families for switcher
  const userFamilies = userFamiliesData?.data?.families || [];
  const hasMultipleFamilies = userFamilies.length > 1;

  return (
    <main className="h-[calc(100dvh-4rem)] flex flex-col bg-slate-50" aria-label="Family tree page">
      {/* Top Header Bar — compact on mobile to give the tree more room */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <button
            onClick={() => router.push('/')}
            className="rounded-lg p-1.5 transition-colors hover:bg-slate-100 sm:p-2"
            type="button"
            aria-label="Back to home"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>

          {hasMultipleFamilies && (
            <div className="relative hidden sm:block">
              <select
                value={data?.data?.rootPersonId || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    router.push(`/tree?rootId=${e.target.value}`);
                  }
                }}
                className="cursor-pointer appearance-none rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 pr-8 text-sm font-medium text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-maroon-500"
              >
                {userFamilies.map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.name} {family.role === 'ADMIN' ? '(Admin)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          )}

          <div className="min-w-0">
            {isEditingFamilyName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedFamilyName}
                  onChange={(e) => setEditedFamilyName(e.target.value)}
                  className="min-w-0 rounded-lg border-2 border-maroon-300 px-2 py-1 text-base font-bold text-slate-900 focus:border-maroon-500 focus:outline-none sm:text-xl"
                  placeholder="e.g., Sithole Family"
                  autoFocus
                />
                <button
                  onClick={handleSaveFamilyName}
                  disabled={isSavingFamilyName || !editedFamilyName.trim()}
                  className="flex items-center gap-1 rounded-lg bg-maroon-600 px-2.5 py-1.5 text-xs text-white transition-colors hover:bg-maroon-700 disabled:opacity-50 sm:px-3 sm:text-sm"
                  type="button"
                >
                  {isSavingFamilyName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span className="hidden sm:inline">{isAdmin ? 'Save' : 'Submit'}</span>
                </button>
                <button
                  onClick={() => setIsEditingFamilyName(false)}
                  className="rounded-lg px-2.5 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100 sm:px-3 sm:text-sm"
                  type="button"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-1.5">
                <h1 className="truncate text-base font-bold text-slate-900 sm:text-2xl">
                  {familyName || 'Family'}
                </h1>
                {/* Only system admins see family-name editing. Regular contributors
                    shouldn't be shown a path that triggers an approvals workflow. */}
                {isAdmin && (
                  <button
                    onClick={handleStartEditFamilyName}
                    className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-maroon-50 hover:text-maroon-600 sm:p-1.5"
                    title="Edit family name"
                    aria-label="Edit family name"
                    type="button"
                  >
                    <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                  </button>
                )}
              </div>
            )}
            <p className="truncate text-[11px] text-slate-500 sm:text-sm">
              {stats ? `${stats.totalMembers} members · ${stats.marriageCount} marriages` : 'Loading...'}
            </p>
          </div>
        </div>

        {!isAuthenticated && (
          <Link
            href="/login"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 transition-colors hover:bg-slate-50 sm:gap-2 sm:px-4 sm:py-2"
          >
            <Lock className="h-4 w-4 text-slate-500" />
            <span className="hidden text-sm font-medium text-slate-700 sm:inline">Sign in</span>
          </Link>
        )}
      </div>

      {/* Admin-only prompt to pick the canonical root. Silent for non-admins,
          guests, and dismissed sessions — see the component for gating. */}
      <CanonicalRootPrompt />

      {/* Main content: tree is primary (left on lg+, first on mobile); overview is collapsible on small screens. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden lg:flex-row lg:overflow-hidden">
        {/* Family tree — first in DOM: left on desktop, full-width focus on mobile */}
        <div className="order-1 flex w-full min-w-0 min-h-0 flex-1 flex-col bg-white lg:min-w-0 lg:border-r lg:border-slate-200">
          {/* View tabs — only visible to signed-in users. */}
          {isAuthenticated && (
            <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-3 py-2 sm:px-6">
              <ViewTab
                active={activeView === 'tree'}
                onClick={() => setActiveView('tree')}
                icon={<LayoutGrid className="h-4 w-4" aria-hidden />}
                label="Tree"
              />
              <ViewTab
                active={activeView === 'list'}
                onClick={() => setActiveView('list')}
                icon={<ListIcon className="h-4 w-4" aria-hidden />}
                label="List"
              />
              <ViewTab
                active={activeView === 'directory'}
                onClick={() => setActiveView('directory')}
                icon={<Contact className="h-4 w-4" aria-hidden />}
                label="Directory"
              />
              <div className="ml-auto flex items-center gap-2">
                {activeView === 'tree' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsExportOpen(true)}
                  >
                    <Download className="mr-1.5 h-4 w-4" aria-hidden />
                    Export
                  </Button>
                )}
                <button
                  onClick={() => setIsExpandedViewOpen(true)}
                  className="hidden rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 lg:inline-flex"
                  title="Expand view"
                  aria-label="Expand tree view"
                  type="button"
                >
                  <Maximize2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          )}

          {/* Panel Header — only shown when no tab strip is present (signed-out users) */}
          {!isAuthenticated && (
            <div className="hidden shrink-0 items-center justify-between border-b border-slate-100 px-6 py-3 lg:flex">
              <div className="flex items-center gap-2">
                <TreePine className="h-5 w-5 text-slate-600" />
                <span className="font-semibold text-slate-900">Family Tree</span>
              </div>
              <button
                onClick={() => setIsExpandedViewOpen(true)}
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
                title="Expand view"
                aria-label="Expand tree view"
                type="button"
              >
                <Maximize2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}

          {/* Tree view (always rendered; hidden when not active so re-mount cost is avoided) */}
          <div
            ref={liveCanvasRef}
            className={clsx(
              'relative min-h-[min(70dvh,640px)] flex-1 lg:min-h-0',
              activeView !== 'tree' && 'hidden'
            )}
          >
            <FamilyTree
              data={tree}
              onNodeClick={handleNodeClick}
              onAddChild={handleAddChild}
              onAddSpouse={handleAddSpouse}
              onAddParent={handleAddParent}
              onViewBirthFamily={handleViewBirthFamily}
            />
          </div>

          {activeView === 'list' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <PeopleListView
                people={flatPeople}
                extras={extrasMap}
                onPersonClick={openPersonModal}
              />
            </div>
          )}

          {activeView === 'directory' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <PeopleDirectoryView
                people={flatPeople}
                extras={extrasMap}
                onPersonClick={openPersonModal}
              />
            </div>
          )}
        </div>

        {/* Family overview — right on desktop, below on mobile, collapsible on &lt;lg via mobileOverviewOpen */}
        <div className="order-2 flex min-h-0 w-full min-w-0 shrink-0 flex-col border-t border-slate-200 bg-white lg:order-2 lg:h-full lg:max-h-none lg:w-1/5 lg:shrink-0 lg:min-h-0 lg:min-w-[220px] lg:flex-col lg:border-t-0 lg:border-l lg:border-slate-200">
          <button
            type="button"
            onClick={() => setMobileOverviewOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 text-left text-slate-800 transition-colors hover:bg-slate-50 lg:hidden"
            aria-expanded={mobileOverviewOpen}
            aria-controls="tree-page-family-overview"
          >
            <span className="flex items-center gap-2 font-semibold">
              <BookOpen className="h-5 w-5 text-slate-600" />
              Family overview
              {stats && (
                <span className="text-xs font-normal text-slate-500">
                  · {stats.totalMembers} members
                </span>
              )}
            </span>
            {mobileOverviewOpen ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
            )}
          </button>

          <div className="hidden items-center justify-between border-b border-slate-100 px-6 py-3 lg:flex">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-slate-600" />
              <span className="font-semibold text-slate-900">Family Overview</span>
            </div>
            <button
              onClick={() => setIsExpandedViewOpen(true)}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
              title="Expand view"
              aria-label="Expand family overview"
              type="button"
            >
              <Maximize2 className="h-4 w-4 text-slate-500" aria-hidden />
            </button>
          </div>

          <div
            id="tree-page-family-overview"
            className={clsx(
              'min-h-0 w-full',
              'overflow-y-auto',
              mobileOverviewOpen
                ? 'max-h-[min(52vh,28rem)] sm:max-h-[min(50vh,32rem)]'
                : 'max-h-0 overflow-y-hidden',
              'lg:max-h-none lg:flex-1 lg:overflow-y-auto'
            )}
          >
          <div className="space-y-6 p-4 sm:p-6">
            {/* Founding Ancestor Card */}
            {foundingAncestor && (
              <div className="bg-gradient-to-br from-maroon-600 to-maroon-800 rounded-xl p-4 text-white">
                <p className="text-[10px] font-medium text-maroon-200 uppercase tracking-wider mb-2">Founding Ancestor</p>
                <div className="flex items-center gap-3">
                  <Avatar 
                    src={foundingAncestor.profileImage || undefined}
                    name={`${foundingAncestor.firstName} ${foundingAncestor.lastName}`}
                    size="lg"
                    className="ring-2 ring-white/20 shadow-lg flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <h2 className="text-base font-bold truncate">{foundingAncestor.firstName} {foundingAncestor.lastName}</h2>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-maroon-200 text-xs">
                      {foundingAncestor.birthYear && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {foundingAncestor.birthYear}
                        </span>
                      )}
                      {foundingAncestor.birthPlace && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{foundingAncestor.birthPlace}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Biography */}
            {foundingAncestor?.biography && (
              <p className="text-slate-600 leading-relaxed">
                {foundingAncestor.biography}
              </p>
            )}

            {/* Family Statistics */}
            {stats && (
                <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
                  <Users className="w-5 h-5 text-slate-600" />
                  Family Statistics
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-slate-50 rounded-lg">
                    <p className="text-xl font-bold text-maroon-600">{stats.totalMembers}</p>
                    <p className="text-xs text-slate-500">Members</p>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded-lg">
                    <p className="text-xl font-bold text-emerald-600">{stats.livingCount}</p>
                  <p className="text-xs text-slate-500">Living</p>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded-lg">
                    <p className="text-xl font-bold text-rose-500">{stats.marriageCount}</p>
                    <p className="text-xs text-slate-500">Marriages</p>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded-lg">
                    <p className="text-xl font-bold text-slate-500">{stats.deceasedCount}</p>
                    <p className="text-xs text-slate-500">Deceased</p>
                  </div>
                </div>
              </div>
            )}

            {/* Oldest Member */}
            {stats?.oldestMember && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Award className="w-5 h-5 text-amber-500" />
                <span>Oldest:</span>
                <span className="font-medium text-slate-900">{stats.oldestMember.name} ({stats.oldestMember.birthYear})</span>
              </div>
            )}

            {/* Birthdays this month */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3">
                <Cake className="w-5 h-5 text-pink-500" />
                Birthdays in {monthName}
                <span className="text-xs text-slate-400 font-normal">({birthdaysThisMonth.length})</span>
              </h3>
              {birthdaysThisMonth.length === 0 ? (
                <p className="text-sm text-slate-500">No birthdays found for {monthName}.</p>
              ) : (
                <div className="space-y-2">
                  {birthdaysThisMonth.slice(0, 8).map((p) => {
                    const d = new Date(p.birthDate);
                    const dayLabel = Number.isNaN(d.getTime())
                      ? ''
                      : d.toLocaleString(undefined, { month: 'short', day: 'numeric' });
                    return (
                      <button
                        key={p.id}
                        onClick={() => router.push(`/person/${p.id}`)}
                        className="w-full flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-left border border-slate-200"
                      >
                        <Avatar
                          src={p.profileImage}
                          name={`${p.firstName} ${p.lastName}`}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-slate-900 text-sm truncate">
                              {p.firstName} {p.lastName}
                            </p>
                            <span className="text-xs text-slate-500 flex-shrink-0">{dayLabel}</span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {p.isLiving ? 'Living' : 'Deceased'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {birthdaysThisMonth.length > 8 && (
                    <p className="text-xs text-slate-500">Showing 8 of {birthdaysThisMonth.length} birthdays.</p>
                  )}
                </div>
              )}
            </div>

            {/* Notable Members - Cards */}
            {notablePersons.length > 0 && (
                <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
                  <Award className="w-5 h-5 text-amber-500" />
                  Notable Family Members
                  <span className="text-xs text-slate-400 font-normal">({notablePersons.length})</span>
                </h3>
                <div className="space-y-3">
                  {notablePersons.map((person) => (
                    <button 
                      key={person.id}
                      onClick={() => router.push(`/person/${person.id}`)}
                      className="w-full flex items-center gap-3 p-3 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors text-left border border-amber-200"
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar 
                          src={person.profileImage?.url}
                          name={`${person.firstName} ${person.lastName}`}
                          size="md"
                          className="ring-2 ring-amber-300"
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center border-2 border-white">
                          <Award className="w-2 h-2 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-900 text-sm truncate">
                          {person.firstName} {person.lastName}
                        </h4>
                        <p className="text-xs text-amber-600 truncate">
                          {person.notableTitle || 'Notable Member'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div className="flex gap-3">
              <Link 
                href="/wiki"
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-maroon-50 text-maroon-700 rounded-xl hover:bg-maroon-100 transition-colors font-medium"
              >
                <BookOpen className="w-5 h-5" />
                Family Wiki
              </Link>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Person Detail Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="xl"
      >
        {selectedPerson && (
          <div className="space-y-6">
            {/* Header with gradient and close button */}
            <div className="relative -m-6 mb-0">
              {/* Close button */}
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-3 right-3 z-10 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors backdrop-blur-sm"
                title="Close"
                aria-label="Close person details"
                type="button"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
              
              <div className={`h-32 bg-gradient-to-r ${
                selectedPerson.gender === 'MALE' 
                  ? 'from-sky-400 to-blue-500' 
                  : selectedPerson.gender === 'FEMALE'
                  ? 'from-pink-400 to-rose-500'
                  : 'from-slate-400 to-slate-500'
              }`}>
                <div className="absolute -bottom-12 left-6">
                  <Avatar 
                    src={selectedPerson.profileImage?.url}
                    name={`${selectedPerson.firstName} ${selectedPerson.lastName}`}
                    size="2xl"
                    className="ring-4 ring-white shadow-xl"
                  />
                </div>
              </div>
            </div>

            {/* Person info */}
            <div className="pt-14 px-2">
              <div className="flex items-start justify-between">
          <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {selectedPerson.firstName} {selectedPerson.middleName} {selectedPerson.lastName}
                  </h2>
                  {selectedPerson.maidenName && (
                    <p className="text-sm text-purple-600">née {selectedPerson.maidenName}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                    {selectedPerson.birthDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(selectedPerson.birthDate).toLocaleDateString()}
                        {selectedPerson.deathDate && ` - ${new Date(selectedPerson.deathDate).toLocaleDateString()}`}
                      </span>
                    )}
                    {selectedPerson.birthPlace && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {selectedPerson.birthPlace}
                      </span>
                    )}
                  </div>
                  {selectedPerson.occupation && (
                    <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                      <Briefcase className="w-4 h-4" />
                      {selectedPerson.occupation}
                    </p>
                  )}
                </div>
                
                {/* Status badge */}
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedPerson.isLiving 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {selectedPerson.isLiving ? 'Living' : 'Deceased'}
                </div>
              </div>

              {/* Biography */}
              {selectedPerson.biography && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Biography</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{selectedPerson.biography}</p>
                </div>
              )}

              {/* Notable info if applicable */}
              {selectedPerson.isNotable ? (
                <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <h4 className="font-semibold text-amber-800">{selectedPerson.notableTitle}</h4>
                  </div>
                  {selectedPerson.notableDescription && (
                    <p className="text-sm text-amber-700">{selectedPerson.notableDescription}</p>
                  )}
                </div>
              ) : isAdmin && (
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    router.push(`/person/${selectedPerson.id}#notable`);
                  }}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl hover:bg-amber-100 transition-colors text-sm"
                >
                  <Award className="w-4 h-4" />
                  Mark as Notable Person
                </button>
              )}

              {/* Action buttons */}
              <div className="mt-6 pt-4 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Add Family Member</h4>
                <div className="grid grid-cols-4 gap-3">
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      handleAddChild(selectedPerson.id);
                    }}
                    className="flex flex-col items-center justify-center gap-1 px-3 py-3 bg-maroon-500 text-white rounded-xl hover:bg-maroon-600 transition-colors"
                  >
                    <ChevronDown className="w-5 h-5" />
                    <span className="text-xs font-medium">Child</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      handleAddParent(selectedPerson.id);
                    }}
                    className="flex flex-col items-center justify-center gap-1 px-3 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    <ChevronUp className="w-5 h-5" />
                    <span className="text-xs font-medium">Parent</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      handleAddSpouse(selectedPerson.id);
                    }}
                    className="flex flex-col items-center justify-center gap-1 px-3 py-3 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-colors"
                  >
                    <Heart className="w-5 h-5" />
                    <span className="text-xs font-medium">Spouse</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      router.push('/add-person');
                    }}
                    className="flex flex-col items-center justify-center gap-1 px-3 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors"
                  >
                    <UserPlus className="w-5 h-5" />
                    <span className="text-xs font-medium">Relative</span>
                  </button>
                </div>
                
                {/* View profile button */}
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    router.push(`/person/${selectedPerson.id}`);
                  }}
                  className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <Users className="w-4 h-4" />
                  <span className="font-medium">View Full Profile</span>
                </button>

                {isAuthenticated && (
                  <div className="flex gap-3 mt-3">
                    <button
                      onClick={() => {
                setIsModalOpen(false);
                router.push(`/person/${selectedPerson.id}/edit`);
                      }}
                      className="flex-1 text-sm text-slate-600 hover:text-maroon-600 py-2"
                    >
                      Edit Person
                    </button>
                    <button
                      onClick={() => {
                setIsModalOpen(false);
                router.push(`/corrections/new?personId=${selectedPerson.id}`);
                      }}
                      className="flex-1 text-sm text-slate-600 hover:text-maroon-600 py-2"
                    >
                      Request Correction
                    </button>
                  </div>
                )}
              </div>

            {!isAuthenticated && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Want to contribute?</p>
                    <p className="text-xs text-amber-600">
                      <Link href="/login" className="underline hover:text-amber-800">Sign in</Link> or{' '}
                        <Link href="/register" className="underline hover:text-amber-800">create an account</Link> to add family members.
                    </p>
                    </div>
                  </div>
                </div>
              )}
              </div>
          </div>
        )}
      </Modal>

      {/* Expanded Tree View */}
      <ExpandedTreeView
        isOpen={isExpandedViewOpen}
        onClose={() => setIsExpandedViewOpen(false)}
        currentUser={user || null}
      />

      {/* Export Tree Dialog */}
      <ExportTreeDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        tree={tree}
        liveCanvasRef={liveCanvasRef}
        familyName={familyName}
      />
    </main>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-maroon-50 text-maroon-700 ring-1 ring-maroon-200'
          : 'text-slate-600 hover:bg-slate-100'
      )}
    >
      {icon}
      {label}
    </button>
  );
}


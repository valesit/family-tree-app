'use client';

import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { FamilyTree } from '@/components/tree';
import { Modal, Button, Card, Avatar } from '@/components/ui';
import { PersonCard } from '@/components/person';
import { NotablePersonsCarousel } from '@/components/notable';
import { TreeNode, PersonWithRelations, SessionUser } from '@/types';
import { 
  Loader2, 
  AlertCircle, 
  Users, 
  TreePine, 
  Calendar, 
  Heart, 
  Lock, 
  ChevronLeft, 
  ChevronRight,
  Maximize2,
  Minimize2,
  BookOpen,
  Crown,
  Cake,
  MapPin,
  ArrowLeft,
  PanelLeftClose,
  PanelRightClose,
  ChevronUp,
  ChevronDown,
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

interface FamilyData {
  tree: TreeNode | null;
  stats: TreeStats | null;
  rootPersonId: string;
  familyName: string;
  foundingAncestor: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage: string | null;
    birthYear: number | null;
    birthPlace: string | null;
    biography: string | null;
  };
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

export default function FamilyViewPage() {
  const router = useRouter();
  const params = useParams();
  const familyId = params.familyId as string;
  const { data: session, status } = useSession();
  
  const [selectedPerson, setSelectedPerson] = useState<PersonWithRelations | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leftPanelExpanded, setLeftPanelExpanded] = useState(false);
  const [rightPanelExpanded, setRightPanelExpanded] = useState(false);
  const [mobileOverviewOpen, setMobileOverviewOpen] = useState(false);

  const user = session?.user as SessionUser | undefined;
  const isAuthenticated = status === 'authenticated';

  // Fetch family tree data
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data: FamilyData;
  }>(`/api/tree?rootId=${familyId}`, fetcher, {
    revalidateOnFocus: false,
  });

  const handleNodeClick = async (node: TreeNode) => {
    try {
      const response = await fetch(`/api/persons/${node.id}`);
      const result = await response.json();
      if (result.success) {
        setSelectedPerson(result.data);
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching person:', error);
    }
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-maroon-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading family tree...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-4" />
          <p className="text-slate-600 mb-4">Failed to load family tree</p>
          <Link href="/" className="text-maroon-600 hover:text-maroon-700 font-medium">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const { tree, stats, familyName, foundingAncestor } = data.data;
  const monthIndex = new Date().getMonth();
  const monthName = new Date().toLocaleString(undefined, { month: 'long' });
  const birthdaysThisMonth = getBirthdaysInMonth(tree, monthIndex);

  // If left panel is expanded, show only left panel
  if (leftPanelExpanded) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-slate-500 hover:text-slate-700">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">{familyName} Family Overview</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLeftPanelExpanded(false)}
            >
              <Minimize2 className="w-4 h-4 mr-2" />
              Exit Full Screen
            </Button>
          </div>
        </div>
        
        {/* Full Overview Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <FamilyOverviewContent 
            familyName={familyName}
            foundingAncestor={foundingAncestor}
            stats={stats}
            isAuthenticated={isAuthenticated}
            familyId={familyId}
            birthdaysThisMonth={birthdaysThisMonth}
            birthdaysMonthName={monthName}
          />
        </div>
      </div>
    );
  }

  // If right panel is expanded, show only tree
  if (rightPanelExpanded) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-slate-500 hover:text-slate-700">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">{familyName} Family Tree</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRightPanelExpanded(false)}
            >
              <Minimize2 className="w-4 h-4 mr-2" />
              Exit Full Screen
            </Button>
          </div>
        </div>
        
        {/* Full Tree Content */}
        <div className="flex-1 relative">
          <FamilyTree
            data={tree}
            onNodeClick={handleNodeClick}
            onAddChild={handleAddChild}
            onAddSpouse={handleAddSpouse}
            onAddParent={handleAddParent}
          />
        </div>

        {/* Person Modal */}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="lg">
          {selectedPerson && (
            <PersonCard
              person={selectedPerson}
              showActions={isAuthenticated}
              onEdit={isAuthenticated ? () => {
                setIsModalOpen(false);
                router.push(`/person/${selectedPerson.id}/edit`);
              } : undefined}
            />
          )}
        </Modal>
      </div>
    );
  }

  // Default: Split view
  return (
    <div className="h-[calc(100dvh-4rem)] flex flex-col">
      {/* Compact header on mobile to give the tree more room */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Link href="/" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:p-2" aria-label="Home">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-slate-900 sm:text-2xl">{familyName} Family</h1>
              <p className="truncate text-[11px] text-slate-500 sm:text-sm">
                {stats?.totalMembers || 0} members · {stats?.marriageCount || 0} marriages
              </p>
            </div>
          </div>
          {!isAuthenticated && (
            <Link
              href="/login"
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-maroon-100 px-2.5 py-1.5 text-xs font-medium text-maroon-700 transition-colors hover:bg-maroon-200 sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm"
            >
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Sign in to contribute</span>
              <span className="sm:hidden">Sign in</span>
            </Link>
          )}
        </div>
      </div>

      {/* Tree is primary (left on lg+); overview on the right, collapsible on mobile */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden lg:flex-row lg:overflow-hidden">
        <div className="order-1 flex min-h-0 w-full min-w-0 flex-1 flex-col bg-white lg:min-w-0 lg:border-r lg:border-slate-200">
          <div className="hidden shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 sm:flex">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <TreePine className="h-4 w-4 text-maroon-500" />
              Family Tree
            </h2>
            <button
              onClick={() => setRightPanelExpanded(true)}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
              title="Expand Tree"
              type="button"
            >
              <Maximize2 className="h-4 w-4 text-slate-500" />
            </button>
          </div>
          <div className="relative min-h-[min(70dvh,640px)] flex-1 lg:min-h-0">
            <FamilyTree
              data={tree}
              onNodeClick={handleNodeClick}
              onAddChild={handleAddChild}
              onAddSpouse={handleAddSpouse}
              onAddParent={handleAddParent}
            />
          </div>
        </div>

        <div className="order-2 flex min-h-0 w-full min-w-0 shrink-0 flex-col border-t border-slate-200 bg-slate-50 lg:order-2 lg:h-full lg:min-h-0 lg:min-w-0 lg:w-1/3 lg:max-w-[min(100%,32rem)] lg:shrink-0 lg:border-t-0 lg:border-l lg:border-slate-200">
          <button
            type="button"
            onClick={() => setMobileOverviewOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 text-left text-slate-800 transition-colors hover:bg-slate-50 lg:hidden"
            aria-expanded={mobileOverviewOpen}
            aria-controls="family-id-overview-panel"
          >
            <span className="flex items-center gap-2 font-semibold">
              <BookOpen className="h-5 w-5 text-maroon-500" />
              Family overview
              {stats && (
                <span className="text-xs font-normal text-slate-500">· {stats.totalMembers} members</span>
              )}
            </span>
            {mobileOverviewOpen ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-slate-500" />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
            )}
          </button>

          <div className="hidden shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:flex">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <BookOpen className="h-4 w-4 text-maroon-500" />
              Family Overview
            </h2>
            <button
              onClick={() => setLeftPanelExpanded(true)}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
              title="Expand Overview"
              type="button"
            >
              <Maximize2 className="h-4 w-4 text-slate-500" />
            </button>
          </div>

          <div
            id="family-id-overview-panel"
            className={clsx(
              'min-h-0 w-full',
              'overflow-y-auto',
              mobileOverviewOpen
                ? 'max-h-[min(52vh,28rem)] sm:max-h-[min(50vh,32rem)]'
                : 'max-h-0 overflow-y-hidden',
              'lg:max-h-none lg:flex-1 lg:overflow-y-auto'
            )}
          >
            <div className="p-4">
              <FamilyOverviewContent
                familyName={familyName}
                foundingAncestor={foundingAncestor}
                stats={stats}
                isAuthenticated={isAuthenticated}
                familyId={familyId}
                compact
                birthdaysThisMonth={birthdaysThisMonth}
                birthdaysMonthName={monthName}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Person Detail Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="lg">
        {selectedPerson && (
          <div>
            <PersonCard
              person={selectedPerson}
              showActions={isAuthenticated}
              onEdit={isAuthenticated ? () => {
                setIsModalOpen(false);
                router.push(`/person/${selectedPerson.id}/edit`);
              } : undefined}
              onRequestCorrection={isAuthenticated ? () => {
                setIsModalOpen(false);
                router.push(`/corrections/new?personId=${selectedPerson.id}`);
              } : undefined}
            />
            {!isAuthenticated && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Want to contribute?</p>
                    <p className="text-xs text-amber-600">
                      <Link href="/login" className="underline hover:text-amber-800">Sign in</Link> or{' '}
                      <Link href="/register" className="underline hover:text-amber-800">create an account</Link> to add information.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// Family Overview Content Component
function FamilyOverviewContent({ 
  familyName, 
  foundingAncestor, 
  stats, 
  isAuthenticated,
  familyId,
  birthdaysThisMonth,
  birthdaysMonthName,
  compact = false 
}: {
  familyName: string;
  foundingAncestor: FamilyData['foundingAncestor'];
  stats: TreeStats | null;
  isAuthenticated: boolean;
  familyId: string;
  birthdaysThisMonth: BirthdayPerson[];
  birthdaysMonthName: string;
  compact?: boolean;
}) {
  return (
    <div className={clsx('space-y-6', compact && 'space-y-4')}>
      {/* Founding Ancestor Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-maroon-500 to-maroon-700 p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-white/20 overflow-hidden flex items-center justify-center">
              {foundingAncestor.profileImage ? (
                <img 
                  src={foundingAncestor.profileImage} 
                  alt={foundingAncestor.firstName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold">
                  {foundingAncestor.firstName[0]}{foundingAncestor.lastName[0]}
                </span>
              )}
            </div>
            <div>
              <p className="text-maroon-200 text-sm">Founding Ancestor</p>
              <h3 className="text-xl font-bold">
                {foundingAncestor.firstName} {foundingAncestor.lastName}
              </h3>
              <div className="flex items-center gap-3 mt-1 text-sm text-maroon-100">
                {foundingAncestor.birthYear && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {foundingAncestor.birthYear}
                  </span>
                )}
                {foundingAncestor.birthPlace && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {foundingAncestor.birthPlace}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        {foundingAncestor.biography && (
          <div className="p-4">
            <p className="text-sm text-slate-600 line-clamp-4">
              {foundingAncestor.biography}
            </p>
          </div>
        )}
      </Card>

      {/* Statistics */}
      {stats && (
        <Card>
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-maroon-500" />
            Family Statistics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <p className="text-2xl font-bold text-maroon-600">{stats.totalMembers}</p>
              <p className="text-xs text-slate-500">Total Members</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <p className="text-2xl font-bold text-maroon-600">{stats.livingCount}</p>
              <p className="text-xs text-slate-500">Living</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <p className="text-2xl font-bold text-rose-500">{stats.marriageCount}</p>
              <p className="text-xs text-slate-500">Marriages</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <p className="text-2xl font-bold text-slate-600">{stats.deceasedCount}</p>
              <p className="text-xs text-slate-500">Deceased</p>
            </div>
          </div>
          
          {stats.oldestMember && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm">
                <Crown className="w-4 h-4 text-amber-500" />
                <span className="text-slate-600">Oldest: </span>
                <span className="font-medium text-slate-900">
                  {stats.oldestMember.name} ({stats.oldestMember.birthYear})
                </span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Notable Persons */}
      <Card>
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-500" />
          Notable Persons
        </h3>
        <NotablePersonsCarousel familyId={familyId} compact={compact} />
      </Card>

      {/* Birthdays this month */}
      <Card>
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Cake className="w-4 h-4 text-pink-500" />
          Birthdays in {birthdaysMonthName}
          <span className="text-xs text-slate-400 font-normal">({birthdaysThisMonth.length})</span>
        </h3>
        {birthdaysThisMonth.length === 0 ? (
          <p className="text-sm text-slate-500">No birthdays found for {birthdaysMonthName}.</p>
        ) : (
          <div className="space-y-2">
            {birthdaysThisMonth.slice(0, 10).map((p) => {
              const d = new Date(p.birthDate);
              const dayLabel = Number.isNaN(d.getTime())
                ? ''
                : d.toLocaleString(undefined, { month: 'short', day: 'numeric' });
              return (
                <Link
                  key={p.id}
                  href={`/person/${p.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <Avatar
                    src={p.profileImage}
                    name={`${p.firstName} ${p.lastName}`}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900 truncate">{p.firstName} {p.lastName}</p>
                      <span className="text-xs text-slate-500 flex-shrink-0">{dayLabel}</span>
                    </div>
                    <p className="text-xs text-slate-500">{p.isLiving ? 'Living' : 'Deceased'}</p>
                  </div>
                </Link>
              );
            })}
            {birthdaysThisMonth.length > 10 && (
              <p className="text-xs text-slate-500">Showing 10 of {birthdaysThisMonth.length} birthdays.</p>
            )}
          </div>
        )}
      </Card>

      {/* Family Wiki Link */}
      <Card className="bg-maroon-50 border-maroon-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-maroon-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Family Wiki
            </h3>
            <p className="text-sm text-maroon-700 mt-1">
              Read and contribute to family history
            </p>
          </div>
          <Link
            href="/wiki"
            className="px-4 py-2 bg-maroon-500 text-white rounded-lg text-sm font-medium hover:bg-maroon-600 transition-colors"
          >
            View Wiki
          </Link>
        </div>
      </Card>

      {/* Actions */}
      {isAuthenticated && (
        <Card>
          <h3 className="font-semibold text-slate-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Link
              href="/add-person"
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-maroon-300 hover:bg-maroon-50 transition-colors"
            >
              <div className="w-8 h-8 bg-maroon-100 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-maroon-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Add Family Member</p>
                <p className="text-xs text-slate-500">Add a new person to the tree</p>
              </div>
            </Link>
            <Link
              href="/wiki/new"
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-maroon-300 hover:bg-maroon-50 transition-colors"
            >
              <div className="w-8 h-8 bg-maroon-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-maroon-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Write Wiki Article</p>
                <p className="text-xs text-slate-500">Document family stories</p>
              </div>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}


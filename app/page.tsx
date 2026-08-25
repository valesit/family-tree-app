'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { clsx } from 'clsx';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CalendarDays,
  Contact,
  Heart,
  Images,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  MapPin,
  Maximize2,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  TreePine,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import { FamilyTree } from '@/components/tree';
import { CanonicalRootPrompt } from '@/components/tree/CanonicalRootPrompt';
import { FamilyGallerySection } from '@/components/gallery';
import { PageScrollNav } from '@/components/shared';
import { PeopleDirectoryView, PeopleListView, type PersonExtras } from '@/components/people';
import { flattenTree } from '@/lib/tree-utils';
import type { PersonWithImage, PersonWithRelations, TreeNode } from '@/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Free Unsplash photograph by Luis Martinez. Kept as a CSS background so the
// hero can fade it smoothly into the archival cream surface without requiring
// Next/Image remote-domain configuration.
const HERITAGE_ACACIA_IMAGE =
  'https://images.unsplash.com/photo-1759767119537-3ea0e5ff75de?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=82&w=2200';

interface FamilyTreePreview {
  id: string;
  familyName: string;
  foundingAncestor: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage: string | null;
    birthYear: number | null;
    birthPlace: string | null;
  };
  memberCount: number;
  generationCount: number;
  notableCount: number;
}

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

type RelationshipRow = {
  id: string;
  name: string;
  label: string;
  image?: string | null;
};

function personYears(person: PersonWithRelations) {
  const birth = person.birthDate ? new Date(person.birthDate).getFullYear() : null;
  const death = person.deathDate ? new Date(person.deathDate).getFullYear() : null;
  if (!birth && !death) return null;
  return `${birth ?? '?'}${death ? ` – ${death}` : ' –'}`;
}

function relationshipsFor(person: PersonWithRelations): RelationshipRow[] {
  const rows: RelationshipRow[] = [];
  const push = (candidate: PersonWithImage | null | undefined, label: string) => {
    if (!candidate) return;
    rows.push({
      id: candidate.id,
      name: `${candidate.firstName} ${candidate.lastName}`,
      label,
      image: candidate.profileImage?.url,
    });
  };

  for (const relation of person.spouseRelations1 ?? []) {
    push(relation.spouse1Id === person.id ? relation.spouse2 : relation.spouse1, 'Spouse');
  }
  for (const relation of person.spouseRelations2 ?? []) {
    push(relation.spouse2Id === person.id ? relation.spouse1 : relation.spouse2, 'Spouse');
  }
  for (const relation of person.parentRelations ?? []) push(relation.parent, 'Parent');
  for (const relation of person.childRelations ?? []) push(relation.child, 'Child');

  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.label}:${row.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function HomePage() {
  const { status } = useSession();
  const router = useRouter();
  const isAuthenticated = status === 'authenticated';

  const [activeView, setActiveView] = useState<'tree' | 'list' | 'directory'>('tree');
  const [selectedPerson, setSelectedPerson] = useState<PersonWithRelations | null>(null);
  const [selectedPersonLoading, setSelectedPersonLoading] = useState(false);
  const [profileOpenMobile, setProfileOpenMobile] = useState(false);
  const [shareComplete, setShareComplete] = useState(false);

  const { data: familiesData, isLoading: familiesLoading } = useSWR<{
    success: boolean;
    data: {
      families: FamilyTreePreview[];
      primaryFamilyId: string | null;
      stats: TreeStats | null;
    };
  }>('/api/families', fetcher, { revalidateOnFocus: false });

  const primaryFamily = familiesData?.data?.families.find(
    (family) => family.id === familiesData?.data?.primaryFamilyId
  );
  const stats = familiesData?.data?.stats;
  const primaryId = familiesData?.data?.primaryFamilyId;

  const { data: treeData, isLoading: treeLoading } = useSWR<{
    success: boolean;
    data: {
      tree: TreeNode | null;
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
      } | null;
    };
  }>(primaryId ? `/api/tree?rootId=${primaryId}` : null, fetcher, { revalidateOnFocus: false });

  const tree = treeData?.data?.tree ?? null;
  const familyName = primaryFamily?.familyName || treeData?.data?.familyName || 'Family';
  const ancestor = treeData?.data?.foundingAncestor || primaryFamily?.foundingAncestor || null;
  const treeExploreHref = primaryId ? `/tree?rootId=${primaryId}` : '/tree';

  const shouldLoadExtras = isAuthenticated && (activeView === 'list' || activeView === 'directory');
  const { data: personsData } = useSWR<{
    success: boolean;
    data: { items: PersonWithImage[] };
  }>(shouldLoadExtras ? '/api/persons?limit=500' : null, fetcher, { revalidateOnFocus: false });

  const flatPeople = useMemo(() => flattenTree(tree), [tree]);
  const extrasMap = useMemo(() => {
    const map = new Map<string, PersonExtras>();
    for (const person of personsData?.data?.items ?? []) {
      map.set(person.id, { birthPlace: person.birthPlace, occupation: person.occupation });
    }
    return map;
  }, [personsData]);

  const openPerson = useCallback(async (personId: string, openMobile = false) => {
    setSelectedPersonLoading(true);
    try {
      const response = await fetch(`/api/persons/${personId}`);
      const result = await response.json();
      if (result.success) {
        setSelectedPerson(result.data);
        if (openMobile) setProfileOpenMobile(true);
      }
    } catch (error) {
      console.error('Error fetching person:', error);
    } finally {
      setSelectedPersonLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedPerson(null);
    setProfileOpenMobile(false);
  }, [primaryId]);

  useEffect(() => {
    if (!selectedPerson && ancestor?.id) void openPerson(ancestor.id);
  }, [ancestor?.id, openPerson, selectedPerson]);

  const handleNodeClick = (node: TreeNode) => void openPerson(node.id, true);
  const handlePersonClick = (personId: string) => void openPerson(personId, true);

  const routeToContribution = (url: string) => {
    if (isAuthenticated) {
      router.push(url);
      return;
    }
    router.push(`/login?callbackUrl=${encodeURIComponent(url)}`);
  };

  const handleAddChild = (parentId: string) => routeToContribution(`/add-person?parentId=${parentId}`);
  const handleAddSpouse = (personId: string) => routeToContribution(`/add-person?spouseId=${personId}`);
  const handleAddParent = (childId: string) => routeToContribution(`/add-person?childId=${childId}`);

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${familyName} Family Tree`, url: window.location.href });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
      }
      setShareComplete(true);
      window.setTimeout(() => setShareComplete(false), 1800);
    } catch {
      // User cancelled the native share sheet.
    }
  };

  const isLoading = familiesLoading || Boolean(primaryId && treeLoading);
  const hasNoData = !familiesLoading && !familiesData?.data?.families?.length;
  const relationships = selectedPerson ? relationshipsFor(selectedPerson) : [];

  return (
    <div className="min-h-screen bg-[#fbf9f5] text-[#2a211d]">
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-[#e8dfd6] bg-[#fffdf9]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px_10px_14px_14px] bg-maroon-500 text-white shadow-sm">
              <TreePine className="h-5 w-5" />
            </span>
            <span className="hidden truncate font-serif text-sm font-bold tracking-[0.16em] text-[#3a2722] sm:block">
              {familyName.toUpperCase()}
            </span>
          </Link>

          <div className="hidden h-full items-stretch md:flex">
            <TopNavLink href="#family-tree" active icon={<TreePine className="h-4 w-4" />}>Tree</TopNavLink>
            <TopNavLink href="/wiki" icon={<BookOpen className="h-4 w-4" />}>Stories</TopNavLink>
            <TopNavLink href="/gallery" icon={<Images className="h-4 w-4" />}>Gallery</TopNavLink>
            <TopNavLink href="/wiki" icon={<BookOpen className="h-4 w-4" />}>Family History</TopNavLink>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={treeExploreHref}
              className="hidden h-9 items-center gap-2 rounded-lg border border-[#e5d9ce] bg-white px-3 text-xs text-[#7a6a61] shadow-sm lg:flex"
            >
              <Search className="h-4 w-4" />
              Search people...
            </Link>
            {isAuthenticated ? (
              <Link
                href="/add-person"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-maroon-500 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-maroon-600 sm:text-sm"
              >
                <Plus className="h-4 w-4" />
                Add Person
              </Link>
            ) : (
              <Link
                href="/register"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-maroon-500 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-maroon-600 sm:text-sm"
              >
                <UserPlus className="h-4 w-4" />
                Join
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <section className="relative overflow-hidden border-b border-[#eadfd6] bg-[#fbf8f3]">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[60%] overflow-hidden lg:block" aria-hidden>
            <div
              className="absolute inset-0 bg-cover bg-center opacity-[0.48] mix-blend-multiply"
              style={{
                backgroundImage: `url('${HERITAGE_ACACIA_IMAGE}')`,
                filter: 'sepia(0.34) saturate(0.62) contrast(0.9) brightness(1.04)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,.28) 20%, black 48%, black 100%)',
                maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,.28) 20%, black 48%, black 100%)',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#fbf8f3] via-[#fbf8f3]/55 to-[#e9d7c8]/10" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#fbf8f3]/95 to-transparent" />
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 right-[2%] hidden w-[50%] opacity-[0.055] lg:block"
            aria-hidden
            style={{
              backgroundImage:
                'repeating-linear-gradient(-8deg, transparent 0 18px, rgba(101,26,26,.28) 18px 19px, transparent 19px 35px)',
              WebkitMaskImage: 'linear-gradient(to right, transparent, black 35%, black)',
              maskImage: 'linear-gradient(to right, transparent, black 35%, black)',
            }}
          />
          <div className="mx-auto min-h-[252px] max-w-[1600px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-11">
            <div className="relative z-10 max-w-4xl">
              <p className="mb-2 flex items-center gap-2 font-serif text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b4b3e] sm:text-xs">
                <span className="h-px w-5 bg-[#9b5b4b]" />
                Family Heritage
              </p>
              <h1 className="font-serif text-3xl font-medium tracking-[-0.035em] text-[#2d231f] sm:text-4xl lg:text-5xl">
                The <span className="font-semibold text-maroon-600">{familyName}</span> Family Tree
              </h1>
              <p className="mt-2 max-w-xl font-serif text-sm text-[#796c64] sm:text-base">
                Preserving our family story across generations.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-y-4">
                <HeroStat icon={<Users className="h-5 w-5" />} value={String(primaryFamily?.memberCount ?? stats?.totalMembers ?? 0)} label="Family Members" />
                <HeroStat icon={<TreePine className="h-5 w-5" />} value={String(primaryFamily?.generationCount ?? 0)} label="Generations" />
                <HeroStat
                  icon={<Heart className="h-5 w-5" />}
                  value={ancestor?.birthYear ? `Est. ${ancestor.birthYear}` : 'Family record'}
                  label="Earliest Record"
                  last
                />
              </div>
            </div>

            <div className="relative z-10 mt-6 flex flex-wrap items-center gap-2 lg:absolute lg:bottom-8 lg:right-8 lg:mt-0">
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dfd1c5] bg-[#fffdf9]/92 px-3.5 font-serif text-xs font-medium text-[#55372e] shadow-sm backdrop-blur-sm transition hover:bg-white"
              >
                <Share2 className="h-4 w-4" />
                {shareComplete ? 'Link copied' : 'Share Tree'}
              </button>
              <Link
                href={treeExploreHref}
                aria-label="Open full family tree"
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#dfd1c5] bg-[#fffdf9]/92 text-[#6f5d54] shadow-sm backdrop-blur-sm transition hover:bg-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1600px] px-4 pt-4 sm:px-6 lg:px-8">
          <CanonicalRootPrompt />
        </div>

        <section id="family-tree" className="mx-auto max-w-[1600px] px-3 py-5 sm:px-6 lg:px-8 lg:py-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-full border border-[#e8ded4] bg-[#f3eee8] p-1 shadow-sm">
              <ViewTab active={activeView === 'tree'} onClick={() => setActiveView('tree')} icon={<TreePine className="h-3.5 w-3.5" />} label="Tree" />
              <ViewTab active={activeView === 'list'} onClick={() => setActiveView('list')} icon={<ListIcon className="h-3.5 w-3.5" />} label="List" disabled={!isAuthenticated} />
              <ViewTab active={activeView === 'directory'} onClick={() => setActiveView('directory')} icon={<Contact className="h-3.5 w-3.5" />} label="Directory" disabled={!isAuthenticated} />
            </div>
            <div className="flex items-center gap-3">
              {activeView === 'tree' && (
                <span className="hidden text-xs text-[#8b7d73] sm:inline">Drag to move · Scroll or pinch to zoom</span>
              )}
              <Link href={treeExploreHref} className="inline-flex items-center gap-1.5 rounded-lg border border-[#e3d8cf] bg-white px-3 py-1.5 text-xs font-medium text-maroon-700 shadow-sm hover:bg-[#fffaf6]">
                <Maximize2 className="h-3.5 w-3.5" />
                Full tree
              </Link>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="relative h-[min(68dvh,680px)] min-h-[500px] overflow-hidden rounded-2xl border border-[#e6dcd3] bg-[#fffdf9] shadow-[0_18px_45px_-28px_rgba(74,46,32,0.28)]">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-[#7e7169]">
                    <Loader2 className="mx-auto mb-3 h-9 w-9 animate-spin text-maroon-500" />
                    Loading family tree...
                  </div>
                </div>
              ) : hasNoData ? (
                <EmptyState isAuthenticated={isAuthenticated} />
              ) : activeView === 'list' ? (
                <PeopleListView people={flatPeople} extras={extrasMap} onPersonClick={handlePersonClick} />
              ) : activeView === 'directory' ? (
                <PeopleDirectoryView people={flatPeople} extras={extrasMap} onPersonClick={handlePersonClick} />
              ) : (
                <FamilyTree
                  data={tree}
                  onNodeClick={handleNodeClick}
                  onAddChild={handleAddChild}
                  onAddSpouse={handleAddSpouse}
                  onAddParent={handleAddParent}
                  readOnly={!isAuthenticated}
                />
              )}
            </div>

            <aside className="hidden xl:block">
              <ProfilePanel
                person={selectedPerson}
                loading={selectedPersonLoading}
                rootPersonId={primaryId ?? null}
                relationships={relationships}
                isAuthenticated={isAuthenticated}
                onSelectRelative={(id) => void openPerson(id)}
                onClose={() => setSelectedPerson(null)}
              />
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-[1600px] px-3 pb-8 sm:px-6 lg:px-8">
          <FamilyGallerySection rootPersonId={primaryId ?? null} compact />
        </section>

        {!isAuthenticated && !hasNoData && (
          <section className="border-t border-[#ebe2da] bg-[#f7f2ed] px-4 py-12">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-serif text-2xl font-semibold text-[#31251f] sm:text-3xl">Help preserve the next chapter</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#796b63]">
                Join the family space to add relatives, connect new branches, contribute stories and upload family photographs.
              </p>
              <Link href="/register" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-maroon-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-maroon-600">
                Join the Family
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        )}

        <footer className="border-t border-[#ebe2da] bg-[#fffdf9] px-4 py-7">
          <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
            <div className="flex items-center gap-2 font-serif font-semibold text-[#3b2923]">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-maroon-500 text-white"><TreePine className="h-4 w-4" /></span>
              {familyName}
            </div>
            <p className="text-xs text-[#91857d]">Preserving family history across generations.</p>
          </div>
        </footer>
      </main>

      <PageScrollNav />

      {profileOpenMobile && selectedPerson && (
        <div className="fixed inset-0 z-[100] xl:hidden">
          <button type="button" className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" aria-label="Close person details" onClick={() => setProfileOpenMobile(false)} />
          <div className="absolute inset-x-3 bottom-3 max-h-[82dvh] overflow-y-auto rounded-2xl bg-[#fffaf5] shadow-2xl sm:left-auto sm:right-4 sm:w-[390px]">
            <button type="button" onClick={() => setProfileOpenMobile(false)} className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full border border-[#e4d8ce] bg-[#fffdf9] text-[#6f5f56]" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <ProfilePanel
              person={selectedPerson}
              loading={selectedPersonLoading}
              rootPersonId={primaryId ?? null}
              relationships={relationships}
              isAuthenticated={isAuthenticated}
              onSelectRelative={(id) => void openPerson(id)}
              embedded
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TopNavLink({ href, active, icon, children }: { href: string; active?: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={clsx(
        'relative flex h-full items-center gap-2 px-4 font-serif text-sm transition',
        active ? 'font-semibold text-maroon-700' : 'text-[#6e6058] hover:text-[#332720]'
      )}
    >
      {icon}
      {children}
      {active && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-maroon-500" />}
    </Link>
  );
}

function HeroStat({ icon, value, label, last }: { icon: React.ReactNode; value: string; label: string; last?: boolean }) {
  return (
    <div className={clsx('flex min-w-[145px] items-center gap-3 pr-7', !last && 'mr-7 border-r border-[#e4d9cf]')}>
      <span className="text-[#985a47]">{icon}</span>
      <span>
        <strong className="block font-serif text-base font-semibold text-[#3b2b24]">{value}</strong>
        <span className="mt-0.5 block text-[10px] text-[#8e8178]">{label}</span>
      </span>
    </div>
  );
}

function ViewTab({ active, onClick, icon, label, disabled }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'Sign in to use this view' : undefined}
      className={clsx(
        'inline-flex h-8 items-center gap-1.5 rounded-full px-4 font-serif text-xs transition',
        active ? 'bg-white font-semibold text-maroon-700 shadow-sm' : 'text-[#71635a] hover:text-[#3e3029]',
        disabled && 'cursor-not-allowed opacity-45'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

type DetailTab = 'overview' | 'events' | 'stories' | 'photos';

function ProfilePanel({
  person,
  loading,
  rootPersonId,
  relationships,
  isAuthenticated,
  onSelectRelative,
  onClose,
  embedded = false,
}: {
  person: PersonWithRelations | null;
  loading: boolean;
  rootPersonId: string | null;
  relationships: RelationshipRow[];
  isAuthenticated: boolean;
  onSelectRelative: (id: string) => void;
  onClose?: () => void;
  embedded?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  useEffect(() => {
    setActiveTab('overview');
  }, [person?.id]);

  if (loading && !person) {
    return (
      <div className={clsx('flex h-[520px] items-center justify-center rounded-[18px] border border-[#e2d5ca] bg-[#fffaf5]', !embedded && 'shadow-sm')}>
        <Loader2 className="h-7 w-7 animate-spin text-maroon-500" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className={clsx('rounded-[18px] border border-[#e2d5ca] bg-[#fffaf5] p-7 text-center text-sm text-[#857870]', !embedded && 'shadow-sm')}>
        Select a person in the tree to see their story and relationships.
      </div>
    );
  }

  const years = personYears(person);
  const isRoot = person.id === rootPersonId;
  const birthDate = person.birthDate ? new Date(person.birthDate) : null;
  const deathDate = person.deathDate ? new Date(person.deathDate) : null;
  const photos = (person.images ?? []).slice(0, 6);

  return (
    <div className={clsx('overflow-hidden rounded-[18px] border border-[#e2d5ca] bg-[#fffaf5]', !embedded && 'h-[min(68dvh,680px)] min-h-[500px] shadow-[0_18px_45px_-28px_rgba(74,46,32,0.28)]')}>
      <div className="flex h-full flex-col">
        <div className="relative bg-gradient-to-br from-[#fffdf9] via-[#fffaf5] to-[#f5e9df] px-6 pb-5 pt-6">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-[#735f55] transition hover:bg-[#efe3d8] hover:text-[#4e392f]"
              aria-label="Close person information"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          <div className="flex items-start gap-4 pr-7">
            {person.profileImage?.url ? (
              <img
                src={person.profileImage.url}
                alt={`${person.firstName} ${person.lastName}`}
                className="h-24 w-24 shrink-0 rounded-full object-cover ring-4 ring-[#f0e4da] shadow-sm"
              />
            ) : (
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-[#ede2d8] font-serif text-2xl font-semibold text-[#785d50] ring-4 ring-[#f5ece4]">
                {person.firstName[0]}{person.lastName[0]}
              </div>
            )}
            <div className="min-w-0 pt-2">
              <h2 className="truncate font-serif text-[22px] font-semibold leading-tight text-[#33251f]">{person.firstName} {person.lastName}</h2>
              {years && <p className="mt-1.5 text-sm text-[#8b7d74]">{years}</p>}
              {isRoot && (
                <span className="mt-3 inline-flex rounded-md bg-maroon-500 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.09em] text-white shadow-sm">
                  Root Person
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="border-y border-[#e7d9ce] bg-[#f6ece3]/85 px-5">
          <div className="grid grid-cols-4 gap-1">
            <DetailsTab active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</DetailsTab>
            <DetailsTab active={activeTab === 'events'} onClick={() => setActiveTab('events')}>Life Events</DetailsTab>
            <DetailsTab active={activeTab === 'stories'} onClick={() => setActiveTab('stories')}>Stories</DetailsTab>
            <DetailsTab active={activeTab === 'photos'} onClick={() => setActiveTab('photos')}>Photos</DetailsTab>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fffaf5] px-6 py-5">
          {activeTab === 'overview' && (
            <>
              <section>
                <h3 className="font-serif text-[17px] font-semibold text-[#3a2b24]">About</h3>
                <p className="mt-2.5 text-sm leading-6 text-[#756961]">
                  {person.biography || `${person.firstName}'s biography has not been added yet. Family members can help preserve their story by adding memories, places and important life events.`}
                </p>
                <Link href={`/person/${person.id}`} className="mt-2.5 inline-flex text-xs font-semibold text-maroon-600 hover:text-maroon-700">Read more →</Link>
              </section>

              <section className="mt-6 border-t border-[#eaded4] pt-5">
                <h3 className="font-serif text-[17px] font-semibold text-[#3a2b24]">Relationships</h3>
                {relationships.length > 0 ? (
                  <div className="mt-2 divide-y divide-[#eaded4]">
                    {relationships.slice(0, 6).map((relationship) => (
                      <button
                        key={`${relationship.label}-${relationship.id}`}
                        type="button"
                        onClick={() => onSelectRelative(relationship.id)}
                        className="flex w-full items-center gap-3 rounded-lg py-3 text-left transition hover:bg-[#f8eee6]"
                      >
                        {relationship.image ? (
                          <img src={relationship.image} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-[#f1e6dd]" />
                        ) : (
                          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#eee3d9] text-[#846a5d]"><User className="h-4 w-4" /></span>
                        )}
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate font-serif text-sm font-medium text-[#49362e]">{relationship.name}</strong>
                          <span className="text-[11px] text-[#92857d]">{relationship.label}</span>
                        </span>
                        {relationship.label === 'Spouse' ? <Heart className="h-4 w-4 text-maroon-500" /> : <Users className="h-4 w-4 text-[#9e8b80]" />}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-[#92857d]">No relationships are recorded yet. Use the + branch menu on the tree to add one.</p>
                )}
              </section>
            </>
          )}

          {activeTab === 'events' && (
            <section>
              <h3 className="font-serif text-[17px] font-semibold text-[#3a2b24]">Life Events</h3>
              <div className="mt-4 space-y-3">
                {birthDate && !Number.isNaN(birthDate.getTime()) && (
                  <EventRow icon={<CalendarDays className="h-4 w-4" />} title="Born" detail={birthDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} />
                )}
                {person.birthPlace && (
                  <EventRow icon={<MapPin className="h-4 w-4" />} title="Birthplace" detail={person.birthPlace} />
                )}
                {person.occupation && (
                  <EventRow icon={<Briefcase className="h-4 w-4" />} title="Occupation" detail={person.occupation} />
                )}
                {deathDate && !Number.isNaN(deathDate.getTime()) && (
                  <EventRow icon={<CalendarDays className="h-4 w-4" />} title="Passed" detail={deathDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} />
                )}
                {person.deathPlace && (
                  <EventRow icon={<MapPin className="h-4 w-4" />} title="Place of passing" detail={person.deathPlace} />
                )}
                {!birthDate && !person.birthPlace && !person.occupation && !deathDate && !person.deathPlace && (
                  <p className="rounded-xl border border-[#eaded4] bg-[#f8f0e9] p-4 text-sm leading-6 text-[#7b6c63]">
                    No life events have been recorded yet. Open the full profile to add important dates, places and milestones.
                  </p>
                )}
              </div>
              <Link href={`/person/${person.id}`} className="mt-4 inline-flex text-xs font-semibold text-maroon-600 hover:text-maroon-700">View full timeline →</Link>
            </section>
          )}

          {activeTab === 'stories' && (
            <section>
              <h3 className="font-serif text-[17px] font-semibold text-[#3a2b24]">Stories</h3>
              <div className="mt-4 rounded-xl border border-[#eaded4] bg-[#f8f0e9] p-5">
                <BookOpen className="h-5 w-5 text-[#9a6b56]" />
                <p className="mt-3 text-sm leading-6 text-[#756961]">
                  Family memories and written stories about {person.firstName} can be preserved in the family history archive.
                </p>
                <Link href="/wiki" className="mt-3 inline-flex text-xs font-semibold text-maroon-600 hover:text-maroon-700">Browse family stories →</Link>
              </div>
            </section>
          )}

          {activeTab === 'photos' && (
            <section>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-serif text-[17px] font-semibold text-[#3a2b24]">Photos</h3>
                <Link href="/gallery" className="text-xs font-semibold text-maroon-600 hover:text-maroon-700">View gallery →</Link>
              </div>
              {photos.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {photos.map((photo) => (
                    <div key={photo.id} className="aspect-[4/3] overflow-hidden rounded-xl border border-[#eaded4] bg-[#f3eae2]">
                      <img src={photo.url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-[#d9c7b9] bg-[#f8f0e9] p-5 text-center">
                  <Images className="mx-auto h-6 w-6 text-[#9a6b56]" />
                  <p className="mt-2 text-sm text-[#756961]">No photos have been linked to this person yet.</p>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[#e7d9ce] bg-[#f4e9e0] p-4">
          <Link href={`/person/${person.id}`} className="inline-flex items-center justify-center rounded-lg border border-[#d7c7bb] bg-[#fffdf9] px-3 py-2.5 text-xs font-semibold text-[#5f493d] transition hover:bg-white">View Full Profile</Link>
          {isAuthenticated ? (
            <Link href={`/person/${person.id}/edit`} className="inline-flex items-center justify-center rounded-lg bg-maroon-500 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-maroon-600">Edit Person</Link>
          ) : (
            <Link href="/login" className="inline-flex items-center justify-center rounded-lg bg-maroon-500 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-maroon-600">Sign in</Link>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailsTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'relative min-w-0 px-1 py-3 font-serif text-[11px] transition sm:text-xs',
        active ? 'font-semibold text-maroon-700' : 'text-[#79695f] hover:text-[#4b372e]'
      )}
    >
      <span className="truncate">{children}</span>
      {active && <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-maroon-500" />}
    </button>
  );
}

function EventRow({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#eaded4] bg-[#fffdf9] p-3.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f0e4da] text-[#8f5f4b]">{icon}</span>
      <span className="min-w-0">
        <strong className="block font-serif text-sm font-semibold text-[#49362e]">{title}</strong>
        <span className="mt-0.5 block text-xs leading-5 text-[#81736a]">{detail}</span>
      </span>
    </div>
  );
}

function EmptyState({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div>
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#f1eae3] text-[#a07866]"><TreePine className="h-9 w-9" /></span>
        <h2 className="mt-4 font-serif text-xl font-semibold text-[#3b2c25]">Start your family tree</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#7e7068]">Add the first family member, then grow the tree by connecting parents, spouses and children.</p>
        <Link href={isAuthenticated ? '/add-person' : '/register'} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-maroon-500 px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-600">
          <Plus className="h-4 w-4" />
          {isAuthenticated ? 'Add first person' : 'Join to contribute'}
        </Link>
      </div>
    </div>
  );
}

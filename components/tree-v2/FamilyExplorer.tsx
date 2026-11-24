'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui';
import type { ExplorerGraph, ExplorerPerson, ExplorerLink } from '@/lib/family-explorer';
import { getExplorerContext, relationshipLabel } from '@/lib/family-explorer';
import {
  ArrowLeft, ArrowRight, BookOpen, ChevronDown, CircleHelp, Heart,
  Home, Plus, Search, TreeDeciduous, UserRoundPlus, Users, X,
} from 'lucide-react';

type ViewMode = 'family' | 'ancestors' | 'descendants';

interface FamilyExplorerProps {
  graph: ExplorerGraph;
  selectedId: string;
  familyName: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  canGoBack: boolean;
  isAuthenticated: boolean;
  oldTreeHref: string;
}

function PersonTile({
  person, onSelect, role, prominent = false, compact = false,
}: {
  person: ExplorerPerson;
  onSelect: (id: string) => void;
  role?: string;
  prominent?: boolean;
  compact?: boolean;
}) {
  const years = person.birthYear
    ? `${person.birthYear} – ${person.deathYear ?? ''}`
    : person.deathYear ? `Died ${person.deathYear}` : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(person.id)}
      aria-label={`Explore ${person.name}`}
      className={[
        'group flex min-w-0 flex-col items-center justify-center rounded-xl border bg-white text-center transition-colors duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#651a1a]',
        'hover:border-[#b78f91] hover:bg-[#fffafa]',
        prominent
          ? 'w-[250px] max-w-full border-[#9d5555] px-5 py-5 shadow-[0_12px_28px_-18px_rgba(54,25,25,0.28)]'
          : compact
            ? 'w-[154px] min-h-[102px] border-[#e2e9e5] px-3 py-3'
            : 'w-[194px] min-h-[145px] border-[#d5dfd8] px-4 py-4',
      ].join(' ')}
    >
      {!compact && (
        <Avatar src={person.photo} name={person.name} size={prominent ? 'xl' : 'lg'} className="mb-2.5" />
      )}
      <span className={`block w-full break-words font-semibold leading-snug text-[#332b28] ${prominent ? 'text-lg' : compact ? 'text-sm' : 'text-base'}`}>
        {person.name}
      </span>
      {years && <span className="mt-1 text-xs font-medium tabular-nums text-[#596660]">{years}</span>}
      {role && <span className="mt-2 text-[11px] font-medium text-[#14635b]">{role}</span>}
      {!role && !years && <span className="mt-1 text-xs text-[#52615c]">View connections</span>}
    </button>
  );
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-4 flex items-center justify-center gap-2 text-center text-sm font-semibold text-[#496059]">
      <span>{children}</span>
      {typeof count === 'number' && (
        <span className="rounded-full bg-[#e7f3ef] px-2 py-0.5 text-xs tabular-nums text-[#14635b]">{count}</span>
      )}
    </div>
  );
}

function BranchLine() {
  return <div className="mx-auto h-9 w-px bg-[#9db7aa]" aria-hidden="true" />;
}

export function FamilyExplorer({
  graph, selectedId, familyName, onSelect, onBack, canGoBack,
  isAuthenticated, oldTreeHref,
}: FamilyExplorerProps) {
  const [view, setView] = useState<ViewMode>('family');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const context = useMemo(() => getExplorerContext(graph, selectedId), [graph, selectedId]);
  const people = useMemo(() => [...graph.people.values()].sort((a, b) => a.name.localeCompare(b.name)), [graph]);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return people.filter((p) => p.name.toLowerCase().includes(term)).slice(0, 8);
  }, [people, query]);

  const selectPerson = (id: string) => {
    onSelect(id);
    setQuery('');
    setSearchOpen(false);
  };

  if (!context) return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h2 className="font-serif text-2xl font-semibold text-[#332b28]">That relative is not available</h2>
      <p className="mt-2 text-[#52615c]">Return to the family root to continue exploring.</p>
      <button onClick={() => onSelect(graph.rootId)} className="mt-5 rounded-lg bg-[#651a1a] px-5 py-3 text-white">Go to family root</button>
    </div>
  );

  const { person, parents, parentBranches, partners, childGroups, siblings } = context;
  const totalChildren = childGroups.reduce((sum, group) => sum + group.children.length, 0);
  const rootIsSelected = selectedId === graph.rootId;

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#fbfcfa] pb-10 text-[#332b28]">
      <header className="border-b border-[#e2e9e5] bg-white">
        <div className="mx-auto flex max-w-[1510px] flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-7">
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#651a1a] sm:text-[29px]">Family Explorer</h1>
            <p className="mt-0.5 text-sm text-[#52615c]">{familyName} · {people.length} connected family members</p>
          </div>
          <Link href={oldTreeHref} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#cad9d2] bg-white px-4 text-sm font-semibold text-[#344d44] transition-colors hover:bg-[#f1f7f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14635b]">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Classic tree
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1510px] px-4 pt-5 sm:px-7">
        <div className="relative z-20 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[230px] flex-1">
            <label htmlFor="family-explorer-search" className="sr-only">Find a family member</label>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#52615c]" aria-hidden />
            <input
              id="family-explorer-search"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && results[0]) selectPerson(results[0].id);
                if (event.key === 'Escape') setSearchOpen(false);
              }}
              placeholder="Find someone in this family"
              className="h-12 w-full rounded-xl border border-[#cad9d2] bg-white pl-12 pr-4 text-base text-[#332b28] outline-none placeholder:text-[#687770] focus:border-[#14635b] focus:ring-2 focus:ring-[#14635b]/15"
            />
            {searchOpen && query.trim() && (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-80 overflow-y-auto rounded-xl border border-[#cad9d2] bg-white p-2 shadow-[0_12px_30px_-12px_rgba(27,57,45,0.24)]">
                {results.length ? results.map((match) => (
                  <button
                    key={match.id}
                    type="button"
                    onClick={() => selectPerson(match.id)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[#f1f7f4] focus-visible:outline-2 focus-visible:outline-[#14635b]"
                  >
                    <Avatar src={match.photo} name={match.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{match.name}</span>
                    {match.birthYear && <span className="text-xs tabular-nums text-[#52615c]">{match.birthYear}</span>}
                    <ArrowRight className="h-4 w-4 text-[#52615c]" aria-hidden />
                  </button>
                )) : <p className="px-3 py-4 text-sm text-[#52615c]">No matching relatives in this family.</p>}
                <button type="button" onClick={() => setSearchOpen(false)} className="mt-1 w-full rounded-lg py-2 text-xs font-medium text-[#52615c] hover:bg-[#f1f7f4]">Close search</button>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-[#cad9d2] bg-white p-1" role="group" aria-label="Family view">
            {([
              ['family', 'Family'],
              ['ancestors', 'Ancestors'],
              ['descendants', 'Descendants'],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                aria-pressed={view === mode}
                className={`min-h-10 rounded-lg px-3 text-xs font-semibold transition-colors sm:px-4 sm:text-sm ${view === mode ? 'bg-[#651a1a] text-white' : 'text-[#52615c] hover:bg-[#f1f7f4]'}`}
              >{label}</button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e2e9e5] bg-white" aria-label="Family relationship explorer">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e9e5] px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2 text-sm text-[#52615c]">
                <TreeDeciduous className="h-5 w-5 text-[#14635b]" aria-hidden />
                <span>Explore relationships around <strong className="text-[#332b28]">{person.firstName}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onBack}
                  disabled={!canGoBack}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-[#52615c] hover:bg-[#f1f7f4] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden /> Back
                </button>
                <button
                  type="button"
                  onClick={() => selectPerson(graph.rootId)}
                  disabled={rootIsSelected}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-[#14635b] hover:bg-[#e7f3ef] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Home className="h-4 w-4" aria-hidden /> Root
                </button>
              </div>
            </div>

            <div className="flex min-h-[590px] flex-col items-center overflow-x-auto px-4 py-9 sm:px-7">
              {view !== 'descendants' && (
                <div className="w-full">
                  <SectionLabel count={parents.length}>Parents and their families</SectionLabel>
                  {parentBranches.length ? (
                    <div className="mx-auto flex max-w-[850px] flex-wrap items-end justify-center gap-x-10 gap-y-8">
                      {parentBranches.map(({ parent, grandparents }) => (
                        <div key={parent.person.id} className="flex min-w-[194px] flex-col items-center gap-2">
                          {grandparents.length > 0 && (
                            <>
                              <div className="mb-1 flex flex-wrap justify-center gap-2">
                                {grandparents.map(({ person: grandparent, type }) => (
                                  <PersonTile key={grandparent.id} person={grandparent} compact role={relationshipLabel(type, grandparent.gender)} onSelect={selectPerson} />
                                ))}
                              </div>
                              <div className="h-5 w-px bg-[#9db7aa]" aria-hidden />
                            </>
                          )}
                          <PersonTile person={parent.person} onSelect={selectPerson} role={relationshipLabel(parent.type, parent.person.gender)} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mx-auto max-w-sm rounded-lg bg-[#f1f7f4] px-4 py-3 text-center text-sm text-[#52615c]">No parents recorded yet. You can add family details from the panel below.</p>
                  )}
                  <BranchLine />
                </div>
              )}

              <div className="flex max-w-full flex-wrap items-center justify-center gap-3">
                <div className="relative">
                  <PersonTile person={person} onSelect={selectPerson} prominent role="Currently exploring" />
                </div>
                {partners.map((partner) => (
                  <div className="flex items-center gap-3" key={partner.id}>
                    <div className="flex items-center gap-2 text-[#a37b7b]" aria-label="Spouse or partner">
                      <span className="h-px w-5 bg-[#d9c5c5]" />
                      <Heart className="h-4 w-4" aria-hidden />
                      <span className="h-px w-5 bg-[#d9c5c5]" />
                    </div>
                    <PersonTile person={partner} onSelect={selectPerson} role="Spouse / partner" />
                  </div>
                ))}
              </div>

              {view !== 'ancestors' && (
                <div className="mt-1 w-full">
                  <BranchLine />
                  <SectionLabel count={totalChildren}>Children</SectionLabel>
                  {childGroups.length ? (
                    <div className="mx-auto flex max-w-[880px] flex-wrap items-stretch justify-center gap-4">
                      {childGroups.map((group) => (
                        <div key={group.key} className="min-w-[220px] flex-1 basis-[255px] rounded-xl border border-[#e2e9e5] bg-[#fbfcfa] px-4 pb-5 pt-4">
                          <p className="mb-4 text-center text-xs font-semibold text-[#496059]">
                            {group.coParents.length
                              ? `With ${group.coParents.map((p) => p.name).join(' & ')}`
                              : 'Other parent not recorded'}
                          </p>
                          <div className="flex flex-wrap justify-center gap-3">
                            {group.children.map(({ person: child, type }) => (
                              <PersonTile key={child.id} person={child} onSelect={selectPerson} compact role={type === 'PARENT_CHILD' ? undefined : relationshipLabel(type)} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-center text-sm text-[#52615c]">No children recorded for {person.firstName}.</p>}
                </div>
              )}
              {view === 'family' && siblings.length > 0 && (
                <div className="mt-9 w-full max-w-[880px] border-t border-[#e2e9e5] pt-6">
                  <SectionLabel count={siblings.length}>Brothers and sisters through a recorded parent</SectionLabel>
                  <div className="flex flex-wrap justify-center gap-2">
                    {siblings.map((sibling) => (
                      <button key={sibling.id} type="button" onClick={() => selectPerson(sibling.id)}
                        className="min-h-11 rounded-lg border border-[#cad9d2] bg-white px-3 text-sm font-medium text-[#344d44] hover:border-[#14635b] hover:bg-[#f1f7f4] focus-visible:outline-2 focus-visible:outline-[#14635b]">
                        {sibling.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-[#e2e9e5] bg-[#fbfcfa] px-5 py-3 text-center text-xs text-[#52615c]">
              Select any person to recenter the view · Relationships reflect recorded family connections
            </div>
          </section>

          <aside className="space-y-4" aria-label="Selected relative details">
            <div className="rounded-2xl border border-[#e2e9e5] bg-white p-5">
              <div className="flex items-center gap-3">
                <Avatar src={person.photo} name={person.name} size="xl" />
                <div className="min-w-0">
                  <h2 className="break-words font-serif text-xl font-semibold text-[#332b28]">{person.name}</h2>
                  <p className="mt-1 text-sm text-[#52615c]">
                    {person.birthYear ? `${person.birthYear} – ${person.deathYear ?? ''}` : 'Life dates not recorded'}
                  </p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 divide-x divide-[#e2e9e5] border-y border-[#e2e9e5] py-3 text-center">
                <div><div className="text-lg font-semibold tabular-nums">{parents.length}</div><div className="text-xs text-[#52615c]">Parents</div></div>
                <div><div className="text-lg font-semibold tabular-nums">{partners.length}</div><div className="text-xs text-[#52615c]">Partners</div></div>
                <div><div className="text-lg font-semibold tabular-nums">{totalChildren}</div><div className="text-xs text-[#52615c]">Children</div></div>
              </div>
              <Link href={`/person/${person.id}`} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#651a1a] px-4 text-sm font-semibold text-white hover:bg-[#4a1313] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#651a1a]">
                <BookOpen className="h-4 w-4" aria-hidden /> View profile <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            <div className="rounded-2xl border border-[#e2e9e5] bg-white p-5">
              <div className="flex items-center gap-2">
                <UserRoundPlus className="h-5 w-5 text-[#14635b]" aria-hidden />
                <h3 className="font-semibold">Grow this family tree</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#52615c]">
                {isAuthenticated ? `Add a relative connected to ${person.firstName}.` : 'Sign in to contribute family information.'}
              </p>
              {isAuthenticated ? (
                <div className="mt-4 space-y-2">
                  {[
                    { text: 'Add parent', href: `/add-person?childId=${person.id}` },
                    { text: 'Add child', href: `/add-person?parentId=${person.id}` },
                    { text: 'Add spouse / partner', href: `/add-person?spouseId=${person.id}` },
                  ].map((action) => (
                    <Link key={action.text} href={action.href} className="flex min-h-11 items-center justify-between rounded-lg border border-[#cad9d2] px-3 text-sm font-medium text-[#344d44] hover:bg-[#f1f7f4] focus-visible:outline-2 focus-visible:outline-[#14635b]">
                      <span className="flex items-center gap-2"><Plus className="h-4 w-4" aria-hidden />{action.text}</span>
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  ))}
                </div>
              ) : (
                <Link href={`/login?callbackUrl=${encodeURIComponent('/tree-v2')}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#cad9d2] px-4 text-sm font-semibold text-[#14635b] hover:bg-[#f1f7f4]">Sign in to contribute</Link>
              )}
            </div>

            <div className="rounded-2xl border border-[#e2e9e5] bg-white p-5">
              <button type="button" onClick={() => setShowGuide((current) => !current)}
                className="flex min-h-10 w-full items-center justify-between gap-2 text-left font-semibold"
                aria-expanded={showGuide}>
                <span className="flex items-center gap-2"><CircleHelp className="h-5 w-5 text-[#14635b]" aria-hidden /> How to explore</span>
                {showGuide ? <X className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showGuide && (
                <p className="mt-2 text-sm leading-relaxed text-[#52615c]">
                  Select any person to move through generations. Use search to jump to a relative, Back to return to the previous person, or Root to start again. Children are grouped by their recorded co-parents so different family branches stay distinct.
                </p>
              )}
            </div>
            <p className="px-2 text-xs leading-relaxed text-[#52615c]">
              Preview viewer · Your original tree and all family records remain unchanged.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

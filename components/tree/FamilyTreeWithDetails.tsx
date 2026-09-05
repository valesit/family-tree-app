'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Heart,
  Images,
  Loader2,
  MapPin,
  Pencil,
  User,
  Users,
} from 'lucide-react';
import type { PersonWithImage, PersonWithRelations, TreeNode as TreeNodeType } from '@/types';
import { FamilyTree as BaseFamilyTree } from './FamilyTree';
import { clsx } from 'clsx';

interface FamilyTreeProps {
  data: TreeNodeType | null;
  onNodeClick: (node: TreeNodeType) => void;
  onAddChild?: (parentId: string) => void;
  onAddSpouse?: (personId: string) => void;
  onAddParent?: (childId: string) => void;
  onViewBirthFamily?: (personId: string, maidenName?: string) => void;
  readOnly?: boolean;
}

type DetailTab = 'overview' | 'events' | 'stories' | 'photos';

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

export function FamilyTreeWithDetails(props: FamilyTreeProps) {
  const pathname = usePathname();
  const { status } = useSession();
  const useModernTreePanel = pathname === '/tree';
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [person, setPerson] = useState<PersonWithRelations | null>(null);
  const [loadingPerson, setLoadingPerson] = useState(false);

  const loadPerson = useCallback(async (personId: string) => {
    setLoadingPerson(true);
    try {
      const response = await fetch(`/api/persons/${encodeURIComponent(personId)}`, {
        cache: 'no-store',
      });
      const result = await response.json().catch(() => null);
      if (response.ok && result?.success) setPerson(result.data);
    } catch (error) {
      console.error('Could not load family member details:', error);
    } finally {
      setLoadingPerson(false);
    }
  }, []);

  useEffect(() => {
    if (!useModernTreePanel || !props.data?.id) return;
    void loadPerson(props.data.id);
  }, [useModernTreePanel, props.data?.id, loadPerson]);

  useEffect(() => {
    if (!useModernTreePanel) {
      setPortalHost(null);
      return;
    }

    const host = document.getElementById('tree-page-family-overview');
    if (!host) return;

    const legacyContent = host.firstElementChild as HTMLElement | null;
    const previousDisplay = legacyContent?.style.display ?? '';
    if (legacyContent) legacyContent.style.display = 'none';
    host.dataset.modernPersonPanel = 'true';
    setPortalHost(host);

    return () => {
      if (legacyContent) legacyContent.style.display = previousDisplay;
      delete host.dataset.modernPersonPanel;
      setPortalHost(null);
    };
  }, [useModernTreePanel]);

  const handleNodeClick = useCallback(
    (node: TreeNodeType) => {
      if (useModernTreePanel) {
        void loadPerson(node.id);
        return;
      }
      props.onNodeClick(node);
    },
    [useModernTreePanel, loadPerson, props]
  );

  return (
    <>
      <BaseFamilyTree {...props} onNodeClick={handleNodeClick} />
      {useModernTreePanel && portalHost
        ? createPortal(
            <TreePersonPanel
              person={person}
              loading={loadingPerson}
              rootPersonId={props.data?.id ?? null}
              canEdit={status === 'authenticated'}
              onSelectRelative={(id) => void loadPerson(id)}
            />,
            portalHost
          )
        : null}
    </>
  );
}

function TreePersonPanel({
  person,
  loading,
  rootPersonId,
  canEdit,
  onSelectRelative,
}: {
  person: PersonWithRelations | null;
  loading: boolean;
  rootPersonId: string | null;
  canEdit: boolean;
  onSelectRelative: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  useEffect(() => {
    setActiveTab('overview');
  }, [person?.id]);

  const relationships = useMemo(() => (person ? relationshipsFor(person) : []), [person]);

  if (loading && !person) {
    return (
      <div className="flex min-h-[360px] items-center justify-center bg-[#fffaf5]">
        <Loader2 className="h-7 w-7 animate-spin text-maroon-500" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="p-6 text-center text-sm leading-6 text-[#857870]">
        Select a family member in the tree to see their profile, relationships, life events and photos.
      </div>
    );
  }

  const years = personYears(person);
  const isRoot = person.id === rootPersonId;
  const birthDate = person.birthDate ? new Date(person.birthDate) : null;
  const deathDate = person.deathDate ? new Date(person.deathDate) : null;
  const photos = (person.images ?? []).filter((image) => image.url).slice(0, 8);

  return (
    <div className="flex min-h-full flex-col bg-[#fffaf5] text-[#352821]">
      <div className="relative border-b border-[#e7d9ce] bg-gradient-to-br from-[#fffdf9] via-[#fffaf5] to-[#f5e9df] px-5 pb-5 pt-5">
        <div className="flex items-start gap-4">
          {person.profileImage?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={person.profileImage.url}
              alt={`${person.firstName} ${person.lastName}`}
              className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-[#f0e4da] shadow-sm"
            />
          ) : (
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[#ede2d8] font-serif text-xl font-semibold text-[#785d50] ring-4 ring-[#f5ece4]">
              {person.firstName[0]}{person.lastName[0]}
            </div>
          )}
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="font-serif text-xl font-semibold leading-tight text-[#33251f]">
              {person.firstName} {person.lastName}
            </h2>
            {years && <p className="mt-1.5 text-xs text-[#8b7d74]">{years}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {isRoot && (
                <span className="inline-flex rounded-md bg-maroon-500 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.09em] text-white">
                  Root Person
                </span>
              )}
              <span className="inline-flex rounded-md border border-[#e2d5ca] bg-[#fffdf9] px-2 py-1 text-[9px] font-medium text-[#75645b]">
                {person.isLiving ? 'Living' : 'Deceased'}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/person/${person.id}`}
            className="inline-flex items-center rounded-lg bg-maroon-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-maroon-600"
          >
            View full profile
          </Link>
          {canEdit && (
            <Link
              href={`/person/${person.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#ddcfc3] bg-[#fffdf9] px-3 py-2 text-xs font-semibold text-[#6f4139] transition hover:bg-white"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          )}
        </div>
      </div>

      <div className="border-b border-[#e7d9ce] bg-[#f6ece3]/85 px-2">
        <div className="grid grid-cols-4">
          <DetailTabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>Overview</DetailTabButton>
          <DetailTabButton active={activeTab === 'events'} onClick={() => setActiveTab('events')}>Life Events</DetailTabButton>
          <DetailTabButton active={activeTab === 'stories'} onClick={() => setActiveTab('stories')}>Stories</DetailTabButton>
          <DetailTabButton active={activeTab === 'photos'} onClick={() => setActiveTab('photos')}>Photos</DetailTabButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {activeTab === 'overview' && (
          <>
            <section>
              <h3 className="font-serif text-base font-semibold text-[#3a2b24]">About</h3>
              <p className="mt-2 text-sm leading-6 text-[#756961]">
                {person.biography || `${person.firstName}'s biography has not been added yet.`}
              </p>
            </section>

            <section className="mt-5 border-t border-[#eaded4] pt-4">
              <h3 className="font-serif text-base font-semibold text-[#3a2b24]">Relationships</h3>
              {relationships.length > 0 ? (
                <div className="mt-2 divide-y divide-[#eaded4]">
                  {relationships.slice(0, 8).map((relationship) => (
                    <button
                      key={`${relationship.label}-${relationship.id}`}
                      type="button"
                      onClick={() => onSelectRelative(relationship.id)}
                      className="flex w-full items-center gap-3 rounded-lg py-2.5 text-left transition hover:bg-[#f8eee6]"
                    >
                      {relationship.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={relationship.image} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-[#f1e6dd]" />
                      ) : (
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eee3d9] text-[#846a5d]"><User className="h-4 w-4" /></span>
                      )}
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate font-serif text-sm font-medium text-[#49362e]">{relationship.name}</strong>
                        <span className="text-[10px] text-[#92857d]">{relationship.label}</span>
                      </span>
                      {relationship.label === 'Spouse' ? <Heart className="h-4 w-4 text-maroon-500" /> : <Users className="h-4 w-4 text-[#9e8b80]" />}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs leading-5 text-[#92857d]">No relationships are recorded yet.</p>
              )}
            </section>
          </>
        )}

        {activeTab === 'events' && (
          <section>
            <h3 className="font-serif text-base font-semibold text-[#3a2b24]">Life Events</h3>
            <div className="mt-3 space-y-3">
              {birthDate && !Number.isNaN(birthDate.getTime()) && (
                <EventRow icon={<CalendarDays className="h-4 w-4" />} title="Born" detail={birthDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} />
              )}
              {person.birthPlace && <EventRow icon={<MapPin className="h-4 w-4" />} title="Birthplace" detail={person.birthPlace} />}
              {person.occupation && <EventRow icon={<Briefcase className="h-4 w-4" />} title="Occupation" detail={person.occupation} />}
              {deathDate && !Number.isNaN(deathDate.getTime()) && (
                <EventRow icon={<CalendarDays className="h-4 w-4" />} title="Passed" detail={deathDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} />
              )}
              {person.deathPlace && <EventRow icon={<MapPin className="h-4 w-4" />} title="Place of passing" detail={person.deathPlace} />}
              {!birthDate && !person.birthPlace && !person.occupation && !deathDate && !person.deathPlace && (
                <p className="rounded-xl border border-[#eaded4] bg-[#f8f0e9] p-4 text-sm leading-6 text-[#7b6c63]">No life events have been recorded yet.</p>
              )}
            </div>
          </section>
        )}

        {activeTab === 'stories' && (
          <section>
            <h3 className="font-serif text-base font-semibold text-[#3a2b24]">Stories</h3>
            <div className="mt-3 rounded-xl border border-[#eaded4] bg-[#f8f0e9] p-4">
              <BookOpen className="h-5 w-5 text-[#9a6b56]" />
              <p className="mt-2 text-sm leading-6 text-[#756961]">Read and preserve family stories connected to {person.firstName}.</p>
              <Link href="/wiki" className="mt-3 inline-flex text-xs font-semibold text-maroon-600 hover:text-maroon-700">Browse family stories →</Link>
            </div>
          </section>
        )}

        {activeTab === 'photos' && (
          <section>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-serif text-base font-semibold text-[#3a2b24]">Photos</h3>
              <Images className="h-4 w-4 text-[#9a735f]" />
            </div>
            {photos.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {photos.map((photo) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={photo.id} src={photo.url} alt={photo.caption || `${person.firstName} family photo`} className="aspect-square w-full rounded-lg object-cover" />
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-[#dfd2c7] bg-[#faf4ee] p-5 text-center text-xs leading-5 text-[#8b7b72]">No photos have been added to this profile yet.</div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function DetailTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'border-b-2 px-1 py-3 text-[10px] font-medium transition',
        active ? 'border-maroon-500 text-maroon-700' : 'border-transparent text-[#8b7d74] hover:text-[#4f3c33]'
      )}
    >
      {children}
    </button>
  );
}

function EventRow({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#eaded4] bg-[#fffdf9] p-3">
      <span className="mt-0.5 text-[#9a6b56]">{icon}</span>
      <span className="min-w-0">
        <strong className="block text-xs font-semibold text-[#4b3930]">{title}</strong>
        <span className="mt-0.5 block text-xs leading-5 text-[#817269]">{detail}</span>
      </span>
    </div>
  );
}

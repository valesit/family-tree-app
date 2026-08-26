'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Heart,
  Loader2,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';

import { PersonForm } from '@/components/person';
import { Avatar, Card } from '@/components/ui';
import type { PersonInput } from '@/lib/validators';
import type { PersonWithRelations } from '@/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type RelationshipMode = 'child_of' | 'parent_of' | 'spouse_of';

type PersonChoice = {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string | null;
  birthDate?: string | Date | null;
  profileImage?: { url: string } | null;
};

type SuggestedParent = PersonChoice & {
  relationshipLabel: string;
  isCurrentSpouse: boolean;
};

function displayName(person: PersonChoice) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function yearOf(person: PersonChoice) {
  if (!person.birthDate) return null;
  const date = new Date(person.birthDate);
  return Number.isNaN(date.getTime()) ? null : date.getFullYear();
}

async function createRelationship(payload: {
  type: 'PARENT_CHILD' | 'SPOUSE';
  person1Id: string;
  person2Id: string;
}) {
  const response = await fetch('/api/relationships', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || 'Could not save the family relationship.');
  }
  return json as { success: true; familyRootId?: string | null };
}

function AddPersonContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const parentIdParam = searchParams.get('parentId');
  const spouseIdParam = searchParams.get('spouseId');
  const childIdParam = searchParams.get('childId');

  const initialMode: RelationshipMode = spouseIdParam
    ? 'spouse_of'
    : childIdParam
      ? 'parent_of'
      : 'child_of';
  const initialPersonId = parentIdParam || spouseIdParam || childIdParam || '';

  const [relationshipMode, setRelationshipMode] = useState<RelationshipMode>(initialMode);
  const [selectedPersonId, setSelectedPersonId] = useState(initialPersonId);
  const [search, setSearch] = useState('');
  const [secondParentId, setSecondParentId] = useState('');
  const [secondParentSearch, setSecondParentSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: personsData, isLoading: personsLoading } = useSWR<{
    success: boolean;
    data: { items: PersonWithRelations[] };
  }>('/api/persons?limit=500', fetcher, { revalidateOnFocus: true });

  const { data: prefillRes } = useSWR<{
    success: boolean;
    data: PersonWithRelations;
  }>(initialPersonId ? `/api/persons/${initialPersonId}` : null, fetcher, {
    revalidateOnFocus: false,
  });

  const prefillPerson = prefillRes?.success ? prefillRes.data : undefined;
  const allPersons = personsData?.data?.items ?? [];
  const isEmptyTree = !personsLoading && allPersons.length === 0;

  const selectedPerson =
    allPersons.find((person) => person.id === selectedPersonId) ??
    (prefillPerson?.id === selectedPersonId ? prefillPerson : undefined);

  const filteredPersons = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? allPersons.filter((person) =>
          `${person.firstName} ${person.lastName} ${person.nickname ?? ''}`
            .toLowerCase()
            .includes(q)
        )
      : allPersons.slice(0, 30);

    const pinned = selectedPerson;
    if (!pinned) return filtered.slice(0, 30);
    return [pinned, ...filtered.filter((person) => person.id !== pinned.id)].slice(0, 30);
  }, [allPersons, search, selectedPerson]);

  const spouseSuggestions = useMemo<SuggestedParent[]>(() => {
    if (relationshipMode !== 'child_of' || !selectedPerson) return [];

    const rows = [
      ...(selectedPerson.spouseRelations1 ?? []),
      ...(selectedPerson.spouseRelations2 ?? []),
    ]
      .filter((relation) => relation.type === 'SPOUSE')
      .map((relation) => {
        const candidate =
          relation.spouse1Id === selectedPerson.id ? relation.spouse2 : relation.spouse1;
        if (!candidate?.id) return null;
        return {
          ...(candidate as PersonChoice),
          relationshipLabel: relation.endDate ? 'Former spouse' : 'Spouse',
          isCurrentSpouse: !relation.endDate,
          startDate: relation.startDate ? new Date(relation.startDate).getTime() : 0,
        };
      })
      .filter(
        (row): row is SuggestedParent & { startDate: number } => Boolean(row)
      )
      .sort((a, b) => {
        if (a.isCurrentSpouse !== b.isCurrentSpouse) return a.isCurrentSpouse ? -1 : 1;
        return b.startDate - a.startDate;
      });

    const deduped = new Map<string, SuggestedParent>();
    for (const row of rows) {
      if (!deduped.has(row.id)) {
        const { startDate: _startDate, ...choice } = row;
        void _startDate;
        deduped.set(row.id, choice);
      }
    }
    return Array.from(deduped.values());
  }, [relationshipMode, selectedPerson]);

  const secondParent = useMemo<PersonChoice | undefined>(() => {
    if (!secondParentId) return undefined;
    const fromPeople = allPersons.find((person) => person.id === secondParentId);
    if (fromPeople) return fromPeople;
    return spouseSuggestions.find((person) => person.id === secondParentId);
  }, [allPersons, secondParentId, spouseSuggestions]);

  const secondParentMatches = useMemo(() => {
    const q = secondParentSearch.trim().toLowerCase();
    if (!q) return [];
    return allPersons
      .filter((person) => person.id !== selectedPersonId)
      .filter((person) =>
        `${person.firstName} ${person.lastName} ${person.nickname ?? ''}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 12);
  }, [allPersons, secondParentSearch, selectedPersonId]);

  useEffect(() => {
    if (!selectedPersonId && initialPersonId) setSelectedPersonId(initialPersonId);
  }, [initialPersonId, selectedPersonId]);

  // Parent 2 is always an explicit decision. Changing Parent 1 or relationship
  // mode clears the previous choice instead of silently carrying it over.
  useEffect(() => {
    setSecondParentId('');
    setSecondParentSearch('');
  }, [relationshipMode, selectedPersonId]);

  const handleSubmit = async (data: PersonInput, profileImage?: File) => {
    if (!isEmptyTree && !selectedPersonId) {
      setError('Choose the existing family member this person is related to before saving.');
      return;
    }
    if (relationshipMode === 'child_of' && secondParentId === selectedPersonId) {
      setError('Parent 1 and Parent 2 must be different people.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const personResponse = await fetch('/api/persons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          ...(selectedPersonId && !isEmptyTree
            ? { relatedPersonId: selectedPersonId }
            : {}),
        }),
      });
      const personJson = await personResponse.json().catch(() => ({}));
      if (!personResponse.ok || !personJson?.success) {
        throw new Error(personJson?.error || 'Could not save this person.');
      }

      const newPersonId = personJson.data?.id as string | undefined;
      if (!newPersonId) throw new Error('No id returned for the new person.');

      let canonicalRootId: string | null = null;

      if (selectedPersonId && !isEmptyTree) {
        if (relationshipMode === 'child_of') {
          const primaryResult = await createRelationship({
            type: 'PARENT_CHILD',
            person1Id: selectedPersonId,
            person2Id: newPersonId,
          });
          canonicalRootId = primaryResult.familyRootId ?? canonicalRootId;

          if (secondParentId) {
            const secondaryResult = await createRelationship({
              type: 'PARENT_CHILD',
              person1Id: secondParentId,
              person2Id: newPersonId,
            });
            canonicalRootId = secondaryResult.familyRootId ?? canonicalRootId;
          }
        } else if (relationshipMode === 'parent_of') {
          const result = await createRelationship({
            type: 'PARENT_CHILD',
            person1Id: newPersonId,
            person2Id: selectedPersonId,
          });
          canonicalRootId = result.familyRootId ?? canonicalRootId;
        } else {
          const result = await createRelationship({
            type: 'SPOUSE',
            person1Id: selectedPersonId,
            person2Id: newPersonId,
          });
          canonicalRootId = result.familyRootId ?? canonicalRootId;
        }
      }

      if (profileImage) {
        const imageFormData = new FormData();
        imageFormData.append('image', profileImage);
        imageFormData.append('personId', newPersonId);
        imageFormData.append('isProfile', 'true');

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: imageFormData,
        });
        const uploadJson = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok || !uploadJson?.success) {
          throw new Error(
            uploadJson?.error ||
              'The person was saved, but their profile photo could not be uploaded.'
          );
        }
      }

      router.push(canonicalRootId ? `/tree?rootId=${encodeURIComponent(canonicalRootId)}` : '/tree');
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Something went wrong while saving this person.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const pageTitle =
    relationshipMode === 'parent_of'
      ? 'Add a parent'
      : relationshipMode === 'spouse_of'
        ? 'Add a spouse'
        : 'Add a child';

  const relationshipExplainer =
    relationshipMode === 'parent_of'
      ? 'Choose the family member who will be this new person’s child.'
      : relationshipMode === 'spouse_of'
        ? 'Choose the family member who will be this new person’s spouse.'
        : 'Choose Parent 1, then explicitly decide whether the child also belongs to Parent 2.';

  return (
    <>
      <div className="mb-6 sm:mb-8">
        <Link
          href="/tree"
          className="mb-3 inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
          Back to tree
        </Link>
        <h1 className="font-serif text-2xl font-semibold text-slate-900 sm:text-3xl">
          {pageTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">
          {isEmptyTree
            ? 'This will be the first person in the family tree.'
            : 'Define the relationship first, then add the person’s details.'}
        </p>
      </div>

      {error && (
        <Card className="mb-5 border-rose-200 bg-rose-50">
          <div className="flex items-start gap-3 text-rose-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p className="text-sm">{error}</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
        {!isEmptyTree && (
          <div className="lg:order-1 lg:col-span-2">
            <Card className="border-2 border-maroon-100/60">
              <p className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
                Step 1
              </p>
              <h2 className="mt-0.5 flex items-center gap-2 font-semibold text-slate-900">
                <Users className="h-5 w-5 text-maroon-500" aria-hidden />
                Define the relationship
              </h2>
              <p className="mt-1 text-xs text-slate-500">{relationshipExplainer}</p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <ModeButton
                  active={relationshipMode === 'child_of'}
                  onClick={() => setRelationshipMode('child_of')}
                  icon={<ChevronDown className="h-4 w-4" aria-hidden />}
                  label="Child of…"
                />
                <ModeButton
                  active={relationshipMode === 'parent_of'}
                  onClick={() => setRelationshipMode('parent_of')}
                  icon={<ChevronUp className="h-4 w-4" aria-hidden />}
                  label="Parent of…"
                />
                <ModeButton
                  active={relationshipMode === 'spouse_of'}
                  onClick={() => setRelationshipMode('spouse_of')}
                  icon={<Heart className="h-4 w-4" aria-hidden />}
                  label="Spouse of…"
                />
              </div>

              <div className="mt-5 space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  {relationshipMode === 'child_of' && 'Parent 1'}
                  {relationshipMode === 'parent_of' && 'Child'}
                  {relationshipMode === 'spouse_of' && 'Spouse'}
                  <span className="ml-1 text-xs font-normal text-slate-400">Required</span>
                </label>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="search"
                    placeholder="Search family members…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20"
                  />
                </div>

                {personsLoading && filteredPersons.length === 0 ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-5 w-5 animate-spin text-maroon-500" aria-hidden />
                  </div>
                ) : (
                  <PersonChoiceList
                    people={filteredPersons}
                    selectedId={selectedPersonId}
                    onSelect={setSelectedPersonId}
                  />
                )}

                {selectedPerson && (
                  <SelectedPersonCard
                    person={selectedPerson}
                    label={
                      relationshipMode === 'child_of'
                        ? 'Parent 1'
                        : relationshipMode === 'parent_of'
                          ? 'Child'
                          : 'Spouse'
                    }
                  />
                )}
              </div>

              {relationshipMode === 'child_of' && selectedPerson && (
                <div className="mt-5 border-t border-slate-200 pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Parent 2</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Optional. Choose this only when the child belongs to another recorded parent as well.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Explicit
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <ParentOption
                      active={!secondParentId}
                      title="No second parent / not known"
                      subtitle={`Record this child as ${displayName(selectedPerson)}’s child only.`}
                      onClick={() => setSecondParentId('')}
                    />

                    {spouseSuggestions.map((spouse) => (
                      <ParentOption
                        key={spouse.id}
                        active={secondParentId === spouse.id}
                        title={displayName(spouse)}
                        subtitle={`${spouse.relationshipLabel} of ${displayName(selectedPerson)}${
                          spouse.isCurrentSpouse ? ' · suggested' : ''
                        }`}
                        person={spouse}
                        onClick={() => setSecondParentId(spouse.id)}
                      />
                    ))}
                  </div>

                  <div className="mt-4">
                    <label className="text-xs font-medium text-slate-600">
                      Or choose another existing family member
                    </label>
                    <input
                      type="search"
                      placeholder="Search for Parent 2…"
                      value={secondParentSearch}
                      onChange={(event) => setSecondParentSearch(event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20"
                    />
                    {secondParentSearch.trim() && (
                      <div className="mt-2">
                        <PersonChoiceList
                          people={secondParentMatches}
                          selectedId={secondParentId}
                          onSelect={(id) => {
                            setSecondParentId(id);
                            const match = allPersons.find((person) => person.id === id);
                            setSecondParentSearch(match ? displayName(match) : '');
                          }}
                          emptyText="No matching family member found."
                        />
                      </div>
                    )}
                  </div>

                  {secondParent &&
                    !spouseSuggestions.some((spouse) => spouse.id === secondParent.id) && (
                      <div className="mt-3">
                        <SelectedPersonCard person={secondParent} label="Parent 2" />
                      </div>
                    )}

                  <div className="mt-4 rounded-xl border border-maroon-200/70 bg-maroon-50/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-maroon-700">
                      Relationship that will be saved
                    </p>
                    <p className="mt-1.5 text-sm font-medium text-slate-900">
                      This child will be recorded as the child of{' '}
                      <span className="text-maroon-700">{displayName(selectedPerson)}</span>
                      {secondParent ? (
                        <>
                          {' '}and{' '}
                          <span className="text-maroon-700">{displayName(secondParent)}</span>.
                        </>
                      ) : (
                        ' only.'
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Marriage does not automatically make a spouse the child’s parent. Only the parent relationships selected here are saved.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        <div
          className={clsx(
            'lg:order-2',
            isEmptyTree ? 'lg:col-span-5' : 'lg:col-span-3'
          )}
        >
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
              {isEmptyTree ? 'New person' : 'Step 2'}
            </p>
            <h2 className="mt-0.5 flex items-center gap-2 font-semibold text-slate-900">
              <UserPlus className="h-5 w-5 text-maroon-500" aria-hidden />
              Their details
            </h2>
          </div>

          <PersonForm
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
            isLoading={isSubmitting}
            title="New family member"
            submitLabel={pageTitle.replace('Add ', 'Save ')}
          />

          {!isEmptyTree && !selectedPersonId && (
            <p className="mt-3 text-xs text-amber-700">
              Choose an existing family member in Step 1 before saving.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function PersonChoiceList({
  people,
  selectedId,
  onSelect,
  emptyText = 'No matches — try a different name.',
}: {
  people: PersonChoice[];
  selectedId: string;
  onSelect: (id: string) => void;
  emptyText?: string;
}) {
  if (people.length === 0) {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1">
      {people.map((person) => {
        const active = selectedId === person.id;
        const birthYear = yearOf(person);
        return (
          <li key={person.id}>
            <button
              type="button"
              onClick={() => onSelect(person.id)}
              aria-pressed={active}
              className={clsx(
                'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                active
                  ? 'bg-maroon-50 text-maroon-900 ring-1 ring-maroon-300'
                  : 'text-slate-700 hover:bg-slate-50'
              )}
            >
              <Avatar
                src={person.profileImage?.url}
                name={displayName(person)}
                size="sm"
              />
              <span className="min-w-0 flex-1 truncate">
                {displayName(person)}
                {birthYear && (
                  <span className="ml-1 text-xs text-slate-400">({birthYear})</span>
                )}
              </span>
              {active && <Check className="h-4 w-4 shrink-0 text-maroon-600" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SelectedPersonCard({ person, label }: { person: PersonChoice; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-maroon-50/60 p-3 ring-1 ring-maroon-200/70">
      <Avatar src={person.profileImage?.url} name={displayName(person)} size="md" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-maroon-700/80">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-slate-900">{displayName(person)}</p>
      </div>
    </div>
  );
}

function ParentOption({
  active,
  title,
  subtitle,
  person,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  person?: PersonChoice;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition',
        active
          ? 'border-maroon-400 bg-maroon-50 ring-1 ring-maroon-200'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      )}
    >
      {person ? (
        <Avatar src={person.profileImage?.url} name={displayName(person)} size="sm" />
      ) : (
        <span
          className={clsx(
            'grid h-8 w-8 shrink-0 place-items-center rounded-full border',
            active
              ? 'border-maroon-300 bg-white text-maroon-600'
              : 'border-slate-200 bg-slate-50 text-slate-400'
          )}
        >
          {active ? <Check className="h-4 w-4" /> : <Users className="h-4 w-4" />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{subtitle}</span>
      </span>
      {active && <Check className="h-4 w-4 shrink-0 text-maroon-600" />}
    </button>
  );
}

function ModeButton({
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
        'flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-2.5 text-center text-xs font-medium transition-all',
        active
          ? 'border-maroon-500 bg-maroon-50 text-maroon-900 shadow-sm'
          : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      )}
    >
      <span
        className={clsx(
          'flex h-7 w-7 items-center justify-center rounded-full',
          active ? 'bg-maroon-500 text-white' : 'bg-slate-100 text-slate-500'
        )}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

function AddPersonFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-7 w-7 animate-spin text-maroon-500" aria-hidden />
    </div>
  );
}

export default function AddPersonPage() {
  return (
    <main className="min-h-screen bg-slate-50 py-6 sm:py-8" aria-label="Add a family member">
      <div className="mx-auto max-w-5xl px-4">
        <Suspense fallback={<AddPersonFallback />}>
          <AddPersonContent />
        </Suspense>
      </div>
    </main>
  );
}

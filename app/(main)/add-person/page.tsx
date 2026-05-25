'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { PersonForm } from '@/components/person';
import { Card, Button, Avatar } from '@/components/ui';
import { PersonInput } from '@/lib/validators';
import { PersonWithRelations } from '@/types';
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  Users,
  UserPlus,
  Heart,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * Add-Person modes — one tree, contribution always anchors to someone existing.
 * The exception is the very first person in an empty database (handled below).
 */
type RelationshipMode = 'child_of' | 'parent_of' | 'spouse_of';

function AddPersonContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  /** Deep-link parameters set by the tree's "Add child/parent/spouse" buttons */
  const parentIdParam = searchParams.get('parentId');
  const spouseIdParam = searchParams.get('spouseId');
  const childIdParam = searchParams.get('childId');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Initial mode from deep-link, fallback to 'child_of' (most common). */
  const initialMode: RelationshipMode = spouseIdParam
    ? 'spouse_of'
    : childIdParam
    ? 'parent_of'
    : 'child_of';
  const initialPersonId = parentIdParam || spouseIdParam || childIdParam || '';

  const [relationshipMode, setRelationshipMode] = useState<RelationshipMode>(initialMode);
  const [selectedPersonId, setSelectedPersonId] = useState<string>(initialPersonId);
  /** Free-text search for the related person; saves the user from a 500-row dropdown. */
  const [search, setSearch] = useState('');

  // Load all persons for the relationship picker
  const { data: personsData, isLoading: personsLoading } = useSWR<{
    success: boolean;
    data: { items: PersonWithRelations[] };
  }>('/api/persons?limit=500', fetcher);

  const allPersons = personsData?.data?.items || [];
  const isEmptyTree = !personsLoading && allPersons.length === 0;

  /** Filter the list as the user types. */
  const filteredPersons = useMemo(() => {
    if (!search.trim()) return allPersons.slice(0, 30);
    const q = search.trim().toLowerCase();
    return allPersons
      .filter((p) => {
        const name = `${p.firstName} ${p.lastName} ${p.nickname ?? ''}`.toLowerCase();
        return name.includes(q);
      })
      .slice(0, 30);
  }, [allPersons, search]);

  const selectedPerson = allPersons.find((p) => p.id === selectedPersonId);

  // If deep-link points at a person who hasn't loaded yet, prefill once loaded.
  useEffect(() => {
    if (!selectedPersonId && initialPersonId) {
      setSelectedPersonId(initialPersonId);
    }
  }, [initialPersonId, selectedPersonId]);

  const handleSubmit = async (data: PersonInput, profileImage?: File) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create the person. Pass relatedPersonId so the API can find the right family tree.
      const personRes = await fetch('/api/persons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          ...(selectedPersonId && !isEmptyTree
            ? { relatedPersonId: selectedPersonId }
            : {}),
        }),
      });
      const personJson = await personRes.json();
      if (!personJson.success) {
        throw new Error(personJson.error || 'Could not save this person.');
      }
      const newPersonId: string = personJson.data?.id;
      if (!newPersonId) throw new Error('No id returned for new person.');

      // 2. Create the relationship if we anchored to someone (we always do unless empty tree).
      if (selectedPersonId && !isEmptyTree) {
        let relPayload:
          | { type: 'PARENT_CHILD'; person1Id: string; person2Id: string }
          | { type: 'SPOUSE'; person1Id: string; person2Id: string }
          | null = null;

        if (relationshipMode === 'child_of') {
          // New person is a child of selectedPersonId
          relPayload = {
            type: 'PARENT_CHILD',
            person1Id: selectedPersonId, // parent
            person2Id: newPersonId,       // child (new)
          };
        } else if (relationshipMode === 'parent_of') {
          // New person is a parent of selectedPersonId
          relPayload = {
            type: 'PARENT_CHILD',
            person1Id: newPersonId,       // parent (new)
            person2Id: selectedPersonId,  // child
          };
        } else if (relationshipMode === 'spouse_of') {
          relPayload = {
            type: 'SPOUSE',
            person1Id: selectedPersonId,
            person2Id: newPersonId,
          };
        }

        if (relPayload) {
          const relRes = await fetch('/api/relationships', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(relPayload),
          });
          const relJson = await relRes.json();
          if (!relJson.success) {
            // We don't roll back the person — non-fatal, surface the message.
            throw new Error(
              relJson.error ||
                'Person was saved but the family link did not. You can add the relationship from the tree.'
            );
          }
        }
      }

      // 3. Optional profile image upload
      if (profileImage) {
        const fd = new FormData();
        fd.append('image', profileImage);
        fd.append('personId', newPersonId);
        await fetch('/api/upload', { method: 'POST', body: fd });
      }

      router.push('/tree');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
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
      ? 'The new person will be added as a parent of the family member you pick below.'
      : relationshipMode === 'spouse_of'
      ? 'The new person will be married to the family member you pick below.'
      : 'The new person will be added as a child of the family member you pick below.';

  // Friendly message for the very first person in a brand-new tree
  const firstPersonHint = isEmptyTree
    ? "This will be the first person in your family tree — you don't need to link them to anyone yet."
    : null;

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
          {firstPersonHint ?? 'Two quick steps: pick how this person fits, then fill in their details.'}
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
        {/* Step 1 — Relationship picker */}
        {!isEmptyTree && (
          <div className="lg:col-span-2 lg:order-1">
            <Card className="border-2 border-maroon-100/60">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-maroon-700/80">
                  Step 1
                </p>
                <h2 className="mt-0.5 flex items-center gap-2 font-semibold text-slate-900">
                  <Users className="h-5 w-5 text-maroon-500" aria-hidden />
                  Who are they to the family?
                </h2>
                <p className="mt-1 text-xs text-slate-500">{relationshipExplainer}</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
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

              {/* Existing-person picker with type-ahead */}
              <div className="mt-5 space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  {relationshipMode === 'child_of' && 'Select the parent'}
                  {relationshipMode === 'parent_of' && 'Select the child'}
                  {relationshipMode === 'spouse_of' && 'Select the spouse'}
                </label>
                <input
                  type="search"
                  inputMode="search"
                  placeholder="Search by name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500"
                  aria-label="Search family members"
                />

                {personsLoading ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-5 w-5 animate-spin text-maroon-500" aria-hidden />
                  </div>
                ) : filteredPersons.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    No matches — try a different name.
                  </p>
                ) : (
                  <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1">
                    {filteredPersons.map((p) => {
                      const isActive = selectedPersonId === p.id;
                      const year = p.birthDate
                        ? new Date(p.birthDate).getFullYear()
                        : null;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedPersonId(p.id)}
                            aria-pressed={isActive}
                            className={clsx(
                              'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                              isActive
                                ? 'bg-maroon-50 text-maroon-900 ring-1 ring-maroon-300'
                                : 'text-slate-700 hover:bg-slate-50'
                            )}
                          >
                            <Avatar
                              src={p.profileImage?.url}
                              name={`${p.firstName} ${p.lastName}`}
                              size="sm"
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {p.firstName} {p.lastName}
                              {year && (
                                <span className="ml-1 text-xs text-slate-400">({year})</span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {selectedPerson && (
                  <div className="flex items-center gap-3 rounded-lg bg-maroon-50/60 p-3 ring-1 ring-maroon-200/70">
                    <Avatar
                      src={selectedPerson.profileImage?.url}
                      name={`${selectedPerson.firstName} ${selectedPerson.lastName}`}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {selectedPerson.firstName} {selectedPerson.lastName}
                      </p>
                      <p className="text-xs text-slate-600">
                        {relationshipMode === 'child_of' && 'Will be the new person\u2019s parent'}
                        {relationshipMode === 'parent_of' && 'Will be the new person\u2019s child'}
                        {relationshipMode === 'spouse_of' && 'Will be the new person\u2019s spouse'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Step 2 — Person details form */}
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
            onSubmit={(data, image) => handleSubmit(data, image)}
            onCancel={() => router.back()}
            isLoading={isSubmitting}
            title="New family member"
            submitLabel={pageTitle.replace('Add ', 'Save ')}
          />

          {!isEmptyTree && !selectedPersonId && (
            <p className="mt-3 text-xs text-amber-700">
              Pick an existing family member above before saving — every new person needs to fit into the tree.
            </p>
          )}
        </div>
      </div>
    </>
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

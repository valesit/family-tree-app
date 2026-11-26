'use client';

import type { TreeNode } from '@/types';
import { Avatar } from '@/components/ui';
import { ArrowLeft, ArrowUpRight, GitBranch, Users } from 'lucide-react';
import { collectAncestorGenerations } from './spouse-ancestry';

interface SpouseAncestryPanelProps {
  person: TreeNode;
  onBack: () => void;
  onPersonClick: (personId: string) => void;
  onShowAllConnections: () => void;
}

function generationLabel(depth: number): string {
  if (depth === 1) return 'Parents';
  if (depth === 2) return 'Grandparents';
  if (depth === 3) return 'Great-grandparents';
  return `${depth} generations back`;
}

function FamilyMember({
  person,
  onPersonClick,
  current = false,
}: {
  person: TreeNode;
  onPersonClick: (personId: string) => void;
  current?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onPersonClick(person.id)}
      className="group flex w-full min-w-0 items-center gap-3 rounded-xl border border-[#d7e5de] bg-white p-3 text-left shadow-[0_6px_20px_-17px_rgba(20,86,79,.45)] transition hover:border-[#14635b] hover:bg-[#f8fcfa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14635b]"
      aria-label={`Open ${person.firstName} ${person.lastName}'s profile`}
    >
      <Avatar src={person.profileImage} name={person.name} size="md" className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-base font-semibold text-[#651a1a] group-hover:underline">
          {person.firstName} {person.lastName}
        </span>
        {(person.attributes?.birthYear || person.attributes?.deathYear) && (
          <span className="block text-xs text-[#52615c]">
            {person.attributes?.birthYear || '?'}{person.attributes?.deathYear ? ` – ${person.attributes.deathYear}` : ' –'}
          </span>
        )}
        {current && <span className="mt-1 block text-[11px] font-medium text-[#14564f]">Connected through marriage</span>}
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-[#14635b]" aria-hidden />
    </button>
  );
}

/**
 * A separate read-only ancestry explorer. Opening a profile invokes the
 * existing tree-page modal, where signed-in users can edit as before.
 */
export function SpouseAncestryPanel({
  person,
  onBack,
  onPersonClick,
  onShowAllConnections,
}: SpouseAncestryPanelProps) {
  const generations = collectAncestorGenerations(person);

  return (
    <section className="flex h-full min-h-0 flex-col bg-white" aria-label={`${person.lastName} family ancestry`}>
      <div className="shrink-0 border-b border-[#d6e5de] px-4 py-4 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-sm font-semibold text-[#14564f] transition hover:text-[#651a1a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14635b]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Primary Tree
        </button>
        <h2 className="mt-2 font-serif text-xl font-medium leading-tight text-[#651a1a]">
          {person.lastName} Family Ancestry
        </h2>
        <p className="mt-1 text-xs leading-5 text-[#52615c]">
          Explore the known ancestors of {person.firstName} {person.lastName}.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
        {generations.length > 0 ? (
          <div className="space-y-4">
            {generations.map(({ depth, people }) => (
              <div key={depth}>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#14564f]">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  {generationLabel(depth)}
                </h3>
                <div className="space-y-2 border-l-2 border-[#d5e6dd] pl-3">
                  {people.map((ancestor) => (
                    <FamilyMember
                      key={ancestor.id}
                      person={ancestor}
                      onPersonClick={onPersonClick}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-center py-0.5" aria-hidden>
              <div className="h-5 w-px bg-[#9bbeb0]" />
            </div>
          </div>
        ) : (
          <p className="rounded-lg bg-[#f1f7f4] p-4 text-sm text-[#52615c]">
            No older ancestors are currently recorded for this person.
          </p>
        )}

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#14564f]">
            Connected family member
          </h3>
          <FamilyMember person={person} onPersonClick={onPersonClick} current />
        </div>

        <button
          type="button"
          onClick={onShowAllConnections}
          className="mt-6 inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-lg border border-[#b5d6c8] bg-[#e7f3ef] px-3 py-2 text-sm font-semibold text-[#14564f] transition hover:bg-[#d8ebe2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14635b]"
        >
          <GitBranch className="h-4 w-4" aria-hidden />
          Show all connections on tree
        </button>
        <p className="mt-2 text-center text-xs leading-5 text-[#52615c]">
          The primary tree keeps extended in-law ancestry collapsed.
        </p>
      </div>
    </section>
  );
}

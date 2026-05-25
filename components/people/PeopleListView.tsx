'use client';

import { useMemo, useState } from 'react';
import { Avatar } from '@/components/ui';
import { ArrowUpDown, Search } from 'lucide-react';
import { clsx } from 'clsx';
import type { PersonFlat } from '@/lib/tree-utils';
import { buildRelationLines } from '@/lib/tree-utils';

export type PersonExtras = {
  birthPlace?: string | null;
  occupation?: string | null;
};

interface PeopleListViewProps {
  people: PersonFlat[];
  /** Map of personId -> extra fields not present in PersonFlat (birthPlace, occupation). */
  extras: Map<string, PersonExtras>;
  onPersonClick?: (personId: string) => void;
}

type SortKey = 'name' | 'lifespan' | 'generation';
type SortDir = 'asc' | 'desc';

function formatLifespan(p: PersonFlat): string {
  if (p.birthYear && p.deathYear) return `${p.birthYear} – ${p.deathYear}`;
  if (p.birthYear && p.isLiving) return `b. ${p.birthYear}`;
  if (p.birthYear) return `${p.birthYear}`;
  if (p.deathYear) return `d. ${p.deathYear}`;
  return p.isLiving ? 'Living' : '—';
}

export function PeopleListView({ people, extras, onPersonClick }: PeopleListViewProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = !q
      ? people
      : people.filter((p) => {
          const hay = [
            p.firstName,
            p.lastName,
            p.maidenName ?? '',
            extras.get(p.id)?.occupation ?? '',
            extras.get(p.id)?.birthPlace ?? '',
          ]
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        });

    const sorted = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);
      } else if (sortKey === 'lifespan') {
        const ay = a.birthYear ?? Infinity;
        const by = b.birthYear ?? Infinity;
        cmp = ay - by;
      } else {
        cmp = a.generation - b.generation;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [people, search, sortKey, sortDir, extras]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Search header */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            inputMode="search"
            placeholder="Search by name, place, or occupation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-maroon-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-maroon-500"
            aria-label="Search family list"
          />
        </div>
        <p className="text-xs text-slate-500">
          Showing {filtered.length} of {people.length}
        </p>
      </div>

      {/* Table (desktop) / Cards (mobile) */}
      <div className="min-h-0 flex-1 overflow-auto bg-slate-50 px-3 py-4 sm:px-6">
        {/* Desktop table */}
        <table className="hidden w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:table">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-16 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Photo
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <SortButton active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')}>
                  Last, First name
                </SortButton>
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <SortButton active={sortKey === 'lifespan'} dir={sortDir} onClick={() => toggleSort('lifespan')}>
                  Lifespan
                </SortButton>
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Birthplace
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Relations
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Occupation
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((p) => {
              const ex = extras.get(p.id);
              const lines = buildRelationLines(p);
              return (
                <tr
                  key={p.id}
                  className={clsx(
                    'hover:bg-slate-50 transition-colors',
                    onPersonClick && 'cursor-pointer'
                  )}
                  onClick={() => onPersonClick?.(p.id)}
                >
                  <td className="px-3 py-3">
                    <Avatar src={p.profileImage} name={`${p.firstName} ${p.lastName}`} size="md" />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPersonClick?.(p.id);
                      }}
                      className="text-left font-medium text-maroon-700 hover:underline"
                    >
                      {p.lastName}, {p.firstName}
                    </button>
                    {p.maidenName && (
                      <p className="text-xs text-slate-500">née {p.maidenName}</p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm text-slate-700">{formatLifespan(p)}</td>
                  <td className="px-3 py-3 text-sm text-slate-700">{ex?.birthPlace ?? '—'}</td>
                  <td className="px-3 py-3 text-sm text-slate-700">
                    {lines.length > 0 ? (
                      <ul className="space-y-0.5">
                        {lines.map((l, i) => (
                          <li key={i} className="text-xs">
                            {l}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm text-slate-700">{ex?.occupation ?? '—'}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                  No people match that search.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Mobile stacked cards */}
        <ul className="space-y-2 sm:hidden">
          {filtered.map((p) => {
            const ex = extras.get(p.id);
            const lines = buildRelationLines(p);
            return (
              <li
                key={p.id}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                onClick={() => onPersonClick?.(p.id)}
              >
                <div className="flex items-start gap-3">
                  <Avatar src={p.profileImage} name={`${p.firstName} ${p.lastName}`} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {p.lastName}, {p.firstName}
                    </p>
                    {p.maidenName && (
                      <p className="text-xs text-slate-500">née {p.maidenName}</p>
                    )}
                    <p className="text-xs text-slate-600">{formatLifespan(p)}</p>
                    {ex?.birthPlace && (
                      <p className="text-xs text-slate-500">{ex.birthPlace}</p>
                    )}
                    {ex?.occupation && (
                      <p className="text-xs text-slate-500">{ex.occupation}</p>
                    )}
                    {lines.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                        {lines.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              No people match that search.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function SortButton({
  active,
  dir,
  onClick,
  children,
}: {
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors',
        active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
      )}
    >
      {children}
      <ArrowUpDown
        className={clsx('h-3 w-3', active ? 'opacity-100' : 'opacity-40')}
        style={{ transform: active && dir === 'desc' ? 'rotate(180deg)' : undefined }}
        aria-hidden
      />
    </button>
  );
}

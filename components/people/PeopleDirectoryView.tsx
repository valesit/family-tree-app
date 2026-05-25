'use client';

import { useMemo, useState } from 'react';
import { Avatar } from '@/components/ui';
import { Search, MapPin, Briefcase } from 'lucide-react';
import { clsx } from 'clsx';
import type { PersonFlat } from '@/lib/tree-utils';
import { buildRelationLines } from '@/lib/tree-utils';
import type { PersonExtras } from './PeopleListView';

type GroupBy = 'name' | 'generation' | 'surname';

interface PeopleDirectoryViewProps {
  people: PersonFlat[];
  extras: Map<string, PersonExtras>;
  onPersonClick?: (personId: string) => void;
}

function formatLifespan(p: PersonFlat): string {
  if (p.birthYear && p.deathYear) return `${p.birthYear} – ${p.deathYear}`;
  if (p.birthYear && p.isLiving) return `b. ${p.birthYear}`;
  if (p.birthYear) return `${p.birthYear}`;
  if (p.deathYear) return `d. ${p.deathYear}`;
  return p.isLiving ? 'Living' : '';
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function PeopleDirectoryView({ people, extras, onPersonClick }: PeopleDirectoryViewProps) {
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('surname');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => {
      const hay = [p.firstName, p.lastName, p.maidenName ?? '']
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [people, search]);

  const groups = useMemo(() => {
    const map = new Map<string, PersonFlat[]>();
    const sortable = [...filtered];

    if (groupBy === 'name') {
      sortable.sort((a, b) => a.firstName.localeCompare(b.firstName));
      for (const p of sortable) {
        const key = (p.firstName[0] ?? '').toUpperCase() || '?';
        const list = map.get(key) ?? [];
        list.push(p);
        map.set(key, list);
      }
      return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    }

    if (groupBy === 'surname') {
      sortable.sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName)
      );
      for (const p of sortable) {
        const key = p.lastName || '—';
        const list = map.get(key) ?? [];
        list.push(p);
        map.set(key, list);
      }
      return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    }

    // generation
    sortable.sort((a, b) => {
      if (a.generation !== b.generation) return a.generation - b.generation;
      return (
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName)
      );
    });
    for (const p of sortable) {
      const key = `${ordinal(p.generation + 1)} generation`;
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    // Already inserted in generation order due to sort.
    return Array.from(map.entries());
  }, [filtered, groupBy]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Search + Group by header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            inputMode="search"
            placeholder="Search Directory…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-maroon-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-maroon-500"
            aria-label="Search directory"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500" htmlFor="dir-groupby">
            Group by
          </label>
          <select
            id="dir-groupby"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500"
          >
            <option value="surname">Surname</option>
            <option value="name">Name</option>
            <option value="generation">Generation</option>
          </select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-slate-50 px-3 py-4 sm:px-6">
        {groups.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No people match that search.
          </p>
        )}

        <div className="space-y-6">
          {groups.map(([label, items]) => (
            <section key={label} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <header className="bg-slate-50 px-4 py-2 text-sm font-semibold text-maroon-700">
                {label}
              </header>
              <ul className="divide-y divide-slate-100">
                {items.map((p) => {
                  const ex = extras.get(p.id);
                  const lines = buildRelationLines(p);
                  const lifespan = formatLifespan(p);
                  return (
                    <li
                      key={p.id}
                      className={clsx(
                        'flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-start sm:gap-5',
                        onPersonClick && 'cursor-pointer hover:bg-slate-50'
                      )}
                      onClick={() => onPersonClick?.(p.id)}
                    >
                      <Avatar
                        src={p.profileImage}
                        name={`${p.firstName} ${p.lastName}`}
                        size="lg"
                        className="shrink-0"
                      />
                      <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-3">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPersonClick?.(p.id);
                            }}
                            className="text-base font-semibold text-maroon-700 hover:underline"
                          >
                            {p.firstName} {p.lastName}
                          </button>
                          {p.maidenName && (
                            <p className="text-xs text-slate-500">née {p.maidenName}</p>
                          )}
                          {ex?.occupation && (
                            <p className="text-sm text-slate-600">{ex.occupation}</p>
                          )}
                          <p className="text-xs text-slate-500">
                            {p.isLiving ? 'Living' : 'Deceased'}
                            {lifespan && <> · {lifespan}</>}
                          </p>
                        </div>

                        <div className="min-w-0 space-y-1 text-sm text-slate-600">
                          {ex?.birthPlace && (
                            <p className="flex items-start gap-1.5">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                              <span className="min-w-0 truncate">{ex.birthPlace}</span>
                            </p>
                          )}
                          {ex?.occupation && (
                            <p className="flex items-start gap-1.5 sm:hidden">
                              <Briefcase className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                              <span className="min-w-0 truncate">{ex.occupation}</span>
                            </p>
                          )}
                        </div>

                        <div className="min-w-0 space-y-0.5 text-sm text-slate-600">
                          {lines.map((l, i) => (
                            <p key={i} className="text-xs">{l}</p>
                          ))}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

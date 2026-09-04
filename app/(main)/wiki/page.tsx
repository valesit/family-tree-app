'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import Link from 'next/link';
import { format } from 'date-fns';
import { Avatar } from '@/components/ui';
import { WikiArticleWithAuthor, SessionUser } from '@/types';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  Eye,
  Heart,
  History,
  Loader2,
  MessageSquare,
  PenLine,
  Search,
  Sparkles,
  Tag,
  Users,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const HERITAGE_ACACIA_IMAGE =
  'https://images.unsplash.com/photo-1759767119537-3ea0e5ff75de?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=82&w=2200';

export default function WikiPage() {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const user = session?.user as SessionUser | undefined;
  const isAuthenticated = !!user;

  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.set('search', searchQuery);
  if (selectedTag) queryParams.set('tag', selectedTag);

  const { data, error, isLoading } = useSWR<{
    success: boolean;
    data: {
      items: WikiArticleWithAuthor[];
      total: number;
      totalPages: number;
    };
  }>(`/api/wiki?${queryParams.toString()}`, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const { data: archiveData } = useSWR<{
    success: boolean;
    data: { items: WikiArticleWithAuthor[] };
  }>('/api/wiki?limit=50', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const archiveArticles = archiveData?.data?.items ?? [];
  const articles = data?.data?.items ?? [];

  const popularTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const article of archiveArticles) {
      for (const tag of article.tags ?? []) {
        if (!tag) continue;
        counts.set(tag.name, (counts.get(tag.name) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [archiveArticles]);

  const contributorRows = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      image: string | null;
      count: number;
      latest: string;
    }>();

    for (const article of archiveArticles) {
      const existing = map.get(article.author.id);
      const createdAt = String(article.createdAt);
      if (!existing) {
        map.set(article.author.id, {
          id: article.author.id,
          name: article.author.name || 'Family member',
          image: article.author.image || null,
          count: 1,
          latest: createdAt,
        });
        continue;
      }
      existing.count += 1;
      if (new Date(createdAt) > new Date(existing.latest)) existing.latest = createdAt;
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 4);
  }, [archiveArticles]);

  const featuredArticle = useMemo(() => {
    if (archiveArticles.length === 0) return null;
    return [...archiveArticles].sort((a, b) => {
      const coverDelta = Number(Boolean(b.coverImage)) - Number(Boolean(a.coverImage));
      if (coverDelta !== 0) return coverDelta;
      return (b.viewCount ?? 0) - (a.viewCount ?? 0);
    })[0];
  }, [archiveArticles]);

  const recentActivity = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return archiveArticles.filter((article) => new Date(article.createdAt).getTime() >= cutoff).length;
  }, [archiveArticles]);

  const displayedArticles = articles.filter((article) => article.id !== featuredArticle?.id);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#fbf9f5]">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-9 w-9 animate-spin text-maroon-500" />
          <p className="text-sm text-[#7e6e65]">Opening the family archive…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#fbf9f5]">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-rose-500" />
          <p className="text-[#75655d]">Failed to load family stories</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbf9f5] text-[#342722]">
      <section className="relative overflow-hidden border-b border-[#eadfd6] bg-[#fbf8f3]">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[57%] lg:block" aria-hidden>
          <div
            className="absolute inset-0 bg-cover bg-center opacity-[0.43] mix-blend-multiply"
            style={{
              backgroundImage: `url('${HERITAGE_ACACIA_IMAGE}')`,
              filter: 'sepia(0.38) saturate(0.55) contrast(0.88) brightness(1.08)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,.26) 24%, black 52%, black 100%)',
              maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,.26) 24%, black 52%, black 100%)',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#fbf8f3] via-[#fbf8f3]/55 to-[#ead8c8]/10" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#fbf8f3] to-transparent" />
        </div>

        <div className="relative mx-auto max-w-[1440px] px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
          <div className="relative z-10 max-w-3xl">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8b4b3e] sm:text-xs">
              <span className="h-px w-5 bg-[#9b5b4b]" />
              Family heritage
            </p>
            <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-[#34251f] sm:text-5xl lg:text-6xl">
              Family Wiki
            </h1>
            <p className="mt-3 max-w-2xl font-serif text-base leading-7 text-[#75635a] sm:text-lg">
              Discover and share stories, traditions, and history about our family. Preserve the details that make each generation memorable.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full max-w-xl">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9d887d]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search family stories…"
                  className="h-12 w-full rounded-xl border border-[#dfd1c5] bg-[#fffdf9]/90 pl-11 pr-4 text-sm text-[#44342d] shadow-sm outline-none transition focus:border-[#a87865] focus:ring-2 focus-[#a87865]/15"
                />
              </div>
              {isAuthenticated && (
                <Link
                  href="/wiki/new"
                  className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-maroon-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-maroon-600"
                >
                  <PenLine className="h-4 w-4" />
                  Write Article
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<BookOpen className="h-5 w-5" />} label="Total articles" value={data?.data?.total ?? 0} detail="Published stories" />
          <StatCard icon={<Tag className="h-5 w-5" />} label="Topics" value={popularTags.length} detail="Active categories" />
          <StatCard icon={<Users className="h-5 w-5" />} label="Contributors" value={contributorRows.length} detail="Family storytellers" />
          <StatCard icon={<Clock3 className="h-5 w-5" />} label="Recent activity" value={recentActivity} detail="Articles this month" />
        </section>

        {(selectedTag || searchQuery) && (
          <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-[#eadfd6] bg-[#fffdf9] px-4 py-3 text-sm text-[#7a6960]">
            <span>Filtering archive:</span>
            {selectedTag && <span className="rounded-full bg-[#f1e5dd] px-2.5 py-1 font-medium text-[#7a3732]">{selectedTag}</span>}
            {searchQuery && <span className="rounded-full bg-[#f6efe9] px-2.5 py-1">“{searchQuery}”</span>}
            <button
              type="button"
              onClick={() => {
                setSelectedTag(null);
                setSearchQuery('');
              }}
              className="ml-auto text-xs font-semibold text-maroon-600 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(290px,.8fr)]">
          <div className="space-y-6">
            {!searchQuery && !selectedTag && featuredArticle && (
              <Link
                href={`/wiki/${featuredArticle.slug}`}
                className="group grid overflow-hidden rounded-2xl border border-[#dfd2c6] bg-[#fffdf9] shadow-[0_14px_35px_-28px_rgba(75,46,33,.5)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_-26px_rgba(75,46,33,.55)] md:grid-cols-[260px_minmax(0,1fr)]"
              >
                <div className="relative min-h-[220px] overflow-hidden bg-[#eee4dc]">
                  {featuredArticle.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={featuredArticle.coverImage}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#ead9c9] to-[#f8f1ea]">
                      <History className="h-14 w-14 text-[#9a6b57]/45" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-center p-6 sm:p-7">
                  <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-[#ead7c8] bg-[#fbf3ec] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a5142]">
                    <Sparkles className="h-3 w-3" /> Featured story
                  </span>
                  <h2 className="font-serif text-2xl font-semibold text-[#382a24] transition group-hover:text-maroon-600 sm:text-3xl">
                    {featuredArticle.title}
                  </h2>
                  {featuredArticle.excerpt && (
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#77675f]">{featuredArticle.excerpt}</p>
                  )}
                  <ArticleMeta article={featuredArticle} />
                </div>
              </Link>
            )}

            <section className="rounded-2xl border border-[#e3d7cd] bg-[#fffdf9] p-4 sm:p-5">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9a735f]">The archive</p>
                  <h2 className="mt-1 font-serif text-2xl font-semibold text-[#382a24]">
                    {searchQuery || selectedTag ? 'Matching stories' : 'Recent articles'}
                  </h2>
                </div>
                <span className="text-xs text-[#9a8980]">{articles.length} shown</span>
              </div>

              {articles.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#dfd3c9] bg-[#fbf8f4] px-6 py-12 text-center">
                  <BookOpen className="mx-auto h-10 w-10 text-[#c2afa3]" />
                  <h3 className="mt-3 font-serif text-lg font-semibold text-[#5d4a41]">
                    {searchQuery || selectedTag ? 'No matching stories' : 'No stories yet'}
                  </h3>
                  <p className="mt-1 text-sm text-[#8c7b72]">
                    {searchQuery || selectedTag ? 'Try another search or topic.' : 'Start preserving a family memory.'}
                  </p>
                </div>
              ) : displayedArticles.length === 0 && featuredArticle ? (
                <ArchiveArticleCard article={featuredArticle} />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {displayedArticles.map((article) => (
                    <ArchiveArticleCard key={article.id} article={article} />
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-[#e3d7cd] bg-[#fffdf9] p-5">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-[#8d5848]" />
                <h2 className="font-serif text-lg font-semibold text-[#382a24]">Browse by topic</h2>
              </div>
              {popularTags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {popularTags.slice(0, 10).map(({ name, count }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedTag(selectedTag === name ? null : name)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${selectedTag === name ? 'border-maroon-400 bg-maroon-50 text-maroon-700' : 'border-[#e7dbd1] bg-[#fdfaf7] text-[#765f54] hover:border-[#ceb8aa] hover:bg-white'}`}
                    >
                      {name} <span className="ml-1 text-[#aa978c]">{count}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[#8c7b72]">Topics will appear as stories are tagged.</p>
              )}
              {selectedTag && (
                <button type="button" onClick={() => setSelectedTag(null)} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-maroon-600 hover:underline">
                  View all topics <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </section>

            <section className="rounded-2xl border border-[#e3d7cd] bg-[#fffdf9] p-5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#8d5848]" />
                <h2 className="font-serif text-lg font-semibold text-[#382a24]">Top contributors</h2>
              </div>
              {contributorRows.length > 0 ? (
                <div className="mt-4 divide-y divide-[#eee4dc]">
                  {contributorRows.map((contributor) => (
                    <div key={contributor.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <Avatar src={contributor.image} name={contributor.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#4d3a32]">{contributor.name}</p>
                        <p className="text-xs text-[#99877d]">{contributor.count} {contributor.count === 1 ? 'article' : 'articles'}</p>
                      </div>
                      <span className="text-[10px] text-[#ae9d93]">{format(new Date(contributor.latest), 'MMM yyyy')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[#8c7b72]">Contributors will appear here.</p>
              )}
            </section>

            {!isAuthenticated && (
              <section className="rounded-2xl border border-[#e1cfc2] bg-gradient-to-br from-[#f7ece5] to-[#fffaf6] p-5">
                <Heart className="h-5 w-5 text-maroon-500" />
                <h2 className="mt-3 font-serif text-xl font-semibold text-[#49352d]">Preserve a family story</h2>
                <p className="mt-2 text-sm leading-6 text-[#806e64]">Sign in to document memories, traditions, and family history for future generations.</p>
                <Link href="/login?callbackUrl=/wiki/new" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-maroon-600 hover:underline">
                  Sign in to contribute <ArrowRight className="h-4 w-4" />
                </Link>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#e4d8cf] bg-[#fffdf9] p-4 shadow-[0_10px_28px_-24px_rgba(74,46,32,.45)]">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#f4ebe4] text-[#895648]">{icon}</div>
      <div>
        <p className="text-xs font-medium text-[#76645a]">{label}</p>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="font-serif text-2xl font-semibold text-[#3d2d26]">{value}</span>
          <span className="text-[10px] text-[#a08e84]">{detail}</span>
        </div>
      </div>
    </div>
  );
}

function ArchiveArticleCard({ article }: { article: WikiArticleWithAuthor }) {
  return (
    <Link
      href={`/wiki/${article.slug}`}
      className="group overflow-hidden rounded-xl border border-[#e4d8cf] bg-[#fffdf9] transition hover:-translate-y-0.5 hover:border-[#d4c0b3] hover:shadow-[0_14px_28px_-24px_rgba(74,46,32,.5)]"
    >
      {article.coverImage && (
        <div className="h-32 overflow-hidden bg-[#eee6df]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.coverImage} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        </div>
      )}
      <div className="p-4">
        {article.tags?.[0] && (
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#9a6856]">{article.tags[0].name}</span>
        )}
        <h3 className="mt-1 line-clamp-2 font-serif text-lg font-semibold leading-6 text-[#44322b] transition group-hover:text-maroon-600">{article.title}</h3>
        {article.excerpt && <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#827168]">{article.excerpt}</p>}
        <ArticleMeta article={article} compact />
      </div>
    </Link>
  );
}

function ArticleMeta({ article, compact = false }: { article: WikiArticleWithAuthor; compact?: boolean }) {
  return (
    <div className={`${compact ? 'mt-4' : 'mt-5'} flex items-center justify-between gap-3 border-t border-[#eee4dc] pt-3`}>
      <div className="flex min-w-0 items-center gap-2">
        <Avatar src={article.author.image} name={article.author.name || 'Author'} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[#655148]">{article.author.name || 'Family member'}</p>
          <p className="flex items-center gap-1 text-[10px] text-[#a08e84]"><CalendarDays className="h-3 w-3" />{format(new Date(article.createdAt), 'MMM d, yyyy')}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-[10px] text-[#99877d]">
        <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{article.viewCount ?? 0}</span>
        <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{article._count?.comments ?? 0}</span>
      </div>
    </div>
  );
}
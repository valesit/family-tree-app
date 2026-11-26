'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import Link from 'next/link';
import { format } from 'date-fns';
import { Avatar } from '@/components/ui';
import type { WikiArticleWithAuthor, SessionUser } from '@/types';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Eye,
  Loader2,
  MessageSquare,
  PenLine,
  Search,
} from 'lucide-react';

type WikiListResponse = {
  success: boolean;
  data: {
    items: WikiArticleWithAuthor[];
    total: number;
    totalPages: number;
  };
};

const fetcher = async (url: string): Promise<WikiListResponse> => {
  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Unable to load the family archive.');
  }
  return result as WikiListResponse;
};

export default function WikiPage() {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const user = session?.user as SessionUser | undefined;
  const isAuthenticated = Boolean(user);
  const hasFilters = Boolean(searchQuery.trim() || selectedTag);

  const queryParams = new URLSearchParams();
  queryParams.set('page', String(page));
  if (searchQuery.trim()) queryParams.set('search', searchQuery.trim());
  if (selectedTag) queryParams.set('tag', selectedTag);

  const { data, error, isLoading } = useSWR<WikiListResponse>(
    '/api/wiki?' + queryParams.toString(),
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  // Keep the discovery controls independent of the current search and page.
  const { data: archiveData } = useSWR<WikiListResponse>(
    '/api/wiki?limit=50',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  const articles = data?.data?.items ?? [];
  const archiveArticles = archiveData?.data?.items ?? articles;
  const totalStories = archiveData?.data?.total ?? (hasFilters ? 0 : data?.data?.total ?? 0);

  const popularTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const article of archiveArticles) {
      for (const tag of article.tags ?? []) {
        if (!tag) continue;
        counts.set(tag.name, (counts.get(tag.name) ?? 0) + 1);
      }
    }
    return Array.from(counts, ([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [archiveArticles]);

  // Preserve the current automatic spotlight rule; the schema has no
  // editorial 'featured' flag. A content-managed spotlight is a separate task.
  const featuredArticle = useMemo(() => {
    if (!archiveArticles.length) return null;
    return [...archiveArticles].sort((a, b) => {
      const hasImage = Number(Boolean(b.coverImage)) - Number(Boolean(a.coverImage));
      if (hasImage !== 0) return hasImage;
      return (b.viewCount ?? 0) - (a.viewCount ?? 0);
    })[0];
  }, [archiveArticles]);

  const showFeatured = !hasFilters && page === 1 && Boolean(featuredArticle);
  const displayedArticles = showFeatured
    ? articles.filter((article) => article.id !== featuredArticle?.id)
    : articles;
  const totalPages = data?.data?.totalPages ?? 1;

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedTag(null);
    setPage(1);
  };

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-white" role="status">
        <Loader2 className="mr-3 h-6 w-6 animate-spin text-[#651a1a]" aria-hidden="true" />
        <p className="text-base text-[#52615c]">Opening the family archive…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center" role="alert">
        <AlertCircle className="mb-4 h-9 w-9 text-[#651a1a]" aria-hidden="true" />
        <h1 className="font-serif text-2xl font-semibold text-[#342722]">We couldn't load the family stories</h1>
        <p className="mt-3 text-base text-[#52615c]">Please refresh the page to try again.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#342722]">
      <header className="border-b border-[#e5e9e5] bg-white">
        <div className="mx-auto max-w-[1320px] px-4 pb-8 pt-10 sm:px-6 sm:pb-10 sm:pt-14 lg:px-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-3xl">
              <h1 className="font-serif text-4xl font-semibold leading-[1.12] tracking-[-0.025em] text-[#651a1a] sm:text-5xl">
                Family Stories &amp; History
              </h1>
              <p className="mt-4 max-w-[66ch] text-base leading-7 text-[#52615c] sm:text-lg sm:leading-8">
                Discover and share stories, traditions, and history about our family.
                Preserve the details that make each generation memorable.
              </p>
              <p className="mt-4 text-sm font-medium text-[#496059]">
                {totalStories} {totalStories === 1 ? 'story' : 'stories'} preserved
              </p>
            </div>
            {isAuthenticated && (
              <Link
                href="/wiki/new"
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-[#651a1a] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#4a1313] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#651a1a] md:self-auto"
              >
                <PenLine className="h-4 w-4" aria-hidden="true" />
                Write a Story
              </Link>
            )}
          </div>

          <div className="mt-8">
            <label htmlFor="family-story-search" className="sr-only">Search family stories</label>
            <div className="relative max-w-[650px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#52615c]" aria-hidden="true" />
              <input
                id="family-story-search"
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search family stories"
                className="h-12 w-full rounded-xl border border-[#cad9d2] bg-white pl-12 pr-4 text-base text-[#342722] outline-none placeholder:text-[#63736a] focus:border-[#14635b] focus:ring-2 focus:ring-[#14635b]/15"
              />
            </div>

            {popularTags.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Filter stories by topic">
                <span className="mr-2 text-sm font-medium text-[#52615c]">Explore topics</span>
                {popularTags.slice(0, 10).map(({ name, count }) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={selectedTag === name}
                    onClick={() => {
                      setSelectedTag(selectedTag === name ? null : name);
                      setPage(1);
                    }}
                    className={
                      'min-h-10 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14635b] ' +
                      (selectedTag === name
                        ? 'border-[#651a1a] bg-[#651a1a] text-white'
                        : 'border-[#dce5df] bg-[#f8fbf9] text-[#344d44] hover:border-[#9fb9aa] hover:bg-[#eef6f1]')
                    }
                  >
                    {name} <span className={selectedTag === name ? 'ml-1 text-white/80' : 'ml-1 text-[#63736a]'}>{count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-4 pb-16 pt-9 sm:px-6 sm:pt-11 lg:px-8">
        {hasFilters && (
          <div className="mb-8 flex flex-wrap items-center gap-3 border-b border-[#e5e9e5] pb-4 text-sm text-[#52615c]">
            <span>Showing matching family stories</span>
            {selectedTag && <span className="rounded-full bg-[#eef6f1] px-3 py-1 font-semibold text-[#14635b]">{selectedTag}</span>}
            {searchQuery.trim() && <span className="rounded-full bg-[#f7f1ed] px-3 py-1 text-[#651a1a]">{searchQuery.trim()}</span>}
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto min-h-10 rounded-lg px-3 text-sm font-semibold text-[#651a1a] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#651a1a]"
            >
              Clear filters
            </button>
          </div>
        )}

        {showFeatured && featuredArticle && (
          <section aria-label="Featured family story">
            <Link
              href={'/wiki/' + featuredArticle.slug}
              className="group grid overflow-hidden rounded-2xl border border-[#e0e5e0] bg-white transition-colors hover:border-[#c1d0c5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#651a1a] lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]"
            >
              <div className="relative flex min-h-[250px] items-center justify-center overflow-hidden bg-[#f4f3ef] px-6 py-9 sm:min-h-[310px] lg:min-h-[420px] lg:px-9">
                <span className="absolute left-5 top-5 rounded-full border border-[#d8ddd5] bg-white px-3 py-1.5 text-xs font-semibold text-[#651a1a] sm:left-7 sm:top-7">
                  Featured story
                </span>
                {featuredArticle.coverImage ? (
                  // Keep heritage artwork at its natural size when possible;
                  // do not crop to fill the frame or enlarge small illustrations.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={featuredArticle.coverImage}
                    alt=""
                    className="max-h-[320px] max-w-full object-contain lg:max-h-[365px]"
                  />
                ) : (
                  <BookOpen className="h-16 w-16 text-[#829287]" strokeWidth={1.3} aria-hidden="true" />
                )}
              </div>
              <div className="flex flex-col justify-center px-6 py-8 sm:px-9 sm:py-10 lg:px-12 lg:py-12">
                {(featuredArticle.tags?.length ?? 0) > 0 && (
                  <p className="mb-3 text-xs font-semibold text-[#14635b]">{featuredArticle.tags?.[0]?.name}</p>
                )}
                <h2 className="max-w-[18ch] font-serif text-[29px] font-semibold leading-[1.18] tracking-[-0.02em] text-[#4a1313] transition-colors group-hover:text-[#651a1a] sm:text-[38px]">
                  {featuredArticle.title}
                </h2>
                {featuredArticle.excerpt && (
                  <p className="mt-5 max-w-[58ch] text-base leading-7 text-[#52615c] line-clamp-4">
                    {featuredArticle.excerpt}
                  </p>
                )}
                <ArticleMeta article={featuredArticle} />
                <span className="mt-7 inline-flex items-center gap-2 self-start border-b border-[#651a1a] pb-1 text-sm font-semibold text-[#651a1a]">
                  Read full story <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </div>
            </Link>
          </section>
        )}

        {(displayedArticles.length > 0 || hasFilters || !featuredArticle) && (
          <section className={showFeatured ? 'mt-14 sm:mt-16' : ''} aria-labelledby="archive-heading">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[#e5e9e5] pb-5">
              <div>
                <h2 id="archive-heading" className="font-serif text-3xl font-semibold tracking-[-0.015em] text-[#342722]">
                  {hasFilters ? 'Matching stories' : 'Explore our stories'}
                </h2>
                <p className="mt-1 text-sm text-[#52615c]">
                  {hasFilters ? 'Stories that match your search or selected topic.' : 'Discover the voices, memories, and history of our families.'}
                </p>
              </div>
              <span className="text-sm font-medium text-[#52615c]">
                {displayedArticles.length} {displayedArticles.length === 1 ? 'story' : 'stories'} shown
              </span>
            </div>

            {displayedArticles.length === 0 ? (
              <div className="rounded-xl bg-[#f8fbf9] px-6 py-12 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-[#8da69a]" strokeWidth={1.4} aria-hidden="true" />
                <h3 className="mt-4 font-serif text-xl font-semibold text-[#342722]">
                  {hasFilters ? 'No matching stories' : 'No additional stories yet'}
                </h3>
                <p className="mt-2 text-base text-[#52615c]">
                  {hasFilters ? 'Try a different search or clear your topic filter.' : 'More family memories will appear here as they are shared.'}
                </p>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-5 min-h-11 rounded-lg border border-[#cad9d2] bg-white px-5 text-sm font-semibold text-[#14635b] hover:bg-[#eef6f1] focus-visible:outline-2 focus-visible:outline-[#14635b]"
                  >
                    View all stories
                  </button>
                )}
              </div>
            ) : (
              <div className="grid items-stretch gap-6 md:grid-cols-2 lg:gap-8">
                {displayedArticles.map((article) => (
                  <ArchiveArticleCard key={article.id} article={article} />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <nav aria-label="Story archive pagination" className="mt-9 flex items-center justify-between border-t border-[#e5e9e5] pt-5">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#651a1a] hover:bg-[#f7f1ed] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#651a1a]"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Previous
                </button>
                <span className="text-sm text-[#52615c]">Page {page} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#651a1a] hover:bg-[#f7f1ed] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[#651a1a]"
                >
                  Next <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </nav>
            )}
          </section>
        )}

        {!hasFilters && (
          <section className="mt-14 flex flex-col justify-between gap-6 border-t border-[#e5e9e5] pt-10 sm:mt-16 sm:flex-row sm:items-center" aria-label="Share a family story">
            <div className="max-w-2xl">
              <h2 className="font-serif text-2xl font-semibold text-[#651a1a] sm:text-3xl">
                Every family has a story worth preserving.
              </h2>
              <p className="mt-3 text-base leading-7 text-[#52615c]">
                Share a memory, tradition, or important moment so future generations can discover it.
              </p>
            </div>
            <Link
              href={isAuthenticated ? '/wiki/new' : '/login?callbackUrl=/wiki/new'}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-[#651a1a] px-5 text-sm font-semibold text-[#651a1a] transition-colors hover:bg-[#f9f1f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#651a1a] sm:self-auto"
            >
              <PenLine className="h-4 w-4" aria-hidden="true" />
              {isAuthenticated ? 'Contribute a story' : 'Sign in to contribute'}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}

function ArchiveArticleCard({ article }: { article: WikiArticleWithAuthor }) {
  return (
    <Link
      href={'/wiki/' + article.slug}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-[#e0e5e0] bg-white transition-colors hover:border-[#b6cabb] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#651a1a]"
    >
      <div className="flex h-[220px] shrink-0 items-center justify-center overflow-hidden bg-[#f4f3ef] p-5 sm:h-[245px]">
        {article.coverImage ? (
          // Preserve the full totem or heritage illustration; avoid cropping.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.coverImage} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <BookOpen className="h-12 w-12 text-[#829287]" strokeWidth={1.35} aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {(article.tags?.length ?? 0) > 0 && (
          <p className="mb-2 text-xs font-semibold text-[#14635b]">{article.tags?.[0]?.name}</p>
        )}
        <h3 className="font-serif text-[23px] font-semibold leading-[1.25] tracking-[-0.015em] text-[#342722] transition-colors group-hover:text-[#651a1a] sm:text-[25px]">
          {article.title}
        </h3>
        {article.excerpt && <p className="mt-3 line-clamp-3 text-base leading-7 text-[#52615c]">{article.excerpt}</p>}
        <div className="mt-auto pt-5">
          <ArticleMeta article={article} compact />
        </div>
        <span className="mt-4 inline-flex items-center gap-2 self-start text-sm font-semibold text-[#651a1a]">
          Read story <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

function ArticleMeta({ article, compact = false }: { article: WikiArticleWithAuthor; compact?: boolean }) {
  return (
    <div className={'flex flex-wrap items-center justify-between gap-3 border-t border-[#e7ebe6] pt-4 ' + (compact ? '' : 'mt-6')}>
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar src={article.author.image} name={article.author.name || 'Family member'} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#51413b]">
            Published by {article.author.name || 'Family member'}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#52615c]">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            <time dateTime={String(article.createdAt)}>{format(new Date(article.createdAt), 'MMM d, yyyy')}</time>
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs text-[#52615c]" aria-label="Article engagement">
        <span className="inline-flex items-center gap-1" title="Views">
          <Eye className="h-4 w-4" aria-hidden="true" /> {article.viewCount ?? 0}
          <span className="sr-only">views</span>
        </span>
        <span className="inline-flex items-center gap-1" title="Comments">
          <MessageSquare className="h-4 w-4" aria-hidden="true" /> {article._count?.comments ?? 0}
          <span className="sr-only">comments</span>
        </span>
      </div>
    </div>
  );
}

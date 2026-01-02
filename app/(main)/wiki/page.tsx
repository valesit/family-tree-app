'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import Link from 'next/link';
import { WikiArticleCard } from '@/components/wiki';
import { Button, Input, Card } from '@/components/ui';
import { WikiArticleWithAuthor, SessionUser } from '@/types';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Loader2, 
  AlertCircle,
  Filter,
  TrendingUp,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

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
  }>(`/api/wiki?${queryParams.toString()}`, fetcher);

  // Get popular tags
  const { data: tagsData } = useSWR<{
    success: boolean;
    data: { items: WikiArticleWithAuthor[] };
  }>('/api/wiki?limit=50', fetcher);

  const popularTags = tagsData?.data?.items
    ?.flatMap(article => article.tags || [])
    .reduce((acc, tag) => {
      if (tag) {
        acc[tag.name] = (acc[tag.name] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

  const sortedTags = popularTags 
    ? Object.entries(popularTags)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name]) => name)
    : [];

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-maroon-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading family wiki...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-4" />
          <p className="text-slate-600">Failed to load wiki articles</p>
        </div>
      </div>
    );
  }

  const articles = data?.data?.items || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-maroon-50/30">
      {/* Hero section */}
      <div className="bg-gradient-to-r from-maroon-600 to-maroon-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h1 className="text-3xl font-bold">Family Wiki</h1>
              </div>
              <p className="text-maroon-100 max-w-xl">
                Discover and share stories, traditions, and history about our family. 
                Everyone can contribute to preserving our shared heritage.
              </p>
            </div>
            {isAuthenticated && (
              <Link href="/wiki/new">
                <Button className="bg-white text-maroon-600 hover:bg-maroon-50">
                  <Plus className="w-4 h-4 mr-2" />
                  Write Article
                </Button>
              </Link>
            )}
          </div>

          {/* Search bar */}
          <div className="mt-8 relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-maroon-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search articles..."
              className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder:text-maroon-200 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Tags filter */}
            {sortedTags.length > 0 && (
              <Card>
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-900">Topics</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedTag(null)}
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                      !selectedTag
                        ? 'bg-maroon-100 text-maroon-700'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All
                  </button>
                  {sortedTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                      className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                        selectedTag === tag
                          ? 'bg-maroon-100 text-maroon-700'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {/* Quick stats */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-slate-400" />
                <h3 className="font-semibold text-slate-900">Wiki Stats</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Articles</span>
                  <span className="font-semibold text-slate-900">{data?.data?.total || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Topics</span>
                  <span className="font-semibold text-slate-900">{sortedTags.length}</span>
                </div>
              </div>
            </Card>

            {/* CTA for non-authenticated */}
            {!isAuthenticated && (
              <Card className="bg-gradient-to-br from-maroon-50 to-maroon-50 border-maroon-200">
                <h3 className="font-semibold text-maroon-900 mb-2">Want to contribute?</h3>
                <p className="text-sm text-maroon-700 mb-4">
                  Sign in to write articles and share your family stories.
                </p>
                <Link href="/login">
                  <Button size="sm" className="w-full">
                    Sign In
                  </Button>
                </Link>
              </Card>
            )}
          </div>

          {/* Articles grid */}
          <div className="lg:col-span-3">
            {articles.length === 0 ? (
              <Card className="text-center py-12">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">
                  {searchQuery || selectedTag ? 'No articles found' : 'No articles yet'}
                </h3>
                <p className="text-slate-500 mb-4">
                  {searchQuery || selectedTag
                    ? 'Try adjusting your search or filter.'
                    : 'Be the first to share a story about our family!'}
                </p>
                {isAuthenticated && !searchQuery && !selectedTag && (
                  <Link href="/wiki/new">
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Write First Article
                    </Button>
                  </Link>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {articles.map((article) => (
                  <WikiArticleCard key={article.id} article={article} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


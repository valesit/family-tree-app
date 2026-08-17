'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { RelativeSuggestion } from '@/types';
import { Avatar, Button, Card } from '@/components/ui';
import { 
  Users, 
  MessageSquare, 
  ChevronRight, 
  Sparkles, 
  UserPlus,
  Loader2,
  RefreshCw,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

/**
 * Contact handed back to the parent when the user picks a suggestion. We
 * include the resolved display name + image so the messages page can open the
 * chat without re-querying the family directory (which may be paginated and
 * not contain the suggested user).
 */
export interface RelativeContact {
  id: string;
  name: string;
  image: string | null;
}

interface RelativeDiscoveryProps {
  onStartConversation?: (contact: RelativeContact) => void;
}

const PAGE_SIZE = 5;

export function RelativeDiscovery({ onStartConversation }: RelativeDiscoveryProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [limit, setLimit] = useState(PAGE_SIZE);

  // We re-fetch with a growing limit each time the user clicks "Load more".
  // The relatives endpoint already de-duplicates and sorts by distance, so
  // requesting a bigger page just reveals additional matches.
  const { data, error, isLoading, isValidating, mutate } = useSWR<{
    success: boolean;
    data: RelativeSuggestion[];
    message?: string;
  }>(`/api/relatives?limit=${limit}&minDistance=3`, fetcher, {
    revalidateOnFocus: false,
  });

  const suggestions = data?.data || [];
  // If the API returned fewer than we asked for, there's nothing further
  // to reveal. Used to disable the "Load more" affordance.
  const hasMore = suggestions.length >= limit;

  if (error) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-purple-900">Discover Relatives</h3>
            <p className="text-xs text-purple-600">Connect with family you may not know</p>
          </div>
        </div>
        <ChevronRight 
          className={`w-5 h-5 text-purple-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
        />
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-purple-200/50">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-6">
              <Users className="w-10 h-10 text-purple-300 mx-auto mb-3" />
              <p className="text-sm text-purple-700">
                {data?.message || 'No suggestions available yet'}
              </p>
              <p className="text-xs text-purple-500 mt-1">
                Link your profile to a family member to see relative suggestions
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <RelativeSuggestionCard
                  key={suggestion.person.id}
                  suggestion={suggestion}
                  onStartConversation={onStartConversation}
                />
              ))}

              {hasMore ? (
                <button
                  onClick={() => setLimit((n) => n + PAGE_SIZE)}
                  disabled={isValidating}
                  className="w-full py-2 text-center text-sm text-purple-600 hover:text-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isValidating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Load more suggestions
                </button>
              ) : (
                <div className="flex flex-col items-center gap-1 pt-2 text-xs text-purple-500">
                  <p>That&rsquo;s everyone we found.</p>
                  <button
                    onClick={() => mutate()}
                    className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-700"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

interface RelativeSuggestionCardProps {
  suggestion: RelativeSuggestion;
  onStartConversation?: (contact: RelativeContact) => void;
}

function RelativeSuggestionCard({ suggestion, onStartConversation }: RelativeSuggestionCardProps) {
  const { person, user, relationshipPath, hasAccount } = suggestion;
  const treeName = `${person.firstName} ${person.lastName}`.trim();

  return (
    <div className="flex items-center gap-3 p-3 bg-white/60 rounded-xl hover:bg-white/80 transition-colors">
      <div className="relative">
        <Avatar
          src={person.profileImage?.url}
          name={treeName}
          size="md"
        />
        {hasAccount && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-maroon-500 rounded-full border-2 border-white flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 truncate">{treeName}</p>
        <p className="text-xs text-purple-600 font-medium">{relationshipPath}</p>
      </div>

      <div className="flex items-center gap-2">
        {hasAccount && user ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onStartConversation?.({
                id: user.id,
                name: treeName || user.name || 'Family member',
                image: user.image ?? null,
              })
            }
            className="border-purple-200 hover:bg-purple-100"
            title={`Message ${treeName}`}
          >
            <MessageSquare className="w-4 h-4 text-purple-600" />
          </Button>
        ) : (
          <Link href={`/person/${person.id}`}>
            <Button
              size="sm"
              variant="outline"
              className="border-purple-200 hover:bg-purple-100"
            >
              <UserPlus className="w-4 h-4 text-purple-600" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}


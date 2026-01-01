'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { NotablePersonWithDetails } from '@/types';
import { Avatar, Card } from '@/components/ui';
import { 
  ChevronLeft, 
  ChevronRight, 
  Award, 
  Star,
  ExternalLink,
  Loader2,
  Crown,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface NotablePersonsCarouselProps {
  persons?: NotablePersonWithDetails[];
  familyId?: string;
  onPersonClick?: (person: NotablePersonWithDetails) => void;
  compact?: boolean;
}

export function NotablePersonsCarousel({ 
  persons: propPersons, 
  familyId, 
  onPersonClick,
  compact = false,
}: NotablePersonsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Fetch notable persons if not provided
  const { data, isLoading } = useSWR<{
    success: boolean;
    data: NotablePersonWithDetails[];
  }>(
    !propPersons ? `/api/notable${familyId ? `?familyId=${familyId}` : ''}` : null, 
    fetcher
  );

  const persons = propPersons || data?.data || [];

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = compact ? 200 : 320;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkScroll, 300);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-maroon-500 animate-spin" />
      </div>
    );
  }

  if (persons.length === 0) {
    return (
      <div className="text-center py-6 text-slate-500">
        <Crown className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p className="text-sm">No notable persons yet</p>
        <p className="text-xs mt-1">Nominate distinguished family members</p>
      </div>
    );
  }

  // Compact view for sidebar
  if (compact) {
    return (
      <div className="space-y-3">
        {persons.slice(0, 3).map((person) => (
          <CompactNotableCard key={person.id} person={person} onClick={() => onPersonClick?.(person)} />
        ))}
        {persons.length > 3 && (
          <p className="text-xs text-slate-500 text-center">
            +{persons.length - 3} more notable members
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <Award className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Notable Family Members</h2>
            <p className="text-sm text-slate-500">Distinguished members who made a difference</p>
          </div>
        </div>

        {/* Navigation arrows */}
        {persons.length > 3 && (
          <div className="flex gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="p-2 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="p-2 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        )}
      </div>

      {/* Carousel */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {persons.map((person) => (
          <NotablePersonCard
            key={person.id}
            person={person}
            onClick={() => onPersonClick?.(person)}
          />
        ))}
      </div>
    </div>
  );
}

// Compact card for sidebar view
function CompactNotableCard({ person, onClick }: { person: NotablePersonWithDetails; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
    >
      <div className="relative shrink-0">
        <Avatar
          src={person.profileImage?.url}
          name={`${person.firstName} ${person.lastName}`}
          size="sm"
        />
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
          <Star className="w-2 h-2 text-white" fill="currentColor" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900 text-sm truncate">
          {person.firstName} {person.lastName}
        </p>
        {person.notableTitle && (
          <p className="text-xs text-amber-600 truncate">{person.notableTitle}</p>
        )}
      </div>
    </div>
  );
}

interface NotablePersonCardProps {
  person: NotablePersonWithDetails;
  onClick?: () => void;
}

function NotablePersonCard({ person, onClick }: NotablePersonCardProps) {
  const achievements = person.notableAchievements 
    ? JSON.parse(person.notableAchievements) 
    : [];

  return (
    <div onClick={onClick} className="flex-shrink-0 w-80 snap-start cursor-pointer">
    <Card 
      className="group hover:shadow-lg transition-all duration-300 overflow-hidden bg-gradient-to-br from-white to-amber-50/30"
    >
      {/* Header with gradient */}
      <div className="relative -mx-6 -mt-6 mb-4 h-24 bg-gradient-to-r from-amber-400 to-orange-400">
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
          <div className="relative">
            <Avatar
              src={person.profileImage?.url}
              name={`${person.firstName} ${person.lastName}`}
              size="xl"
              className="ring-4 ring-white shadow-lg"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shadow-md">
              <Star className="w-3 h-3 text-white" fill="currentColor" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-10 text-center">
        <h3 className="font-bold text-slate-900 text-lg">
          {person.firstName} {person.lastName}
        </h3>
        
        {person.notableTitle && (
          <p className="text-amber-600 font-medium text-sm mt-1">
            {person.notableTitle}
          </p>
        )}

        {person.notableDescription && (
          <p className="text-slate-600 text-sm mt-3 line-clamp-3">
            {person.notableDescription}
          </p>
        )}

        {/* Achievements preview */}
        {achievements.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {achievements.slice(0, 3).map((achievement: string, index: number) => (
              <span
                key={index}
                className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs"
              >
                {achievement}
              </span>
            ))}
            {achievements.length > 3 && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs">
                +{achievements.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* View profile link */}
        <Link
          href={`/person/${person.id}`}
          className="inline-flex items-center gap-1 mt-4 text-sm text-maroon-600 hover:text-maroon-700 font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          View Profile
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </Card>
    </div>
  );
}

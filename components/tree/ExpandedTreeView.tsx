'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { NotablePersonsCarousel } from '@/components/notable';
import { WikiArticleCard } from '@/components/wiki';
import { Button, Card, Modal } from '@/components/ui';
import { NominationForm } from '@/components/notable';
import { 
  NotablePersonWithDetails, 
  WikiArticleWithAuthor, 
  PersonWithImage,
  SessionUser 
} from '@/types';
import { 
  X, 
  BookOpen, 
  Award, 
  Users, 
  TreePine, 
  Calendar,
  ChevronRight,
  Plus,
  Loader2,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface ExpandedTreeViewProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SessionUser | null;
}

export function ExpandedTreeView({ isOpen, onClose, currentUser }: ExpandedTreeViewProps) {
  const [showNominationForm, setShowNominationForm] = useState(false);

  // Fetch notable persons
  const { data: notableData, isLoading: loadingNotable } = useSWR<{
    success: boolean;
    data: NotablePersonWithDetails[];
  }>(isOpen ? '/api/notable?type=approved&limit=10' : null, fetcher);

  // Fetch recent wiki articles
  const { data: wikiData, isLoading: loadingWiki } = useSWR<{
    success: boolean;
    data: { items: WikiArticleWithAuthor[] };
  }>(isOpen ? '/api/wiki?limit=6' : null, fetcher);

  // Fetch family stats
  const { data: treeData, isLoading: loadingTree } = useSWR<{
    success: boolean;
    data: {
      stats: {
        totalMembers: number;
        livingCount: number;
        deceasedCount: number;
        marriageCount: number;
        oldestMember: { name: string; birthYear: number } | null;
      };
    };
  }>(isOpen ? '/api/tree' : null, fetcher);

  // Fetch persons for nomination
  const { data: personsData } = useSWR<{
    success: boolean;
    data: { items: PersonWithImage[] };
  }>(showNominationForm ? '/api/persons?limit=100' : null, fetcher);

  const notablePersons = notableData?.data || [];
  const wikiArticles = wikiData?.data?.items || [];
  const stats = treeData?.data?.stats;

  const handleNominate = async (data: {
    personId: string;
    title: string;
    description: string;
    achievements: string[];
  }) => {
    const response = await fetch('/api/notable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (response.ok) {
      setShowNominationForm(false);
      alert('Nomination submitted successfully! It will be reviewed by an admin.');
    } else {
      const result = await response.json();
      throw new Error(result.error);
    }
  };

  const isLoading = loadingNotable || loadingWiki || loadingTree;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Family Overview</h1>
              <p className="text-white/70">
                Explore your family&apos;s history, notable members, and shared stories
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Stats Cards */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-white/95 backdrop-blur">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-maroon-100 rounded-xl flex items-center justify-center">
                        <Users className="w-5 h-5 text-maroon-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900">{stats.totalMembers}</p>
                        <p className="text-xs text-slate-500">Total Members</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="bg-white/95 backdrop-blur">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-maroon-100 rounded-xl flex items-center justify-center">
                        <TreePine className="w-5 h-5 text-maroon-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900">{stats.livingCount}</p>
                        <p className="text-xs text-slate-500">Living</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="bg-white/95 backdrop-blur">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                        <Award className="w-5 h-5 text-rose-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900">{notablePersons.length}</p>
                        <p className="text-xs text-slate-500">Notable Members</p>
                      </div>
                    </div>
                  </Card>
                  {stats.oldestMember && (
                    <Card className="bg-white/95 backdrop-blur">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 truncate">{stats.oldestMember.name}</p>
                          <p className="text-xs text-slate-500">Since {stats.oldestMember.birthYear}</p>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Notable Persons Section */}
              <Card className="bg-white/95 backdrop-blur p-6">
                {notablePersons.length > 0 ? (
                  <NotablePersonsCarousel persons={notablePersons} />
                ) : (
                  <div className="text-center py-8">
                    <Award className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No Notable Members Yet</h3>
                    <p className="text-slate-500 mb-4">
                      Recognize family members who made significant contributions
                    </p>
                    {currentUser && (
                      <Button onClick={() => setShowNominationForm(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nominate Someone
                      </Button>
                    )}
                  </div>
                )}
                
                {notablePersons.length > 0 && currentUser && (
                  <div className="mt-6 pt-6 border-t border-slate-200 flex justify-center">
                    <Button variant="outline" onClick={() => setShowNominationForm(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nominate Notable Person
                    </Button>
                  </div>
                )}
              </Card>

              {/* Wiki Section */}
              <Card className="bg-white/95 backdrop-blur p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-maroon-100 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-maroon-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Family Wiki</h2>
                      <p className="text-sm text-slate-500">Stories and history from our family</p>
                    </div>
                  </div>
                  <Link href="/wiki">
                    <Button variant="outline" size="sm">
                      View All
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>

                {wikiArticles.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {wikiArticles.map((article) => (
                      <WikiArticleCard 
                        key={article.id} 
                        article={article} 
                        variant="compact"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No Articles Yet</h3>
                    <p className="text-slate-500 mb-4">
                      Start documenting your family&apos;s stories and traditions
                    </p>
                    {currentUser && (
                      <Link href="/wiki/new">
                        <Button>
                          <Plus className="w-4 h-4 mr-2" />
                          Write First Article
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </Card>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/tree" onClick={onClose}>
                  <Card className="bg-white/95 backdrop-blur hover:bg-white transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-maroon-100 rounded-xl flex items-center justify-center group-hover:bg-maroon-200 transition-colors">
                        <TreePine className="w-5 h-5 text-maroon-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">Explore Tree</p>
                        <p className="text-xs text-slate-500">Navigate the family tree</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-maroon-500 transition-colors" />
                    </div>
                  </Card>
                </Link>
                <Link href="/wiki" onClick={onClose}>
                  <Card className="bg-white/95 backdrop-blur hover:bg-white transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">Browse Wiki</p>
                        <p className="text-xs text-slate-500">Read family stories</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </Card>
                </Link>
                <Link href="/messages" onClick={onClose}>
                  <Card className="bg-white/95 backdrop-blur hover:bg-white transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                        <Users className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">Connect</p>
                        <p className="text-xs text-slate-500">Message relatives</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-purple-500 transition-colors" />
                    </div>
                  </Card>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nomination Modal */}
      <Modal
        isOpen={showNominationForm}
        onClose={() => setShowNominationForm(false)}
        size="lg"
      >
        <NominationForm
          persons={personsData?.data?.items || []}
          onSubmit={handleNominate}
          onCancel={() => setShowNominationForm(false)}
        />
      </Modal>
    </div>
  );
}


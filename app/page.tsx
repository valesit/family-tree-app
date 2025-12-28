'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { FamilyTree } from '@/components/tree';
import { Modal } from '@/components/ui';
import { PersonCard } from '@/components/person';
import { TreeNode, PersonWithRelations, SessionUser } from '@/types';
import { 
  TreePine, 
  Users, 
  Heart, 
  ArrowRight, 
  LogIn, 
  UserPlus,
  Loader2,
  AlertCircle,
  Calendar,
  Lock,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface TreeStats {
  totalMembers: number;
  livingCount: number;
  deceasedCount: number;
  maleCount: number;
  femaleCount: number;
  marriageCount: number;
  oldestMember: { name: string; birthYear: number } | null;
  youngestLiving: { name: string; birthYear: number } | null;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [selectedPerson, setSelectedPerson] = useState<PersonWithRelations | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const user = session?.user as SessionUser | undefined;
  const isAuthenticated = status === 'authenticated';

  // Fetch the family tree data (public endpoint)
  const { data, error, isLoading } = useSWR<{
    success: boolean;
    data: {
      tree: TreeNode | null;
      stats: TreeStats | null;
      rootPersonId: string;
    };
  }>('/api/tree', fetcher, {
    revalidateOnFocus: false,
  });

  const handleNodeClick = async (node: TreeNode) => {
    try {
      const response = await fetch(`/api/persons/${node.id}`);
      const result = await response.json();
      if (result.success) {
        setSelectedPerson(result.data);
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching person:', error);
    }
  };

  const handleAddChild = (parentId: string) => {
    if (!isAuthenticated) {
      window.location.href = `/login?callbackUrl=/add-person?parentId=${parentId}`;
      return;
    }
    window.location.href = `/add-person?parentId=${parentId}`;
  };

  const handleAddSpouse = (personId: string) => {
    if (!isAuthenticated) {
      window.location.href = `/login?callbackUrl=/add-person?spouseId=${personId}`;
      return;
    }
    window.location.href = `/add-person?spouseId=${personId}`;
  };

  const { tree, stats } = data?.data || { tree: null, stats: null };
  const hasTree = tree !== null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <TreePine className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-slate-900">FamilyTree</span>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <Link
                    href="/tree"
                    className="text-slate-600 hover:text-slate-900 font-medium"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/add-person"
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-xl font-medium hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25"
                  >
                    Add Person
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-xl font-medium hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25 flex items-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Join Family
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-16">
        {isLoading ? (
          <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
            <div className="text-center">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mx-auto mb-4" />
              <p className="text-slate-600">Loading family tree...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
            <div className="text-center">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-4" />
              <p className="text-slate-600">Failed to load family tree</p>
            </div>
          </div>
        ) : hasTree ? (
          <>
            {/* Stats bar */}
            {stats && (
              <div className="absolute top-20 left-4 right-4 z-10 flex justify-center">
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200 px-6 py-3">
                  <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-emerald-500" />
                      <div>
                        <p className="text-lg font-bold text-slate-900">{stats.totalMembers}</p>
                        <p className="text-xs text-slate-500">Members</p>
                      </div>
                    </div>
                    <div className="w-px h-10 bg-slate-200" />
                    <div className="flex items-center gap-2">
                      <TreePine className="w-5 h-5 text-teal-500" />
                      <div>
                        <p className="text-lg font-bold text-slate-900">{stats.livingCount}</p>
                        <p className="text-xs text-slate-500">Living</p>
                      </div>
                    </div>
                    <div className="w-px h-10 bg-slate-200" />
                    <div className="flex items-center gap-2">
                      <Heart className="w-5 h-5 text-rose-500" />
                      <div>
                        <p className="text-lg font-bold text-slate-900">{stats.marriageCount}</p>
                        <p className="text-xs text-slate-500">Marriages</p>
                      </div>
                    </div>
                    {stats.oldestMember && (
                      <>
                        <div className="w-px h-10 bg-slate-200" />
                        <div className="flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-amber-500" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">{stats.oldestMember.name}</p>
                            <p className="text-xs text-slate-500">Oldest ({stats.oldestMember.birthYear})</p>
                          </div>
                        </div>
                      </>
                    )}
                    
                    {/* Sign in prompt for guests */}
                    {!isAuthenticated && (
                      <>
                        <div className="w-px h-10 bg-slate-200" />
                        <Link
                          href="/login"
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          <Lock className="w-4 h-4" />
                          <span className="text-sm font-medium">Sign in to contribute</span>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Family Tree */}
            <FamilyTree
              data={tree}
              onNodeClick={handleNodeClick}
              onAddChild={handleAddChild}
              onAddSpouse={handleAddSpouse}
            />

            {/* Person Detail Modal */}
            <Modal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              size="lg"
            >
              {selectedPerson && (
                <div>
                  <PersonCard
                    person={selectedPerson}
                    showActions={isAuthenticated}
                    onEdit={isAuthenticated ? () => {
                      setIsModalOpen(false);
                      window.location.href = `/person/${selectedPerson.id}/edit`;
                    } : undefined}
                    onRequestCorrection={isAuthenticated ? () => {
                      setIsModalOpen(false);
                      window.location.href = `/corrections/new?personId=${selectedPerson.id}`;
                    } : undefined}
                  />
                  {!isAuthenticated && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-amber-600" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">Want to contribute?</p>
                          <p className="text-xs text-amber-600">
                            <Link href="/login" className="underline hover:text-amber-800">Sign in</Link> or{' '}
                            <Link href="/register" className="underline hover:text-amber-800">create an account</Link> to add information or request corrections.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Modal>
          </>
        ) : (
          /* No tree yet - show welcome page */
          <div className="relative">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
              <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse animation-delay-2000" />
            </div>

            {/* Hero Section */}
            <section className="pt-16 pb-20 px-4">
              <div className="max-w-7xl mx-auto text-center">
                <div className="inline-flex items-center px-4 py-2 bg-emerald-100 rounded-full text-emerald-700 text-sm font-medium mb-8">
                  <Heart className="w-4 h-4 mr-2" fill="currentColor" />
                  Preserve Your Family History
                </div>
                
                <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                  Build Your Family Tree
                  <br />
                  <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                    Together
                  </span>
                </h1>
                
                <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10">
                  A collaborative platform for families to document their heritage, 
                  share stories, and preserve memories for generations to come.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    href="/register"
                    className="group flex items-center bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-xl font-medium hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-500/25"
                  >
                    Start Your Tree
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    href="/login"
                    className="flex items-center px-8 py-4 rounded-xl font-medium border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-white transition-all"
                  >
                    Sign In to Contribute
                  </Link>
                </div>
              </div>
            </section>

            {/* Features Section */}
            <section className="py-20 px-4 bg-white">
              <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                  <h2 className="text-3xl font-bold text-slate-900 mb-4">
                    Everything Your Family Needs
                  </h2>
                  <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                    Designed to be simple enough for everyone while powerful enough 
                    to capture your complete family history.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {[
                    {
                      icon: TreePine,
                      title: 'Visual Family Tree',
                      description: 'Interactive tree visualization with expandable branches. See your family connections at a glance.',
                    },
                    {
                      icon: Users,
                      title: 'Collaborative Editing',
                      description: 'Invite family members to contribute. Everyone can add their branch of the family.',
                    },
                    {
                      icon: Heart,
                      title: 'Rich Profiles',
                      description: 'Add photos, biographies, interesting facts, and contact information for each person.',
                    },
                  ].map((feature, index) => {
                    const Icon = feature.icon;
                    return (
                      <div
                        key={index}
                        className="group p-8 rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all bg-white"
                      >
                        <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                          <Icon className="w-7 h-7 text-emerald-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-900 mb-3">
                          {feature.title}
                        </h3>
                        <p className="text-slate-600">
                          {feature.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-4">
              <div className="max-w-4xl mx-auto">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-12 text-center text-white relative overflow-hidden">
                  <div className="relative">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                      Start Preserving Your Family Legacy Today
                    </h2>
                    <p className="text-xl text-emerald-100 mb-8 max-w-2xl mx-auto">
                      Join families who are documenting their history 
                      and connecting across generations.
                    </p>
                    <Link
                      href="/register"
                      className="inline-flex items-center bg-white text-emerald-600 px-8 py-4 rounded-xl font-medium hover:bg-emerald-50 transition-colors shadow-lg"
                    >
                      Create Your Family Tree
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            {/* Footer */}
            <footer className="py-12 px-4 border-t border-slate-200 bg-white">
              <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-between">
                  <div className="flex items-center space-x-2 mb-4 md:mb-0">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                      <TreePine className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-slate-900">FamilyTree</span>
                  </div>
                  <p className="text-sm text-slate-500">
                    © {new Date().getFullYear()} FamilyTree. Preserving family histories.
                  </p>
                </div>
              </div>
            </footer>
        </div>
        )}
      </main>
    </div>
  );
}

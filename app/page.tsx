'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { 
  TreePine, 
  Users, 
  Heart, 
  ArrowRight, 
  LogIn, 
  UserPlus,
  Loader2,
  AlertCircle,
  Search,
  Crown,
  Calendar,
  MapPin,
  ChevronRight,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface FamilyTreePreview {
  id: string;
  familyName: string;
  foundingAncestor: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage: string | null;
    birthYear: number | null;
    birthPlace: string | null;
  };
  memberCount: number;
  generationCount: number;
  notableCount: number;
  lastUpdated: string;
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [searchQuery, setSearchQuery] = useState('');

  const isAuthenticated = status === 'authenticated';

  // Fetch all family trees
  const { data, error, isLoading } = useSWR<{
    success: boolean;
    data: {
      families: FamilyTreePreview[];
    };
  }>('/api/families', fetcher, {
    revalidateOnFocus: false,
  });

  const families = data?.data?.families || [];

  // Filter families based on search
  const filteredFamilies = families.filter(family =>
    family.familyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    family.foundingAncestor.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    family.foundingAncestor.lastName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-maroon-50 via-rose-50 to-amber-50">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-maroon-500 to-maroon-700 rounded-xl flex items-center justify-center shadow-lg shadow-maroon-500/20">
                <TreePine className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-slate-900">FamilyTree</span>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <Link
                    href="/wiki"
                    className="text-slate-600 hover:text-slate-900 font-medium"
                  >
                    Wiki
                  </Link>
                  <Link
                    href="/messages"
                    className="text-slate-600 hover:text-slate-900 font-medium"
                  >
                    Messages
                  </Link>
                  <Link
                    href="/add-person"
                    className="bg-gradient-to-r from-maroon-500 to-maroon-700 text-white px-4 py-2 rounded-xl font-medium hover:from-maroon-600 hover:to-maroon-800 transition-all shadow-lg shadow-maroon-500/25"
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
                    className="bg-gradient-to-r from-maroon-500 to-maroon-700 text-white px-4 py-2 rounded-xl font-medium hover:from-maroon-600 hover:to-maroon-800 transition-all shadow-lg shadow-maroon-500/25 flex items-center gap-2"
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
      <main className="pt-20">
        {/* Hero Section */}
        <section className="relative py-16 px-4">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-maroon-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-maroon-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse animation-delay-2000" />
          </div>

          <div className="max-w-7xl mx-auto relative">
            <div className="text-center mb-12">
              <div className="inline-flex items-center px-4 py-2 bg-maroon-100 rounded-full text-maroon-700 text-sm font-medium mb-6">
                <Heart className="w-4 h-4 mr-2" fill="currentColor" />
                Preserve Your Family History
              </div>
              
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 leading-tight">
                Discover Your
                <span className="bg-gradient-to-r from-maroon-500 to-maroon-700 bg-clip-text text-transparent"> Family Legacy</span>
              </h1>
              
              <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8">
                Explore family trees, connect with relatives, and preserve your heritage for generations to come.
              </p>

              {/* Search Bar */}
              <div className="max-w-xl mx-auto">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search family trees by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-200 focus:border-maroon-500 focus:outline-none focus:ring-4 focus:ring-maroon-100 transition-all text-lg shadow-lg bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Family Trees Grid */}
        <section className="py-8 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-slate-900">
                {searchQuery ? `Search Results (${filteredFamilies.length})` : 'Family Trees'}
              </h2>
              {isAuthenticated && (
                <Link
                  href="/add-person"
                  className="flex items-center gap-2 px-4 py-2 bg-maroon-100 text-maroon-700 rounded-xl font-medium hover:bg-maroon-200 transition-colors"
                >
                  <TreePine className="w-4 h-4" />
                  Start New Tree
                </Link>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 text-maroon-500 animate-spin mx-auto mb-4" />
                  <p className="text-slate-600">Loading family trees...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-4" />
                  <p className="text-slate-600">Failed to load family trees</p>
                </div>
              </div>
            ) : filteredFamilies.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredFamilies.map((family) => (
                  <FamilyTreeCard key={family.id} family={family} />
                ))}
              </div>
            ) : families.length === 0 ? (
              <EmptyState isAuthenticated={isAuthenticated} />
            ) : (
              <div className="text-center py-20">
                <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-700 mb-2">No families found</h3>
                <p className="text-slate-500">Try a different search term</p>
              </div>
            )}
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
                    <div className="w-14 h-14 bg-maroon-100 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Icon className="w-7 h-7 text-maroon-600" />
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
        {!isAuthenticated && (
          <section className="py-20 px-4">
            <div className="max-w-4xl mx-auto">
              <div className="bg-gradient-to-br from-maroon-500 to-maroon-700 rounded-3xl p-12 text-center text-white relative overflow-hidden">
                <div className="relative">
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">
                    Start Preserving Your Family Legacy Today
                  </h2>
                  <p className="text-xl text-maroon-100 mb-8 max-w-2xl mx-auto">
                    Join families who are documenting their history 
                    and connecting across generations.
                  </p>
                  <Link
                    href="/register"
                    className="inline-flex items-center bg-white text-maroon-600 px-8 py-4 rounded-xl font-medium hover:bg-maroon-50 transition-colors shadow-lg"
                  >
                    Create Your Family Tree
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="py-12 px-4 border-t border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center space-x-2 mb-4 md:mb-0">
                <div className="w-8 h-8 bg-gradient-to-br from-maroon-500 to-maroon-700 rounded-lg flex items-center justify-center">
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
      </main>
    </div>
  );
}

// Family Tree Card Component
function FamilyTreeCard({ family }: { family: FamilyTreePreview }) {
  return (
    <Link
      href={`/tree/${family.id}`}
      className="group block bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:border-maroon-300 transition-all duration-300"
    >
      {/* Ancestor Header */}
      <div className="relative h-32 bg-gradient-to-br from-maroon-500 to-maroon-700 p-6">
        <div className="absolute -bottom-10 left-6">
          <div className="w-20 h-20 rounded-2xl bg-white shadow-lg border-4 border-white overflow-hidden">
            {family.foundingAncestor.profileImage ? (
              <img
                src={family.foundingAncestor.profileImage}
                alt={family.foundingAncestor.firstName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-maroon-100 to-maroon-200 flex items-center justify-center">
                <span className="text-2xl font-bold text-maroon-600">
                  {family.foundingAncestor.firstName[0]}{family.foundingAncestor.lastName[0]}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="absolute top-4 right-4 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
          <span className="text-xs font-medium text-white">{family.generationCount} Generations</span>
        </div>
      </div>

      {/* Content */}
      <div className="pt-14 pb-6 px-6">
        <h3 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-maroon-700 transition-colors">
          {family.familyName}
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Est. {family.foundingAncestor.firstName} {family.foundingAncestor.lastName}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{family.memberCount} members</span>
          </div>
          {family.notableCount > 0 && (
            <div className="flex items-center gap-1">
              <Crown className="w-4 h-4 text-amber-500" />
              <span>{family.notableCount} notable</span>
            </div>
          )}
        </div>

        {/* Ancestor info */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {family.foundingAncestor.birthYear && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{family.foundingAncestor.birthYear}</span>
            </div>
          )}
          {family.foundingAncestor.birthPlace && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span className="truncate max-w-[150px]">{family.foundingAncestor.birthPlace}</span>
            </div>
          )}
        </div>

        {/* View link */}
        <div className="mt-4 flex items-center text-maroon-600 font-medium text-sm group-hover:translate-x-1 transition-transform">
          <span>Explore Family Tree</span>
          <ChevronRight className="w-4 h-4 ml-1" />
        </div>
      </div>
    </Link>
  );
}

// Empty State Component
function EmptyState({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="text-center py-20">
      <div className="w-24 h-24 bg-maroon-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <TreePine className="w-12 h-12 text-maroon-500" />
      </div>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">
        No Family Trees Yet
      </h3>
      <p className="text-slate-600 max-w-md mx-auto mb-8">
        Be the first to create a family tree and start documenting your family&apos;s history.
      </p>
      {isAuthenticated ? (
        <Link
          href="/add-person"
          className="inline-flex items-center bg-gradient-to-r from-maroon-500 to-maroon-700 text-white px-8 py-4 rounded-xl font-medium hover:from-maroon-600 hover:to-maroon-800 transition-all shadow-lg shadow-maroon-500/25"
        >
          Start Your Family Tree
          <ArrowRight className="w-5 h-5 ml-2" />
        </Link>
      ) : (
        <Link
          href="/register"
          className="inline-flex items-center bg-gradient-to-r from-maroon-500 to-maroon-700 text-white px-8 py-4 rounded-xl font-medium hover:from-maroon-600 hover:to-maroon-800 transition-all shadow-lg shadow-maroon-500/25"
        >
          Create Your Account
          <ArrowRight className="w-5 h-5 ml-2" />
        </Link>
      )}
    </div>
  );
}

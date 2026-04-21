'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { FamilyTree } from '@/components/tree';
import { TreeNode, PersonWithRelations } from '@/types';
import {
  TreePine,
  Users,
  Heart,
  ArrowRight,
  LogIn,
  UserPlus,
  Loader2,
  AlertCircle,
  Crown,
  Calendar,
  MapPin,
  Maximize2,
  X,
  User,
  Briefcase,
  BookOpen,
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
}

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
  const router = useRouter();
  const isAuthenticated = status === 'authenticated';

  const [selectedPerson, setSelectedPerson] = useState<PersonWithRelations | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. Fetch families to get primaryFamilyId
  const { data: familiesData, isLoading: familiesLoading } = useSWR<{
    success: boolean;
    data: {
      families: FamilyTreePreview[];
      primaryFamilyId: string | null;
      stats: TreeStats | null;
    };
  }>('/api/families', fetcher, { revalidateOnFocus: false });

  const primaryFamily = familiesData?.data?.families.find(
    (f) => f.id === familiesData?.data?.primaryFamilyId
  );
  const stats = familiesData?.data?.stats;

  // 2. Fetch tree data for the primary family
  const primaryId = familiesData?.data?.primaryFamilyId;
  const { data: treeData, isLoading: treeLoading } = useSWR<{
    success: boolean;
    data: {
      tree: TreeNode | null;
      rootPersonId: string;
      familyName: string;
      foundingAncestor: {
        id: string;
        firstName: string;
        lastName: string;
        profileImage: string | null;
        birthYear: number | null;
        birthPlace: string | null;
        biography: string | null;
      } | null;
    };
  }>(primaryId ? `/api/tree?rootId=${primaryId}` : null, fetcher, { revalidateOnFocus: false });

  const tree = treeData?.data?.tree || null;
  const familyName = primaryFamily?.familyName || treeData?.data?.familyName || 'Family Tree';
  const ancestor = treeData?.data?.foundingAncestor || primaryFamily?.foundingAncestor;

  const handleNodeClick = async (node: TreeNode) => {
    try {
      const response = await fetch(`/api/persons/${node.id}`);
      const result = await response.json();
      if (result.success) {
        setSelectedPerson(result.data);
        setIsModalOpen(true);
      }
    } catch (err) {
      console.error('Error fetching person:', err);
    }
  };

  const isLoading = familiesLoading || (primaryId && treeLoading);
  const hasNoData = !familiesLoading && (!familiesData?.data?.families?.length);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-[0_1px_0_0_rgba(15,23,42,0.04)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-maroon-500 rounded-lg flex items-center justify-center shadow-sm">
                <TreePine className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-lg tracking-tight text-slate-900">{familyName}</span>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <Link href="/tree" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">
                    Full Tree
                  </Link>
                  <Link href="/wiki" className="text-sm text-slate-600 hover:text-slate-900 font-medium transition-colors">
                    Wiki
                  </Link>
                  <Link
                    href="/add-person"
                    className="text-sm bg-maroon-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-maroon-600 transition-colors shadow-sm"
                  >
                    Add Person
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 font-medium flex items-center gap-2 transition-colors">
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="text-sm bg-maroon-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-maroon-600 transition-colors shadow-sm flex items-center gap-2"
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
        {/* Compact intro — keeps the tree high on the page */}
        <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-2">
                  <Heart className="w-3.5 h-3.5 text-maroon-500" strokeWidth={2} />
                  Family Heritage
                </p>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-slate-900 tracking-tight">
                  The <span className="text-maroon-500">{familyName}</span>
                </h1>
                {ancestor && (
                  <p className="text-sm sm:text-base text-slate-600 mt-2">
                    Est. {ancestor.firstName} {ancestor.lastName}
                    {(ancestor as FamilyTreePreview['foundingAncestor']).birthYear &&
                      ` (${(ancestor as FamilyTreePreview['foundingAncestor']).birthYear})`}
                    {(ancestor as FamilyTreePreview['foundingAncestor']).birthPlace &&
                      ` · ${(ancestor as FamilyTreePreview['foundingAncestor']).birthPlace}`}
                  </p>
                )}
                {treeData?.data?.foundingAncestor?.biography && (
                  <p className="text-slate-500 text-sm max-w-2xl line-clamp-2 mt-2">
                    {treeData.data.foundingAncestor.biography}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {primaryId && (
                  <Link
                    href={`/tree?rootId=${primaryId}`}
                    className="inline-flex items-center gap-2 bg-maroon-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-maroon-600 transition-colors shadow-sm"
                  >
                    <Maximize2 className="w-4 h-4" />
                    View Full Tree
                  </Link>
                )}
                {!isAuthenticated && (
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 bg-white text-slate-800 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <UserPlus className="w-4 h-4" />
                    Sign Up to Edit
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Tree + sidebar stats — tree is primary, stats alongside */}
        <section className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 lg:items-stretch min-h-0">
            {/* Tree canvas — maximum vertical space */}
            <div className="flex-1 min-w-0 flex flex-col order-1 min-h-[min(78vh,920px)] lg:min-h-[min(82vh,960px)]">
              <div className="flex items-center justify-between gap-3 mb-3 px-0.5">
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <TreePine className="w-4 h-4 text-maroon-600" />
                  Family tree
                </h2>
                <span className="text-xs text-slate-500 hidden sm:inline">Drag to move · Scroll to zoom</span>
              </div>
              <div className="flex-1 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[min(72vh,880px)] ring-1 ring-slate-900/[0.04]">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full min-h-[inherit]">
                    <div className="text-center">
                      <Loader2 className="w-10 h-10 text-slate-400 animate-spin mx-auto mb-4" />
                      <p className="text-slate-600">Loading family tree...</p>
                    </div>
                  </div>
                ) : hasNoData ? (
                  <EmptyState isAuthenticated={isAuthenticated} />
                ) : (
                  <FamilyTree data={tree} onNodeClick={handleNodeClick} readOnly />
                )}
              </div>
            </div>

            {/* Stats — beside tree on lg+, below on small screens */}
            <aside className="w-full lg:w-[min(100%,20rem)] xl:w-80 shrink-0 order-2 lg:pt-9">
              {stats && primaryFamily ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24 space-y-4 ring-1 ring-slate-900/[0.04]">
                  <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
                    <TreePine className="w-5 h-5 text-maroon-600" />
                    Family at a glance
                  </h3>
                  <p className="text-xs text-slate-500 -mt-2">Key numbers for this family</p>
                  <div className="grid grid-cols-2 gap-3">
                    <FactCard icon={Users} label="Members" value={String(primaryFamily.memberCount)} />
                    <FactCard icon={TreePine} label="Generations" value={String(primaryFamily.generationCount)} />
                    <FactCard icon={Heart} label="Marriages" value={String(stats.marriageCount)} />
                    {primaryFamily.notableCount > 0 && (
                      <FactCard icon={Crown} label="Notable" value={String(primaryFamily.notableCount)} />
                    )}
                  </div>
                  {stats.oldestMember && (
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-400 mb-1">Oldest ancestor</p>
                      <p className="text-sm font-medium text-slate-700">
                        {stats.oldestMember.name}{' '}
                        <span className="text-slate-400">({stats.oldestMember.birthYear})</span>
                      </p>
                    </div>
                  )}
                  {ancestor && (ancestor as FamilyTreePreview['foundingAncestor']).birthPlace && (
                    <div className="flex items-start gap-2 text-sm text-slate-600">
                      <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                      {(ancestor as FamilyTreePreview['foundingAncestor']).birthPlace}
                    </div>
                  )}
                </div>
              ) : (
                !isLoading &&
                !hasNoData && (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
                    Statistics will appear when family data is loaded.
                  </div>
                )
              )}
            </aside>
          </div>
        </section>

        {/* CTA for unauthenticated */}
        {!isAuthenticated && (
          <section className="py-14 px-4 border-t border-slate-100 bg-slate-50/50">
            <div className="max-w-4xl mx-auto">
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-3 tracking-tight">
                  Are You Part of This Family?
                </h2>
                <p className="text-base text-slate-600 mb-8 max-w-xl mx-auto leading-relaxed">
                  Create an account to add yourself, claim your profile, and help grow the family tree.
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <Link
                    href="/register"
                    className="inline-flex items-center bg-maroon-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-maroon-600 transition-colors shadow-sm"
                  >
                    Join the Family
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center bg-white text-slate-800 border border-slate-300 px-6 py-3 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    Already Have an Account?
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="py-8 px-4 border-t border-slate-100 bg-white">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-maroon-500 rounded-md flex items-center justify-center shadow-sm">
                <TreePine className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-slate-900">{familyName}</span>
            </div>
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} FamilyTree. Preserving family histories.
            </p>
          </div>
        </footer>
      </main>

      {/* Person Detail Modal */}
      {isModalOpen && selectedPerson && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto z-10">
            {/* Modal header */}
            <div className="sticky top-0 border-b border-slate-100 bg-white p-6 rounded-t-2xl">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-4 pr-10">
                {selectedPerson.profileImage ? (
                  <img src={selectedPerson.profileImage.url} alt={selectedPerson.firstName} className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-xl font-semibold text-slate-600">
                    {selectedPerson.firstName[0]}{selectedPerson.lastName[0]}
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    {selectedPerson.firstName} {selectedPerson.middleName ? `${selectedPerson.middleName} ` : ''}{selectedPerson.lastName}
                  </h3>
                  {selectedPerson.maidenName && (
                    <p className="text-slate-500 text-sm">n&eacute;e {selectedPerson.maidenName}</p>
                  )}
                  {selectedPerson.nickname && (
                    <p className="text-slate-500 text-sm">&ldquo;{selectedPerson.nickname}&rdquo;</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-4">
              {/* Vital info */}
              <div className="grid grid-cols-2 gap-3">
                {selectedPerson.birthDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-slate-400 text-xs">Born</p>
                      <p className="text-slate-700">{new Date(selectedPerson.birthDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
                {selectedPerson.birthPlace && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-slate-400 text-xs">Birthplace</p>
                      <p className="text-slate-700">{selectedPerson.birthPlace}</p>
                    </div>
                  </div>
                )}
                {selectedPerson.deathDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-slate-400 text-xs">Died</p>
                      <p className="text-slate-700">{new Date(selectedPerson.deathDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
                {selectedPerson.occupation && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-slate-400 text-xs">Occupation</p>
                      <p className="text-slate-700">{selectedPerson.occupation}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Biography */}
              {selectedPerson.biography && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
                    <BookOpen className="w-4 h-4 text-slate-400" /> Biography
                  </h4>
                  <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">
                    {selectedPerson.biography}
                  </p>
                </div>
              )}

              {/* Spouse context */}
              {(selectedPerson.spouseRelations1?.length ?? 0) > 0 || (selectedPerson.spouseRelations2?.length ?? 0) > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
                    <Heart className="w-4 h-4 text-slate-400" /> Spouse(s)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {[...(selectedPerson.spouseRelations1 || []), ...(selectedPerson.spouseRelations2 || [])].map((rel: any) => {
                      const spouse = rel.spouse1?.id === selectedPerson.id ? rel.spouse2 : rel.spouse1;
                      if (!spouse) return null;
                      return (
                        <span key={spouse.id} className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-md border border-slate-200/80">
                          <User className="w-3 h-3" />
                          {spouse.firstName} {spouse.lastName}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Children context */}
              {(selectedPerson.childRelations?.length ?? 0) > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-2">
                    <Users className="w-4 h-4 text-slate-400" /> Children
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(selectedPerson.childRelations ?? []).map((rel: any) => {
                      if (!rel.child) return null;
                      return (
                        <span key={rel.child.id} className="inline-flex items-center gap-1 px-3 py-1 bg-white text-slate-700 text-sm rounded-md border border-slate-200">
                          <User className="w-3 h-3" />
                          {rel.child.firstName} {rel.child.lastName}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3">
                {primaryId && (
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      router.push(`/tree?rootId=${primaryId}`);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 transition-colors"
                  >
                    <Maximize2 className="w-4 h-4" />
                    Open Full Tree
                  </button>
                )}
                {!isAuthenticated ? (
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
                    onClick={() => setIsModalOpen(false)}
                  >
                    <LogIn className="w-4 h-4" />
                    Sign In to Edit / Claim
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      router.push(`/tree?rootId=${primaryId}`);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
                  >
                    Edit in Full Tree
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FactCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-100 p-3 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <Icon className="w-5 h-5 text-slate-500 mx-auto mb-1" />
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function EmptyState({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16">
      <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-200">
        <TreePine className="w-12 h-12 text-slate-500" />
      </div>
      <h3 className="text-2xl font-semibold text-slate-900 mb-4 tracking-tight">No Family Tree Yet</h3>
      <p className="text-slate-600 max-w-md mx-auto mb-8 text-center leading-relaxed">
        Be the first to create a family tree and start documenting your family&apos;s history.
      </p>
      {isAuthenticated ? (
        <Link
          href="/add-person"
          className="inline-flex items-center bg-maroon-500 text-white px-8 py-3.5 rounded-lg font-medium hover:bg-maroon-600 transition-colors shadow-sm"
        >
          Start Your Family Tree
          <ArrowRight className="w-5 h-5 ml-2" />
        </Link>
      ) : (
        <Link
          href="/register"
          className="inline-flex items-center bg-maroon-500 text-white px-8 py-3.5 rounded-lg font-medium hover:bg-maroon-600 transition-colors shadow-sm"
        >
          Create Your Account
          <ArrowRight className="w-5 h-5 ml-2" />
        </Link>
      )}
    </div>
  );
}

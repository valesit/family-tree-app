'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { FamilyTree } from '@/components/tree';
import { Modal } from '@/components/ui';
import { PersonCard } from '@/components/person';
import { TreeNode, PersonWithRelations, SessionUser } from '@/types';
import { Loader2, AlertCircle, Users, TreePine, Calendar, Heart, Lock } from 'lucide-react';
import Link from 'next/link';

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

export default function TreePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [selectedPerson, setSelectedPerson] = useState<PersonWithRelations | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const user = session?.user as SessionUser | undefined;
  const isAuthenticated = status === 'authenticated';

  const { data, error, isLoading, mutate } = useSWR<{
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
      router.push(`/login?callbackUrl=/add-person?parentId=${parentId}`);
      return;
    }
    router.push(`/add-person?parentId=${parentId}`);
  };

  const handleAddSpouse = (personId: string) => {
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=/add-person?spouseId=${personId}`);
      return;
    }
    router.push(`/add-person?spouseId=${personId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading your family tree...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-4" />
          <p className="text-slate-600">Failed to load family tree</p>
          <button
            onClick={() => mutate()}
            className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { tree, stats } = data?.data || { tree: null, stats: null };

  return (
    <div className="relative">
      {/* Stats bar */}
      {stats && (
        <div className="absolute top-4 left-4 right-4 z-10 flex justify-center">
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
                router.push(`/person/${selectedPerson.id}/edit`);
              } : undefined}
              onRequestCorrection={isAuthenticated ? () => {
                setIsModalOpen(false);
                router.push(`/corrections/new?personId=${selectedPerson.id}`);
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
    </div>
  );
}

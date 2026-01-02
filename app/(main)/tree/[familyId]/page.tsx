'use client';

import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { FamilyTree } from '@/components/tree';
import { Modal, Button, Card, Avatar } from '@/components/ui';
import { PersonCard } from '@/components/person';
import { NotablePersonsCarousel } from '@/components/notable';
import { TreeNode, PersonWithRelations, SessionUser } from '@/types';
import { 
  Loader2, 
  AlertCircle, 
  Users, 
  TreePine, 
  Calendar, 
  Heart, 
  Lock, 
  ChevronLeft, 
  ChevronRight,
  Maximize2,
  Minimize2,
  BookOpen,
  Crown,
  MapPin,
  ArrowLeft,
  PanelLeftClose,
  PanelRightClose,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

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

interface FamilyData {
  tree: TreeNode | null;
  stats: TreeStats | null;
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
  };
}

export default function FamilyViewPage() {
  const router = useRouter();
  const params = useParams();
  const familyId = params.familyId as string;
  const { data: session, status } = useSession();
  
  const [selectedPerson, setSelectedPerson] = useState<PersonWithRelations | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leftPanelExpanded, setLeftPanelExpanded] = useState(false);
  const [rightPanelExpanded, setRightPanelExpanded] = useState(false);

  const user = session?.user as SessionUser | undefined;
  const isAuthenticated = status === 'authenticated';

  // Fetch family tree data
  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data: FamilyData;
  }>(`/api/tree?rootId=${familyId}`, fetcher, {
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

  const handleAddParent = (childId: string) => {
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=/add-person?childId=${childId}`);
      return;
    }
    router.push(`/add-person?childId=${childId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-maroon-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading family tree...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-4" />
          <p className="text-slate-600 mb-4">Failed to load family tree</p>
          <Link href="/" className="text-maroon-600 hover:text-maroon-700 font-medium">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const { tree, stats, familyName, foundingAncestor } = data.data;

  // If left panel is expanded, show only left panel
  if (leftPanelExpanded) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-slate-500 hover:text-slate-700">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">{familyName} Family Overview</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLeftPanelExpanded(false)}
            >
              <Minimize2 className="w-4 h-4 mr-2" />
              Exit Full Screen
            </Button>
          </div>
        </div>
        
        {/* Full Overview Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <FamilyOverviewContent 
            familyName={familyName}
            foundingAncestor={foundingAncestor}
            stats={stats}
            isAuthenticated={isAuthenticated}
            familyId={familyId}
          />
        </div>
      </div>
    );
  }

  // If right panel is expanded, show only tree
  if (rightPanelExpanded) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-slate-500 hover:text-slate-700">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">{familyName} Family Tree</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRightPanelExpanded(false)}
            >
              <Minimize2 className="w-4 h-4 mr-2" />
              Exit Full Screen
            </Button>
          </div>
        </div>
        
        {/* Full Tree Content */}
        <div className="flex-1 relative">
          <FamilyTree
            data={tree}
            onNodeClick={handleNodeClick}
            onAddChild={handleAddChild}
            onAddSpouse={handleAddSpouse}
            onAddParent={handleAddParent}
          />
        </div>

        {/* Person Modal */}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="lg">
          {selectedPerson && (
            <PersonCard
              person={selectedPerson}
              showActions={isAuthenticated}
              onEdit={isAuthenticated ? () => {
                setIsModalOpen(false);
                router.push(`/person/${selectedPerson.id}/edit`);
              } : undefined}
            />
          )}
        </Modal>
      </div>
    );
  }

  // Default: Split view
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-500 hover:text-slate-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{familyName} Family</h1>
              <p className="text-sm text-slate-500">
                {stats?.totalMembers || 0} members • {stats?.marriageCount || 0} marriages
              </p>
            </div>
          </div>
          {!isAuthenticated && (
            <Link
              href="/login"
              className="flex items-center gap-2 px-4 py-2 bg-maroon-100 text-maroon-700 rounded-xl font-medium hover:bg-maroon-200 transition-colors"
            >
              <Lock className="w-4 h-4" />
              Sign in to contribute
            </Link>
          )}
        </div>
      </div>

      {/* Split View Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Family Overview */}
        <div className="w-1/3 min-w-[350px] max-w-[500px] bg-slate-50 border-r border-slate-200 flex flex-col">
          {/* Panel Header */}
          <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-maroon-500" />
              Family Overview
            </h2>
            <button
              onClick={() => setLeftPanelExpanded(true)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              title="Expand Overview"
            >
              <Maximize2 className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          
          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <FamilyOverviewContent 
              familyName={familyName}
              foundingAncestor={foundingAncestor}
              stats={stats}
              isAuthenticated={isAuthenticated}
              familyId={familyId}
              compact
            />
          </div>
        </div>

        {/* Right Panel - Family Tree */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Panel Header */}
          <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <TreePine className="w-4 h-4 text-maroon-500" />
              Family Tree
            </h2>
            <button
              onClick={() => setRightPanelExpanded(true)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              title="Expand Tree"
            >
              <Maximize2 className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          
          {/* Tree Content */}
          <div className="flex-1 relative">
            <FamilyTree
              data={tree}
              onNodeClick={handleNodeClick}
              onAddChild={handleAddChild}
              onAddSpouse={handleAddSpouse}
              onAddParent={handleAddParent}
            />
          </div>
        </div>
      </div>

      {/* Person Detail Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="lg">
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
                      <Link href="/register" className="underline hover:text-amber-800">create an account</Link> to add information.
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

// Family Overview Content Component
function FamilyOverviewContent({ 
  familyName, 
  foundingAncestor, 
  stats, 
  isAuthenticated,
  familyId,
  compact = false 
}: {
  familyName: string;
  foundingAncestor: FamilyData['foundingAncestor'];
  stats: TreeStats | null;
  isAuthenticated: boolean;
  familyId: string;
  compact?: boolean;
}) {
  return (
    <div className={clsx('space-y-6', compact && 'space-y-4')}>
      {/* Founding Ancestor Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-maroon-500 to-maroon-700 p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-white/20 overflow-hidden flex items-center justify-center">
              {foundingAncestor.profileImage ? (
                <img 
                  src={foundingAncestor.profileImage} 
                  alt={foundingAncestor.firstName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold">
                  {foundingAncestor.firstName[0]}{foundingAncestor.lastName[0]}
                </span>
              )}
            </div>
            <div>
              <p className="text-maroon-200 text-sm">Founding Ancestor</p>
              <h3 className="text-xl font-bold">
                {foundingAncestor.firstName} {foundingAncestor.lastName}
              </h3>
              <div className="flex items-center gap-3 mt-1 text-sm text-maroon-100">
                {foundingAncestor.birthYear && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {foundingAncestor.birthYear}
                  </span>
                )}
                {foundingAncestor.birthPlace && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {foundingAncestor.birthPlace}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        {foundingAncestor.biography && (
          <div className="p-4">
            <p className="text-sm text-slate-600 line-clamp-4">
              {foundingAncestor.biography}
            </p>
          </div>
        )}
      </Card>

      {/* Statistics */}
      {stats && (
        <Card>
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-maroon-500" />
            Family Statistics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <p className="text-2xl font-bold text-maroon-600">{stats.totalMembers}</p>
              <p className="text-xs text-slate-500">Total Members</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <p className="text-2xl font-bold text-maroon-600">{stats.livingCount}</p>
              <p className="text-xs text-slate-500">Living</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <p className="text-2xl font-bold text-rose-500">{stats.marriageCount}</p>
              <p className="text-xs text-slate-500">Marriages</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <p className="text-2xl font-bold text-slate-600">{stats.deceasedCount}</p>
              <p className="text-xs text-slate-500">Deceased</p>
            </div>
          </div>
          
          {stats.oldestMember && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm">
                <Crown className="w-4 h-4 text-amber-500" />
                <span className="text-slate-600">Oldest: </span>
                <span className="font-medium text-slate-900">
                  {stats.oldestMember.name} ({stats.oldestMember.birthYear})
                </span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Notable Persons */}
      <Card>
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-500" />
          Notable Persons
        </h3>
        <NotablePersonsCarousel familyId={familyId} compact={compact} />
      </Card>

      {/* Family Wiki Link */}
      <Card className="bg-maroon-50 border-maroon-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-maroon-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Family Wiki
            </h3>
            <p className="text-sm text-maroon-700 mt-1">
              Read and contribute to family history
            </p>
          </div>
          <Link
            href="/wiki"
            className="px-4 py-2 bg-maroon-500 text-white rounded-lg text-sm font-medium hover:bg-maroon-600 transition-colors"
          >
            View Wiki
          </Link>
        </div>
      </Card>

      {/* Actions */}
      {isAuthenticated && (
        <Card>
          <h3 className="font-semibold text-slate-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Link
              href="/add-person"
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-maroon-300 hover:bg-maroon-50 transition-colors"
            >
              <div className="w-8 h-8 bg-maroon-100 rounded-lg flex items-center justify-center">
                <Users className="w-4 h-4 text-maroon-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Add Family Member</p>
                <p className="text-xs text-slate-500">Add a new person to the tree</p>
              </div>
            </Link>
            <Link
              href="/wiki/new"
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-maroon-300 hover:bg-maroon-50 transition-colors"
            >
              <div className="w-8 h-8 bg-maroon-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-maroon-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Write Wiki Article</p>
                <p className="text-xs text-slate-500">Document family stories</p>
              </div>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}


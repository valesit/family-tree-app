'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { FamilyTree, ExpandedTreeView } from '@/components/tree';
import { Modal, Button, Avatar } from '@/components/ui';
import { PersonCard } from '@/components/person';
import { TreeNode, PersonWithRelations, SessionUser } from '@/types';
import { 
  Loader2, AlertCircle, Users, TreePine, Calendar, Heart, Lock, 
  Maximize2, BookOpen, Award, MapPin, Briefcase, ChevronRight,
  ChevronUp, ChevronDown, ChevronLeft, X, UserPlus, Pencil, Save
} from 'lucide-react';
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

interface FoundingAncestor {
  id: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
  birthYear: number | null;
  birthPlace: string | null;
  biography: string | null;
}

export default function TreePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [selectedPerson, setSelectedPerson] = useState<PersonWithRelations | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExpandedViewOpen, setIsExpandedViewOpen] = useState(false);
  
  // Family name edit state
  const [isEditingFamilyName, setIsEditingFamilyName] = useState(false);
  const [editedFamilyName, setEditedFamilyName] = useState('');
  const [isSavingFamilyName, setIsSavingFamilyName] = useState(false);

  const user = session?.user as SessionUser | undefined;
  const isAuthenticated = status === 'authenticated';
  const isAdmin = user?.role === 'ADMIN';

  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data: {
      tree: TreeNode | null;
      stats: TreeStats | null;
      rootPersonId: string;
      familyName: string;
      foundingAncestor: FoundingAncestor | null;
    };
  }>('/api/tree', fetcher, {
    revalidateOnFocus: false,
  });

  // Fetch notable persons
  const { data: notableData } = useSWR<{
    success: boolean;
    data: Array<{
      id: string;
      firstName: string;
      lastName: string;
      notableTitle: string | null;
      notableDescription: string | null;
      notableAchievements: string | null;
      profileImage?: { url: string } | null;
    }>;
  }>(data?.data?.rootPersonId ? `/api/notable?familyId=${data.data.rootPersonId}` : null, fetcher);

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

  const handleViewBirthFamily = (personId: string, maidenName?: string, birthFamilyRootPersonId?: string) => {
    if (birthFamilyRootPersonId) {
      // Direct link to the birth family tree
      router.push(`/tree?rootId=${birthFamilyRootPersonId}`);
    } else if (maidenName) {
      // Search for families with this surname
      router.push(`/?search=${encodeURIComponent(maidenName)}`);
    }
  };

  // Handle saving edited family name
  const handleSaveFamilyName = async () => {
    if (!data?.data?.rootPersonId || !editedFamilyName.trim()) return;
    
    setIsSavingFamilyName(true);
    try {
      if (isAdmin) {
        // Admin can save directly
        const response = await fetch('/api/family', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rootPersonId: data.data.rootPersonId,
            name: editedFamilyName.trim(),
          }),
        });
        
        if (response.ok) {
          mutate();
          setIsEditingFamilyName(false);
        } else {
          const result = await response.json();
          alert(result.error || 'Failed to save family name');
        }
      } else {
        // Regular user - submit for approval
        const response = await fetch('/api/approvals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'UPDATE_FAMILY_NAME',
            personId: data.data.rootPersonId, // Use root person as reference
            currentData: { familyName: familyName },
            proposedData: { familyName: editedFamilyName.trim() },
            reason: `Proposed family name change: "${familyName}" → "${editedFamilyName.trim()}"`,
            requiredApprovals: 2, // Requires 2 family member approvals or 1 admin
          }),
        });
        
        if (response.ok) {
          setIsEditingFamilyName(false);
          alert('Your family name change has been submitted for approval. It needs approval from 2 family members or an admin.');
        } else {
          const result = await response.json();
          alert(result.error || 'Failed to submit family name change');
        }
      }
    } catch (error) {
      console.error('Error saving family name:', error);
      alert('Failed to save family name');
    } finally {
      setIsSavingFamilyName(false);
    }
  };

  // Start editing family name
  const handleStartEditFamilyName = () => {
    setEditedFamilyName(familyName || '');
    setIsEditingFamilyName(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-maroon-500 animate-spin mx-auto mb-4" />
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
            className="mt-4 text-maroon-600 hover:text-maroon-700 font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { tree, stats, familyName, foundingAncestor } = data?.data || { 
    tree: null, 
    stats: null, 
    familyName: null, 
    foundingAncestor: null 
  };

  const notablePersons = notableData?.data || [];

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            {isEditingFamilyName ? (
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={editedFamilyName}
                  onChange={(e) => setEditedFamilyName(e.target.value)}
                  className="text-xl font-bold text-slate-900 px-3 py-1 border-2 border-maroon-300 rounded-lg focus:border-maroon-500 focus:outline-none"
                  placeholder="e.g., Sithole Family"
                  autoFocus
                />
                <button
                  onClick={handleSaveFamilyName}
                  disabled={isSavingFamilyName || !editedFamilyName.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-maroon-600 text-white text-sm rounded-lg hover:bg-maroon-700 disabled:opacity-50 transition-colors"
                >
                  {isSavingFamilyName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isAdmin ? 'Save' : 'Submit'}
                </button>
                <button
                  onClick={() => setIsEditingFamilyName(false)}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{familyName || 'Family'}</h1>
                {isAuthenticated && (
                  <button
                    onClick={handleStartEditFamilyName}
                    className="p-1.5 text-slate-400 hover:text-maroon-600 hover:bg-maroon-50 rounded-lg transition-colors"
                    title={isAdmin ? "Edit family name" : "Propose family name change"}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            <p className="text-sm text-slate-500">
              {stats ? `${stats.totalMembers} members • ${stats.marriageCount} marriages` : 'Loading...'}
            </p>
          </div>
        </div>
        
        {!isAuthenticated && (
          <Link
            href="/login"
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Lock className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Sign in to contribute</span>
          </Link>
        )}
      </div>

      {/* Main Content - Two Panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Family Overview (20%) */}
        <div className="w-1/5 min-w-[280px] border-r border-slate-200 flex flex-col bg-white">
          {/* Panel Header */}
          <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-slate-600" />
              <span className="font-semibold text-slate-900">Family Overview</span>
            </div>
            <button
              onClick={() => setIsExpandedViewOpen(true)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              title="Expand view"
            >
              <Maximize2 className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          
          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Founding Ancestor Card */}
            {foundingAncestor && (
              <div className="bg-gradient-to-br from-maroon-600 to-maroon-800 rounded-xl p-4 text-white">
                <p className="text-[10px] font-medium text-maroon-200 uppercase tracking-wider mb-2">Founding Ancestor</p>
                <div className="flex items-center gap-3">
                  <Avatar 
                    src={foundingAncestor.profileImage || undefined}
                    name={`${foundingAncestor.firstName} ${foundingAncestor.lastName}`}
                    size="lg"
                    className="ring-2 ring-white/20 shadow-lg flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <h2 className="text-base font-bold truncate">{foundingAncestor.firstName} {foundingAncestor.lastName}</h2>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-maroon-200 text-xs">
                      {foundingAncestor.birthYear && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {foundingAncestor.birthYear}
                        </span>
                      )}
                      {foundingAncestor.birthPlace && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{foundingAncestor.birthPlace}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Biography */}
            {foundingAncestor?.biography && (
              <p className="text-slate-600 leading-relaxed">
                {foundingAncestor.biography}
              </p>
            )}

            {/* Family Statistics */}
            {stats && (
                <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
                  <Users className="w-5 h-5 text-slate-600" />
                  Family Statistics
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-slate-50 rounded-lg">
                    <p className="text-xl font-bold text-maroon-600">{stats.totalMembers}</p>
                    <p className="text-xs text-slate-500">Members</p>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded-lg">
                    <p className="text-xl font-bold text-emerald-600">{stats.livingCount}</p>
                  <p className="text-xs text-slate-500">Living</p>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded-lg">
                    <p className="text-xl font-bold text-rose-500">{stats.marriageCount}</p>
                    <p className="text-xs text-slate-500">Marriages</p>
                  </div>
                  <div className="text-center p-2 bg-slate-50 rounded-lg">
                    <p className="text-xl font-bold text-slate-500">{stats.deceasedCount}</p>
                    <p className="text-xs text-slate-500">Deceased</p>
                  </div>
                </div>
              </div>
            )}

            {/* Oldest Member */}
            {stats?.oldestMember && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Award className="w-5 h-5 text-amber-500" />
                <span>Oldest:</span>
                <span className="font-medium text-slate-900">{stats.oldestMember.name} ({stats.oldestMember.birthYear})</span>
              </div>
            )}

            {/* Notable Members - Cards */}
            {notablePersons.length > 0 && (
                <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-4">
                  <Award className="w-5 h-5 text-amber-500" />
                  Notable Family Members
                  <span className="text-xs text-slate-400 font-normal">({notablePersons.length})</span>
                </h3>
                <div className="space-y-3">
                  {notablePersons.map((person) => (
                    <button 
                      key={person.id}
                      onClick={() => router.push(`/person/${person.id}`)}
                      className="w-full flex items-center gap-3 p-3 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors text-left border border-amber-200"
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar 
                          src={person.profileImage?.url}
                          name={`${person.firstName} ${person.lastName}`}
                          size="md"
                          className="ring-2 ring-amber-300"
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center border-2 border-white">
                          <Award className="w-2 h-2 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-900 text-sm truncate">
                          {person.firstName} {person.lastName}
                        </h4>
                        <p className="text-xs text-amber-600 truncate">
                          {person.notableTitle || 'Notable Member'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div className="flex gap-3">
              <Link 
                href="/wiki"
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-maroon-50 text-maroon-700 rounded-xl hover:bg-maroon-100 transition-colors font-medium"
              >
                <BookOpen className="w-5 h-5" />
                Family Wiki
              </Link>
            </div>
          </div>
        </div>

        {/* Right Panel - Family Tree (80%) */}
        <div className="w-4/5 flex flex-col bg-white">
          {/* Panel Header */}
          <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TreePine className="w-5 h-5 text-slate-600" />
              <span className="font-semibold text-slate-900">Family Tree</span>
            </div>
            <button
              onClick={() => setIsExpandedViewOpen(true)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              title="Expand view"
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
              onViewBirthFamily={handleViewBirthFamily}
      />
          </div>
        </div>
      </div>

      {/* Person Detail Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="xl"
      >
        {selectedPerson && (
          <div className="space-y-6">
            {/* Header with gradient and close button */}
            <div className="relative -m-6 mb-0">
              {/* Close button */}
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-3 right-3 z-10 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors backdrop-blur-sm"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className={`h-32 bg-gradient-to-r ${
                selectedPerson.gender === 'MALE' 
                  ? 'from-sky-400 to-blue-500' 
                  : selectedPerson.gender === 'FEMALE'
                  ? 'from-pink-400 to-rose-500'
                  : 'from-slate-400 to-slate-500'
              }`}>
                <div className="absolute -bottom-12 left-6">
                  <Avatar 
                    src={selectedPerson.profileImage?.url}
                    name={`${selectedPerson.firstName} ${selectedPerson.lastName}`}
                    size="2xl"
                    className="ring-4 ring-white shadow-xl"
                  />
                </div>
              </div>
            </div>

            {/* Person info */}
            <div className="pt-14 px-2">
              <div className="flex items-start justify-between">
          <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {selectedPerson.firstName} {selectedPerson.middleName} {selectedPerson.lastName}
                  </h2>
                  {selectedPerson.maidenName && (
                    <p className="text-sm text-purple-600">née {selectedPerson.maidenName}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                    {selectedPerson.birthDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(selectedPerson.birthDate).toLocaleDateString()}
                        {selectedPerson.deathDate && ` - ${new Date(selectedPerson.deathDate).toLocaleDateString()}`}
                      </span>
                    )}
                    {selectedPerson.birthPlace && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {selectedPerson.birthPlace}
                      </span>
                    )}
                  </div>
                  {selectedPerson.occupation && (
                    <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                      <Briefcase className="w-4 h-4" />
                      {selectedPerson.occupation}
                    </p>
                  )}
                </div>
                
                {/* Status badge */}
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedPerson.isLiving 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {selectedPerson.isLiving ? 'Living' : 'Deceased'}
                </div>
              </div>

              {/* Biography */}
              {selectedPerson.biography && (
                <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Biography</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{selectedPerson.biography}</p>
                </div>
              )}

              {/* Notable info if applicable */}
              {selectedPerson.isNotable ? (
                <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <h4 className="font-semibold text-amber-800">{selectedPerson.notableTitle}</h4>
                  </div>
                  {selectedPerson.notableDescription && (
                    <p className="text-sm text-amber-700">{selectedPerson.notableDescription}</p>
                  )}
                </div>
              ) : isAdmin && (
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    router.push(`/person/${selectedPerson.id}#notable`);
                  }}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl hover:bg-amber-100 transition-colors text-sm"
                >
                  <Award className="w-4 h-4" />
                  Mark as Notable Person
                </button>
              )}

              {/* Action buttons */}
              <div className="mt-6 pt-4 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Add Family Member</h4>
                <div className="grid grid-cols-4 gap-3">
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      handleAddChild(selectedPerson.id);
                    }}
                    className="flex flex-col items-center justify-center gap-1 px-3 py-3 bg-maroon-500 text-white rounded-xl hover:bg-maroon-600 transition-colors"
                  >
                    <ChevronDown className="w-5 h-5" />
                    <span className="text-xs font-medium">Child</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      handleAddParent(selectedPerson.id);
                    }}
                    className="flex flex-col items-center justify-center gap-1 px-3 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    <ChevronUp className="w-5 h-5" />
                    <span className="text-xs font-medium">Parent</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      handleAddSpouse(selectedPerson.id);
                    }}
                    className="flex flex-col items-center justify-center gap-1 px-3 py-3 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-colors"
                  >
                    <Heart className="w-5 h-5" />
                    <span className="text-xs font-medium">Spouse</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      router.push('/add-person');
                    }}
                    className="flex flex-col items-center justify-center gap-1 px-3 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors"
                  >
                    <UserPlus className="w-5 h-5" />
                    <span className="text-xs font-medium">Relative</span>
                  </button>
                </div>
                
                {/* View profile button */}
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    router.push(`/person/${selectedPerson.id}`);
                  }}
                  className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <Users className="w-4 h-4" />
                  <span className="font-medium">View Full Profile</span>
                </button>

                {isAuthenticated && (
                  <div className="flex gap-3 mt-3">
                    <button
                      onClick={() => {
                setIsModalOpen(false);
                router.push(`/person/${selectedPerson.id}/edit`);
                      }}
                      className="flex-1 text-sm text-slate-600 hover:text-maroon-600 py-2"
                    >
                      Edit Person
                    </button>
                    <button
                      onClick={() => {
                setIsModalOpen(false);
                router.push(`/corrections/new?personId=${selectedPerson.id}`);
                      }}
                      className="flex-1 text-sm text-slate-600 hover:text-maroon-600 py-2"
                    >
                      Request Correction
                    </button>
                  </div>
                )}
              </div>

            {!isAuthenticated && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Want to contribute?</p>
                    <p className="text-xs text-amber-600">
                      <Link href="/login" className="underline hover:text-amber-800">Sign in</Link> or{' '}
                        <Link href="/register" className="underline hover:text-amber-800">create an account</Link> to add family members.
                    </p>
                    </div>
                  </div>
                </div>
              )}
              </div>
          </div>
        )}
      </Modal>

      {/* Expanded Tree View */}
      <ExpandedTreeView
        isOpen={isExpandedViewOpen}
        onClose={() => setIsExpandedViewOpen(false)}
        currentUser={user || null}
      />
    </div>
  );
}


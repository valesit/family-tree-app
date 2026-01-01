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
  ChevronUp, ChevronDown, X, UserPlus, Pencil, Save
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
      const response = await fetch('/api/family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rootPersonId: data.data.rootPersonId,
          name: editedFamilyName.trim(),
        }),
      });
      
      if (response.ok) {
        // Refresh tree data to get updated family name
        mutate();
        setIsEditingFamilyName(false);
      } else {
        const result = await response.json();
        alert(result.error || 'Failed to save family name');
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
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left Panel - Family Overview (wider) */}
      <div className="w-[55%] min-w-[700px] max-w-[900px] bg-gradient-to-b from-slate-50 to-white border-r border-slate-200 overflow-y-auto flex-shrink-0">
        <div className="p-8 space-y-8">
          {/* Family Header */}
          <div className="flex items-center gap-6">
            <div className="flex items-center justify-center w-24 h-24 bg-gradient-to-br from-maroon-500 to-maroon-700 rounded-2xl shadow-lg">
              <TreePine className="w-12 h-12 text-white" />
            </div>
            <div className="flex-1">
              {isEditingFamilyName ? (
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={editedFamilyName}
                    onChange={(e) => setEditedFamilyName(e.target.value)}
                    className="flex-1 text-2xl font-bold text-slate-900 px-3 py-2 border-2 border-maroon-300 rounded-lg focus:border-maroon-500 focus:outline-none"
                    placeholder="e.g., Sithole/Mutseyami Family"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveFamilyName}
                    disabled={isSavingFamilyName || !editedFamilyName.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-maroon-600 text-white rounded-lg hover:bg-maroon-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSavingFamilyName ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingFamilyName(false)}
                    className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-slate-900">
                    {familyName || 'Family'} Tree
                  </h1>
                  {isAdmin && (
                    <button
                      onClick={handleStartEditFamilyName}
                      className="p-2 text-slate-400 hover:text-maroon-600 hover:bg-maroon-50 rounded-lg transition-colors"
                      title="Edit family name"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-slate-500 mt-1">Family Heritage & Legacy</p>
              {stats && (
                <p className="text-sm text-maroon-600 mt-2">
                  {stats.totalMembers} members across multiple generations
                </p>
              )}
            </div>
          </div>

          {/* Stats Grid - 6 columns for wider layout */}
      {stats && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
              <div className="grid grid-cols-6 gap-6 text-center">
                <div className="p-3 bg-maroon-50 rounded-xl">
                  <Users className="w-6 h-6 text-maroon-600 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-slate-900">{stats.totalMembers}</p>
                  <p className="text-sm text-slate-500">Total Members</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl">
                  <TreePine className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-slate-900">{stats.livingCount}</p>
                  <p className="text-sm text-slate-500">Living</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <Calendar className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-slate-900">{stats.deceasedCount}</p>
                  <p className="text-sm text-slate-500">Ancestors</p>
                </div>
                <div className="p-3 bg-rose-50 rounded-xl">
                  <Heart className="w-6 h-6 text-rose-600 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-slate-900">{stats.marriageCount}</p>
                  <p className="text-sm text-slate-500">Marriages</p>
                </div>
                <div className="p-3 bg-sky-50 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-sky-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-slate-900">{stats.maleCount}</p>
                  <p className="text-sm text-slate-500">Male</p>
                </div>
                <div className="p-3 bg-pink-50 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-pink-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-slate-900">{stats.femaleCount}</p>
                  <p className="text-sm text-slate-500">Female</p>
                </div>
              </div>
            </div>
          )}

          {/* Two column layout for Founding Ancestor and Quick Actions */}
          <div className="grid grid-cols-2 gap-6">
            {/* Founding Ancestor */}
            {foundingAncestor && (
              <div className="bg-gradient-to-br from-maroon-50 to-rose-50 rounded-xl p-5 border border-maroon-100">
                <h3 className="text-xs font-semibold text-maroon-700 uppercase tracking-wide mb-4">
                  Founding Ancestor
                </h3>
                <div className="flex items-start gap-4">
                  <Avatar 
                    src={foundingAncestor.profileImage || undefined}
                    name={`${foundingAncestor.firstName} ${foundingAncestor.lastName}`}
                    size="xl"
                    className="ring-2 ring-white shadow-md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg text-slate-900">
                      {foundingAncestor.firstName} {foundingAncestor.lastName}
                    </p>
                    {foundingAncestor.birthYear && (
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                        <Calendar className="w-4 h-4" />
                        Born {foundingAncestor.birthYear}
                      </p>
                    )}
                    {foundingAncestor.birthPlace && (
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-4 h-4" />
                        {foundingAncestor.birthPlace}
                      </p>
                    )}
                  </div>
                </div>
                {foundingAncestor.biography && (
                  <p className="text-sm text-slate-600 mt-4 leading-relaxed">
                    {foundingAncestor.biography}
                  </p>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="space-y-4">
              <Link 
                href="/wiki"
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-maroon-300 hover:bg-maroon-50 transition-all group"
              >
                <div className="p-3 bg-maroon-100 rounded-xl group-hover:bg-maroon-200 transition-colors">
                  <BookOpen className="w-6 h-6 text-maroon-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">Family Wiki</p>
                  <p className="text-sm text-slate-500">Read stories, history & articles about your family</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-maroon-500" />
              </Link>

              <button
                onClick={() => setIsExpandedViewOpen(true)}
                className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-maroon-300 hover:bg-maroon-50 transition-all group"
              >
                <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-slate-200 transition-colors">
                  <Maximize2 className="w-6 h-6 text-slate-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-slate-900">Expanded View</p>
                  <p className="text-sm text-slate-500">See complete family overview and details</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-maroon-500" />
              </button>
                </div>
              </div>

          {/* Notable Members - Cards */}
          {notablePersons.length > 0 && (
                    <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-amber-500" />
                Notable Family Members
                <span className="text-xs text-slate-400 font-normal">({notablePersons.length})</span>
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {notablePersons.map((person) => (
                  <div 
                    key={person.id}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-lg transition-shadow"
                  >
                    {/* Orange gradient header */}
                    <div className="h-16 bg-gradient-to-r from-amber-400 to-orange-400 relative">
                      {/* Avatar positioned at bottom of header */}
                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
                        <div className="relative">
                          <Avatar 
                            src={person.profileImage?.url}
                            name={`${person.firstName} ${person.lastName}`}
                            size="xl"
                            className="ring-4 ring-white shadow-lg"
                          />
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white">
                            <Award className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="pt-10 pb-4 px-4 text-center">
                      <h4 className="font-bold text-slate-900">
                        {person.firstName} {person.lastName}
                      </h4>
                      <p className="text-sm text-amber-600 font-medium mt-0.5">
                        {person.notableTitle || 'Notable Member'}
                      </p>
                      
                      {person.notableDescription && (
                        <p className="text-xs text-slate-500 mt-3 line-clamp-3">
                          {person.notableDescription}
                        </p>
                      )}
                      
                      {/* Achievement tags */}
                      {person.notableAchievements && (
                        <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                          {(JSON.parse(person.notableAchievements) as string[]).slice(0, 3).map((achievement, idx) => (
                            <span 
                              key={idx}
                              className="text-[10px] px-2 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200"
                            >
                              {achievement}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <button
                        onClick={() => router.push(`/person/${person.id}`)}
                        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-amber-600 mt-4 font-medium"
                      >
                        View Profile
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legend - Horizontal for wider layout */}
          <div className="bg-slate-100/50 rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-sky-400 border-2 border-sky-500" />
                  <span className="text-sm text-slate-600">Male</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-pink-400 border-2 border-pink-500" />
                  <span className="text-sm text-slate-600">Female</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500" />
                  <span className="text-sm text-slate-600">Living</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-slate-400" />
                  <span className="text-sm text-slate-600">Deceased</span>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500" fill="currentColor" />
                  <span className="text-sm text-slate-600">Marriage</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-purple-500 text-white text-[10px] rounded-full font-medium">née</span>
                  <span className="text-sm text-slate-600">Birth Family</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Family Tree (2/3) */}
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
              {selectedPerson.isNotable && (
                <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    <h4 className="font-semibold text-amber-800">{selectedPerson.notableTitle}</h4>
                  </div>
                  {selectedPerson.notableDescription && (
                    <p className="text-sm text-amber-700">{selectedPerson.notableDescription}</p>
                  )}
                </div>
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


'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { PersonForm } from '@/components/person';
import { Card, Select, Button, Avatar } from '@/components/ui';
import { PersonInput } from '@/lib/validators';
import { PersonWithRelations } from '@/types';
import { ArrowLeft, Check, AlertCircle, Loader2, Users, UserPlus, Heart, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

const fetcher = (url: string) => fetch(url).then(res => res.json());

type RelationshipMode = 'none' | 'child_of' | 'parent_of' | 'spouse_of';

function AddPersonContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // URL params for direct links from tree
  const parentIdParam = searchParams.get('parentId');
  const spouseIdParam = searchParams.get('spouseId');
  const childIdParam = searchParams.get('childId');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Relationship selection state
  const [relationshipMode, setRelationshipMode] = useState<RelationshipMode>('none');
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [relationshipSubtype, setRelationshipSubtype] = useState<string>('PARENT_CHILD');

  // Fetch all existing persons for dropdown
  const { data: personsData, isLoading: personsLoading } = useSWR<{
    success: boolean;
    data: { items: PersonWithRelations[] };
  }>('/api/persons?limit=500', fetcher);

  const allPersons = personsData?.data?.items || [];

  // Initialize from URL params
  useEffect(() => {
    if (parentIdParam) {
      setRelationshipMode('child_of');
      setSelectedPersonId(parentIdParam);
      setRelationshipSubtype('PARENT_CHILD');
    } else if (spouseIdParam) {
      setRelationshipMode('spouse_of');
      setSelectedPersonId(spouseIdParam);
      setRelationshipSubtype('SPOUSE');
    } else if (childIdParam) {
      setRelationshipMode('parent_of');
      setSelectedPersonId(childIdParam);
      setRelationshipSubtype('PARENT_CHILD');
    }
  }, [parentIdParam, spouseIdParam, childIdParam]);

  const handleSubmit = async (data: PersonInput, profileImage?: File) => {
    setIsLoading(true);
    setError(null);

    try {
      // First create the person
      const response = await fetch('/api/persons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create person');
      }

      const newPersonId = result.data?.id;

      // Create relationship if one is selected
      if (relationshipMode !== 'none' && selectedPersonId && newPersonId) {
        let relationshipData;

        if (relationshipMode === 'child_of') {
          // New person is a child of selected person
          relationshipData = {
            type: relationshipSubtype,
            person1Id: selectedPersonId, // Parent
            person2Id: newPersonId,       // Child (new person)
          };
        } else if (relationshipMode === 'parent_of') {
          // New person is a parent of selected person
          relationshipData = {
            type: relationshipSubtype,
            person1Id: newPersonId,       // Parent (new person)
            person2Id: selectedPersonId,  // Child
          };
        } else if (relationshipMode === 'spouse_of') {
          // New person is spouse of selected person
          relationshipData = {
            type: 'SPOUSE',
            person1Id: selectedPersonId,
            person2Id: newPersonId,
          };
        }

        if (relationshipData) {
          const relationshipResponse = await fetch('/api/relationships', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(relationshipData),
          });

          const relationshipResult = await relationshipResponse.json();
          if (!relationshipResult.success) {
            console.error('Failed to create relationship:', relationshipResult.error);
          }
        }
      }

      // Upload profile image if provided
      if (profileImage && newPersonId) {
        const formData = new FormData();
        formData.append('image', profileImage);
        formData.append('personId', newPersonId);

        await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
      }

      // Redirect to tree or show success
      router.push('/tree');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  // Get selected person details
  const selectedPerson = allPersons.find(p => p.id === selectedPersonId);

  // Get relationship type options based on mode
  const getRelationshipOptions = () => {
    if (relationshipMode === 'child_of') {
      return [
        { value: 'PARENT_CHILD', label: 'Biological Child' },
        { value: 'ADOPTED', label: 'Adopted Child' },
        { value: 'STEP_CHILD', label: 'Step Child' },
        { value: 'FOSTER', label: 'Foster Child' },
      ];
    } else if (relationshipMode === 'parent_of') {
      return [
        { value: 'PARENT_CHILD', label: 'Biological Parent' },
        { value: 'ADOPTED', label: 'Adoptive Parent' },
        { value: 'STEP_CHILD', label: 'Step Parent' },
        { value: 'FOSTER', label: 'Foster Parent' },
      ];
    }
    return [];
  };

  // Page title based on mode
  const getPageTitle = () => {
    if (relationshipMode === 'parent_of') return 'Add Parent';
    if (relationshipMode === 'child_of') return 'Add Child';
    if (relationshipMode === 'spouse_of') return 'Add Spouse';
    return 'Add Family Member';
  };

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/tree"
          className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tree
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">{getPageTitle()}</h1>
        <p className="text-slate-600 mt-1">
          Add a new person to your family tree and define their relationship to existing members
        </p>
      </div>

      {/* Error message */}
      {error && (
        <Card className="mb-6 bg-rose-50 border-rose-200">
          <div className="flex items-center gap-3 text-rose-700">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main form */}
        <div className="lg:col-span-2">
          <PersonForm
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
            isLoading={isLoading}
            title="New Family Member"
            submitLabel="Add to Family Tree"
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Relationship Selection - NEW SECTION */}
          <Card className="border-2 border-maroon-100">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-maroon-500" />
              Relationship to Existing Member
            </h3>

            {/* Relationship Mode Selection */}
            <div className="space-y-3 mb-4">
              <p className="text-sm text-slate-600">
                How is this person related to existing family members?
              </p>
              
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRelationshipMode('none');
                    setSelectedPersonId('');
                  }}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left',
                    relationshipMode === 'none'
                      ? 'border-maroon-500 bg-maroon-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <div className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    relationshipMode === 'none' ? 'bg-maroon-500 text-white' : 'bg-slate-100 text-slate-500'
                  )}>
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 text-sm">No Relationship Yet</p>
                    <p className="text-xs text-slate-500">Add person without connecting to tree</p>
                  </div>
                  {relationshipMode === 'none' && <Check className="w-5 h-5 text-maroon-500" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRelationshipMode('child_of');
                    setRelationshipSubtype('PARENT_CHILD');
                  }}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left',
                    relationshipMode === 'child_of'
                      ? 'border-maroon-500 bg-maroon-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <div className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    relationshipMode === 'child_of' ? 'bg-maroon-500 text-white' : 'bg-slate-100 text-slate-500'
                  )}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 text-sm">Child of...</p>
                    <p className="text-xs text-slate-500">This person is a child of someone</p>
                  </div>
                  {relationshipMode === 'child_of' && <Check className="w-5 h-5 text-maroon-500" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRelationshipMode('parent_of');
                    setRelationshipSubtype('PARENT_CHILD');
                  }}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left',
                    relationshipMode === 'parent_of'
                      ? 'border-maroon-500 bg-maroon-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <div className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center rotate-180',
                    relationshipMode === 'parent_of' ? 'bg-maroon-500 text-white' : 'bg-slate-100 text-slate-500'
                  )}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 text-sm">Parent of...</p>
                    <p className="text-xs text-slate-500">This person is a parent of someone</p>
                  </div>
                  {relationshipMode === 'parent_of' && <Check className="w-5 h-5 text-maroon-500" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRelationshipMode('spouse_of');
                    setRelationshipSubtype('SPOUSE');
                  }}
                  className={clsx(
                    'flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left',
                    relationshipMode === 'spouse_of'
                      ? 'border-maroon-500 bg-maroon-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <div className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    relationshipMode === 'spouse_of' ? 'bg-maroon-500 text-white' : 'bg-slate-100 text-slate-500'
                  )}>
                    <Heart className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 text-sm">Spouse of...</p>
                    <p className="text-xs text-slate-500">This person is married to someone</p>
                  </div>
                  {relationshipMode === 'spouse_of' && <Check className="w-5 h-5 text-maroon-500" />}
                </button>
              </div>
            </div>

            {/* Person Selector - only shown when a relationship mode is selected */}
            {relationshipMode !== 'none' && (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {relationshipMode === 'child_of' && 'Select Parent'}
                    {relationshipMode === 'parent_of' && 'Select Child'}
                    {relationshipMode === 'spouse_of' && 'Select Spouse'}
                  </label>
                  
                  {personsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 text-maroon-500 animate-spin" />
                    </div>
                  ) : (
                    <select
                      value={selectedPersonId}
                      onChange={(e) => setSelectedPersonId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 text-sm"
                    >
                      <option value="">-- Select a person --</option>
                      {allPersons.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.firstName} {person.lastName}
                          {person.birthDate && ` (${new Date(person.birthDate).getFullYear()})`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Selected person preview */}
                {selectedPerson && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={selectedPerson.profileImage?.url}
                        name={`${selectedPerson.firstName} ${selectedPerson.lastName}`}
                        size="md"
                      />
                      <div>
                        <p className="font-medium text-slate-900 text-sm">
                          {selectedPerson.firstName} {selectedPerson.lastName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {relationshipMode === 'child_of' && 'Will be the parent'}
                          {relationshipMode === 'parent_of' && 'Will be the child'}
                          {relationshipMode === 'spouse_of' && 'Will be the spouse'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Relationship subtype - only for parent/child */}
                {(relationshipMode === 'child_of' || relationshipMode === 'parent_of') && selectedPersonId && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Relationship Type
                    </label>
                    <Select
                      value={relationshipSubtype}
                      onChange={(e) => setRelationshipSubtype(e.target.value)}
                      options={getRelationshipOptions()}
                    />
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Tips */}
          <Card className="bg-maroon-50 border-maroon-200">
            <h3 className="font-semibold text-maroon-900 mb-2">Tips</h3>
            <ul className="text-sm text-maroon-700 space-y-2">
              <li>• Fill in as much information as you know</li>
              <li>• Upload a photo to help family members recognize them</li>
              <li>• Select a relationship to connect them to the tree</li>
              <li>• New additions show as &quot;Unverified&quot; until approved</li>
              <li>• Any family member can verify new additions</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function AddPersonFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 text-maroon-500 animate-spin" />
    </div>
  );
}

export default function AddPersonPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <Suspense fallback={<AddPersonFallback />}>
          <AddPersonContent />
        </Suspense>
      </div>
    </div>
  );
}

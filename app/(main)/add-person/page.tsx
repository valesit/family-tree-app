'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { PersonForm } from '@/components/person';
import { Card, Select, Button, Avatar } from '@/components/ui';
import { PersonInput } from '@/lib/validators';
import { PersonWithRelations } from '@/types';
import { ArrowLeft, Check, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function AddPersonContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parentId = searchParams.get('parentId');
  const spouseId = searchParams.get('spouseId');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>([]);
  const [relationshipType, setRelationshipType] = useState<string>(
    parentId ? 'PARENT_CHILD' : spouseId ? 'SPOUSE' : ''
  );

  // Fetch available approvers (existing family members with accounts)
  const { data: personsData } = useSWR<{
    success: boolean;
    data: { items: PersonWithRelations[] };
  }>('/api/persons?limit=100', fetcher);

  const availableApprovers = personsData?.data?.items?.filter(p => p.userId) || [];

  const handleSubmit = async (data: PersonInput, profileImage?: File) => {
    setIsLoading(true);
    setError(null);

    try {
      // First create the person
      const response = await fetch('/api/persons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          approverIds: selectedApprovers,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create person');
      }

      // If we have a parent or spouse, create the relationship
      if ((parentId || spouseId) && relationshipType && result.data?.id) {
        const relationshipResponse = await fetch('/api/relationships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: relationshipType,
            person1Id: parentId || spouseId,
            person2Id: result.data.id,
            approverIds: selectedApprovers,
          }),
        });

        const relationshipResult = await relationshipResponse.json();
        if (!relationshipResult.success) {
          console.error('Failed to create relationship:', relationshipResult.error);
        }
      }

      // Upload profile image if provided
      if (profileImage && result.data?.id) {
        const formData = new FormData();
        formData.append('image', profileImage);
        formData.append('personId', result.data.id);

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

  const toggleApprover = (personId: string) => {
    setSelectedApprovers(prev => {
      if (prev.includes(personId)) {
        return prev.filter(id => id !== personId);
      }
      if (prev.length >= 2) {
        return prev; // Max 2 approvers
      }
      return [...prev, personId];
    });
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
        <h1 className="text-3xl font-bold text-slate-900">Add Family Member</h1>
        <p className="text-slate-600 mt-1">
          Add a new person to your family tree
          {parentId && ' as a child'}
          {spouseId && ' as a spouse'}
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
          {/* Relationship type */}
          {(parentId || spouseId) && (
            <Card>
              <h3 className="font-semibold text-slate-900 mb-4">Relationship Type</h3>
              <Select
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value)}
                options={
                  parentId
                    ? [
                        { value: 'PARENT_CHILD', label: 'Biological Child' },
                        { value: 'ADOPTED', label: 'Adopted Child' },
                        { value: 'STEP_CHILD', label: 'Step Child' },
                        { value: 'FOSTER', label: 'Foster Child' },
                      ]
                    : [
                        { value: 'SPOUSE', label: 'Spouse/Partner' },
                      ]
                }
              />
            </Card>
          )}

          {/* Approvers selection */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Select Approvers</h3>
              <span className="text-sm text-slate-500">
                {selectedApprovers.length}/2 selected
              </span>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Choose up to 2 family members to approve this addition. 
              If none selected, an admin will review it.
            </p>

            {availableApprovers.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                No family members with accounts available yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableApprovers.map((person) => (
                  <button
                    key={person.id}
                    onClick={() => toggleApprover(person.userId!)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                      selectedApprovers.includes(person.userId!)
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Avatar
                      src={person.profileImage?.url}
                      name={`${person.firstName} ${person.lastName}`}
                      size="sm"
                    />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-slate-900">
                        {person.firstName} {person.lastName}
                      </p>
                    </div>
                    {selectedApprovers.includes(person.userId!) && (
                      <Check className="w-5 h-5 text-emerald-500" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Tips */}
          <Card className="bg-emerald-50 border-emerald-200">
            <h3 className="font-semibold text-emerald-900 mb-2">Tips</h3>
            <ul className="text-sm text-emerald-700 space-y-2">
              <li>• Fill in as much information as you know</li>
              <li>• Upload a photo to help family members recognize them</li>
              <li>• Add interesting facts to preserve memories</li>
              <li>• Contact info is optional and can be kept private</li>
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
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
    </div>
  );
}

export default function AddPersonPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Suspense fallback={<AddPersonFallback />}>
          <AddPersonContent />
        </Suspense>
      </div>
    </div>
  );
}

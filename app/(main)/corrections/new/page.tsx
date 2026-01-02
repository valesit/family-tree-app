'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, Button, Input, Textarea, Select, Avatar } from '@/components/ui';
import { correctionSchema, CorrectionInput } from '@/lib/validators';
import { PersonWithRelations } from '@/types';
import { ArrowLeft, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function NewCorrectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPersonId = searchParams.get('personId');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState(preselectedPersonId || '');

  // Fetch persons for selection
  const { data: personsData } = useSWR<{
    success: boolean;
    data: { items: PersonWithRelations[] };
  }>('/api/persons?limit=100', fetcher);

  // Fetch selected person details
  const { data: personData } = useSWR<{
    success: boolean;
    data: PersonWithRelations;
  }>(selectedPersonId ? `/api/persons/${selectedPersonId}` : null, fetcher);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CorrectionInput>({
    resolver: zodResolver(correctionSchema),
    defaultValues: {
      personId: preselectedPersonId || '',
      proposedChanges: {},
      reason: '',
    },
  });

  const onSubmit = async (data: CorrectionInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          personId: selectedPersonId,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit correction');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/corrections');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPerson = personData?.data;

  if (success) {
    return (
      <Card className="max-w-md w-full text-center mx-auto">
        <CheckCircle className="w-16 h-16 text-maroon-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Correction Submitted!
        </h2>
        <p className="text-slate-600">
          Your correction request has been submitted for review. You&apos;ll be notified once it&apos;s processed.
        </p>
      </Card>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/corrections"
          className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Corrections
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Request Correction</h1>
        <p className="text-slate-600 mt-1">
          Found incorrect information? Submit a correction request.
        </p>
      </div>

      {error && (
        <Card className="mb-6 bg-rose-50 border-rose-200">
          <div className="flex items-center gap-3 text-rose-700">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Person selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select Person to Correct
            </label>
            <Select
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
              options={
                personsData?.data?.items?.map((p) => ({
                  value: p.id,
                  label: `${p.firstName} ${p.lastName}`,
                })) || []
              }
              placeholder="Choose a person..."
            />
          </div>

          {/* Selected person info */}
          {selectedPerson && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-4">
                <Avatar
                  src={selectedPerson.profileImage?.url}
                  name={`${selectedPerson.firstName} ${selectedPerson.lastName}`}
                  size="lg"
                />
                <div>
                  <p className="font-medium text-slate-900">
                    {selectedPerson.firstName} {selectedPerson.lastName}
                  </p>
                  {selectedPerson.birthDate && (
                    <p className="text-sm text-slate-500">
                      Born: {new Date(selectedPerson.birthDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Proposed changes */}
          {selectedPerson && (
            <div className="space-y-4">
              <h3 className="font-medium text-slate-900">Proposed Changes</h3>
              <p className="text-sm text-slate-500">
                Only fill in the fields you want to correct.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  placeholder={selectedPerson.firstName}
                  {...register('proposedChanges.firstName')}
                />
                <Input
                  label="Last Name"
                  placeholder={selectedPerson.lastName}
                  {...register('proposedChanges.lastName')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Birth Date"
                  type="date"
                  {...register('proposedChanges.birthDate')}
                />
                <Input
                  label="Death Date"
                  type="date"
                  {...register('proposedChanges.deathDate')}
                />
              </div>

              <Textarea
                label="Biography"
                placeholder="Corrected biography..."
                rows={3}
                {...register('proposedChanges.biography')}
              />
            </div>
          )}

          {/* Reason */}
          <Textarea
            label="Reason for Correction *"
            placeholder="Please explain what needs to be corrected and why..."
            rows={4}
            error={errors.reason?.message}
            {...register('reason')}
          />

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
              disabled={!selectedPersonId}
              className="flex-1"
            >
              Submit Correction Request
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

function NewCorrectionFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 text-maroon-500 animate-spin" />
    </div>
  );
}

export default function NewCorrectionPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <Suspense fallback={<NewCorrectionFallback />}>
          <NewCorrectionContent />
        </Suspense>
      </div>
    </div>
  );
}

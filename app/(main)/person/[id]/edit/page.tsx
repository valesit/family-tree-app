'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { PersonForm } from '@/components/person';
import { Button } from '@/components/ui';
import { PersonWithRelations, SessionUser } from '@/types';
import { PersonInput } from '@/lib/validators';
import { ArrowLeft, Loader2, AlertCircle, Lock } from 'lucide-react';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditPersonPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session, status } = useSession();

  const user = session?.user as SessionUser | undefined;
  const isAuthenticated = status === 'authenticated';
  const isLoading = status === 'loading';

  const { data, error, isLoading: isPersonLoading } = useSWR<{
    success: boolean;
    data: PersonWithRelations;
  }>(`/api/persons/${id}`, fetcher);

  // Redirect to login if not authenticated
  if (!isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Sign In Required</h2>
          <p className="text-slate-600 mb-4">You need to be signed in to edit person information.</p>
          <Link href={`/login?callbackUrl=/person/${id}/edit`}>
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || isPersonLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="w-8 h-8 text-maroon-500 animate-spin" />
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <p className="text-slate-600 mb-4">Failed to load person details</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const person = data.data;

  // Convert person data to form format
  const initialData: Partial<PersonInput> = {
    firstName: person.firstName,
    lastName: person.lastName,
    middleName: person.middleName || '',
    maidenName: person.maidenName || '',
    nickname: person.nickname || '',
    gender: person.gender || undefined,
    birthDate: person.birthDate ? new Date(person.birthDate).toISOString().split('T')[0] : '',
    birthPlace: person.birthPlace || '',
    deathDate: person.deathDate ? new Date(person.deathDate).toISOString().split('T')[0] : '',
    deathPlace: person.deathPlace || '',
    biography: person.biography || '',
    facts: (() => {
      if (!person.facts) return [];
      try {
        return JSON.parse(person.facts);
      } catch {
        console.error('Failed to parse facts JSON');
        return [];
      }
    })(),
    email: person.email || '',
    phone: person.phone || '',
    address: person.address || '',
    occupation: person.occupation || '',
    isLiving: person.isLiving,
    isPrivate: person.isPrivate,
  };

  const handleSubmit = async (formData: PersonInput, profileImage?: File) => {
    try {
      // Keep the payload in the same shape expected by personSchema. The API
      // owns date conversion and facts JSON serialization before writing to Prisma.
      const updateData: PersonInput = {
        ...formData,
        birthDate: formData.birthDate || '',
        deathDate: formData.deathDate || '',
        facts: (formData.facts || []).filter((fact) => fact.trim().length > 0),
      };

      // Update person
      const response = await fetch(`/api/persons/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to update person');
      }

      // Handle profile image upload if provided. /api/upload expects the field
      // name `image`, and `isProfile=true` is required to set profileImageId.
      if (profileImage) {
        const imageFormData = new FormData();
        imageFormData.append('image', profileImage);
        imageFormData.append('personId', id);
        imageFormData.append('isProfile', 'true');

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: imageFormData,
        });
        const uploadResult = await uploadResponse.json().catch(() => null);

        if (!uploadResponse.ok || !uploadResult?.success) {
          throw new Error(
            `Profile details were saved, but the photo could not be uploaded: ${
              uploadResult?.error || 'Upload failed'
            }`
          );
        }
      }

      // Redirect back to person page
      router.push(`/person/${id}`);
      router.refresh();
    } catch (error) {
      console.error('Error updating person:', error);
      alert(error instanceof Error ? error.message : 'Failed to update person');
    }
  };

  const handleCancel = () => {
    router.push(`/person/${id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/person/${id}`}
            className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Profile
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">
            Edit {person.firstName} {person.lastName}
          </h1>
          <p className="text-slate-600 mt-1">
            Update the information below and click save to apply changes.
          </p>
        </div>

        {/* Form */}
        <PersonForm
          initialData={initialData}
          initialImageUrl={person.profileImage?.url}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          title={`Edit ${person.firstName} ${person.lastName}`}
          submitLabel="Save Changes"
        />
      </div>
    </div>
  );
}

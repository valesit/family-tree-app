'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { PersonCard } from '@/components/person';
import { Card, Button, Avatar } from '@/components/ui';
import { PersonWithRelations, SessionUser } from '@/types';
import { 
  ArrowLeft, 
  Edit, 
  Flag, 
  Users, 
  ChevronRight, 
  Loader2, 
  AlertCircle,
  MessageSquare,
  ImagePlus,
  Lock,
  LogIn,
} from 'lucide-react';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PersonDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session, status } = useSession();

  const user = session?.user as SessionUser | undefined;
  const isAuthenticated = status === 'authenticated';

  const { data, error, isLoading } = useSWR<{
    success: boolean;
    data: PersonWithRelations;
  }>(`/api/persons/${id}`, fetcher);

  if (isLoading) {
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

  // Get family relationships
  const parents = person.parentRelations?.map(r => r.parent).filter(Boolean) || [];
  const children = person.childRelations?.map(r => r.child).filter(Boolean) || [];
  const spouses = [
    ...(person.spouseRelations1?.map(r => r.spouse2) || []),
    ...(person.spouseRelations2?.map(r => r.spouse1) || []),
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tree
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            <PersonCard
              person={person}
              showActions={isAuthenticated}
              onEdit={isAuthenticated ? () => router.push(`/person/${id}/edit`) : undefined}
              onRequestCorrection={isAuthenticated ? () => router.push(`/corrections/new?personId=${id}`) : undefined}
            />

            {/* Sign in prompt for guests */}
            {!isAuthenticated && (
              <Card className="mt-6 bg-amber-50 border-amber-200">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Lock className="w-6 h-6 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900">Want to contribute?</h3>
                    <p className="text-sm text-amber-700">
                      Sign in to edit information, add photos, or request corrections.
                    </p>
                  </div>
                  <Link href={`/login?callbackUrl=/person/${id}`}>
                    <Button variant="outline" size="sm">
                      <LogIn className="w-4 h-4 mr-2" />
                      Sign In
                    </Button>
                  </Link>
                </div>
              </Card>
            )}

            {/* Photo Gallery */}
            {person.images && person.images.length > 0 && (
              <Card className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900">Photos</h3>
                  {isAuthenticated && (
                    <Button variant="outline" size="sm">
                      <ImagePlus className="w-4 h-4 mr-2" />
                      Add Photo
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {person.images.map((image) => (
                    <div
                      key={image.id}
                      className="aspect-square rounded-lg overflow-hidden bg-slate-100"
                    >
                      <img
                        src={image.url}
                        alt={image.caption || 'Family photo'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar - Family connections */}
          <div className="space-y-6">
            {/* Actions (authenticated only) */}
            {isAuthenticated && (
              <Card>
                <h3 className="font-semibold text-slate-900 mb-4">Actions</h3>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={() => router.push(`/person/${id}/edit`)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Information
                  </Button>
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={() => router.push(`/corrections/new?personId=${id}`)}
                  >
                    <Flag className="w-4 h-4 mr-2" />
                    Request Correction
                  </Button>
                  {person.userId && (
                    <Button
                      variant="outline"
                      fullWidth
                      onClick={() => router.push(`/messages?userId=${person.userId}`)}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Send Message
                    </Button>
                  )}
                </div>
              </Card>
            )}

            {/* Parents */}
            {parents.length > 0 && (
              <Card>
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-slate-400" />
                  Parents
                </h3>
                <div className="space-y-2">
                  {parents.map((parent) => (
                    <Link
                      key={parent!.id}
                      href={`/person/${parent!.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Avatar
                        src={parent!.profileImage?.url}
                        name={`${parent!.firstName} ${parent!.lastName}`}
                        size="md"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">
                          {parent!.firstName} {parent!.lastName}
                        </p>
                        <p className="text-sm text-slate-500">
                          {parent!.isLiving ? 'Living' : 'Deceased'}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            {/* Spouses */}
            {spouses.length > 0 && (
              <Card>
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-rose-400" />
                  Spouse(s)
                </h3>
                <div className="space-y-2">
                  {spouses.map((spouse) => (
                    <Link
                      key={spouse!.id}
                      href={`/person/${spouse!.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Avatar
                        src={spouse!.profileImage?.url}
                        name={`${spouse!.firstName} ${spouse!.lastName}`}
                        size="md"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">
                          {spouse!.firstName} {spouse!.lastName}
                        </p>
                        <p className="text-sm text-slate-500">
                          {spouse!.isLiving ? 'Living' : 'Deceased'}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            {/* Children */}
            {children.length > 0 && (
              <Card>
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-maroon-400" />
                  Children ({children.length})
                </h3>
                <div className="space-y-2">
                  {children.map((child) => (
                    <Link
                      key={child!.id}
                      href={`/person/${child!.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Avatar
                        src={child!.profileImage?.url}
                        name={`${child!.firstName} ${child!.lastName}`}
                        size="md"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">
                          {child!.firstName} {child!.lastName}
                        </p>
                        <p className="text-sm text-slate-500">
                          {child!.isLiving ? 'Living' : 'Deceased'}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            {/* Add family member (authenticated only) */}
            {isAuthenticated && (
              <Card className="bg-maroon-50 border-maroon-200">
                <h3 className="font-semibold text-maroon-900 mb-3">
                  Add Family Member
                </h3>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={() => router.push(`/add-person?parentId=${id}`)}
                    className="justify-start"
                  >
                    Add Child
                  </Button>
                  <Button
                    variant="outline"
                    fullWidth
                    onClick={() => router.push(`/add-person?spouseId=${id}`)}
                    className="justify-start"
                  >
                    Add Spouse
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

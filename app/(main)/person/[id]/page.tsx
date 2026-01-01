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
  Award,
  Star,
  Send,
  Mail,
  UserCheck,
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PersonDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session, status } = useSession();
  
  // Notable person state
  const [showNotableForm, setShowNotableForm] = useState(false);
  const [notableTitle, setNotableTitle] = useState('');
  const [notableDescription, setNotableDescription] = useState('');
  const [isSubmittingNotable, setIsSubmittingNotable] = useState(false);

  const user = session?.user as SessionUser | undefined;
  const isAuthenticated = status === 'authenticated';
  const isAdmin = user?.role === 'ADMIN';

  const { data, error, isLoading, mutate } = useSWR<{
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

  // Handle marking/nominating as notable
  const handleMarkAsNotable = async (isDirect: boolean = false) => {
    if (!notableTitle.trim()) {
      alert('Please enter a title for the notable person');
      return;
    }

    setIsSubmittingNotable(true);
    try {
      if (isDirect && isAdmin) {
        // Admin direct update
        const response = await fetch(`/api/persons/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...person,
            isNotable: true,
            notableTitle: notableTitle,
            notableDescription: notableDescription,
            birthDate: person.birthDate ? new Date(person.birthDate).toISOString() : null,
            deathDate: person.deathDate ? new Date(person.deathDate).toISOString() : null,
          }),
        });

        if (response.ok) {
          mutate();
          setShowNotableForm(false);
          setNotableTitle('');
          setNotableDescription('');
          alert('Person marked as notable!');
        } else {
          throw new Error('Failed to update');
        }
      } else {
        // Submit nomination for approval
        const response = await fetch('/api/notable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            personId: id,
            title: notableTitle,
            description: notableDescription,
          }),
        });

        if (response.ok) {
          setShowNotableForm(false);
          setNotableTitle('');
          setNotableDescription('');
          alert('Nomination submitted! An admin will review it shortly.');
        } else {
          throw new Error('Failed to submit nomination');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to process. Please try again.');
    } finally {
      setIsSubmittingNotable(false);
    }
  };

  // Handle removing notable status (admin only)
  const handleRemoveNotable = async () => {
    if (!confirm('Remove notable status from this person?')) return;

    try {
      const response = await fetch(`/api/persons/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...person,
          isNotable: false,
          notableTitle: null,
          notableDescription: null,
          notableAchievements: null,
          birthDate: person.birthDate ? new Date(person.birthDate).toISOString() : null,
          deathDate: person.deathDate ? new Date(person.deathDate).toISOString() : null,
        }),
      });

      if (response.ok) {
        mutate();
        alert('Notable status removed');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

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
            {/* Contact / Message Card */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-500" />
                Contact
              </h3>
              {person.userId ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    This person has a linked account and can receive messages.
                  </p>
                  {isAuthenticated ? (
                    <Button
                      fullWidth
                      onClick={() => router.push(`/messages?userId=${person.userId}`)}
                      className="bg-blue-500 hover:bg-blue-600"
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Send Direct Message
                    </Button>
                  ) : (
                    <Link href={`/login?callbackUrl=/person/${id}`}>
                      <Button variant="outline" fullWidth>
                        <LogIn className="w-4 h-4 mr-2" />
                        Sign in to Message
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-white/60 rounded-lg">
                    <UserCheck className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-600">
                        This person hasn&apos;t claimed their profile yet.
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        If you know them, let them know they can create an account and link to this profile.
                      </p>
                    </div>
                  </div>
                  {person.email && !person.isPrivate && (
                    <a 
                      href={`mailto:${person.email}`}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-white border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Email {person.firstName}
                    </a>
                  )}
                </div>
              )}
            </Card>

            {/* Notable Person Card */}
            <Card className={person.isNotable ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' : ''}>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Award className={`w-5 h-5 ${person.isNotable ? 'text-amber-500' : 'text-slate-400'}`} />
                Notable Status
              </h3>
              
              {person.isNotable ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500" fill="currentColor" />
                    <span className="text-sm font-medium text-amber-700">{person.notableTitle}</span>
                  </div>
                  {person.notableDescription && (
                    <p className="text-sm text-slate-600">{person.notableDescription}</p>
                  )}
                  {isAdmin && (
                    <button
                      onClick={handleRemoveNotable}
                      className="text-xs text-slate-500 hover:text-red-500 transition-colors"
                    >
                      Remove notable status
                    </button>
                  )}
                </div>
              ) : showNotableForm ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Title (e.g., Community Leader, Philanthropist)"
                    value={notableTitle}
                    onChange={(e) => setNotableTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
                  />
                  <textarea
                    placeholder="Why is this person notable? Describe their achievements..."
                    value={notableDescription}
                    onChange={(e) => setNotableDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleMarkAsNotable(isAdmin)}
                      isLoading={isSubmittingNotable}
                      className="flex-1 bg-amber-500 hover:bg-amber-600"
                    >
                      {isAdmin ? 'Mark as Notable' : 'Submit Nomination'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setShowNotableForm(false);
                        setNotableTitle('');
                        setNotableDescription('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                  {!isAdmin && (
                    <p className="text-xs text-slate-500">
                      Your nomination will be reviewed by an admin before being published.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    {isAdmin 
                      ? 'Mark this person as notable to highlight their achievements.'
                      : 'Nominate this person as a notable family member.'
                    }
                  </p>
                  {isAuthenticated ? (
                    <Button
                      variant="outline"
                      fullWidth
                      onClick={() => setShowNotableForm(true)}
                      className="border-amber-300 text-amber-700 hover:bg-amber-50"
                    >
                      <Award className="w-4 h-4 mr-2" />
                      {isAdmin ? 'Mark as Notable' : 'Nominate as Notable'}
                    </Button>
                  ) : (
                    <Link href={`/login?callbackUrl=/person/${id}`}>
                      <Button variant="outline" fullWidth size="sm">
                        Sign in to nominate
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </Card>

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

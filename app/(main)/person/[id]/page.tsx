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
  LinkIcon,
  Unlink,
  CheckCircle2,
  AlertTriangle,
  X,
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
  
  // Claim profile state
  const [isClaimingProfile, setIsClaimingProfile] = useState(false);
  
  // Dispute profile state
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

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

  // Handle claiming profile
  const handleClaimProfile = async () => {
    if (!confirm(`Are you ${person.firstName} ${person.lastName}? This will link your account to this profile in the family tree.`)) {
      return;
    }

    setIsClaimingProfile(true);
    try {
      const response = await fetch(`/api/persons/${id}/claim`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        mutate();
        alert(result.message);
      } else {
        alert(result.error || 'Failed to claim profile');
      }
    } catch (error) {
      console.error('Error claiming profile:', error);
      alert('Failed to claim profile. Please try again.');
    } finally {
      setIsClaimingProfile(false);
    }
  };

  // Handle unlinking profile (admin or self)
  const handleUnlinkProfile = async () => {
    if (!confirm('Are you sure you want to unlink this profile from the associated account?')) {
      return;
    }

    try {
      const response = await fetch(`/api/persons/${id}/claim`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        mutate();
        alert('Profile unlinked successfully');
      } else {
        alert(result.error || 'Failed to unlink profile');
      }
    } catch (error) {
      console.error('Error unlinking profile:', error);
      alert('Failed to unlink profile');
    }
  };

  // Check if current user is linked to this person
  const isLinkedToCurrentUser = person?.userId === user?.id;

  // Handle dispute submission
  const handleSubmitDispute = async () => {
    if (!disputeReason.trim()) {
      alert('Please explain why you believe this is your profile');
      return;
    }

    setIsSubmittingDispute(true);
    try {
      // Create a correction request for the dispute
      const response = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: id,
          currentData: {
            linkedUserId: person.userId,
            disputeType: 'PROFILE_CLAIM_DISPUTE',
          },
          proposedData: {
            requestedUserId: user?.id,
            requestedUserEmail: user?.email,
            requestedUserName: user?.name,
          },
          reason: `PROFILE DISPUTE: ${disputeReason}`,
        }),
      });

      if (response.ok) {
        setShowDisputeForm(false);
        setDisputeReason('');
        alert('Your dispute has been submitted. An admin will review it and contact you.');
      } else {
        const result = await response.json();
        alert(result.error || 'Failed to submit dispute');
      }
    } catch (error) {
      console.error('Error submitting dispute:', error);
      alert('Failed to submit dispute. Please try again.');
    } finally {
      setIsSubmittingDispute(false);
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
            {/* Claim / Link Profile Card */}
            <Card className={`${
              isLinkedToCurrentUser 
                ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                : person.userId
                ? 'bg-slate-50 border-slate-200'
                : 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200'
            }`}>
              <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <LinkIcon className={`w-5 h-5 ${
                  isLinkedToCurrentUser ? 'text-green-500' : person.userId ? 'text-slate-400' : 'text-purple-500'
                }`} />
                Profile Link
              </h3>

              {isLinkedToCurrentUser ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-sm font-medium">This is your profile</span>
                  </div>
                  <p className="text-xs text-green-600">
                    Your account is linked to this family tree entry. You can receive messages from relatives.
                  </p>
                  <button
                    onClick={handleUnlinkProfile}
                    className="text-xs text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1"
                  >
                    <Unlink className="w-3 h-3" />
                    Unlink my account
                  </button>
                </div>
              ) : person.userId ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    This profile is linked to another account.
                  </p>
                  {isAdmin ? (
                    <button
                      onClick={handleUnlinkProfile}
                      className="text-xs text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1"
                    >
                      <Unlink className="w-3 h-3" />
                      Unlink profile (Admin)
                    </button>
                  ) : isAuthenticated && (
                    <button
                      onClick={() => setShowDisputeForm(true)}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Is this actually you? Report an issue
                    </button>
                  )}
                </div>
              ) : isAuthenticated ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Is this you? Link your account to this profile to:
                  </p>
                  <ul className="text-xs text-slate-500 space-y-1 ml-4">
                    <li>• Receive messages from relatives</li>
                    <li>• Get notified of family updates</li>
                    <li>• Easily edit your own information</li>
                  </ul>
                  <Button
                    fullWidth
                    onClick={handleClaimProfile}
                    isLoading={isClaimingProfile}
                    className="bg-purple-500 hover:bg-purple-600"
                  >
                    <LinkIcon className="w-4 h-4 mr-2" />
                    This is Me - Link My Account
                  </Button>
                  <p className="text-xs text-green-600 text-center">
                    ✓ Instant linking - no approval needed
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Is this you in the family tree?
                  </p>
                  <p className="text-xs text-slate-500">
                    Create an account to claim this profile and connect with your family.
                  </p>
                  <ul className="text-xs text-slate-500 space-y-1 ml-4">
                    <li>• Receive messages from relatives</li>
                    <li>• Get notified of family updates</li>
                    <li>• Easily edit your own information</li>
                  </ul>
                  <Link href={`/register?claimPersonId=${id}&name=${encodeURIComponent(person.firstName + ' ' + person.lastName)}`}>
                    <Button
                      fullWidth
                      className="bg-purple-500 hover:bg-purple-600"
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      Create Account & Claim Profile
                    </Button>
                  </Link>
                  <p className="text-xs text-slate-400 text-center">
                    Already have an account?{' '}
                    <Link href={`/login?callbackUrl=/person/${id}`} className="text-purple-600 hover:underline">
                      Sign in
                    </Link>
                  </p>
                </div>
              )}
            </Card>

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

      {/* Dispute Profile Modal */}
      {showDisputeForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Dispute Profile Link</h3>
                    <p className="text-xs text-slate-500">Report incorrect profile ownership</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDisputeForm(false);
                    setDisputeReason('');
                  }}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                  <p>
                    This profile is currently linked to another account. If you believe this is 
                    actually your profile in the family tree, please explain why and an admin 
                    will review your request.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Why do you believe this is your profile?
                  </label>
                  <textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="e.g., This is my name and birth date. I can verify my identity with..."
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowDisputeForm(false);
                      setDisputeReason('');
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitDispute}
                    isLoading={isSubmittingDispute}
                    className="flex-1 bg-amber-500 hover:bg-amber-600"
                  >
                    Submit Dispute
                  </Button>
                </div>

                <p className="text-xs text-slate-400 text-center">
                  An admin will review your request and may contact you for verification.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

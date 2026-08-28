'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { Avatar, Button, Card } from '@/components/ui';
import { PersonWithRelations, SessionUser } from '@/types';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Briefcase,
  CalendarDays,
  Camera,
  ChevronRight,
  Edit,
  Heart,
  LinkIcon,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  Send,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Tribute = {
  id: string;
  content: string;
  personId: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  authorName: string | null;
  authorImage: string | null;
};

type RelatedPerson = {
  id: string;
  firstName: string;
  lastName: string;
  profileImage?: { url: string } | null;
  isLiving?: boolean;
  birthDate?: string | Date | null;
};

type ParentRelation = { parent?: RelatedPerson | null };
type ChildRelation = { child?: RelatedPerson | null };
type SpouseRelation1 = { spouse2?: RelatedPerson | null };
type SpouseRelation2 = { spouse1?: RelatedPerson | null };

interface PageProps {
  params: Promise<{ id: string }>;
}

function ageAt(birthValue?: string | Date | null, endValue?: string | Date | null) {
  if (!birthValue) return null;
  const birth = new Date(birthValue);
  const end = endValue ? new Date(endValue) : new Date();
  if (Number.isNaN(birth.getTime()) || Number.isNaN(end.getTime())) return null;
  let age = end.getFullYear() - birth.getFullYear();
  const monthDelta = end.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && end.getDate() < birth.getDate())) age -= 1;
  return age;
}

export default function PersonDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const user = session?.user as SessionUser | undefined;
  const isAuthenticated = status === 'authenticated';

  const [tributeText, setTributeText] = useState('');
  const [tributeBusy, setTributeBusy] = useState(false);
  const [tributeError, setTributeError] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data: PersonWithRelations;
  }>(`/api/persons/${id}`, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 0,
  });

  const { data: tributeData, mutate: refreshTributes } = useSWR<{
    success: boolean;
    data: Tribute[];
  }>(`/api/persons/${id}/tributes`, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 0,
  });

  const person = data?.data;
  const isOwnProfile = !!person?.userId && person.userId === user?.id;

  const parents = useMemo(
    () => person?.parentRelations?.map((r: ParentRelation) => r.parent).filter(Boolean) as RelatedPerson[] | undefined,
    [person]
  ) ?? [];
  const children = useMemo(
    () => person?.childRelations?.map((r: ChildRelation) => r.child).filter(Boolean) as RelatedPerson[] | undefined,
    [person]
  ) ?? [];
  const spouses = useMemo(() => {
    if (!person) return [] as RelatedPerson[];
    return [
      ...(person.spouseRelations1?.map((r: SpouseRelation1) => r.spouse2) || []),
      ...(person.spouseRelations2?.map((r: SpouseRelation2) => r.spouse1) || []),
    ].filter(Boolean) as RelatedPerson[];
  }, [person]);

  const handleClaimProfile = async () => {
    if (!person) return;
    if (!window.confirm(`Link your account to ${person.firstName} ${person.lastName}?`)) return;
    setClaimBusy(true);
    try {
      const response = await fetch(`/api/persons/${id}/claim`, { method: 'POST' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Could not claim this profile');
      await update({ linkedPersonId: id });
      await mutate();
    } catch (claimError) {
      window.alert(claimError instanceof Error ? claimError.message : 'Could not claim this profile.');
    } finally {
      setClaimBusy(false);
    }
  };

  const handlePostTribute = async () => {
    const content = tributeText.trim();
    if (!content) return;
    setTributeBusy(true);
    setTributeError(null);
    try {
      const response = await fetch(`/api/persons/${id}/tributes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Could not post your message');
      setTributeText('');
      await refreshTributes();
    } catch (postError) {
      setTributeError(postError instanceof Error ? postError.message : 'Could not post your message.');
    } finally {
      setTributeBusy(false);
    }
  };

  const handleDeleteTribute = async (tributeId: string) => {
    if (!window.confirm('Remove this family message?')) return;
    const response = await fetch(`/api/tributes/${tributeId}`, { method: 'DELETE' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      setTributeError(result?.error || 'Could not remove this message.');
      return;
    }
    await refreshTributes();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-maroon-500" />
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <AlertCircle className="mb-4 h-10 w-10 text-rose-500" />
        <h1 className="font-serif text-2xl font-semibold text-[#382a24]">Profile unavailable</h1>
        <p className="mt-2 text-sm text-[#7d6e66]">We could not load this family member.</p>
        <Button className="mt-5" onClick={() => router.back()}>Go back</Button>
      </div>
    );
  }

  const fullName = `${person.firstName} ${person.middleName ? `${person.middleName} ` : ''}${person.lastName}`.trim();
  const lifeAge = ageAt(person.birthDate, person.isLiving ? null : person.deathDate);
  const tributes = tributeData?.data ?? [];

  return (
    <div className="min-h-screen bg-[#fbf9f5] py-8 sm:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Link href="/tree" className="mb-5 inline-flex items-center gap-2 text-sm text-[#74645b] hover:text-[#5f2521]">
          <ArrowLeft className="h-4 w-4" />
          Back to family tree
        </Link>

        <Card className="overflow-hidden border-[#dfd2c6] bg-[#fffdf9]" padding="none">
          <div className="bg-gradient-to-r from-[#efe1d7] via-[#faf4ee] to-[#fffdf9] p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <Avatar
                src={person.profileImage?.url}
                name={fullName}
                size="2xl"
                className="ring-4 ring-[#fffaf6] shadow-md"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8f6c5b]">Family profile</p>
                  {person.userId && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-emerald-700">Active profile</span>
                  )}
                </div>
                <h1 className="mt-1 font-serif text-3xl font-semibold text-[#382a24] sm:text-4xl">{fullName}</h1>
                {person.nickname && <p className="mt-1 text-sm italic text-[#8c776b]">“{person.nickname}”</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#77665d]">
                  {person.birthDate && (
                    <span>{format(new Date(person.birthDate), 'MMMM d, yyyy')}{person.deathDate ? ` – ${format(new Date(person.deathDate), 'MMMM d, yyyy')}` : ''}</span>
                  )}
                  {lifeAge !== null && <span>{person.isLiving ? `${lifeAge} years old` : `Lived ${lifeAge} years`}</span>}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {isAuthenticated && (
                    <Link href={`/person/${id}/edit`}>
                      <Button size="sm"><Edit className="mr-2 h-4 w-4" />{isOwnProfile ? 'Edit my profile' : 'Edit information'}</Button>
                    </Link>
                  )}
                  {person.userId && person.userId !== user?.id && isAuthenticated && (
                    <Button size="sm" variant="outline" onClick={() => router.push(`/messages?userId=${person.userId}`)}>
                      <MessageSquare className="mr-2 h-4 w-4" />Message {person.firstName}
                    </Button>
                  )}
                  {!person.userId && isAuthenticated && !user?.linkedPersonId && (
                    <Button size="sm" variant="outline" onClick={handleClaimProfile} isLoading={claimBusy}>
                      <LinkIcon className="mr-2 h-4 w-4" />This is me
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4">
            <ProfileFact icon={<CalendarDays className="h-4 w-4" />} label="Birthday" value={person.birthDate ? format(new Date(person.birthDate), 'MMMM d') : 'Not recorded'} detail={person.birthDate ? new Date(person.birthDate).getFullYear().toString() : undefined} />
            <ProfileFact icon={<MapPin className="h-4 w-4" />} label="Birthplace" value={person.birthPlace || 'Not recorded'} />
            <ProfileFact icon={<Briefcase className="h-4 w-4" />} label="Occupation" value={person.occupation || 'Not recorded'} />
            <ProfileFact icon={<Heart className="h-4 w-4" />} label="Family messages" value={tributes.length.toString()} detail={person.isLiving ? 'gratitude & encouragement' : 'memories & eulogies'} />
          </div>
        </Card>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.75fr)]">
          <main className="space-y-6">
            <Card className="border-[#e3d7cd] bg-[#fffdf9]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#9a735f]">About</p>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-[#382a24]">{person.firstName}’s story</h2>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#706057]">
                {person.biography || `${person.firstName}'s biography has not been added yet. Family members can help preserve their story by adding memories, places and important life details.`}
              </p>
              {person.isNotable && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                  <div className="flex items-center gap-2 text-amber-800"><Award className="h-4 w-4" /><span className="text-sm font-semibold">{person.notableTitle || 'Notable family member'}</span></div>
                  {person.notableDescription && <p className="mt-2 text-sm leading-6 text-amber-900/80">{person.notableDescription}</p>}
                </div>
              )}
            </Card>

            {person.images && person.images.length > 0 && (
              <Card className="border-[#e3d7cd] bg-[#fffdf9]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#9a735f]">Photo archive</p>
                    <h2 className="mt-1 font-serif text-2xl font-semibold text-[#382a24]">Photos</h2>
                  </div>
                  {isAuthenticated && <Link href={`/person/${id}/edit`} className="text-xs font-semibold text-[#742825] hover:underline"><Camera className="mr-1 inline h-3.5 w-3.5" />Manage photo</Link>}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {person.images.map((image: { id: string; url: string; caption?: string | null }) => (
                    <figure key={image.id} className="overflow-hidden rounded-xl border border-[#eadfd6] bg-[#f7f1ec]">
                      <img src={image.url} alt={image.caption || `${person.firstName} family photo`} className="aspect-square w-full object-cover" />
                      {image.caption && <figcaption className="p-2 text-xs text-[#7f6e65]">{image.caption}</figcaption>}
                    </figure>
                  ))}
                </div>
              </Card>
            )}

            <Card id="tributes" className="border-[#e3d7cd] bg-[#fffdf9]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#9a735f]">Words from family</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold text-[#382a24]">{person.isLiving ? `Gratitude & encouragement for ${person.firstName}` : `In memory of ${person.firstName}`}</h2>
                <p className="mt-2 text-sm leading-6 text-[#7a6960]">
                  {person.isLiving
                    ? 'Share a short note of gratitude, appreciation or encouragement that becomes part of this family profile.'
                    : 'Share a short memory, reflection or eulogy that helps preserve how this person is remembered.'}
                </p>
              </div>

              {isAuthenticated && !isOwnProfile ? (
                <div className="mt-5 rounded-xl border border-[#e5d9cf] bg-[#faf6f2] p-4">
                  <textarea
                    value={tributeText}
                    onChange={(event) => setTributeText(event.target.value.slice(0, 1000))}
                    rows={4}
                    placeholder={person.isLiving ? `Write something meaningful for ${person.firstName}…` : `Share a memory of ${person.firstName}…`}
                    className="w-full resize-none rounded-lg border border-[#ddd0c6] bg-white px-3 py-3 text-sm leading-6 text-[#4c3b33] outline-none focus:border-[#8a4a42]"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-[#9b8a80]">{tributeText.length}/1000</span>
                    <Button size="sm" onClick={handlePostTribute} isLoading={tributeBusy} disabled={!tributeText.trim()}>
                      <Send className="mr-2 h-3.5 w-3.5" />Post to profile
                    </Button>
                  </div>
                  {tributeError && <p className="mt-2 text-xs text-rose-600">{tributeError}</p>}
                </div>
              ) : !isAuthenticated ? (
                <div className="mt-5 rounded-xl border border-[#e5d9cf] bg-[#faf6f2] p-4 text-sm text-[#75645c]">
                  <Lock className="mr-2 inline h-4 w-4" />
                  <Link href={`/login?callbackUrl=/person/${id}`} className="font-semibold text-[#742825] hover:underline">Sign in</Link> to leave a family message.
                </div>
              ) : null}

              <div className="mt-5 space-y-3">
                {tributes.map((tribute) => (
                  <article key={tribute.id} className="rounded-xl border border-[#eadfd6] bg-[#fcf9f6] p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <Avatar src={tribute.authorImage || undefined} name={tribute.authorName || 'Family member'} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap text-sm leading-6 text-[#57473f]">“{tribute.content}”</p>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-[#8f7c71]">— {tribute.authorName || 'Family member'} · {format(new Date(tribute.createdAt), 'MMM d, yyyy')}</p>
                          {(tribute.authorId === user?.id || user?.role === 'ADMIN') && (
                            <button type="button" onClick={() => handleDeleteTribute(tribute.id)} className="inline-flex items-center gap-1 text-[11px] text-[#aa7770] hover:text-rose-700">
                              <Trash2 className="h-3 w-3" />Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
                {tributes.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[#e2d5ca] px-5 py-7 text-center text-sm text-[#8a7970]">No family messages have been shared yet.</div>
                )}
              </div>
            </Card>
          </main>

          <aside className="space-y-6">
            {!person.userId && (
              <Card className="border-[#dfd2c6] bg-[#fffdf9]">
                <h3 className="font-serif text-xl font-semibold text-[#382a24]">Is this you?</h3>
                <p className="mt-2 text-sm leading-6 text-[#75655d]">Claim this family-tree entry to manage your own details, profile photo and receive private messages from relatives.</p>
                {isAuthenticated ? (
                  user?.linkedPersonId ? (
                    <p className="mt-4 rounded-lg bg-[#f6efe9] p-3 text-xs text-[#7a665c]">Your account is already linked to another family profile.</p>
                  ) : (
                    <Button className="mt-4" fullWidth onClick={handleClaimProfile} isLoading={claimBusy}><UserCheck className="mr-2 h-4 w-4" />This is me</Button>
                  )
                ) : (
                  <Link href={`/register?claimPersonId=${id}&name=${encodeURIComponent(fullName)}`} className="mt-4 block"><Button fullWidth><UserCheck className="mr-2 h-4 w-4" />Join & claim profile</Button></Link>
                )}
              </Card>
            )}

            {person.userId && person.userId !== user?.id && (
              <Card className="border-[#dfd2c6] bg-[#fffdf9]">
                <h3 className="font-serif text-xl font-semibold text-[#382a24]">Connect</h3>
                <p className="mt-2 text-sm text-[#75655d]">{person.firstName} has an active profile and can receive private family messages.</p>
                {isAuthenticated ? (
                  <Button className="mt-4" fullWidth onClick={() => router.push(`/messages?userId=${person.userId}`)}><MessageSquare className="mr-2 h-4 w-4" />Send message</Button>
                ) : (
                  <Link href={`/login?callbackUrl=/person/${id}`} className="mt-4 block"><Button variant="outline" fullWidth>Sign in to message</Button></Link>
                )}
              </Card>
            )}

            <RelationshipCard title="Parents" icon={<Users className="h-4 w-4" />} people={parents} />
            <RelationshipCard title="Spouse(s)" icon={<Heart className="h-4 w-4" />} people={spouses} />
            <RelationshipCard title={`Children${children.length ? ` (${children.length})` : ''}`} icon={<Users className="h-4 w-4" />} people={children} />
          </aside>
        </div>
      </div>
    </div>
  );
}

function ProfileFact({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail?: string }) {
  return (
    <div className="border-b border-[#eee4dc] p-5 sm:border-b-0 sm:border-r last:border-r-0">
      <div className="flex items-center gap-2 text-[#956b58]">{icon}<span className="text-[10px] font-semibold uppercase tracking-[0.12em]">{label}</span></div>
      <p className="mt-2 text-sm font-semibold text-[#43332c]">{value}</p>
      {detail && <p className="mt-0.5 text-[11px] text-[#948279]">{detail}</p>}
    </div>
  );
}

function RelationshipCard({ title, icon, people }: { title: string; icon: React.ReactNode; people: RelatedPerson[] }) {
  if (people.length === 0) return null;
  return (
    <Card className="border-[#e3d7cd] bg-[#fffdf9]">
      <div className="flex items-center gap-2 text-[#6d554a]">{icon}<h3 className="font-serif text-lg font-semibold text-[#382a24]">{title}</h3></div>
      <div className="mt-3 space-y-1">
        {people.map((person) => (
          <Link key={person.id} href={`/person/${person.id}`} className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-[#f8f3ee]">
            <Avatar src={person.profileImage?.url} name={`${person.firstName} ${person.lastName}`} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#493831]">{person.firstName} {person.lastName}</p>
              <p className="text-[11px] text-[#99887e]">{person.isLiving === false ? 'Deceased' : 'Family member'}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-[#b5a79e]" />
          </Link>
        ))}
      </div>
    </Card>
  );
}

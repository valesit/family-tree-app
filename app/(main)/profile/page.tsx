'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import useSWR from 'swr';
import { format } from 'date-fns';
import { Avatar, Button, Card, Input } from '@/components/ui';
import {
  passwordChangeSchema,
  PasswordChangeInput,
  profileSchema,
  ProfileInput,
} from '@/lib/validators';
import {
  AlertCircle,
  Briefcase,
  CalendarDays,
  Camera,
  CheckCircle,
  Heart,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Shield,
  User,
  Users,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type LinkedPerson = {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  maidenName: string | null;
  nickname: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathPlace: string | null;
  biography: string | null;
  occupation: string | null;
  isLiving: boolean;
  profileImage: { id: string; url: string } | null;
  tributeCount: number;
  _count: {
    parentRelations: number;
    childRelations: number;
    spouseRelations1: number;
    spouseRelations2: number;
    images: number;
  };
};

type ProfileResponse = {
  success: boolean;
  data: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    image: string | null;
    whatsappOptIn: boolean;
    role: 'ADMIN' | 'MEMBER' | 'VIEWER';
    linkedPerson: LinkedPerson | null;
  };
};

type Tribute = {
  id: string;
  content: string;
  authorId: string;
  authorName: string | null;
  authorImage: string | null;
  createdAt: string;
};

function ageFromBirthDate(value: string | null) {
  if (!value) return null;
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export default function ProfilePage() {
  const { update } = useSession();
  const [activeSection, setActiveSection] = useState<'family' | 'account' | 'security'>('family');
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: profileData, mutate: refreshProfile, isLoading } = useSWR<ProfileResponse>(
    '/api/auth/profile',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 0 }
  );
  const linkedPerson = profileData?.data?.linkedPerson ?? null;

  const { data: tributeData } = useSWR<{ success: boolean; data: Tribute[] }>(
    linkedPerson ? `/api/persons/${linkedPerson.id}/tributes` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, refreshInterval: 0 }
  );

  const profileForm = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', email: '', phone: '', whatsappOptIn: false },
    values: profileData?.data
      ? {
          name: profileData.data.name || '',
          email: profileData.data.email || '',
          phone: profileData.data.phone || '',
          whatsappOptIn: profileData.data.whatsappOptIn,
        }
      : undefined,
  });

  const passwordForm = useForm<PasswordChangeInput>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  const phoneValue = profileForm.watch('phone');
  const age = useMemo(() => ageFromBirthDate(linkedPerson?.birthDate ?? null), [linkedPerson?.birthDate]);
  const spouseCount = linkedPerson
    ? linkedPerson._count.spouseRelations1 + linkedPerson._count.spouseRelations2
    : 0;

  const handleAccountUpdate = async (data: ProfileInput) => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Could not update account');
      await update({ name: data.name, phone: data.phone });
      await refreshProfile();
      setMessage({ type: 'success', text: 'Account settings saved.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not update account.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (data: PasswordChangeInput) => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || 'Could not change password');
      passwordForm.reset();
      setMessage({ type: 'success', text: 'Password changed successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not change password.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !linkedPerson) return;

    const valid = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!valid.includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Choose a JPEG, PNG, GIF or WebP image smaller than 5MB.' });
      return;
    }

    setPhotoBusy(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('personId', linkedPerson.id);
      formData.append('isProfile', 'true');
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Could not upload photo');
      await update({ image: result.data.url });
      await refreshProfile();
      setMessage({ type: 'success', text: 'Profile photo updated.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not upload photo.' });
    } finally {
      setPhotoBusy(false);
    }
  };

  if (isLoading || !profileData?.data) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-[#7f6e65]">Loading your profile…</div>;
  }

  const sections = [
    { id: 'family' as const, label: 'My Family Profile', icon: User },
    { id: 'account' as const, label: 'Account & Privacy', icon: Shield },
    { id: 'security' as const, label: 'Security', icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-[#fbf9f5] py-8 sm:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a735f]">Family account</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-[#382a24]">My Profile</h1>
          <p className="mt-1 text-sm text-[#7d6e66]">Your family identity, personal details and account preferences in one place.</p>
        </div>

        {message && (
          <div className={`mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        <div className="grid gap-7 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside>
            <Card className="border-[#e3d7cd] bg-[#fffdf9]" padding="sm">
              <div className="space-y-1">
                {sections.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveSection(id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition ${activeSection === id ? 'bg-[#f2e7df] text-[#6f2e2a]' : 'text-[#6f625b] hover:bg-[#f8f3ee]'}`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
                <div className="my-2 h-px bg-[#eee4dc]" />
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </Card>
          </aside>

          <section>
            {activeSection === 'family' && (
              linkedPerson ? (
                <div className="space-y-6">
                  <Card className="overflow-hidden border-[#dfd2c6] bg-[#fffdf9]" padding="none">
                    <div className="border-b border-[#e6dad0] bg-gradient-to-r from-[#f3e7de] via-[#fbf6f1] to-[#fffdf9] p-6 sm:p-8">
                      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                        <div className="relative w-fit">
                          <Avatar
                            src={linkedPerson.profileImage?.url || profileData.data.image || undefined}
                            name={`${linkedPerson.firstName} ${linkedPerson.lastName}`}
                            size="2xl"
                            className="ring-4 ring-[#fffaf6] shadow-md"
                          />
                          <button
                            type="button"
                            disabled={photoBusy}
                            onClick={() => photoInputRef.current?.click()}
                            className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-[#fffdf9] bg-[#701f1d] text-white shadow-md hover:bg-[#5f1918] disabled:opacity-50"
                            aria-label="Change profile photo"
                          >
                            <Camera className="h-4 w-4" />
                          </button>
                          <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            className="hidden"
                            onChange={handlePhotoChange}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8e6856]">Claimed family profile</p>
                          <h2 className="mt-1 font-serif text-3xl font-semibold text-[#382a24]">
                            {linkedPerson.firstName} {linkedPerson.middleName ? `${linkedPerson.middleName} ` : ''}{linkedPerson.lastName}
                          </h2>
                          {linkedPerson.nickname && <p className="mt-1 text-sm italic text-[#8b7468]">“{linkedPerson.nickname}”</p>}
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Link href={`/person/${linkedPerson.id}/edit`}>
                              <Button size="sm"><Pencil className="mr-2 h-4 w-4" />Edit my profile</Button>
                            </Link>
                            <Link href={`/person/${linkedPerson.id}`}>
                              <Button variant="outline" size="sm">View public profile</Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-4">
                      <ProfileFact icon={<CalendarDays className="h-4 w-4" />} label="Birthday" value={linkedPerson.birthDate ? format(new Date(linkedPerson.birthDate), 'MMMM d, yyyy') : 'Not added'} subvalue={age !== null && linkedPerson.isLiving ? `${age} years old` : undefined} />
                      <ProfileFact icon={<MapPin className="h-4 w-4" />} label="Birthplace" value={linkedPerson.birthPlace || 'Not added'} />
                      <ProfileFact icon={<Briefcase className="h-4 w-4" />} label="Occupation" value={linkedPerson.occupation || 'Not added'} />
                      <ProfileFact icon={<Heart className="h-4 w-4" />} label="Family messages" value={`${linkedPerson.tributeCount}`} subvalue={linkedPerson.tributeCount === 1 ? 'message from family' : 'messages from family'} />
                    </div>
                  </Card>

                  <div className="grid gap-6 md:grid-cols-2">
                    <Card className="border-[#e3d7cd] bg-[#fffdf9]">
                      <h3 className="font-serif text-xl font-semibold text-[#382a24]">About me</h3>
                      <p className="mt-3 text-sm leading-7 text-[#74645b]">
                        {linkedPerson.biography || 'Your biography has not been added yet. Use Edit my profile to tell your family a little about your story.'}
                      </p>
                    </Card>

                    <Card className="border-[#e3d7cd] bg-[#fffdf9]">
                      <h3 className="font-serif text-xl font-semibold text-[#382a24]">My family record</h3>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <CountTile label="Parents recorded" value={linkedPerson._count.parentRelations} icon={<Users className="h-4 w-4" />} />
                        <CountTile label="Spouse records" value={spouseCount} icon={<Heart className="h-4 w-4" />} />
                        <CountTile label="Children recorded" value={linkedPerson._count.childRelations} icon={<Users className="h-4 w-4" />} />
                        <CountTile label="Photos" value={linkedPerson._count.images} icon={<Camera className="h-4 w-4" />} />
                      </div>
                    </Card>
                  </div>

                  <Card className="border-[#e3d7cd] bg-[#fffdf9]">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a735f]">From the family</p>
                        <h3 className="mt-1 font-serif text-xl font-semibold text-[#382a24]">{linkedPerson.isLiving ? 'Gratitude & encouragement' : 'In memory'}</h3>
                      </div>
                      <Link href={`/person/${linkedPerson.id}#tributes`} className="text-xs font-semibold text-[#742825] hover:underline">View all</Link>
                    </div>
                    <div className="mt-4 space-y-3">
                      {(tributeData?.data ?? []).slice(0, 3).map((tribute) => (
                        <div key={tribute.id} className="rounded-xl border border-[#eadfd6] bg-[#fcf8f4] p-4">
                          <p className="text-sm leading-6 text-[#58483f]">“{tribute.content}”</p>
                          <p className="mt-2 text-xs text-[#907b70]">— {tribute.authorName || 'Family member'}</p>
                        </div>
                      ))}
                      {(tributeData?.data ?? []).length === 0 && (
                        <p className="rounded-xl border border-dashed border-[#e5d8ce] px-4 py-5 text-sm text-[#8b7b72]">No family messages have been posted yet.</p>
                      )}
                    </div>
                  </Card>
                </div>
              ) : (
                <Card className="border-[#dfd2c6] bg-[#fffdf9]">
                  <div className="mx-auto max-w-xl py-8 text-center">
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#f1e6de] text-[#742825]"><User className="h-7 w-7" /></div>
                    <h2 className="mt-5 font-serif text-2xl font-semibold text-[#382a24]">Link your family profile</h2>
                    <p className="mt-2 text-sm leading-6 text-[#796961]">Find yourself in the family tree and choose <strong>This is Me</strong>. Once linked, this page becomes your family profile where you can manage your photo and personal details.</p>
                    <Link href="/tree" className="mt-5 inline-block"><Button>Find me in the tree</Button></Link>
                  </div>
                </Card>
              )
            )}

            {activeSection === 'account' && (
              <Card className="border-[#e3d7cd] bg-[#fffdf9]">
                <h2 className="font-serif text-2xl font-semibold text-[#382a24]">Account & privacy</h2>
                <p className="mt-1 text-sm text-[#7d6e66]">These settings control sign-in and how relatives can contact you.</p>
                <form onSubmit={profileForm.handleSubmit(handleAccountUpdate)} className="mt-6 space-y-4">
                  <Input label="Account name" leftIcon={<User className="h-4 w-4" />} {...profileForm.register('name')} error={profileForm.formState.errors.name?.message} />
                  <Input label="Email address" type="email" leftIcon={<Mail className="h-4 w-4" />} {...profileForm.register('email')} error={profileForm.formState.errors.email?.message} />
                  <Input label="Phone number" type="tel" leftIcon={<Phone className="h-4 w-4" />} {...profileForm.register('phone')} error={profileForm.formState.errors.phone?.message} />
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e4d8ce] bg-[#faf5f0] p-4">
                    <input type="checkbox" disabled={!phoneValue} className="mt-1 h-4 w-4" {...profileForm.register('whatsappOptIn')} />
                    <span>
                      <span className="flex items-center gap-2 text-sm font-semibold text-[#4c3b33]"><MessageCircle className="h-4 w-4" />Allow family members to contact me via WhatsApp</span>
                      <span className="mt-1 block text-xs leading-5 text-[#84736a]">Your phone number is only exposed to signed-in family members when this is enabled.</span>
                    </span>
                  </label>
                  <div className="pt-2"><Button type="submit" isLoading={saving}>Save account settings</Button></div>
                </form>
              </Card>
            )}

            {activeSection === 'security' && (
              <Card className="border-[#e3d7cd] bg-[#fffdf9]">
                <h2 className="font-serif text-2xl font-semibold text-[#382a24]">Security</h2>
                <p className="mt-1 text-sm text-[#7d6e66]">Change the password used to access your account.</p>
                <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)} className="mt-6 space-y-4">
                  <Input label="Current password" type="password" leftIcon={<Lock className="h-4 w-4" />} {...passwordForm.register('currentPassword')} error={passwordForm.formState.errors.currentPassword?.message} />
                  <Input label="New password" type="password" leftIcon={<Lock className="h-4 w-4" />} {...passwordForm.register('newPassword')} error={passwordForm.formState.errors.newPassword?.message} />
                  <Input label="Confirm new password" type="password" leftIcon={<Lock className="h-4 w-4" />} {...passwordForm.register('confirmNewPassword')} error={passwordForm.formState.errors.confirmNewPassword?.message} />
                  <div className="pt-2"><Button type="submit" isLoading={saving}>Update password</Button></div>
                </form>
              </Card>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ProfileFact({ icon, label, value, subvalue }: { icon: React.ReactNode; label: string; value: string; subvalue?: string }) {
  return (
    <div className="border-b border-[#eee4dc] p-5 sm:border-b-0 sm:border-r last:border-r-0">
      <div className="flex items-center gap-2 text-[#956b58]">{icon}<span className="text-[10px] font-semibold uppercase tracking-[0.12em]">{label}</span></div>
      <p className="mt-2 text-sm font-semibold text-[#43332c]">{value}</p>
      {subvalue && <p className="mt-0.5 text-[11px] text-[#948279]">{subvalue}</p>}
    </div>
  );
}

function CountTile({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#eadfd6] bg-[#faf6f2] p-4">
      <div className="flex items-center gap-2 text-[#956b58]">{icon}<span className="text-xs text-[#7e6d64]">{label}</span></div>
      <p className="mt-2 font-serif text-2xl font-semibold text-[#382a24]">{value}</p>
    </div>
  );
}

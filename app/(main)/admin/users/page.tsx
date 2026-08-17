'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { Card, Button, Avatar, Badge, Input } from '@/components/ui';
import { SessionUser } from '@/types';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Lock,
  Search,
  Trash2,
  ShieldCheck,
  Mail,
  Phone,
  UserX,
  Crown,
} from 'lucide-react';
import { format } from 'date-fns';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  createdAt: string;
  whatsappOptIn: boolean;
  linkedPerson: { id: string; firstName: string; lastName: string } | null;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const me = session?.user as SessionUser | undefined;
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR<{
    success: boolean;
    data: AdminUser[];
    error?: string;
  }>(status === 'authenticated' && me?.role === 'ADMIN' ? '/api/admin/users' : null, fetcher, {
    revalidateOnFocus: false,
  });

  // Auth gate — render-time check first, server still enforces.
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="w-8 h-8 text-maroon-500 animate-spin" />
      </div>
    );
  }
  if (status !== 'authenticated' || me?.role !== 'ADMIN') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Card className="max-w-md text-center">
          <div className="w-12 h-12 mx-auto bg-amber-100 rounded-full flex items-center justify-center mb-3">
            <Lock className="w-6 h-6 text-amber-600" />
          </div>
          <h2 className="font-semibold text-slate-900">Admin access required</h2>
          <p className="text-sm text-slate-600 mt-1">
            Only System Admins can view and manage user accounts.
          </p>
          <div className="mt-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                Back home
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const users = data?.data ?? [];
  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter((u) => {
        const haystack = [
          u.name ?? '',
          u.email ?? '',
          u.phone ?? '',
          u.linkedPerson ? `${u.linkedPerson.firstName} ${u.linkedPerson.lastName}` : '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
    : users;

  const adminCount = users.filter((u) => u.role === 'ADMIN').length;

  const handleDelete = async (u: AdminUser) => {
    const label = u.name || u.email || u.phone || 'this user';
    const isMe = u.id === me?.id;
    if (isMe) {
      alert('You cannot delete your own account here. Ask another admin to remove it.');
      return;
    }
    if (u.role === 'ADMIN' && adminCount <= 1) {
      alert('Cannot delete the last System Admin — promote someone else first.');
      return;
    }

    const typed = window.prompt(
      `Permanently delete the account "${label}"?\n\n` +
        `This removes their login, sessions, notifications, and family memberships. ` +
        `Their family-tree profile (if any) stays — only the login is removed.\n\n` +
        `Type "${label}" to confirm:`
    );
    if (typed === null) return;
    if (typed.trim() !== label) {
      alert('Name did not match — deletion cancelled.');
      return;
    }

    setDeletingId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) {
        alert(result.error || 'Failed to delete user');
        return;
      }
      await mutate();
    } catch (err) {
      console.error('delete user', err);
      alert('Failed to delete user. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-3"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </button>
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck className="w-6 h-6 text-maroon-600" />
            <h1 className="font-serif text-2xl font-semibold text-slate-900 sm:text-3xl">
              User Accounts
            </h1>
          </div>
          <p className="text-sm text-slate-600">
            {users.length} account{users.length === 1 ? '' : 's'}, {adminCount} admin
            {adminCount === 1 ? '' : 's'}. Removing an account does not delete their family-tree
            profile.
          </p>
        </div>

        {/* Search */}
        <Card className="mb-4" padding="sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone, or linked person..."
              className="pl-10"
            />
          </div>
        </Card>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-7 h-7 text-maroon-500 animate-spin" />
          </div>
        ) : error || !data?.success ? (
          <Card className="border-rose-200 bg-rose-50">
            <div className="flex items-start gap-3 text-rose-700">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm">{data?.error || 'Failed to load users'}</p>
            </div>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <UserX className="w-8 h-8 text-slate-300" />
              <p className="text-sm text-slate-600">
                {q ? 'No accounts match your search.' : 'No user accounts yet.'}
              </p>
            </div>
          </Card>
        ) : (
          <Card padding="sm">
            <ul className="divide-y divide-slate-100">
              {filtered.map((u) => {
                const isMe = u.id === me?.id;
                const isLastAdmin = u.role === 'ADMIN' && adminCount <= 1;
                const cannotDelete = isMe || isLastAdmin;
                const cannotDeleteReason = isMe
                  ? 'This is your own account'
                  : isLastAdmin
                  ? 'Last remaining System Admin'
                  : '';
                return (
                  <li key={u.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <Avatar src={u.image} name={u.name || 'User'} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-900 truncate">
                          {u.name || <span className="italic text-slate-400">(no name)</span>}
                        </p>
                        {u.role === 'ADMIN' && (
                          <Badge variant="warning" className="inline-flex items-center gap-1">
                            <Crown className="w-3 h-3" /> Admin
                          </Badge>
                        )}
                        {isMe && <Badge variant="default">You</Badge>}
                        {u.whatsappOptIn && u.phone && (
                          <Badge variant="success">WhatsApp</Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 flex-wrap text-xs text-slate-500">
                        {u.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {u.email}
                          </span>
                        )}
                        {u.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {u.phone}
                          </span>
                        )}
                        <span>Joined {format(new Date(u.createdAt), 'MMM d, yyyy')}</span>
                      </div>
                      {u.linkedPerson ? (
                        <p className="mt-1 text-xs text-slate-600">
                          Linked to{' '}
                          <Link
                            href={`/person/${u.linkedPerson.id}`}
                            className="text-maroon-700 hover:underline font-medium"
                          >
                            {u.linkedPerson.firstName} {u.linkedPerson.lastName}
                          </Link>
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400 italic">No linked person</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(u)}
                        disabled={cannotDelete || deletingId === u.id}
                        isLoading={deletingId === u.id}
                        title={cannotDeleteReason || `Delete ${u.name || u.email}`}
                        className="border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" />
                        Delete
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

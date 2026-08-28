'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { MessageInput, MessageList } from '@/components/messages';
import { Avatar, Input } from '@/components/ui';
import { MessageWithUsers, SessionUser } from '@/types';
import {
  Circle,
  Loader2,
  MessageSquare,
  Phone,
  Search,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ContactUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

type RecentContact = {
  user: ContactUser;
  lastMessage: {
    content: string;
    createdAt: string;
    isRead: boolean;
  };
};

type AvailableContact = {
  id: string;
  name: string;
  image: string | null;
  phone: string | null;
  whatsappOptIn: boolean;
  personId: string;
};

function MessagesContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const preselectedUserId = searchParams.get('userId');
  const user = session?.user as SessionUser | undefined;

  const [selectedContact, setSelectedContact] = useState<AvailableContact | null>(null);
  const [conversationSearch, setConversationSearch] = useState('');
  const [directorySearch, setDirectorySearch] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);

  const { data: inboxData, mutate: refreshInbox } = useSWR<{
    success: boolean;
    data: {
      directMessages: RecentContact[];
      availableContacts: AvailableContact[];
    };
  }>('/api/messages', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 0,
  });

  const { data: messagesData, mutate: refreshMessages } = useSWR<{
    success: boolean;
    data: MessageWithUsers[];
    error?: string;
  }>(selectedContact ? `/api/messages?userId=${selectedContact.id}` : null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 0,
  });

  const contacts = inboxData?.data?.availableContacts ?? [];
  const recent = inboxData?.data?.directMessages ?? [];
  const messages = messagesData?.data ?? [];

  const preselectAppliedRef = useRef(false);
  useEffect(() => {
    if (preselectAppliedRef.current || !preselectedUserId || contacts.length === 0) return;
    const match = contacts.find((contact) => contact.id === preselectedUserId);
    if (!match) return;
    preselectAppliedRef.current = true;
    setSelectedContact(match);
  }, [preselectedUserId, contacts]);

  const recentById = useMemo(() => {
    const map = new Map(recent.map((entry) => [entry.user.id, entry]));
    return map;
  }, [recent]);

  const filteredRecent = useMemo(() => {
    const q = conversationSearch.trim().toLowerCase();
    const rows = contacts
      .filter((contact) => recentById.has(contact.id))
      .map((contact) => ({ contact, recent: recentById.get(contact.id)! }));
    if (!q) return rows;
    return rows.filter(({ contact }) => contact.name.toLowerCase().includes(q));
  }, [contacts, recentById, conversationSearch]);

  const filteredDirectory = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((contact) => contact.name.toLowerCase().includes(q));
  }, [contacts, directorySearch]);

  const handleSendMessage = async (content: string) => {
    if (!selectedContact) return;
    setSendError(null);

    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, receiverId: selectedContact.id }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success) {
      setSendError(result?.error || 'Message could not be sent.');
      return;
    }

    await Promise.all([refreshMessages(), refreshInbox()]);
  };

  const whatsappUrl = useMemo(() => {
    if (!selectedContact?.whatsappOptIn || !selectedContact.phone) return null;
    const digits = selectedContact.phone.replace(/[^\d]/g, '');
    if (!digits) return null;
    const firstName = selectedContact.name.split(' ')[0] || 'there';
    const greeting = encodeURIComponent(`Hi ${firstName}, reaching out via the family tree.`);
    return `https://wa.me/${digits}?text=${greeting}`;
  }, [selectedContact]);

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[#fbf9f5]">
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-[#e6dad0] bg-[#fffdf9]">
        <div className="border-b border-[#e6dad0] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b7664]">Family connections</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-[#382a24]">Messages</h1>
          <p className="mt-1 text-xs text-[#88776e]">Message relatives who have claimed an active family profile.</p>
        </div>

        <div className="border-b border-[#eee4dc] p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a99b92]" />
            <Input
              value={conversationSearch}
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder="Search conversations..."
              className="pl-10"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-[#eee4dc] p-3">
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#99867b]">Recent</p>
            {filteredRecent.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#e3d6cc] px-4 py-5 text-center text-xs text-[#97877d]">
                No conversations yet.
              </div>
            ) : (
              <div className="space-y-1">
                {filteredRecent.map(({ contact, recent: row }) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => setSelectedContact(contact)}
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                      selectedContact?.id === contact.id
                        ? 'bg-[#f3e9e1]'
                        : 'hover:bg-[#f8f3ee]'
                    }`}
                  >
                    <div className="relative">
                      <Avatar src={contact.image} name={contact.name} size="md" />
                      <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-emerald-500 text-emerald-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-[#43332c]">{contact.name}</span>
                        <span className="shrink-0 text-[10px] text-[#aa9b92]">
                          {format(new Date(row.lastMessage.createdAt), 'h:mm a')}
                        </span>
                      </div>
                      <p className="truncate text-xs text-[#88776e]">{row.lastMessage.content}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-3">
            <div className="mb-3 flex items-center gap-2 px-2">
              <Users className="h-4 w-4 text-[#855f4f]" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#99867b]">
                Family members ({contacts.length})
              </p>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#a99b92]" />
              <input
                value={directorySearch}
                onChange={(event) => setDirectorySearch(event.target.value)}
                placeholder="Find a relative..."
                className="w-full rounded-lg border border-[#dfd2c6] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#8b4b43]"
              />
            </div>
            <div className="space-y-1">
              {filteredDirectory.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => setSelectedContact(contact)}
                  className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-[#f8f3ee]"
                >
                  <Avatar src={contact.image} name={contact.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm text-[#514039]">{contact.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {selectedContact ? (
          <>
            <div className="flex h-16 items-center gap-4 border-b border-[#e6dad0] bg-[#fffdf9] px-6">
              <Avatar src={selectedContact.image} name={selectedContact.name} size="md" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-serif text-lg font-semibold text-[#382a24]">{selectedContact.name}</h2>
                <p className="text-xs text-[#8a756a]">Active family profile</p>
              </div>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  <Phone className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
              )}
            </div>

            {messagesData && !messagesData.success ? (
              <div className="m-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {messagesData.error || 'This conversation is not available.'}
              </div>
            ) : (
              <MessageList messages={messages} currentUserId={user?.id || ''} />
            )}

            {sendError && (
              <div className="mx-5 mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {sendError}
              </div>
            )}
            <MessageInput onSend={handleSendMessage} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-[#f0e5dd]">
                <MessageSquare className="h-9 w-9 text-[#7b433d]" />
              </div>
              <h2 className="font-serif text-2xl font-semibold text-[#382a24]">Stay connected with family</h2>
              <p className="mt-2 text-sm leading-6 text-[#806f66]">
                Choose any relative with an active claimed profile. Messages stay inside the family network.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function MessagesFallback() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-maroon-500" />
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<MessagesFallback />}>
      <MessagesContent />
    </Suspense>
  );
}

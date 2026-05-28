'use client';

import { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { MessageList, MessageInput, RelativeDiscovery } from '@/components/messages';
import { Avatar, Input } from '@/components/ui';
import { MessageWithUsers, SessionUser } from '@/types';
import {
  MessageSquare,
  Search,
  Loader2,
  Circle,
  Users,
  Phone,
} from 'lucide-react';
import { format } from 'date-fns';

const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Contact {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  lastMessage: {
    content: string;
    createdAt: string;
    isRead: boolean;
  };
}

interface FamilyPersonItem {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  user?: {
    id: string;
    name: string | null;
    image?: string | null;
    phone?: string | null;
    whatsappOptIn?: boolean;
  } | null;
}

function MessagesContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const preselectedUserId = searchParams.get('userId');

  const [selectedContact, setSelectedContact] = useState<Contact['user'] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [directorySearch, setDirectorySearch] = useState('');
  const [showDirectory, setShowDirectory] = useState(false);

  const user = session?.user as SessionUser | undefined;

  const { data: conversationsData, mutate: mutateConversations } = useSWR<{
    success: boolean;
    data: {
      conversations: unknown[];
      directMessages: Contact[];
    };
  }>('/api/messages', fetcher);

  const { data: messagesData, mutate: mutateMessages } = useSWR<{
    success: boolean;
    data: MessageWithUsers[];
  }>(
    selectedContact ? `/api/messages?userId=${selectedContact.id}` : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const { data: usersData } = useSWR<{
    success: boolean;
    data: { items: FamilyPersonItem[] };
  }>('/api/persons?limit=500', fetcher);

  // Pull selected contact's WhatsApp info if available
  const selectedContactPerson = useMemo(() => {
    if (!selectedContact || !usersData?.data?.items) return null;
    return usersData.data.items.find((p) => p.user?.id === selectedContact.id) ?? null;
  }, [selectedContact, usersData]);

  // Apply the `?userId=` URL preselection at most once per page load. We use a
  // ref-guarded effect (instead of inlining the lookup) because this needs to
  // wait until the persons list has loaded.
  const preselectAppliedRef = useRef(false);
  useEffect(() => {
    if (preselectAppliedRef.current) return;
    if (!preselectedUserId || !usersData?.data?.items) return;
    const person = usersData.data.items.find((p) => p.userId === preselectedUserId);
    if (!person?.user) return;
    preselectAppliedRef.current = true;
    setSelectedContact({
      id: person.user.id,
      name: person.user.name,
      email: null,
      image: person.user.image || null,
    });
  }, [preselectedUserId, usersData]);

  const handleSendMessage = async (content: string) => {
    if (!selectedContact) return;

    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        receiverId: selectedContact.id,
      }),
    });

    mutateMessages();
    mutateConversations();
  };

  const contacts = conversationsData?.data?.directMessages || [];
  const messages = messagesData?.data || [];

  const filteredContacts = contacts.filter(contact =>
    contact.user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /** Every family member with a linked account (other than me) — the directory of who can be DM'd. */
  const familyDirectory = useMemo(() => {
    const items = usersData?.data?.items ?? [];
    return items
      .filter((p) => p.user && p.user.id !== user?.id)
      .map((p) => ({
        id: p.user!.id,
        name: p.user!.name || `${p.firstName} ${p.lastName}`,
        image: p.user!.image || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [usersData, user?.id]);

  const filteredDirectory = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    if (!q) return familyDirectory;
    return familyDirectory.filter((p) => p.name.toLowerCase().includes(q));
  }, [directorySearch, familyDirectory]);

  const selectContactFromDirectory = (entry: { id: string; name: string; image: string | null }) => {
    setSelectedContact({
      id: entry.id,
      name: entry.name,
      email: null,
      image: entry.image,
    });
    setShowDirectory(false);
    setDirectorySearch('');
  };

  // Build a WhatsApp click-to-chat URL if the contact has opted in.
  const whatsappUrl = useMemo(() => {
    const phone = selectedContactPerson?.user?.phone;
    const optIn = selectedContactPerson?.user?.whatsappOptIn;
    if (!phone || !optIn) return null;
    // wa.me requires digits only (with country code, no '+').
    const digits = phone.replace(/[^\d]/g, '');
    if (!digits) return null;
    const greeting = encodeURIComponent(
      `Hi ${selectedContact?.name?.split(' ')[0] || ''}, reaching out via the family tree.`
    );
    return `https://wa.me/${digits}?text=${greeting}`;
  }, [selectedContactPerson, selectedContact?.name]);

  return (
    <div className="h-[calc(100vh-4rem)] bg-slate-50 flex">
      {/* Sidebar - Contact List */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h1 className="text-xl font-bold text-slate-900 mb-4">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredContacts.length === 0 ? (
            <div className="p-4 text-center text-slate-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a conversation with a family member</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredContacts.map((contact) => (
                <button
                  key={contact.user.id}
                  onClick={() => setSelectedContact(contact.user)}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors ${
                    selectedContact?.id === contact.user.id ? 'bg-maroon-50' : ''
                  }`}
                >
                  <div className="relative">
                    <Avatar
                      src={contact.user.image}
                      name={contact.user.name || 'User'}
                      size="md"
                    />
                    <Circle className="absolute -bottom-0.5 -right-0.5 w-3 h-3 text-maroon-500 fill-maroon-500" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-900 truncate">
                        {contact.user.name}
                      </p>
                      <span className="text-xs text-slate-400">
                        {format(new Date(contact.lastMessage.createdAt), 'h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 truncate">
                      {contact.lastMessage.content}
                    </p>
                  </div>
                  {!contact.lastMessage.isRead && (
                    <div className="w-2 h-2 bg-maroon-500 rounded-full" />
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="p-4 border-t border-slate-200">
            <RelativeDiscovery
              onStartConversation={(userId) => {
                const target = familyDirectory.find((u) => u.id === userId);
                if (target) {
                  selectContactFromDirectory(target);
                }
              }}
            />
          </div>

          {/* Family directory: every linked family member can be messaged. */}
          {familyDirectory.length > 0 && (
            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowDirectory((s) => !s)}
                className="w-full flex items-center justify-between mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700 transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" />
                  Message any family member ({familyDirectory.length})
                </span>
                <span className="text-slate-400">{showDirectory ? '−' : '+'}</span>
              </button>

              {showDirectory && (
                <>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={directorySearch}
                      onChange={(e) => setDirectorySearch(e.target.value)}
                      placeholder="Find a relative..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-maroon-400 focus:ring-1 focus:ring-maroon-400"
                    />
                  </div>
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {filteredDirectory.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">
                        No matching relatives
                      </p>
                    ) : (
                      filteredDirectory.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => selectContactFromDirectory(u)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <Avatar src={u.image} name={u.name} size="sm" />
                          <span className="text-sm text-slate-700 truncate">{u.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center gap-4">
              <Avatar
                src={selectedContact.image}
                name={selectedContact.name || 'User'}
                size="md"
              />
              <div className="flex-1">
                <h2 className="font-semibold text-slate-900">
                  {selectedContact.name}
                </h2>
                <p className="text-xs text-maroon-600">Family member</p>
              </div>

              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                  title={`Open WhatsApp chat with ${selectedContact.name}`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  WhatsApp
                </a>
              )}
            </div>

            <MessageList
              messages={messages}
              currentUserId={user?.id || ''}
            />

            <MessageInput onSend={handleSendMessage} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <div className="w-20 h-20 bg-maroon-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-10 h-10 text-maroon-500" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Your Messages
              </h2>
              <p className="text-slate-500 max-w-sm">
                Select a conversation, or open the family directory in the sidebar to message any
                relative who has joined the platform.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessagesFallback() {
  return (
    <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-maroon-500 animate-spin" />
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

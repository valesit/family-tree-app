'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { MessageList, MessageInput, RelativeDiscovery } from '@/components/messages';
import { Card, Avatar, Input } from '@/components/ui';
import { MessageWithUsers, SessionUser } from '@/types';
import { 
  MessageSquare, 
  Search, 
  Loader2,
  Circle,
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

function MessagesContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const preselectedUserId = searchParams.get('userId');

  const [selectedContact, setSelectedContact] = useState<Contact['user'] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const user = session?.user as SessionUser | undefined;

  // Fetch conversations list
  const { data: conversationsData, mutate: mutateConversations } = useSWR<{
    success: boolean;
    data: {
      conversations: unknown[];
      directMessages: Contact[];
    };
  }>('/api/messages', fetcher);

  // Fetch messages for selected contact
  const { data: messagesData, mutate: mutateMessages } = useSWR<{
    success: boolean;
    data: MessageWithUsers[];
  }>(
    selectedContact ? `/api/messages?userId=${selectedContact.id}` : null,
    fetcher,
    { refreshInterval: 5000 } // Poll for new messages
  );

  // Fetch users for new conversations
  const { data: usersData } = useSWR<{
    success: boolean;
    data: { items: Array<{ id: string; userId: string; firstName: string; lastName: string; user?: { id: string; name: string; image?: string } }> };
  }>('/api/persons?limit=100', fetcher);

  // Handle preselected user
  useEffect(() => {
    if (preselectedUserId && usersData?.data?.items) {
      const person = usersData.data.items.find(p => p.userId === preselectedUserId);
      if (person?.user) {
        setSelectedContact({
          id: person.user.id,
          name: person.user.name,
          email: null,
          image: person.user.image || null,
        });
      }
    }
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

  // Filter contacts by search query
  const filteredContacts = contacts.filter(contact =>
    contact.user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get available users for new conversations
  const availableUsers = usersData?.data?.items
    ?.filter(p => p.user && p.userId !== user?.id)
    ?.map(p => ({
      id: p.user!.id,
      name: p.user!.name || `${p.firstName} ${p.lastName}`,
      image: p.user!.image,
    })) || [];

  return (
    <div className="h-[calc(100vh-4rem)] bg-slate-50 flex">
      {/* Sidebar - Contact List */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
        {/* Header */}
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

        {/* Contacts list */}
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

          {/* Relative Discovery */}
          <div className="p-4 border-t border-slate-200">
            <RelativeDiscovery
              onStartConversation={(userId) => {
                // Find the user from the available users
                const targetUser = availableUsers.find(u => u.id === userId);
                if (targetUser) {
                  setSelectedContact({
                    id: targetUser.id,
                    name: targetUser.name,
                    email: null,
                    image: targetUser.image || null,
                  });
                }
              }}
            />
          </div>

          {/* New conversation section */}
          {availableUsers.length > 0 && (
            <div className="p-4 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Start New Conversation
              </p>
              <div className="space-y-2">
                {availableUsers.slice(0, 5).map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedContact({
                      id: u.id,
                      name: u.name,
                      email: null,
                      image: u.image || null,
                    })}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Avatar
                      src={u.image}
                      name={u.name}
                      size="sm"
                    />
                    <span className="text-sm text-slate-700">{u.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            {/* Chat header */}
            <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center gap-4">
              <Avatar
                src={selectedContact.image}
                name={selectedContact.name || 'User'}
                size="md"
              />
              <div>
                <h2 className="font-semibold text-slate-900">
                  {selectedContact.name}
                </h2>
                <p className="text-xs text-maroon-600">Online</p>
              </div>
            </div>

            {/* Messages */}
            <MessageList
              messages={messages}
              currentUserId={user?.id || ''}
            />

            {/* Input */}
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
                Select a conversation from the sidebar or start a new one with a family member.
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

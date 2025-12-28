'use client';

import { useRef, useEffect } from 'react';
import { MessageWithUsers } from '@/types';
import { Avatar } from '@/components/ui';
import { format, isToday, isYesterday } from 'date-fns';
import { clsx } from 'clsx';

interface MessageListProps {
  messages: MessageWithUsers[];
  currentUserId: string;
}

function formatMessageDate(date: Date): string {
  if (isToday(date)) {
    return format(date, 'h:mm a');
  }
  if (isYesterday(date)) {
    return `Yesterday ${format(date, 'h:mm a')}`;
  }
  return format(date, 'MMM d, h:mm a');
}

export function MessageList({ messages, currentUserId }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <p>No messages yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message, index) => {
        const isOwn = message.senderId === currentUserId;
        const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;

        return (
          <div
            key={message.id}
            className={clsx(
              'flex items-end gap-2',
              isOwn ? 'flex-row-reverse' : 'flex-row'
            )}
          >
            {showAvatar && !isOwn ? (
              <Avatar
                src={message.sender.image}
                name={message.sender.name || 'User'}
                size="sm"
              />
            ) : (
              <div className="w-8" />
            )}

            <div
              className={clsx(
                'max-w-[70%] rounded-2xl px-4 py-2',
                isOwn
                  ? 'bg-emerald-500 text-white rounded-br-md'
                  : 'bg-slate-100 text-slate-900 rounded-bl-md'
              )}
            >
              {!isOwn && showAvatar && (
                <p className="text-xs font-medium text-slate-500 mb-1">
                  {message.sender.name}
                </p>
              )}
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </p>
              <p
                className={clsx(
                  'text-[10px] mt-1',
                  isOwn ? 'text-emerald-100' : 'text-slate-400'
                )}
              >
                {formatMessageDate(new Date(message.createdAt))}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}


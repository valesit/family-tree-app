'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';
import { Card, Badge } from '@/components/ui';
import { Notification } from '@/types';
import { format, formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const notificationIcons: Record<string, string> = {
  APPROVAL_REQUEST: '📋',
  APPROVAL_GRANTED: '✅',
  APPROVAL_REJECTED: '❌',
  CORRECTION_REQUEST: '📝',
  CORRECTION_RESOLVED: '✔️',
  NEW_MESSAGE: '💬',
  NEW_FAMILY_MEMBER: '👥',
  WELCOME: '👋',
};

const notificationLinks: Record<string, (data: { changeId?: string; personId?: string; senderId?: string }) => string> = {
  APPROVAL_REQUEST: () => '/approvals',
  APPROVAL_GRANTED: () => '/approvals?type=mine',
  APPROVAL_REJECTED: () => '/approvals?type=mine',
  CORRECTION_REQUEST: () => '/corrections',
  CORRECTION_RESOLVED: () => '/corrections?type=mine',
  NEW_MESSAGE: (data) => data.senderId ? `/messages?userId=${data.senderId}` : '/messages',
  NEW_FAMILY_MEMBER: (data) => data.personId ? `/person/${data.personId}` : '/tree',
  WELCOME: () => '/tree',
};

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);

  const { data, mutate } = useSWR<{
    success: boolean;
    data: {
      notifications: Notification[];
      unreadCount: number;
    };
  }>('/api/notifications?limit=10', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
  });

  const notifications = data?.data?.notifications || [];
  const unreadCount = data?.data?.unreadCount || 0;

  const markAllAsRead = async () => {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    mutate();
  };

  const markAsRead = async (notificationIds: string[]) => {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds }),
    });
    mutate();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-rose-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                >
                  <CheckCheck className="w-4 h-4" />
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications list */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Bell className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {notifications.map((notification) => {
                    const notificationData = notification.data as { changeId?: string; personId?: string; senderId?: string } | null;
                    const linkFn = notificationLinks[notification.type];
                    const link = linkFn ? linkFn(notificationData || {}) : '#';

                    return (
                      <Link
                        key={notification.id}
                        href={link}
                        onClick={() => {
                          if (!notification.isRead) {
                            markAsRead([notification.id]);
                          }
                          setIsOpen(false);
                        }}
                        className={clsx(
                          'block px-4 py-3 hover:bg-slate-50 transition-colors',
                          !notification.isRead && 'bg-emerald-50/50'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl">
                            {notificationIcons[notification.type] || '📌'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={clsx(
                              'text-sm',
                              notification.isRead ? 'text-slate-600' : 'text-slate-900 font-medium'
                            )}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2" />
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                View all notifications
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


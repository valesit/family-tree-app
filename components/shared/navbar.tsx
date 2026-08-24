'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import useSWR from 'swr';
import { clsx } from 'clsx';
import {
  TreePine,
  MessageSquare,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Plus,
  LogIn,
  UserPlus,
  Home,
  BookOpen,
  Images,
  ShieldCheck,
} from 'lucide-react';
import { Avatar } from '@/components/ui';
import { SessionUser } from '@/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type FamilyNavPreview = {
  id: string;
  familyName: string;
};

export function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const user = session?.user as SessionUser | undefined;
  const isAuthenticated = status === 'authenticated';
  const isLoading = status === 'loading';

  const { data: familiesData } = useSWR<{
    success: boolean;
    data: {
      families: FamilyNavPreview[];
      primaryFamilyId: string | null;
    };
  }>('/api/families', fetcher, { revalidateOnFocus: false });

  const primaryFamily = familiesData?.data?.families.find(
    (family) => family.id === familiesData?.data?.primaryFamilyId
  );
  const brandName = primaryFamily?.familyName || 'Family';

  const authNavItems = [
    { href: '/tree', label: 'Tree', icon: TreePine },
    { href: '/wiki', label: 'Stories', icon: BookOpen },
    { href: '/gallery', label: 'Gallery', icon: Images },
    { href: '/messages', label: 'Messages', icon: MessageSquare },
  ];

  const guestNavItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/wiki', label: 'Stories', icon: BookOpen },
    { href: '/gallery', label: 'Gallery', icon: Images },
  ];

  const navItems = isAuthenticated ? authNavItems : guestNavItems;

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-[#e8dfd6] bg-[#fffdf9]/95 shadow-[0_1px_0_rgba(84,57,43,0.03)] backdrop-blur-xl">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px_10px_14px_14px] bg-maroon-500 text-white shadow-sm">
              <TreePine className="h-5 w-5" />
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate font-serif text-sm font-bold uppercase tracking-[0.16em] text-[#3a2722]">
                {brandName}
              </span>
              <span className="block text-[9px] uppercase tracking-[0.18em] text-[#9a897f]">
                Family Archive
              </span>
            </span>
          </Link>

          <div className="hidden h-full items-stretch md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'relative flex h-full items-center gap-2 px-4 font-serif text-sm transition-colors',
                    isActive
                      ? 'font-semibold text-maroon-700'
                      : 'text-[#6e6058] hover:text-[#332720]'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {isActive && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-maroon-500" />}
                </Link>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isLoading ? (
              <div className="h-8 w-8 animate-pulse rounded-full bg-[#eee6df]" />
            ) : isAuthenticated ? (
              <>
                <Link
                  href="/tree"
                  aria-label="Search family tree"
                  className="hidden h-9 items-center gap-2 rounded-lg border border-[#e5d9ce] bg-white px-3 text-xs text-[#7a6a61] shadow-sm transition hover:bg-[#fffaf6] lg:flex"
                >
                  <Search className="h-4 w-4" />
                  <span>Search people...</span>
                </Link>

                <Link
                  href="/add-person"
                  className="hidden h-9 items-center gap-2 rounded-lg bg-maroon-500 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-maroon-600 sm:inline-flex"
                >
                  <Plus className="h-4 w-4" />
                  Add Person
                </Link>

                <button
                  className="relative grid h-9 w-9 place-items-center rounded-lg text-[#76675f] transition hover:bg-[#f5efe9] hover:text-[#3e3029]"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-maroon-500 ring-2 ring-[#fffdf9]" />
                </button>

                <div className="relative">
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center rounded-lg p-1 transition hover:bg-[#f5efe9]"
                    aria-label="Open profile menu"
                  >
                    <Avatar src={user?.image} name={user?.name || 'User'} size="sm" />
                  </button>

                  {isProfileOpen && (
                    <>
                      <button
                        type="button"
                        className="fixed inset-0 z-40 cursor-default"
                        onClick={() => setIsProfileOpen(false)}
                        aria-label="Close profile menu"
                      />
                      <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-[#e4d9d0] bg-[#fffdf9] py-2 shadow-[0_18px_50px_-24px_rgba(61,38,28,0.35)]">
                        <div className="border-b border-[#ece3dc] px-4 py-3">
                          <p className="font-serif font-semibold text-[#332720]">{user?.name}</p>
                          <p className="mt-0.5 truncate text-xs text-[#8a7b72]">
                            {user?.email || user?.phone}
                          </p>
                        </div>
                        <Link
                          href="/profile"
                          className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#66574f] hover:bg-[#f7f1eb]"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          <Settings className="h-4 w-4" />
                          <span>Settings</span>
                        </Link>
                        {user?.role === 'ADMIN' && (
                          <Link
                            href="/admin/users"
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-maroon-700 hover:bg-[#f7f1eb]"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            <ShieldCheck className="h-4 w-4" />
                            <span>Manage Users</span>
                          </Link>
                        )}
                        <button
                          onClick={() => signOut({ callbackUrl: '/' })}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#66574f] hover:bg-[#f7f1eb]"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#66574f] transition hover:bg-[#f5efe9] hover:text-[#332720]"
                >
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign In</span>
                </Link>
                <Link
                  href="/register"
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-maroon-500 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-maroon-600"
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Join</span>
                </Link>
              </>
            )}

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="grid h-9 w-9 place-items-center rounded-lg text-[#76675f] transition hover:bg-[#f5efe9] md:hidden"
              aria-label="Toggle navigation"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="border-t border-[#e8dfd6] bg-[#fffdf9] px-4 py-3 md:hidden">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={clsx(
                    'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium',
                    isActive
                      ? 'bg-[#f5efe9] text-maroon-700'
                      : 'text-[#66574f] hover:bg-[#f7f1eb]'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {isAuthenticated && (
              <Link
                href="/add-person"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-maroon-700 hover:bg-[#f7f1eb]"
              >
                <Plus className="h-5 w-5" />
                <span>Add Person</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
